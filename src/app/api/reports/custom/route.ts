import { NextResponse, NextRequest } from "next/server";
import { db } from "@/lib/db";
import { MONTH_NAMES_FA } from "@/lib/server/accounting";
import type { CustomReportConfig, CustomReportResult } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * موتور گزارش‌ساز: مجموعه‌داده × بعد × سنجه → سطرهای آماری برای نمودار
 */
export async function POST(req: NextRequest) {
  try {
    const config = (await req.json()) as CustomReportConfig;
    const { dataset, groupBy, metric = "amount", chartType = "bar" } = config;
    const from = config.dateFrom ? new Date(config.dateFrom) : undefined;
    const to = config.dateTo ? new Date(`${config.dateTo}T23:59:59`) : undefined;
    const limit = Math.min(config.limit ?? 12, 30);

    const dateFilter = {
      ...(from || to ? { date: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
    };

    const rowsMap = new Map<string, { value: number; secondary: number }>();
    const add = (key: string, v: number, sec = 0) => {
      const prev = rowsMap.get(key) ?? { value: 0, secondary: 0 };
      rowsMap.set(key, { value: prev.value + v, secondary: prev.secondary + sec });
    };

    let title = "";

    if (dataset === "entries" || dataset === "expenses" || dataset === "revenue") {
      // گردش آرتیکل‌های اسناد
      const typeFilter =
        dataset === "expenses"
          ? "EXPENSE"
          : dataset === "revenue"
            ? "INCOME"
            : undefined;

      const status = config.entryStatus ?? "POSTED";
      const lines = await db.journalLine.findMany({
        where: {
          entry: { status: status === "ALL" ? undefined : status, ...dateFilter },
          ...(typeFilter ? { account: { type: typeFilter, isGroup: false } } : {}),
        },
        include: {
          account: { select: { code: true, name: true, type: true, isGroup: true } },
          entry: { select: { date: true } },
        },
      });

      title =
        dataset === "expenses"
          ? "تحلیل هزینه‌ها"
          : dataset === "revenue"
            ? "تحلیل درآمدها"
            : "تحلیل اسناد حسابداری";

      for (const l of lines) {
        if (l.account.isGroup) continue;
        const amt = l.debit - l.credit;
        const absAmt = Math.abs(amt);
        if (absAmt === 0) continue;

        if (groupBy === "account") {
          add(`${l.account.code} | ${l.account.name}`, metric === "credit" ? l.credit : metric === "debit" ? l.debit : absAmt);
        } else if (groupBy === "type") {
          const typeLabel =
            l.account.type === "ASSET" ? "دارایی" : l.account.type === "LIABILITY" ? "بدهی" : l.account.type === "EQUITY" ? "سرمایه" : l.account.type === "INCOME" ? "درآمد" : "هزینه";
          add(typeLabel, metric === "credit" ? l.credit : metric === "debit" ? l.debit : absAmt);
        } else if (groupBy === "month") {
          const d = l.entry.date;
          add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, metric === "credit" ? l.credit : metric === "debit" ? l.debit : absAmt);
        } else if (groupBy === "contact") {
          // بدون طرف‌حساب در خطوط؛ از سند می‌آید — استفاده از شرح سند جایگزین
          add("اسناد", metric === "credit" ? l.credit : metric === "debit" ? l.debit : absAmt);
        }
      }

      // مرتب‌سازی ماهانه
      if (groupBy === "month") {
        const sorted = [...rowsMap.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-limit);
        rowsMap.clear();
        for (const [k, v] of sorted) {
          const [y, m] = k.split("-").map(Number);
          const d = new Date(y, m - 1, 1);
          rowsMap.set(MONTH_NAMES_FA[d.getMonth()], v);
        }
        title += " به تفکیک ماه";
      } else if (groupBy === "account") {
        const sorted = [...rowsMap.entries()].sort((a, b) => b[1].value - a[1].value).slice(0, limit);
        rowsMap.clear();
        for (const [k, v] of sorted) rowsMap.set(k.split(" | ")[1], v);
        title += " به تفکیک حساب";
      }
    } else if (dataset === "invoices") {
      const type = config.invoiceType ?? "ALL";
      const invoices = await db.invoice.findMany({
        where: { ...(type !== "ALL" ? { type } : {}), ...dateFilter },
        include: { contact: { select: { name: true } } },
      });
      title = type === "SALES" ? "فاکتورهای فروش" : type === "PURCHASE" ? "فاکتورهای خرید" : "فاکتورها";

      for (const inv of invoices) {
        const val = metric === "count" ? 1 : metric === "tax" ? inv.taxAmount : metric === "grandTotal" ? inv.grandTotal : inv.total;
        if (groupBy === "month") {
          const d = inv.date;
          add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, val);
        } else if (groupBy === "contact") {
          add(inv.contact.name, val);
        } else if (groupBy === "type") {
          add(inv.type === "SALES" ? "فروش" : "خرید", val);
        } else {
          add("کل", val);
        }
      }

      if (groupBy === "month") {
        const sorted = [...rowsMap.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-limit);
        rowsMap.clear();
        for (const [k, v] of sorted) {
          const [y, m] = k.split("-").map(Number);
          rowsMap.set(MONTH_NAMES_FA[new Date(y, m - 1, 1).getMonth()], v);
        }
        title += " به تفکیک ماه";
      }
    } else if (dataset === "accounts") {
      const accounts = await db.account.findMany({ where: { isGroup: false } });
      const lines = await db.journalLine.findMany({
        where: { entry: { status: "POSTED", ...dateFilter } },
        select: { accountId: true, debit: true, credit: true },
      });
      title = "مانده حساب‌ها";
      const balMap = new Map<string, { d: number; c: number }>();
      for (const l of lines) {
        const prev = balMap.get(l.accountId) ?? { d: 0, c: 0 };
        balMap.set(l.accountId, { d: prev.d + l.debit, c: prev.c + l.credit });
      }
      for (const a of accounts) {
        const b = balMap.get(a.id) ?? { d: 0, c: 0 };
        const diff = b.d - b.c;
        const natural = a.type === "ASSET" || a.type === "EXPENSE" ? diff : -diff;
        if (Math.abs(natural) < 1000) continue;
        const key =
          groupBy === "type"
            ? a.type === "ASSET" ? "دارایی" : a.type === "LIABILITY" ? "بدهی" : a.type === "EQUITY" ? "سرمایه" : a.type === "INCOME" ? "درآمد" : "هزینه"
            : a.name;
        add(key, Math.abs(natural));
      }
      const sorted = [...rowsMap.entries()].sort((a, b) => b[1].value - a[1].value).slice(0, limit);
      rowsMap.clear();
      for (const [k, v] of sorted) rowsMap.set(k, v);
    }

    const rows = [...rowsMap.entries()]
      .map(([name, v]) => ({ name, value: Math.round(v.value), secondary: Math.round(v.secondary) }))
      .sort((a, b) => b.value - a.value);

    const total = rows.reduce((s, r) => s + r.value, 0);

    const result: CustomReportResult = {
      rows,
      total,
      count: rows.length,
      chartType: chartType ?? "bar",
      title,
    };
    return NextResponse.json(result);
  } catch (err) {
    console.error("custom report error", err);
    return NextResponse.json({ error: "خطا در تولید گزارش سفارشی" }, { status: 500 });
  }
}
