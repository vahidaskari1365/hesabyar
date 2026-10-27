import { NextResponse, NextRequest } from "next/server";
import { db } from "@/lib/db";
import ZAI from "z-ai-web-dev-sdk";
import { aggregateAccounts } from "@/lib/server/accounting";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** دستیار گفتگویی هوشمند حسابداری با دانش از داده‌های واقعی شرکت */
export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "پیام خالی است" }, { status: 400 });
    }

    // ساخت بستر داده‌ای فشرده
    const aggs = await aggregateAccounts();
    const leaves = [...aggs.values()].filter((a) => !a.isGroup);
    const leaf = (code: string) => leaves.find((a) => a.code === code);
    const revenue = leaves.filter((a) => a.type === "INCOME").reduce((s, a) => s + a.balance, 0);
    const expenses = leaves.filter((a) => a.type === "EXPENSE").reduce((s, a) => s + a.balance, 0);
    const assets = leaves.filter((a) => a.type === "ASSET").reduce((s, a) => s + a.balance, 0);
    const liabilities = leaves.filter((a) => a.type === "LIABILITY").reduce((s, a) => s + a.balance, 0);

    const topAccounts = leaves
      .filter((a) => Math.abs(a.balance) > 0)
      .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance))
      .slice(0, 15)
      .map((a) => `${a.code} ${a.name}: ${Math.round(a.balance).toLocaleString("fa-IR")}`)
      .join("\n");

    const entryCount = await db.journalEntry.count();
    const invoiceCount = await db.invoice.count();

    const systemPrompt = `تو «دستیار هوشمند حساب‌یار» هستی؛ مشاور حسابداری و مالی یک شرکت ایرانی. به فارسی روان و حرفه‌ای پاسخ بده.

داده‌های واقعی فعلی شرکت:
- درآمد دوره: ${Math.round(revenue).toLocaleString("fa-IR")} تومان
- هزینه دوره: ${Math.round(expenses).toLocaleString("fa-IR")} تومان
- سود خالص: ${Math.round(revenue - expenses).toLocaleString("fa-IR")} تومان
- جمع دارایی‌ها: ${Math.round(assets).toLocaleString("fa-IR")} تومان
- جمع بدهی‌ها: ${Math.round(liabilities).toLocaleString("fa-IR")} تومان
- نقد و بانک: ${Math.round((leaf("1101")?.balance ?? 0) + (leaf("1102")?.balance ?? 0)).toLocaleString("fa-IR")} تومان
- مطالبات: ${Math.round(leaf("1103")?.balance ?? 0).toLocaleString("fa-IR")} تومان
- تعداد اسناد: ${entryCount}، تعداد فاکتورها: ${invoiceCount}

مانده حساب‌های مهم:
${topAccounts}

قواعد:
1. سوالات حسابداری ایرانی (استانداردها، کدینگ، مالیات ارزش افزوده ۱۰٪، صورت‌های مالی) را با دانش تخصصی پاسخ بده.
2. برای اعداد شرکت از داده‌های بالا استفاده کن؛ اگر داده‌ای موجود نیست صادقانه بگو.
3. پاسخ‌ها کوتاه، کاربردی و ساختارمند (در صورت نیاز فهرست نقطه‌ای).
4. راهنمایی‌های مالیاتی را با ذکر این نکته بده که تأیید نهایی با مشاور مالیاتی است.`;

    // حداکثر ۱۰ پیام آخر
    const trimmed = messages.slice(-10);

    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages: [{ role: "assistant", content: systemPrompt }, ...trimmed],
      thinking: { type: "disabled" },
    });

    const reply = completion.choices[0]?.message?.content ?? "پاسخی دریافت نشد.";
    return NextResponse.json({ reply });
  } catch (err) {
    console.error("chat error", err);
    return NextResponse.json({ error: "خطا در ارتباط با دستیار هوشمند" }, { status: 500 });
  }
}
