import { db } from "@/lib/db";
import type { AccountType } from "@/lib/types";

// ─── محاسبات هسته حسابداری (سمت سرور) ──────────────────────────

export interface AccountAgg {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  isGroup: boolean;
  parentId: string | null;
  debit: number;
  credit: number;
  balance: number; // مانده طبیعی: دارایی/هزینه → بدهکار، بدهی/سرمایه/درآمد → بستانکار
}

/** گردش همه حساب‌ها (تجمیع‌شده) در بازه اختیاری */
export async function aggregateAccounts(from?: Date, to?: Date): Promise<Map<string, AccountAgg>> {
  const accounts = await db.account.findMany();

  const dateCond: { gte?: Date; lte?: Date } = {};
  if (from) dateCond.gte = from;
  if (to) dateCond.lte = to;
  const entryWhere = { status: "POSTED" as const, ...(Object.keys(dateCond).length ? { date: dateCond } : {}) };

  const lines = await db.journalLine.findMany({
    where: { entry: entryWhere },
    select: { accountId: true, debit: true, credit: true },
  });

  const map = new Map<string, AccountAgg>();
  for (const a of accounts) {
    map.set(a.id, {
      id: a.id,
      code: a.code,
      name: a.name,
      type: a.type as AccountType,
      isGroup: a.isGroup,
      parentId: a.parentId,
      debit: 0,
      credit: 0,
      balance: 0,
    });
  }
  for (const l of lines) {
    const agg = map.get(l.accountId);
    if (agg) {
      agg.debit += l.debit;
      agg.credit += l.credit;
    }
  }
  // مانده طبیعی برگ‌ها
  for (const agg of map.values()) {
    if (!agg.isGroup) {
      const diff = agg.debit - agg.credit;
      agg.balance = agg.type === "ASSET" || agg.type === "EXPENSE" ? diff : -diff;
    }
  }
  // تجمیع گروه‌ها از پایین به بالا (کد کوتاه‌تر = والد)
  const all = [...map.values()].sort((x, y) => y.code.length - x.code.length);
  for (const agg of all) {
    if (agg.parentId) {
      const parent = map.get(agg.parentId);
      if (parent) {
        parent.debit += agg.debit;
        parent.credit += agg.credit;
        parent.balance += agg.balance;
      }
    }
  }
  return map;
}

type TreeNode = AccountAgg & { children: TreeNode[] };

export function buildTree(aggs: AccountAgg[]) {
  const byId = new Map<string, TreeNode>();
  for (const a of aggs) {
    byId.set(a.id, { ...a, children: [] });
  }
  const roots: TreeNode[] = [];
  for (const node of byId.values()) {
    if (node.parentId && byId.has(node.parentId)) {
      byId.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  const sortRec = (list: TreeNode[]) => {
    list.sort((a, b) => a.code.localeCompare(b.code, "en"));
    list.forEach((n) => sortRec(n.children));
  };
  sortRec(roots);
  return { roots, byId };
}

export function sumBalances(aggs: Map<string, AccountAgg>, type: AccountType): number {
  let sum = 0;
  for (const a of aggs.values()) {
    if (!a.isGroup && a.type === type) sum += a.balance;
  }
  return sum;
}

export const MONTH_NAMES_FA = [
  "فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور",
  "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند",
];
