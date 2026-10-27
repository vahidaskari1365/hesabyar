import { NextResponse, NextRequest } from "next/server";
import { db } from "@/lib/db";
import ZAI from "z-ai-web-dev-sdk";
import type { DocScanResult } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

/** اسکن هوشمند اسناد: استخراج اطلاعات فاکتور/رسید از تصویر با VLM */
export async function POST(req: NextRequest) {
  try {
    const { imageBase64, mime = "image/jpeg" } = await req.json();
    if (!imageBase64) {
      return NextResponse.json({ error: "تصویر سند ارسال نشده است" }, { status: 400 });
    }

    const accounts = await db.account.findMany({ where: { isGroup: false }, orderBy: { code: "asc" } });
    const accountList = accounts.map((a) => `${a.code}: ${a.name}`).join("\n");

    const zai = await ZAI.create();
    // مدل به‌صورت پیش‌فرض توسط سرور انتخاب می‌شود (همانند CLI)
    const visionBody = {
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `این تصویر یک سند مالی (فاکتور، رسید، قبض یا برگه حسابداری) است. آن را تحلیل کن و اطلاعات زیر را استخراج کن:
- نوع سند (docType): مثلا «فاکتور فروش»، «رسید پرداخت»، «قبض برق»
- فروشنده/صادرکننده (vendor)
- تاریخ سند (date) به هر فرمتی که هست
- مبلغ کل (total) به تومان به صورت عدد
- مالیات (taxAmount) به صورت عدد، اگر هست
- ردیف‌های کالا/خدمات (items)

سپس پیشنهاد ثبت حسابداری (suggestion) بده. فقط از حساب‌های لیست استفاده کن و سند باید تراز باشد (مجموع بدهکار = بستانکار).

پاسخ فقط JSON معتبر با این ساختار:
{
  "docType": "نوع سند",
  "vendor": "نام فروشنده",
  "date": "تاریخ روی سند",
  "total": 0,
  "taxAmount": 0,
  "items": [{"description": "...", "quantity": 1, "unitPrice": 0, "total": 0}],
  "rawSummary": "خلاصه یک خطی محتوای سند",
  "suggestion": {
    "description": "شرح سند حسابداری",
    "lines": [{"accountCode": "...", "debit": 0, "credit": 0, "description": "..."}],
    "confidence": 0.8,
    "note": "توضیح کوتاه"
  }
}

لیست حساب‌ها:
${accountList}

اگر تصویر سند مالی نبود، docType را «نامشخص» بگذار و در rawSummary توضیح بده.`,
            },
            { type: "image_url", image_url: { url: `data:${mime};base64,${imageBase64}` } },
          ],
        },
      ],
      thinking: { type: "disabled" },
    };

    const completion = await zai.chat.completions.createVision(
      visionBody as unknown as Parameters<typeof zai.chat.completions.createVision>[0]
    );

    const raw = completion.choices[0]?.message?.content ?? "";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "تحلیل تصویر ناموفق بود. تصویر واضح‌تری امتحان کنید." }, { status: 502 });
    }
    const parsed = JSON.parse(jsonMatch[0]);

    const validAccounts = new Map(accounts.map((a) => [a.code, a]));
    const suggestionLines = (parsed.suggestion?.lines ?? [])
      .filter((l: { accountCode?: string }) => l.accountCode && validAccounts.has(l.accountCode))
      .map((l: { accountCode: string; debit?: number; credit?: number; description?: string }) => ({
        accountCode: l.accountCode,
        accountName: validAccounts.get(l.accountCode)!.name,
        debit: Math.round(Number(l.debit) || 0),
        credit: Math.round(Number(l.credit) || 0),
        description: l.description ?? "",
      }));

    const result: DocScanResult = {
      docType: parsed.docType ?? "نامشخص",
      vendor: parsed.vendor,
      date: parsed.date,
      total: Number(parsed.total) || undefined,
      taxAmount: Number(parsed.taxAmount) || undefined,
      items: parsed.items ?? [],
      suggestion: {
        description: parsed.suggestion?.description ?? `ثبت ${parsed.docType ?? "سند"} — ${parsed.vendor ?? ""}`,
        lines: suggestionLines,
        confidence: Math.min(1, Math.max(0, Number(parsed.suggestion?.confidence) || 0.75)),
        note: parsed.suggestion?.note,
      },
      rawSummary: parsed.rawSummary,
    };
    return NextResponse.json(result);
  } catch (err) {
    console.error("analyze-doc error", err);
    return NextResponse.json({ error: "خطا در تحلیل هوشمند سند" }, { status: 500 });
  }
}
