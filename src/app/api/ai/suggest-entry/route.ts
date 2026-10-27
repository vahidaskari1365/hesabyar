import { NextResponse, NextRequest } from "next/server";
import { db } from "@/lib/db";
import ZAI from "z-ai-web-dev-sdk";
import type { AISuggestion } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** پیشنهاد هوشمند ثبت سند از توصیف زبان طبیعی */
export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();
    if (!text?.trim()) {
      return NextResponse.json({ error: "شرح تراکنش را وارد کنید" }, { status: 400 });
    }

    // کدینگ حساب‌های برگ برای درج در پرامپت
    const accounts = await db.account.findMany({ where: { isGroup: false }, orderBy: { code: "asc" } });
    const accountList = accounts.map((a) => `${a.code}: ${a.name}`).join("\n");

    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: "assistant",
          content: `تو یک حسابدار حرفه‌ای ایرانی هستی که با استانداردهای حسابداری ایران کاملاً آشناست.
کاربر شرح یک تراکنش مالی را به فارسی می‌دهد و تو باید سند حسابداری آن را پیشنهاد بدهی.

قواعد:
1. فقط از حساب‌های موجود در لیست استفاده کن (کد دقیق).
2. سند باید تراز باشد: مجموع بدهکار = مجموع بستانکار.
3. برای فروش: حساب دریافتنی/بانک بدهکار، درآمد فروش و مالیات ارزش افزوده (2103) بستانکار.
4. برای خرید: حساب هزینه یا موجودی بدهکار، بانک/پرداختنی بستانکار.
5. مبالغ را به تومان و به صورت عدد صحیح تخمین بزن؛ اگر کاربر مبلغ داده دقیقاً همان را استفاده کن.
6. شرح آرتیکل فارسی کوتاه و دقیق.

پاسخ را فقط به صورت JSON معتبر بده، بدون هیچ متن اضافه، با این ساختار:
{"description": "شرح سند", "lines": [{"accountCode": "1102", "debit": 0, "credit": 0, "description": "شرح آرتیکل"}], "confidence": 0.85, "note": "توضیح کوتاه استدلال حسابداری"}

لیست حساب‌ها:
${accountList}`,
        },
        { role: "user", content: text },
      ],
      thinking: { type: "disabled" },
    });

    const raw = completion.choices[0]?.message?.content ?? "";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "پاسخ هوش مصنوعی قابل تفسیر نبود" }, { status: 502 });
    }
    const parsed = JSON.parse(jsonMatch[0]);

    // اعتبارسنجی کدها و تراز
    const validAccounts = new Map(accounts.map((a) => [a.code, a]));
    const lines = (parsed.lines ?? [])
      .filter((l: { accountCode?: string }) => l.accountCode && validAccounts.has(l.accountCode))
      .map((l: { accountCode: string; debit?: number; credit?: number; description?: string }) => {
        const acc = validAccounts.get(l.accountCode)!;
        return {
          accountCode: l.accountCode,
          accountName: acc.name,
          debit: Math.round(Number(l.debit) || 0),
          credit: Math.round(Number(l.credit) || 0),
          description: l.description ?? "",
        };
      });

    if (lines.length < 2) {
      return NextResponse.json({ error: "هوش مصنوعی نتوانست سند معتبری پیشنهاد کند. شرح را دقیق‌تر بنویسید." }, { status: 422 });
    }

    const suggestion: AISuggestion = {
      description: parsed.description ?? text.slice(0, 80),
      lines,
      confidence: Math.min(1, Math.max(0, Number(parsed.confidence) || 0.8)),
      note: parsed.note,
    };
    return NextResponse.json(suggestion);
  } catch (err) {
    console.error("suggest-entry error", err);
    return NextResponse.json({ error: "خطا در پیشنهاد هوشمند سند" }, { status: 500 });
  }
}
