import { NextResponse, NextRequest } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const reports = await db.savedReport.findMany({ orderBy: { createdAt: "desc" } });
    return NextResponse.json(
      reports.map((r) => ({
        id: r.id,
        name: r.name,
        config: JSON.parse(r.config),
        createdAt: r.createdAt.toISOString(),
      }))
    );
  } catch (err) {
    console.error("saved reports error", err);
    return NextResponse.json({ error: "خطا در دریافت گزارش‌های ذخیره‌شده" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, config } = body ?? {};
    if (!name?.trim()) return NextResponse.json({ error: "نام گزارش الزامی است" }, { status: 400 });
    const created = await db.savedReport.create({
      data: { name: String(name).trim(), config: JSON.stringify(config) },
    });
    return NextResponse.json({ id: created.id });
  } catch (err) {
    console.error("save report error", err);
    return NextResponse.json({ error: "خطا در ذخیره گزارش" }, { status: 500 });
  }
}
