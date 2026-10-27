import { NextResponse, NextRequest } from "next/server";
import { db } from "@/lib/db";
import { MONTH_NAMES_FA } from "@/lib/server/accounting";

export const dynamic = "force-dynamic";

/** جزئیات حساب: مشخصات، دفتر کل و گردش ماهانه */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const account = await db.account.findUnique({ where: { id } });
    if (!account) return NextResponse.json({ error: "حساب یافت نشد" }, { status: 404 });

    const lines = await db.journalLine.findMany({
      where: { accountId: id, entry: { status: "POSTED" } },
      include: {
        entry: { select: { id: true, number: true, date: true, description: true } },
      },
      orderBy: { entry: { date: "asc" } },
    });

    let running = 0;
    const ledger = lines
      .sort((a, b) => {
        const d = a.entry.date.getTime() - b.entry.date.getTime();
        return d !== 0 ? d : a.entry.number - b.entry.number;
      })
      .map((l) => {
        running += l.debit - l.credit;
        return {
          id: l.id,
          date: l.entry.date.toISOString(),
          entryNumber: l.entry.number,
          entryId: l.entry.id,
          entryDesc: l.entry.description,
          description: l.description,
          debit: l.debit,
          credit: l.credit,
          balance: Math.round(running),
        };
      });

    // گردش ماهانه
    const monthlyMap = new Map<string, number>();
    for (const l of lines) {
      const d = l.entry.date;
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      monthlyMap.set(key, (monthlyMap.get(key) ?? 0) + l.debit - l.credit);
    }
    const monthly = [...monthlyMap.entries()]
      .sort((a, b) => {
        const [ya, ma] = a[0].split("-").map(Number);
        const [yb, mb] = b[0].split("-").map(Number);
        return ya * 12 + ma - (yb * 12 + mb);
      })
      .slice(-8)
      .map(([key, v]) => {
        const [, m] = key.split("-").map(Number);
        return { name: MONTH_NAMES_FA[m], value: Math.round(v) };
      });

    return NextResponse.json({
      account: {
        id: account.id,
        code: account.code,
        name: account.name,
        type: account.type,
        isGroup: account.isGroup,
      },
      ledger,
      monthly,
      totals: {
        debit: Math.round(ledger.reduce((s, l) => s + l.debit, 0)),
        credit: Math.round(ledger.reduce((s, l) => s + l.credit, 0)),
        balance: Math.round(running),
      },
    });
  } catch (err) {
    console.error("account detail error", err);
    return NextResponse.json({ error: "خطا در جزئیات حساب" }, { status: 500 });
  }
}
