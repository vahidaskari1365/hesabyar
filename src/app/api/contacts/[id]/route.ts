import { NextResponse, NextRequest } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { name, type, phone, email, taxId } = body ?? {};
    const updated = await db.contact.update({
      where: { id },
      data: {
        ...(name ? { name: String(name).trim() } : {}),
        ...(type ? { type } : {}),
        phone: phone ?? null,
        email: email ?? null,
        taxId: taxId ?? null,
      },
    });
    return NextResponse.json({ id: updated.id });
  } catch (err) {
    console.error("contact update error", err);
    return NextResponse.json({ error: "خطا در ویرایش طرف‌حساب" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const invoices = await db.invoice.count({ where: { contactId: id } });
    const entries = await db.journalEntry.count({ where: { contactId: id } });
    if (invoices > 0 || entries > 0) {
      return NextResponse.json(
        { error: `این طرف‌حساب در ${invoices + entries} سند/فاکتور استفاده شده و قابل حذف نیست` },
        { status: 400 }
      );
    }
    await db.contact.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("contact delete error", err);
    return NextResponse.json({ error: "خطا در حذف طرف‌حساب" }, { status: 500 });
  }
}
