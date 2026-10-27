import { NextResponse, NextRequest } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const i = await db.invoice.findUnique({
      where: { id },
      include: { contact: true, items: true, entry: { select: { id: true, number: true } } },
    });
    if (!i) return NextResponse.json({ error: "فاکتور یافت نشد" }, { status: 404 });
    return NextResponse.json({
      id: i.id,
      number: i.number,
      type: i.type,
      contactId: i.contactId,
      contactName: i.contact.name,
      contactPhone: i.contact.phone,
      date: i.date.toISOString(),
      status: i.status,
      total: Math.round(i.total),
      taxRate: i.taxRate,
      taxAmount: Math.round(i.taxAmount),
      grandTotal: Math.round(i.grandTotal),
      entryId: i.entryId,
      entryNumber: i.entry?.number ?? null,
      notes: i.notes,
      items: i.items.map((it) => ({
        id: it.id,
        description: it.description,
        quantity: it.quantity,
        unitPrice: Math.round(it.unitPrice),
        total: Math.round(it.total),
      })),
    });
  } catch (err) {
    console.error("invoice detail error", err);
    return NextResponse.json({ error: "خطا در دریافت فاکتور" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const invoice = await db.invoice.findUnique({ where: { id } });
    if (!invoice) return NextResponse.json({ error: "فاکتور یافت نشد" }, { status: 404 });
    // حذف سند مرتبط
    if (invoice.entryId) {
      await db.journalEntry.deleteMany({ where: { id: invoice.entryId } });
    }
    await db.invoice.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("invoice delete error", err);
    return NextResponse.json({ error: "خطا در حذف فاکتور" }, { status: 500 });
  }
}
