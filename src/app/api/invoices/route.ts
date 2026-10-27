import { NextResponse, NextRequest } from "next/server";
import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const type = req.nextUrl.searchParams.get("type");
    const where: Prisma.InvoiceWhereInput = {};
    if (type && type !== "ALL") where.type = type;

    const invoices = await db.invoice.findMany({
      where,
      orderBy: [{ date: "desc" }, { number: "desc" }],
      take: 300,
      include: { contact: { select: { name: true } }, items: true },
    });

    const data = invoices.map((i) => ({
      id: i.id,
      number: i.number,
      type: i.type as "SALES" | "PURCHASE",
      contactId: i.contactId,
      contactName: i.contact.name,
      date: i.date.toISOString(),
      status: i.status,
      total: Math.round(i.total),
      taxRate: i.taxRate,
      taxAmount: Math.round(i.taxAmount),
      grandTotal: Math.round(i.grandTotal),
      entryId: i.entryId,
      notes: i.notes,
      items: i.items.map((it) => ({
        id: it.id,
        description: it.description,
        quantity: it.quantity,
        unitPrice: Math.round(it.unitPrice),
        total: Math.round(it.total),
      })),
    }));

    return NextResponse.json(data);
  } catch (err) {
    console.error("invoices error", err);
    return NextResponse.json({ error: "خطا در دریافت فاکتورها" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, contactId, date, items, taxRate = 10, notes, createEntry = true } = body ?? {};

    if (!["SALES", "PURCHASE"].includes(type)) {
      return NextResponse.json({ error: "نوع فاکتور نامعتبر است" }, { status: 400 });
    }
    if (!contactId) return NextResponse.json({ error: "انتخاب طرف‌حساب الزامی است" }, { status: 400 });
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "حداقل یک ردیف کالا/خدمات لازم است" }, { status: 400 });
    }

    const parsedItems: { description: string; quantity: number; unitPrice: number; total: number }[] = items.map(
      (it: { description?: string; quantity?: number; unitPrice?: number }) => ({
        description: String(it.description ?? "").trim() || "کالا/خدمات",
        quantity: Number(it.quantity) || 0,
        unitPrice: Number(it.unitPrice) || 0,
        total: 0,
      })
    );
    for (const it of parsedItems) {
      it.total = Math.round(it.quantity * it.unitPrice);
    }
    const total = parsedItems.reduce((s: number, it: { total: number }) => s + it.total, 0);
    if (total <= 0) return NextResponse.json({ error: "مبلغ فاکتور باید بزرگ‌تر از صفر باشد" }, { status: 400 });

    const taxAmount = Math.round((total * Number(taxRate)) / 100);
    const grandTotal = total + taxAmount;

    const last = await db.invoice.aggregate({ _max: { number: true } });
    const number = (last._max.number ?? 0) + 1;

    let entryId: string | undefined;

    const created = await db.invoice.create({
      data: {
        number,
        type,
        contactId,
        date: date ? new Date(date) : new Date(),
        status: "FINAL",
        total,
        taxRate: Number(taxRate),
        taxAmount,
        grandTotal,
        notes: notes || null,
        items: { create: parsedItems },
      },
    });

    if (createEntry) {
      const contact = await db.contact.findUnique({ where: { id: contactId } });
      const lastEntry = await db.journalEntry.aggregate({ _max: { number: true } });
      const entryNumber = (lastEntry._max.number ?? 0) + 1;

      const cash = await db.account.findUnique({ where: { code: "1102" } });
      const receivable = await db.account.findUnique({ where: { code: "1103" } });
      const payable = await db.account.findUnique({ where: { code: "2101" } });
      const revenue = await db.account.findUnique({ where: { code: "4101" } });
      const inventory = await db.account.findUnique({ where: { code: "1105" } });
      const vat = await db.account.findUnique({ where: { code: "2103" } });
      if (!cash || !revenue || !vat) {
        return NextResponse.json({ error: "کدینگ حساب‌ها ناقص است" }, { status: 500 });
      }

      const isSales = type === "SALES";
      const onCredit = body.paymentType === "CREDIT";
      const lines: { accountId: string; debit: number; credit: number; description: string; order: number }[] = [];

      if (isSales) {
        lines.push({
          accountId: onCredit ? receivable!.id : cash.id,
          debit: grandTotal,
          credit: 0,
          description: `فاکتور فروش ${number} - ${contact?.name ?? ""}`,
          order: 0,
        });
        lines.push({ accountId: revenue.id, debit: 0, credit: total, description: "درآمد فروش", order: 1 });
        lines.push({ accountId: vat.id, debit: 0, credit: taxAmount, description: "مالیات ارزش افزوده", order: 2 });
        // بهای تمام‌شده تقریبی ۷۵٪
        const cogs = Math.round(total * 0.75);
        const cogsAcc = await db.account.findUnique({ where: { code: "5101" } });
        if (cogsAcc && inventory) {
          lines.push({ accountId: cogsAcc.id, debit: cogs, credit: 0, description: "بهای تمام‌شده", order: 3 });
          lines.push({ accountId: inventory.id, debit: 0, credit: cogs, description: "کاهش موجودی", order: 4 });
        }
      } else {
        const purchaseAcc = inventory!;
        lines.push({ accountId: purchaseAcc.id, debit: total, credit: 0, description: "خرید کالا", order: 0 });
        lines.push({ accountId: vat.id, debit: taxAmount, credit: 0, description: "مالیات ارزش افزوده خرید", order: 1 });
        lines.push({
          accountId: onCredit ? payable!.id : cash.id,
          debit: 0,
          credit: grandTotal,
          description: onCredit ? `بدهی به ${contact?.name ?? ""}` : "پرداخت",
          order: 2,
        });
      }

      const entry = await db.journalEntry.create({
        data: {
          number: entryNumber,
          date: created.date,
          description: `${isSales ? "فاکتور فروش" : "فاکتور خرید"} ${number} - ${contact?.name ?? ""}`,
          status: "POSTED",
          source: "INVOICE",
          contactId,
          lines: { create: lines },
        },
      });
      await db.invoice.update({ where: { id: created.id }, data: { entryId: entry.id } });
      entryId = entry.id;
    }

    return NextResponse.json({ id: created.id, number: created.number, entryId });
  } catch (err) {
    console.error("invoice create error", err);
    return NextResponse.json({ error: "خطا در ثبت فاکتور" }, { status: 500 });
  }
}
