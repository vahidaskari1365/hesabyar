import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import ZAI from "z-ai-web-dev-sdk";
import { aggregateAccounts, MONTH_NAMES_FA } from "@/lib/server/accounting";
import type { AIInsight } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// کش در حافظه (۱۰ دقیقه)
let cache: { at: number; data: AIInsight[] } | null = null;
const TTL = 10 * 60 * 1000;

/** تحلیل هوشمند مالی: روندها، نسبت‌ها، هشدارها و توصیه‌ها */
export async function GET() {
  if (cache && Date.now() - cache.at < TTL) {
    return NextResponse.json(cache.data);
  }

  try {
    const aggs = await aggregateAccounts();
    const leaves = [...aggs.values()].filter((a) => !a.isGroup);

    const revenue = leaves.filter((a) => a.type === "INCOME").reduce((s, a) => s + a.balance, 0);
    const expenses = leaves.filter((a) => a.type === "EXPENSE").reduce((s, a) => s + a.balance, 0);
    const profit = revenue - expenses;
    const assets = leaves.filter((a) => a.type === "ASSET").reduce((s, a) => s + a.balance, 0);
    const liabilities = leaves.filter((a) => a.type === "LIABILITY").reduce((s, a) => s + a.balance, 0);

    const leaf = (code: string) => leaves.find((a) => a.code === code);
    const cash = (leaf("1101")?.balance ?? 0) + (leaf("1102")?.balance ?? 0);
    const receivables = leaf("1103")?.balance ?? 0;
    const payables = leaf("2101")?.balance ?? 0;
    const currentAssets = leaves
      .filter((a) => a.type === "ASSET" && ["1101", "1102", "1103", "1104", "1105"].includes(a.code))
      .reduce((s, a) => s + a.balance, 0);
    const currentLiab = leaves.filter((a) => a.type === "LIABILITY" && a.code.startsWith("21")).reduce((s, a) => s + a.balance, 0);

    // روند ماهانه
    const now = new Date();
    const monthly: { month: string; revenue: number; expenses: number; profit: number }[] = [];
    for (let m = 5; m >= 0; m--) {
      const start = new Date(now.getFullYear(), now.getMonth() - m, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - m + 1, 1);
      const lines = await db.journalLine.findMany({
        where: { entry: { status: "POSTED", date: { gte: start, lt: end } } },
        select: { debit: true, credit: true, account: { select: { type: true, isGroup: true } } },
      });
      let rev = 0, exp = 0;
      for (const l of lines) {
        if (l.account.isGroup) continue;
        if (l.account.type === "INCOME") rev += l.credit - l.debit;
        if (l.account.type === "EXPENSE") exp += l.debit - l.credit;
      }
      monthly.push({ month: MONTH_NAMES_FA[start.getMonth()], revenue: Math.round(rev), expenses: Math.round(exp), profit: Math.round(rev - exp) });
    }

    const topExpenses = leaves
      .filter((a) => a.type === "EXPENSE" && a.balance > 0)
      .sort((a, b) => b.balance - a.balance)
      .slice(0, 5)
      .map((a) => ({ name: a.name, value: Math.round(a.balance) }));

    const context = {
      خلاصه: {
        درآمد_کل: Math.round(revenue),
        هزینه_کل: Math.round(expenses),
        سود_خالص: Math.round(profit),
        حاشیه_سود_درصد: revenue > 0 ? Math.round((profit / revenue) * 1000) / 10 : 0,
        جمع_دارایی‌ها: Math.round(assets),
        جمع_بدهی‌ها: Math.round(liabilities),
        موجودی_نقد: Math.round(cash),
        مطالبات: Math.round(receivables),
        بدهی_به_تامین‌کنندگان: Math.round(payables),
      },
      نسبت_جاری: currentLiab > 0 ? Math.round((currentAssets / currentLiab) * 100) / 100 : null,
      روند_ماهانه_۶ماه: monthly,
      بزرگترین_هزینه‌ها: topExpenses,
    };

    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: "assistant",
          content: `تو یک تحلیلگر مالی ارشد ایرانی هستی. داده‌های مالی یک شرکت را تحلیل کن و بین ۴ تا ۶ یافته ارزشمند ارائه کن.

هر یافته باید:
- type یکی از: "insight" (تحلیل روند)، "warning" (هشدار ریسک)، "success" (نقطه قوت)، "recommendation" (توصیه عملی)
- title: عنوان کوتاه (حداکثر ۸ کلمه)
- text: توضیح ۱ تا ۲ جمله‌ای حرفه‌ای با استناد به اعداد
- metric: یک عدد کلیدی خوانا مثل «حاشیه سود: ۲۳٪» (اختیاری)

به زبان فارسی و با لحن حرفه‌ای حسابداری. اعداد را با فرمت فارسی بنویس.
فقط JSON معتبر آرایه بده، بدون متن اضافه:
[{"type": "...", "title": "...", "text": "...", "metric": "..."}]`,
        },
        { role: "user", content: JSON.stringify(context) },
      ],
      thinking: { type: "disabled" },
    });

    const raw = completion.choices[0]?.message?.content ?? "";
    const match = raw.match(/\[[\s\S]*\]/);
    let insights: AIInsight[] = [];
    if (match) {
      try {
        const parsed = JSON.parse(match[0]);
        insights = parsed
          .filter((x: { title?: string; text?: string }) => x.title && x.text)
          .map((x: { type?: string; title: string; text: string; metric?: string }) => ({
            type: ["insight", "warning", "success", "recommendation"].includes(x.type ?? "") ? x.type! : "insight",
            title: x.title,
            text: x.text,
            metric: x.metric,
          }));
      } catch {
        /* fallthrough */
      }
    }

    // پشتیبان قانون‌محور اگر هوش مصنوعی پاسخ معتبر نداد
    if (insights.length === 0) {
      const marginPct = revenue > 0 ? (profit / revenue) * 100 : 0;
      const ratio = currentLiab > 0 ? currentAssets / currentLiab : 3;
      insights = [
        {
          type: marginPct >= 15 ? "success" : "warning",
          title: `حاشیه سود ${Math.round(marginPct)}٪`,
          text: marginPct >= 15 ? "سودآوری شرکت در محدوده مطلوب صنعت قرار دارد." : "حاشیه سود پایین‌تر از حد مطلوب است؛ بازنگری در قیمت‌گذاری و کنترل هزینه‌ها پیشنهاد می‌شود.",
          metric: `سود خالص: ${Math.round(profit).toLocaleString("fa-IR")} تومان`,
        },
        {
          type: ratio >= 1.5 ? "success" : "warning",
          title: "نسبت جاری",
          text: ratio >= 1.5 ? "توان پرداخت تعهدات کوتاه‌مدت مناسب ارزیابی می‌شود." : "نسبت جاری کمتر از ۱٫۵ است؛ مدیریت نقدینگی نیازمند توجه است.",
          metric: `نسبت جاری: ${ratio.toFixed(2)}`,
        },
        {
          type: "insight",
          title: "ساختار سرمایه",
          text: `جمع بدهی‌ها ${Math.round(liabilities).toLocaleString("fa-IR")} تومان در مقابل دارایی‌های ${Math.round(assets).toLocaleString("fa-IR")} تومانی است.`,
        },
        {
          type: "recommendation",
          title: "وصول مطالبات",
          text: `مطالبات جاری معادل ${Math.round(receivables).toLocaleString("fa-IR")} تومان است؛ پیگیری وصول و اعمال سیاست تخفیف نقدی توصیه می‌شود.`,
        },
      ];
    }

    cache = { at: Date.now(), data: insights };
    return NextResponse.json(insights);
  } catch (err) {
    console.error("insights error", err);
    // پشتیبان آفلاین
    return NextResponse.json([
      { type: "warning", title: "تحلیل هوشمند در دسترس نیست", text: "در حال حاضر موتور تحلیل پاسخ نمی‌دهد؛ لطفاً بعداً تلاش کنید." },
    ] satisfies AIInsight[]);
  }
}
