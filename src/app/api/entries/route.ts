import { NextResponse, NextRequest } from "next/server";
import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

interface LineInput {
  accountId: string;
  debit?: number;
  credit?: number;
  description?: string;
}

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const q = sp.get("q")?.trim();
    const status = sp.get("status");
    const source = sp.get("source");
    const from = sp.get("from");
    const to = sp.get("to");

    const where: Prisma.JournalEntryWhereInput = {};
    if (status && status !== "ALL") where.status = status;
    if (source && source !== "ALL") where.source = source;
    if (q) {
      where.OR = [
        { description: { contains: q } },
        { lines: { some: { description: { contains: q } } } },
        { contact: { name: { contains: q } } },
      ];
    }
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = new Date(from);
      if (to) where.date.lte = new Date(`${to}T23:59:59`);
    }

    const entries = await db.journalEntry.findMany({
      where,
      orderBy: [{ date: "desc" }, { number: "desc" }],
      take: 300,
      include: {
        contact: { select: { name: true } },
        lines: { orderBy: { order: "asc" }, include: { account: { select: { code: true, name: true } } } },
      },
    });

    const data = entries.map((e) => ({
      id: e.id,
      number: e.number,
      date: e.date.toISOString(),
      description: e.description,
      status: e.status as "DRAFT" | "POSTED",
      source: e.source,
      aiNote: e.aiNote,
      contactId: e.contactId,
      contactName: e.contact?.name ?? null,
      totalDebit: Math.round(e.lines.reduce((s, l) => s + l.debit, 0)),
      totalCredit: Math.round(e.lines.reduce((s, l) => s + l.credit, 0)),
      lines: e.lines.map((l) => ({
        accountId: l.accountId,
        accountCode: l.account.code,
        accountName: l.account.name,
        debit: l.debit,
        credit: l.credit,
        description: l.description,
        order: l.order,
      })),
    }));

    return NextResponse.json(data);
  } catch (err) {
    console.error("entries list error", err);
    return NextResponse.json({ error: "خطا در دریافت اسناد" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { date, description, status = "DRAFT", source = "MANUAL", contactId, aiNote, lines } = body ?? {};

    if (!date || !description || !Array.isArray(lines) || lines.length === 0) {
      return NextResponse.json({ error: "تاریخ، شرح و اقلام سند الزامی است" }, { status: 400 });
    }

    const parsed: LineInput[] = lines;
    const totalDebit = parsed.reduce((s, l) => s + (Number(l.debit) || 0), 0);
    const totalCredit = parsed.reduce((s, l) => s + (Number(l.credit) || 0), 0);

    if (totalDebit <= 0) {
      return NextResponse.json({ error: "مبلغ سند باید بزرگ‌تر از صفر باشد" }, { status: 400 });
    }
    if (status === "POSTED" && Math.abs(totalDebit - totalCredit) > 0.5) {
      return NextResponse.json(
        {
          error: `سند تراز نیست — بدهکار ${Math.round(totalDebit).toLocaleString("fa-IR")} و بستانکار ${Math.round(totalCredit).toLocaleString("fa-IR")}`,
        },
        { status: 400 }
      );
    }

    for (const l of parsed) {
      if (!l.accountId) {
        return NextResponse.json({ error: "همه اقلام باید حساب داشته باشند" }, { status: 400 });
      }
    }

    const last = await db.journalEntry.aggregate({ _max: { number: true } });
    const number = (last._max.number ?? 0) + 1;

    const created = await db.journalEntry.create({
      data: {
        number,
        date: new Date(date),
        description: String(description).trim(),
        status,
        source,
        aiNote: aiNote ?? null,
        contactId: contactId || null,
        lines: {
          create: parsed.map((l, i) => ({
            accountId: l.accountId,
            debit: Number(l.debit) || 0,
            credit: Number(l.credit) || 0,
            description: l.description ?? "",
            order: i,
          })),
        },
      },
    });

    return NextResponse.json({ id: created.id, number: created.number });
  } catch (err) {
    console.error("entry create error", err);
    return NextResponse.json({ error: "خطا در ثبت سند" }, { status: 500 });
  }
}
