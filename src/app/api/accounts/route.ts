import { NextResponse, NextRequest } from "next/server";
import { db } from "@/lib/db";
import { aggregateAccounts, buildTree } from "@/lib/server/accounting";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const aggs = await aggregateAccounts();
    const { roots } = buildTree([...aggs.values()]);
    return NextResponse.json(roots);
  } catch (err) {
    console.error("accounts error", err);
    return NextResponse.json({ error: "خطا در دریافت کدینگ حساب‌ها" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { code, name, type, parentId, isGroup } = body ?? {};
    if (!code || !name || !type) {
      return NextResponse.json({ error: "کد، نام و نوع حساب الزامی است" }, { status: 400 });
    }
    const exists = await db.account.findUnique({ where: { code } });
    if (exists) {
      return NextResponse.json({ error: `کد حساب «${code}» قبلاً استفاده شده است` }, { status: 400 });
    }
    const created = await db.account.create({
      data: {
        code: String(code).trim(),
        name: String(name).trim(),
        type,
        isGroup: Boolean(isGroup),
        parentId: parentId || null,
      },
    });
    return NextResponse.json({ id: created.id });
  } catch (err) {
    console.error("account create error", err);
    return NextResponse.json({ error: "خطا در ایجاد حساب" }, { status: 500 });
  }
}
