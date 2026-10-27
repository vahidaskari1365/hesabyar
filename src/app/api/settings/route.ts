import { NextResponse, NextRequest } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    let s = await db.setting.findUnique({ where: { id: "main" } });
    if (!s) {
      s = await db.setting.create({ data: { id: "main" } });
    }
    return NextResponse.json({
      companyName: s.companyName,
      fiscalYear: s.fiscalYear,
      taxRate: s.taxRate,
      currency: s.currency,
    });
  } catch (err) {
    console.error("settings error", err);
    return NextResponse.json({ error: "خطا در دریافت تنظیمات" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { companyName, fiscalYear, taxRate, currency } = body ?? {};
    const s = await db.setting.upsert({
      where: { id: "main" },
      create: { id: "main", companyName, fiscalYear, taxRate, currency },
      update: {
        ...(companyName !== undefined ? { companyName } : {}),
        ...(fiscalYear !== undefined ? { fiscalYear } : {}),
        ...(taxRate !== undefined ? { taxRate: Number(taxRate) } : {}),
        ...(currency !== undefined ? { currency } : {}),
      },
    });
    return NextResponse.json({
      companyName: s.companyName,
      fiscalYear: s.fiscalYear,
      taxRate: s.taxRate,
      currency: s.currency,
    });
  } catch (err) {
    console.error("settings update error", err);
    return NextResponse.json({ error: "خطا در ذخیره تنظیمات" }, { status: 500 });
  }
}
