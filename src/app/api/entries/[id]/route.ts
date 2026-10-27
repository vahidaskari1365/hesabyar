import { NextResponse, NextRequest } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const e = await db.journalEntry.findUnique({
      where: { id },
      include: {
        contact: { select: { name: true } },
        lines: { orderBy: { order: "asc" }, include: { account: { select: { code: true, name: true } } } },
      },
    });
    if (!e) return NextResponse.json({ error: "سند یافت نشد" }, { status: 404 });
    return NextResponse.json({
      id: e.id,
      number: e.number,
      date: e.date.toISOString(),
      description: e.description,
      status: e.status,
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
    });
  } catch (err) {
    console.error("entry get error", err);
    return NextResponse.json({ error: "خطا در دریافت سند" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();

    const existing = await db.journalEntry.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "سند یافت نشد" }, { status: 404 });

    // تغییر وضعیت
    if (body.action === "post" || body.action === "unpost") {
      const newStatus = body.action === "post" ? "POSTED" : "DRAFT";
      if (newStatus === "POSTED") {
        const lines = await db.journalLine.findMany({ where: { entryId: id } });
        const td = lines.reduce((s, l) => s + l.debit, 0);
        const tc = lines.reduce((s, l) => s + l.credit, 0);
        if (Math.abs(td - tc) > 0.5) {
          return NextResponse.json({ error: "سند تراز نیست و قابل قطعی‌شدن نیست" }, { status: 400 });
        }
      }
      const updated = await db.journalEntry.update({ where: { id }, data: { status: newStatus } });
      return NextResponse.json({ ok: true, status: updated.status });
    }

    // ویرایش کامل
    const { date, description, status = "DRAFT", contactId, aiNote, lines } = body ?? {};
    if (!Array.isArray(lines) || lines.length === 0) {
      return NextResponse.json({ error: "اقلام سند الزامی است" }, { status: 400 });
    }
    const totalDebit = lines.reduce((s: number, l: { debit?: number }) => s + (Number(l.debit) || 0), 0);
    const totalCredit = lines.reduce((s: number, l: { credit?: number }) => s + (Number(l.credit) || 0), 0);
    if (status === "POSTED" && Math.abs(totalDebit - totalCredit) > 0.5) {
      return NextResponse.json({ error: "سند تراز نیست" }, { status: 400 });
    }

    await db.journalLine.deleteMany({ where: { entryId: id } });
    const updated = await db.journalEntry.update({
      where: { id },
      data: {
        date: date ? new Date(date) : existing.date,
        description: description ?? existing.description,
        status,
        contactId: contactId || null,
        aiNote: aiNote ?? existing.aiNote,
        lines: {
          create: lines.map((l: { accountId: string; debit?: number; credit?: number; description?: string }, i: number) => ({
            accountId: l.accountId,
            debit: Number(l.debit) || 0,
            credit: Number(l.credit) || 0,
            description: l.description ?? "",
            order: i,
          })),
        },
      },
    });
    return NextResponse.json({ ok: true, id: updated.id });
  } catch (err) {
    console.error("entry update error", err);
    return NextResponse.json({ error: "خطا در ویرایش سند" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const existing = await db.journalEntry.findUnique({ where: { id }, include: { invoice: true } });
    if (!existing) return NextResponse.json({ error: "سند یافت نشد" }, { status: 404 });
    if (existing.invoice) {
      return NextResponse.json(
        { error: "این سند از فاکتور تولید شده و حذف آن از فاکتورها انجام می‌شود" },
        { status: 400 }
      );
    }
    await db.journalEntry.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("entry delete error", err);
    return NextResponse.json({ error: "خطا در حذف سند" }, { status: 500 });
  }
}
