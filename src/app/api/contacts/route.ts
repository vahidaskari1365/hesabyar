import { NextResponse, NextRequest } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const contacts = await db.contact.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        invoices: { select: { type: true, total: true, grandTotal: true } },
        entries: {
          where: { status: "POSTED" },
          include: { lines: { include: { account: { select: { code: true } } } } },
        },
      },
    });

    const data = contacts.map((c) => {
      let receivable = 0;
      let payable = 0;
      // مانده از طریق حساب‌های دریافتنی/پرداختنی در اسناد
      for (const e of c.entries) {
        for (const l of e.lines) {
          if (l.account.code === "1103") receivable += l.debit - l.credit;
          if (l.account.code === "2101") payable += l.credit - l.debit;
        }
      }
      return {
        id: c.id,
        name: c.name,
        type: c.type as "CUSTOMER" | "SUPPLIER" | "BOTH",
        phone: c.phone,
        email: c.email,
        taxId: c.taxId,
        receivable: Math.round(receivable),
        payable: Math.round(payable),
        invoiceCount: c.invoices.length,
        createdAt: c.createdAt.toISOString(),
      };
    });

    return NextResponse.json(data);
  } catch (err) {
    console.error("contacts error", err);
    return NextResponse.json({ error: "خطا در دریافت طرف‌حساب‌ها" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, type = "CUSTOMER", phone, email, taxId } = body ?? {};
    if (!name?.trim()) return NextResponse.json({ error: "نام طرف‌حساب الزامی است" }, { status: 400 });
    const created = await db.contact.create({
      data: { name: String(name).trim(), type, phone: phone || null, email: email || null, taxId: taxId || null },
    });
    return NextResponse.json({ id: created.id });
  } catch (err) {
    console.error("contact create error", err);
    return NextResponse.json({ error: "خطا در ایجاد طرف‌حساب" }, { status: 500 });
  }
}
