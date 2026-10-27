import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { aggregateAccounts, sumBalances, MONTH_NAMES_FA } from "@/lib/server/accounting";
import type { DashboardData, MonthlyPoint } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const settings = await db.setting.findUnique({ where: { id: "main" } });
    const aggs = await aggregateAccounts();

    const totalAssets = sumBalances(aggs, "ASSET");
    const totalLiabilities = sumBalances(aggs, "LIABILITY");
    const totalEquity = sumBalances(aggs, "EQUITY");
    const revenue = sumBalances(aggs, "INCOME");
    const expenses = sumBalances(aggs, "EXPENSE");
    const netProfit = revenue - expenses;

    const findLeaf = (code: string) => [...aggs.values()].find((a) => !a.isGroup && a.code === code);
    const cashBalance = (findLeaf("1101")?.balance ?? 0) + (findLeaf("1102")?.balance ?? 0);
    const receivables = findLeaf("1103")?.balance ?? 0;
    const payables = findLeaf("2101")?.balance ?? 0;

    // ── سری ماهانه ۶ ماه اخیر ──
    const now = new Date();
    const months: MonthlyPoint[] = [];
    for (let m = 5; m >= 0; m--) {
      const start = new Date(now.getFullYear(), now.getMonth() - m, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - m + 1, 1);
      const lines = await db.journalLine.findMany({
        where: { entry: { status: "POSTED", date: { gte: start, lt: end } } },
        select: { debit: true, credit: true, account: { select: { type: true, isGroup: true } } },
      });
      let rev = 0, exp = 0, sales = 0, purchases = 0;
      for (const l of lines) {
        if (l.account.isGroup) continue;
        if (l.account.type === "INCOME") rev += l.credit - l.debit;
        if (l.account.type === "EXPENSE") exp += l.debit - l.credit;
      }
      const invs = await db.invoice.findMany({
        where: { date: { gte: start, lt: end }, type: { in: ["SALES", "PURCHASE"] } },
        select: { type: true, total: true },
      });
      for (const i of invs) {
        if (i.type === "SALES") sales += i.total;
        else purchases += i.total;
      }
      months.push({
        month: MONTH_NAMES_FA[start.getMonth()],
        key: `${start.getFullYear()}-${start.getMonth() + 1}`,
        revenue: Math.round(rev),
        expenses: Math.round(exp),
        profit: Math.round(rev - exp),
        sales: Math.round(sales),
        purchases: Math.round(purchases),
      });
    }

    // ── تفکیک هزینه‌ها ──
    const expenseBreakdown = [...aggs.values()]
      .filter((a) => !a.isGroup && a.type === "EXPENSE" && a.balance > 0)
      .sort((a, b) => b.balance - a.balance)
      .slice(0, 8)
      .map((a) => ({ name: a.name, value: Math.round(a.balance) }));

    // ── تفکیک دارایی‌ها ──
    const assetBreakdown = ["1101", "1102", "1103", "1104", "1105", "1201"]
      .map((code) => {
        const a = findLeaf(code);
        return { name: a?.name ?? code, value: Math.round(a?.balance ?? 0) };
      })
      .filter((x) => x.value > 0);

    // ── مشتریان برتر ──
    const salesInvoices = await db.invoice.findMany({
      where: { type: "SALES" },
      select: { total: true, contact: { select: { name: true } } },
    });
    const byCustomer = new Map<string, number>();
    for (const inv of salesInvoices) {
      byCustomer.set(inv.contact.name, (byCustomer.get(inv.contact.name) ?? 0) + inv.total);
    }
    const topCustomers = [...byCustomer.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, value]) => ({ name, value: Math.round(value) }));

    // ── اسناد اخیر ──
    const recentEntriesRaw = await db.journalEntry.findMany({
      orderBy: [{ date: "desc" }, { number: "desc" }],
      take: 7,
      include: { lines: true },
    });
    const recentEntries = recentEntriesRaw.map((e) => ({
      id: e.id,
      number: e.number,
      date: e.date.toISOString(),
      description: e.description,
      status: e.status,
      source: e.source,
      amount: Math.round(e.lines.reduce((s, l) => s + l.debit, 0)),
    }));

    const entryCount = await db.journalEntry.count();
    const draftCount = await db.journalEntry.count({ where: { status: "DRAFT" } });
    const invoiceCount = await db.invoice.count();
    const salesCount = await db.invoice.count({ where: { type: "SALES" } });
    const purchaseCount = await db.invoice.count({ where: { type: "PURCHASE" } });

    // روند سود ماه قبل → ماه جاری
    const prevProfit = months.length >= 2 ? months[months.length - 2].profit : 0;
    const currProfit = months.length >= 1 ? months[months.length - 1].profit : 0;
    const margin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

    const data: DashboardData = {
      kpi: {
        totalAssets: Math.round(totalAssets),
        totalLiabilities: Math.round(totalLiabilities),
        totalEquity: Math.round(totalEquity),
        revenue: Math.round(revenue),
        expenses: Math.round(expenses),
        netProfit: Math.round(netProfit),
        cashBalance: Math.round(cashBalance),
        receivables: Math.round(receivables),
        payables: Math.round(payables),
        entryCount,
        draftCount,
        invoiceCount,
        salesCount,
        purchaseCount,
        margin,
      },
      monthly: months,
      expenseBreakdown,
      topCustomers,
      assetBreakdown,
      recentEntries,
      companyName: settings?.companyName ?? "شرکت من",
    };

    return NextResponse.json(data);
  } catch (err) {
    console.error("dashboard error", err);
    return NextResponse.json({ error: "خطا در محاسبه داشبورد" }, { status: 500 });
  }
}
