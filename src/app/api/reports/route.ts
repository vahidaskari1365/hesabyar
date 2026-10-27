import { NextResponse, NextRequest } from "next/server";
import { db } from "@/lib/db";
import { aggregateAccounts } from "@/lib/server/accounting";
import { MONTH_NAMES_FA } from "@/lib/server/accounting";
import type { AccountType, ReportData } from "@/lib/types";
import type { AccountAgg } from "@/lib/server/accounting";

export const dynamic = "force-dynamic";

const fa = (n: number) => Math.round(n).toLocaleString("fa-IR");

function typeOf(a: AccountAgg): AccountType {
  return a.type;
}

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const type = sp.get("type") ?? "trial-balance";
    const accountId = sp.get("accountId");
    const fromParam = sp.get("from");
    const toParam = sp.get("to");

    const from = fromParam ? new Date(fromParam) : undefined;
    const to = toParam ? new Date(`${toParam}T23:59:59`) : undefined;

    let data: ReportData;

    // ── ۱) تراز آزمایشی ──
    if (type === "trial-balance") {
      const aggs = await aggregateAccounts(from, to);
      const leaves = [...aggs.values()].filter((a) => !a.isGroup && (a.debit > 0 || a.credit > 0));
      leaves.sort((a, b) => a.code.localeCompare(b.code, "en"));
      const rows = leaves.map((a) => {
        const diff = a.debit - a.credit;
        return [
          a.code,
          a.name,
          fa(a.debit),
          fa(a.credit),
          diff >= 0 ? fa(diff) : "—",
          diff < 0 ? fa(-diff) : "—",
        ];
      });
      const td = leaves.reduce((s, a) => s + a.debit, 0);
      const tc = leaves.reduce((s, a) => s + a.credit, 0);
      const sumDb = leaves.reduce((s, a) => s + Math.max(0, a.debit - a.credit), 0);
      const sumCr = leaves.reduce((s, a) => s + Math.max(0, a.credit - a.debit), 0);
      data = {
        title: "تراز آزمایشی",
        subtitle: "گردش و مانده حساب‌های کل",
        columns: ["کد", "نام حساب", "بدهکار", "بستانکار", "مانده بدهکار", "مانده بستانکار"],
        rows,
        totals: ["", "جمع کل", fa(td), fa(tc), fa(sumDb), fa(sumCr)],
        trial: leaves.map((a) => ({
          accountId: a.id,
          code: a.code,
          name: a.name,
          type: typeOf(a),
          debit: Math.round(a.debit),
          credit: Math.round(a.credit),
          balanceDebit: Math.round(Math.max(0, a.debit - a.credit)),
          balanceCredit: Math.round(Math.max(0, a.credit - a.debit)),
        })),
        chart: {
          kind: "bar",
          data: leaves
            .filter((a) => Math.max(a.debit, a.credit) > 0)
            .sort((a, b) => b.debit - a.debit)
            .slice(0, 10)
            .map((a) => ({ name: a.name, value: Math.round(a.debit), extra: Math.round(a.credit) })),
        },
      };
    }

    // ── ۲) صورت سود و زیان ──
    else if (type === "income-statement") {
      const aggs = await aggregateAccounts(from, to);
      const revenues = [...aggs.values()].filter((a) => !a.isGroup && a.type === "INCOME" && a.balance > 0);
      const expenses = [...aggs.values()].filter((a) => !a.isGroup && a.type === "EXPENSE" && a.balance > 0);
      const totalRev = revenues.reduce((s, a) => s + a.balance, 0);
      const totalExp = expenses.reduce((s, a) => s + a.balance, 0);
      const rows: (string | number)[][] = [];
      for (const r of revenues) rows.push(["درآمد", r.name, fa(r.balance), ""]);
      rows.push(["درآمد", "جمع درآمدها", fa(totalRev), ""]);
      for (const e of expenses) rows.push(["هزینه", e.name, fa(e.balance), ""]);
      rows.push(["هزینه", "جمع هزینه‌ها", fa(totalExp), ""]);
      rows.push(["نتیجه", netLabel(totalRev - totalExp), fa(Math.abs(totalRev - totalExp)), ""]);
      data = {
        title: "صورت سود و زیان",
        subtitle: from || to ? "بازه انتخابی" : "از ابتدای دوره",
        columns: ["گروه", "شرح", "مبلغ"],
        rows,
        totals: ["", netLabel(totalRev - totalExp), fa(totalRev - totalExp)],
        chart: {
          kind: "bar",
          data: [...revenues, ...expenses]
            .sort((a, b) => b.balance - a.balance)
            .slice(0, 12)
            .map((a) => ({ name: a.name, value: Math.round(a.balance) })),
          data2: [
            { name: "درآمدها", value: Math.round(totalRev) },
            { name: "هزینه‌ها", value: Math.round(totalExp) },
            { name: "سود خالص", value: Math.round(totalRev - totalExp) },
          ],
        },
      };
    }

    // ── ۳) ترازنامه ──
    else if (type === "balance-sheet") {
      const aggs = await aggregateAccounts(from, to);
      const assets = [...aggs.values()].filter((a) => !a.isGroup && a.type === "ASSET" && Math.abs(a.balance) > 0);
      const liabilities = [...aggs.values()].filter((a) => !a.isGroup && a.type === "LIABILITY" && a.balance > 0);
      const equity = [...aggs.values()].filter((a) => !a.isGroup && a.type === "EQUITY" && a.balance > 0);
      const revenues = [...aggs.values()].filter((a) => !a.isGroup && a.type === "INCOME");
      const expenses = [...aggs.values()].filter((a) => !a.isGroup && a.type === "EXPENSE");
      const profit = revenues.reduce((s, a) => s + (a.credit - a.debit), 0) - expenses.reduce((s, a) => s + (a.debit - a.credit), 0);

      const ta = assets.reduce((s, a) => s + a.balance, 0);
      const tl = liabilities.reduce((s, a) => s + a.balance, 0);
      const te = equity.reduce((s, a) => s + a.balance, 0);

      const rows: (string | number)[][] = [];
      for (const a of assets) rows.push(["دارایی‌ها", a.name, fa(a.balance)]);
      rows.push(["دارایی‌ها", "جمع دارایی‌ها", fa(ta)]);
      for (const l of liabilities) rows.push(["بدهی‌ها", l.name, fa(l.balance)]);
      rows.push(["بدهی‌ها", "جمع بدهی‌ها", fa(tl)]);
      for (const e of equity) rows.push(["سرمایه", e.name, fa(e.balance)]);
      if (profit !== 0) rows.push(["سرمایه", "سود (زیان) دوره", fa(profit)]);
      rows.push(["سرمایه", "جمع سرمایه و بدهی‌ها", fa(tl + te + profit)]);

      data = {
        title: "ترازنامه (صورت وضعیت مالی)",
        subtitle: "دارایی‌ها = بدهی‌ها + سرمایه",
        columns: ["گروه", "شرح", "مبلغ"],
        rows,
        totals: ["جمع", "دارایی‌ها", fa(ta)],
        chart: {
          kind: "pie",
          data: assets.filter((a) => a.balance > 0).map((a) => ({ name: a.name, value: Math.round(a.balance) })),
          data2: [
            { name: "بدهی‌ها", value: Math.round(tl) },
            { name: "سرمایه و سود", value: Math.round(te + profit) },
          ],
        },
      };
    }

    // ── ۴) دفتر کل یک حساب ──
    else if (type === "general-ledger") {
      if (!accountId) {
        return NextResponse.json({ error: "انتخاب حساب لازم است" }, { status: 400 });
      }
      const account = await db.account.findUnique({ where: { id: accountId } });
      if (!account) return NextResponse.json({ error: "حساب یافت نشد" }, { status: 404 });

      const lines = await db.journalLine.findMany({
        where: { accountId, entry: { status: "POSTED", ...(from || to ? { date: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}) } },
        include: { entry: { select: { number: true, date: true, description: true } } },
      });
      lines.sort((a, b) => {
        const d = a.entry.date.getTime() - b.entry.date.getTime();
        return d !== 0 ? d : a.entry.number - b.entry.number;
      });

      let running = 0;
      const rows = lines.map((l) => {
        running += l.debit - l.credit;
        return [
          faDateStr(l.entry.date),
          String(l.entry.number),
          l.entry.description,
          l.description || "—",
          l.debit > 0 ? fa(l.debit) : "—",
          l.credit > 0 ? fa(l.credit) : "—",
          fa(Math.abs(running)) + (running >= 0 ? " بدهکار" : " بستانکار"),
        ];
      });
      const td = lines.reduce((s, l) => s + l.debit, 0);
      const tc = lines.reduce((s, l) => s + l.credit, 0);

      // گردش ماهانه
      const monthMap = new Map<string, number>();
      for (const l of lines) {
        const d = l.entry.date;
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        monthMap.set(key, (monthMap.get(key) ?? 0) + l.debit - l.credit);
      }
      const monthlyChart = [...monthMap.entries()]
        .sort((a, b) => {
          const [ya, ma] = a[0].split("-").map(Number);
          const [yb, mb] = b[0].split("-").map(Number);
          return ya * 12 + ma - (yb * 12 + mb);
        })
        .map(([key, v]) => {
          const [, m] = key.split("-").map(Number);
          return { name: MONTH_NAMES_FA[m], value: Math.round(v) };
        });

      data = {
        title: `دفتر کل — ${account.name} (${account.code})`,
        subtitle: "ریز گردش‌های بدهکار و بستانکار",
        columns: ["تاریخ", "شماره سند", "شرح سند", "شرح آرتیکل", "بدهکار", "بستانکار", "مانده"],
        rows,
        totals: ["", "", "", "جمع", fa(td), fa(tc), ""],
        chart: {
          kind: monthlyChart.length > 3 ? "line" : "bar",
          data: monthlyChart,
        },
      };
    }

    // ── ۵) دفتر روزنامه ──
    else if (type === "journal-book") {
      const entries = await db.journalEntry.findMany({
        where: {
          status: "POSTED",
          ...(from || to ? { date: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
        },
        orderBy: [{ date: "asc" }, { number: "asc" }],
        include: { lines: { orderBy: { order: "asc" }, include: { account: true } } },
      });
      const rows: (string | number)[][] = [];
      for (const e of entries) {
        e.lines.forEach((l, idx) => {
          rows.push([
            idx === 0 ? faDateStr(e.date) : "",
            idx === 0 ? String(e.number) : "",
            idx === 0 ? e.description : "",
            `${l.account.code} — ${l.account.name}`,
            l.description || "",
            l.debit > 0 ? fa(l.debit) : "—",
            l.credit > 0 ? fa(l.credit) : "—",
          ]);
        });
      }
      const td = entries.reduce((s, e) => s + e.lines.reduce((x, l) => x + l.debit, 0), 0);
      const tc = entries.reduce((s, e) => s + e.lines.reduce((x, l) => x + l.credit, 0), 0);
      data = {
        title: "دفتر روزنامه",
        subtitle: "کلیه اسناد قطعی به ترتیب تاریخ",
        columns: ["تاریخ", "شماره", "شرح سند", "حساب", "شرح آرتیکل", "بدهکار", "بستانکار"],
        rows,
        totals: ["", "", "", "", "جمع کل", fa(td), fa(tc)],
      };
    } else {
      return NextResponse.json({ error: "نوع گزارش نامعتبر است" }, { status: 400 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("reports error", err);
    return NextResponse.json({ error: "خطا در تولید گزارش" }, { status: 500 });
  }
}

function netLabel(v: number) {
  return v >= 0 ? "سود خالص دوره" : "زیان خالص دوره";
}

function faDateStr(d: Date): string {
  return new Intl.DateTimeFormat("fa-IR", { year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
