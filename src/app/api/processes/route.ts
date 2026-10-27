import { NextResponse, NextRequest } from "next/server";
import { db, getDbKind, resetIfMemory } from "@/lib/db";
import { aggregateAccounts, sumBalances, MONTH_NAMES_FA } from "@/lib/server/accounting";
import type { ProcessDefinition, ProcessResult, ProcessStep } from "@/lib/types";

export const dynamic = "force-dynamic";

const fa = (n: number) => Math.round(n).toLocaleString("fa-IR");
const faMoney = (n: number) => `${fa(n)} تومان`;

// ─── تعریف فرآیندها ──────────────────────────────────────────────

const PROCESSES: ProcessDefinition[] = [
  {
    id: "close-month",
    name: "بستن دوره مالی ماه",
    description:
      "قطعی‌سازی اسناد پیش‌نویس تراز، ثبت استهلاک ماه جاری در صورت نبود و ارائه خلاصه سود و زیان ماه.",
    icon: "CalendarCheck",
    category: "automation",
    steps: ["بررسی اسناد پیش‌نویس", "قطعی‌سازی اسناد تراز", "ثبت استهلاک ماه", "خلاصه دوره جاری"],
  },
  {
    id: "sync-invoices",
    name: "همگام‌سازی فاکتورها با اسناد",
    description:
      "شناسایی فاکتورهای بدون سند حسابداری و تولید خودکار سند دوطرفه برای هر فاکتور.",
    icon: "FolderSync",
    category: "automation",
    steps: ["شناسایی فاکتورهای بدون سند", "ایجاد سند خودکار", "کنترل تراز اسناد", "خلاصه همگام‌سازی"],
  },
  {
    id: "collect-receivables",
    name: "پیگیری وصول مطالبات",
    description:
      "تحلیل مانده بدهی مشتریان، دسته‌بندی سنی مطالبات و ارائه توصیه‌های وصول بر اساس سررسید.",
    icon: "HandCoins",
    category: "ai",
    steps: ["جمع‌آوری مانده مطالبات", "دسته‌بندی سنی مطالبات", "توصیه‌های وصول", "خروجی نهایی"],
  },
  {
    id: "audit",
    name: "ممیزی و کنترل صحت داده‌ها",
    description:
      "کنترل تراز اسناد، شناسایی اسناد بی‌مقدار و مشکوک به تکرار، بررسی کدینگ و وضعیت مالیات ارزش افزوده.",
    icon: "ShieldCheck",
    category: "audit",
    steps: [
      "بررسی تراز اسناد قطعی",
      "بررسی اسناد بی‌مقدار",
      "شناسایی اسناد مشکوک به تکرار",
      "کنترل کدینگ حساب‌ها",
      "وضعیت مالیات ارزش افزوده",
      "امتیاز سلامت داده",
    ],
  },
  {
    id: "ai-advisor",
    name: "تحلیل هوشمند عملکرد مالی",
    description:
      "محاسبه شاخص‌های کلیدی، تحلیل روند شش‌ماهه، شناسایی الگوها و ارائه توصیه‌های هوشمند مدیریتی.",
    icon: "Sparkles",
    category: "ai",
    steps: ["محاسبه شاخص‌های مالی", "تحلیل روند شش‌ماهه", "شناسایی الگوها", "توصیه‌های هوشمند"],
  },
  {
    id: "reset-demo",
    name: "بازنشانی داده‌های نمونه",
    description:
      "پاک‌سازی کامل داده‌های فعلی (حالت حافظه) و بازسازی داده نمونه واقع‌گرایانه از ابتدا.",
    icon: "RefreshCcw",
    category: "system",
    danger: true,
    memoryOnly: true,
    steps: ["پاک‌سازی داده‌ها", "بازسازی داده نمونه", "آماده‌سازی نهایی"],
  },
];

// ─── اجرای فرآیندها ──────────────────────────────────────────────

async function runCloseMonth(): Promise<ProcessStep[]> {
  const steps: ProcessStep[] = [];

  // ۱) اسناد پیش‌نویس
  const drafts = (await db.journalEntry.findMany({
    where: { status: "DRAFT" },
    include: { lines: true },
  })) as unknown as Array<{
    id: string;
    number: number;
    description: string;
    lines: Array<{ debit: number; credit: number }>;
  }>;
  steps.push({
    id: "scan-drafts",
    title: "بررسی اسناد پیش‌نویس",
    status: drafts.length > 0 ? "info" : "ok",
    message:
      drafts.length > 0
        ? `${fa(drafts.length)} سند پیش‌نویس یافت شد`
        : "هیچ سند پیش‌نویسی وجود ندارد",
    metrics: [{ label: "اسناد پیش‌نویس", value: fa(drafts.length) }],
    items: drafts.slice(0, 5).map((d) => ({
      label: `سند ${fa(d.number)} — ${d.description}`,
      value: Math.round(d.lines.reduce((s, l) => s + l.debit, 0)),
    })),
  });

  // ۲) قطعی‌سازی اسناد تراز
  let posted = 0;
  let unbalanced = 0;
  for (const d of drafts) {
    const td = d.lines.reduce((s, l) => s + l.debit, 0);
    const tc = d.lines.reduce((s, l) => s + l.credit, 0);
    if (Math.abs(td - tc) <= 0.5) {
      await db.journalEntry.update({ where: { id: d.id }, data: { status: "POSTED" } });
      posted++;
    } else {
      unbalanced++;
    }
  }
  steps.push({
    id: "post-drafts",
    title: "قطعی‌سازی اسناد تراز",
    status: posted > 0 ? "fixed" : "ok",
    message: posted > 0 ? `${fa(posted)} سند قطعی شد` : "اسنادی برای قطعی‌سازی وجود نداشت",
    metrics: [
      { label: "قطعی‌شده", value: fa(posted) },
      ...(unbalanced > 0 ? [{ label: "نامتراز (باقی‌مانده)", value: fa(unbalanced) }] : []),
    ],
  });

  // ۳) استهلاک ماه جاری
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const depAcc = await db.account.findUnique({ where: { code: "5207" } });
  let depStatus: ProcessStep["status"] = "ok";
  let depMessage = "";
  if (depAcc) {
    const existing = (await db.journalLine.findMany({
      where: { accountId: depAcc.id, entry: { status: "POSTED", date: { gte: monthStart, lt: monthEnd } } },
    })) as unknown[];
    if (existing.length > 0) {
      depMessage = "استهلاک ماه جاری قبلاً ثبت شده است";
    } else {
      const accumAcc = await db.account.findUnique({ where: { code: "1202" } });
      const last = (await db.journalEntry.aggregate({ _max: { number: true } })) as unknown as {
        _max: { number: number | null };
      };
      const amount = 15_600_000;
      const entry = (await db.journalEntry.create({
        data: {
          number: (last._max.number ?? 0) + 1,
          date: now,
          description: "ثبت خودکار استهلاک ماه جاری (فرآیند بستن دوره)",
          status: "POSTED",
          source: "MANUAL",
          lines: {
            create: [
              { accountId: depAcc.id, debit: amount, credit: 0, description: "استهلاک خطی تجهیزات", order: 0 },
              ...(accumAcc
                ? [{ accountId: (accumAcc as { id: string }).id, debit: 0, credit: amount, description: "استهلاک انباشته", order: 1 }]
                : []),
            ],
          },
        },
      })) as unknown as { number: number };
      depStatus = "fixed";
      depMessage = `سند استهلاک شماره ${fa(entry.number)} به مبلغ ${faMoney(amount)} ثبت شد`;
    }
  } else {
    depStatus = "warn";
    depMessage = "حساب استهلاک (۵۲۰۷) در کدینگ یافت نشد";
  }
  steps.push({ id: "depreciation", title: "ثبت استهلاک ماه", status: depStatus, message: depMessage });

  // ۴) خلاصه دوره جاری
  const aggs = await aggregateAccounts(monthStart, monthEnd);
  const revenue = sumBalances(aggs, "INCOME");
  const expenses = sumBalances(aggs, "EXPENSE");
  const profit = revenue - expenses;
  const topExpenses = [...aggs.values()]
    .filter((a) => !a.isGroup && a.type === "EXPENSE" && a.balance > 0)
    .sort((a, b) => b.balance - a.balance)
    .slice(0, 5)
    .map((a) => ({ label: a.name, value: Math.round(a.balance) }));
  steps.push({
    id: "summary",
    title: "خلاصه دوره جاری",
    status: "ok",
    message: "محاسبات دوره ماه جاری انجام شد",
    metrics: [
      { label: "درآمد ماه", value: faMoney(revenue) },
      { label: "هزینه ماه", value: faMoney(expenses) },
      { label: profit >= 0 ? "سود ماه" : "زیان ماه", value: faMoney(Math.abs(profit)) },
      { label: "حاشیه سود", value: `${fa(revenue > 0 ? (profit / revenue) * 100 : 0)}٪` },
    ],
    items: topExpenses,
  });

  return steps;
}

async function runSyncInvoices(): Promise<ProcessStep[]> {
  const steps: ProcessStep[] = [];

  const invoices = (await db.invoice.findMany({
    where: { entryId: null },
    include: { contact: true },
  })) as unknown as Array<{
    id: string;
    number: number;
    type: string;
    date: Date;
    contactId: string;
    total: number;
    taxRate: number;
    taxAmount: number;
    grandTotal: number;
    contact: { name: string } | null;
  }>;

  steps.push({
    id: "find",
    title: "شناسایی فاکتورهای بدون سند",
    status: invoices.length > 0 ? "info" : "ok",
    message:
      invoices.length > 0
        ? `${fa(invoices.length)} فاکتور بدون سند حسابداری یافت شد`
        : "تمام فاکتورها سند حسابداری دارند — همگام‌سازی کامل است",
    metrics: [{ label: "فاکتور بدون سند", value: fa(invoices.length) }],
    items: invoices.slice(0, 8).map((i) => ({
      label: `فاکتور ${fa(i.number)} — ${i.contact?.name ?? ""}`,
      value: Math.round(i.grandTotal),
      status: "warn" as const,
    })),
  });

  const cash = await db.account.findUnique({ where: { code: "1102" } });
  const receivable = await db.account.findUnique({ where: { code: "1103" } });
  const payable = await db.account.findUnique({ where: { code: "2101" } });
  const revenue = await db.account.findUnique({ where: { code: "4101" } });
  const inventory = await db.account.findUnique({ where: { code: "1105" } });
  const vat = await db.account.findUnique({ where: { code: "2103" } });
  const cogsAcc = await db.account.findUnique({ where: { code: "5101" } });

  if (!cash || !revenue || !vat || !inventory) {
    steps.push({
      id: "create",
      title: "ایجاد سند خودکار",
      status: "error",
      message: "کدینگ حساب‌ها ناقص است (۱۱۰۲/۴۱۰۱/۲۱۰۳/۱۱۰۵)",
    });
    return steps;
  }

  let created = 0;
  const createdIds: string[] = [];
  for (const inv of invoices) {
    const last = (await db.journalEntry.aggregate({ _max: { number: true } })) as unknown as {
      _max: { number: number | null };
    };
    const isSales = inv.type === "SALES";
    const lines: { accountId: string; debit: number; credit: number; description: string; order: number }[] = [];
    if (isSales) {
      lines.push({ accountId: (receivable ?? cash).id, debit: inv.grandTotal, credit: 0, description: `فاکتور فروش ${inv.number} - ${inv.contact?.name ?? ""}`, order: 0 });
      lines.push({ accountId: (revenue as { id: string }).id, debit: 0, credit: inv.total, description: "درآمد فروش", order: 1 });
      lines.push({ accountId: (vat as { id: string }).id, debit: 0, credit: inv.taxAmount, description: "مالیات ارزش افزوده", order: 2 });
      if (cogsAcc) {
        const cogs = Math.round(inv.total * 0.75);
        lines.push({ accountId: (cogsAcc as { id: string }).id, debit: cogs, credit: 0, description: "بهای تمام‌شده (تخمینی ۷۵٪)", order: 3 });
        lines.push({ accountId: (inventory as { id: string }).id, debit: 0, credit: cogs, description: "کاهش موجودی", order: 4 });
      }
    } else {
      lines.push({ accountId: (inventory as { id: string }).id, debit: inv.total, credit: 0, description: "خرید کالا", order: 0 });
      lines.push({ accountId: (vat as { id: string }).id, debit: inv.taxAmount, credit: 0, description: "مالیات ارزش افزوده خرید", order: 1 });
      lines.push({ accountId: (payable ?? cash).id, debit: 0, credit: inv.grandTotal, description: `بدهی به ${inv.contact?.name ?? ""}`, order: 2 });
    }
    const entry = (await db.journalEntry.create({
      data: {
        number: (last._max.number ?? 0) + 1,
        date: inv.date,
        description: `${isSales ? "فاکتور فروش" : "فاکتور خرید"} ${inv.number} - ${inv.contact?.name ?? ""}`,
        status: "POSTED",
        source: "INVOICE",
        contactId: inv.contactId,
        lines: { create: lines },
      },
    })) as unknown as { id: string };
    await db.invoice.update({ where: { id: inv.id }, data: { entryId: entry.id } });
    createdIds.push(entry.id);
    created++;
  }

  steps.push({
    id: "create",
    title: "ایجاد سند خودکار",
    status: created > 0 ? "fixed" : "ok",
    message: created > 0 ? `${fa(created)} سند حسابداری به‌صورت خودکار ایجاد شد` : "سند جدیدی ایجاد نشد",
  });

  let balanced = 0;
  for (const id of createdIds) {
    const lines = (await db.journalLine.findMany({ where: { entryId: id } })) as unknown as Array<{
      debit: number;
      credit: number;
    }>;
    const td = lines.reduce((s, l) => s + l.debit, 0);
    const tc = lines.reduce((s, l) => s + l.credit, 0);
    if (Math.abs(td - tc) <= 0.5) balanced++;
  }
  steps.push({
    id: "verify",
    title: "کنترل تراز اسناد",
    status: balanced === created ? "ok" : "error",
    message:
      balanced === created
        ? created > 0
          ? `هر ${fa(created)} سند تراز است (بدهکار = بستانکار)`
          : "سندی برای کنترل وجود نداشت"
        : `${fa(created - balanced)} سند تراز نیست — نیاز به بررسی دارد`,
    metrics: [{ label: "اسناد تراز", value: `${fa(balanced)} از ${fa(created)}` }],
  });

  steps.push({
    id: "summary",
    title: "خلاصه همگام‌سازی",
    status: "ok",
    message: "فرآیند همگام‌سازی فاکتورها با موفقیت انجام شد",
    metrics: [
      { label: "فاکتور پردازش‌شده", value: fa(created) },
      { label: "سند ایجادشده", value: fa(createdIds.length) },
    ],
  });

  return steps;
}

async function runCollectReceivables(): Promise<ProcessStep[]> {
  const steps: ProcessStep[] = [];

  const contacts = (await db.contact.findMany({
    include: {
      entries: {
        where: { status: "POSTED" },
        include: { lines: { include: { account: { select: { code: true } } } } },
      },
      invoices: true,
    },
  })) as unknown as Array<{
    id: string;
    name: string;
    entries: Array<{ lines: Array<{ account: { code: string }; debit: number; credit: number }> }>;
    invoices: Array<{ type: string; date: Date; grandTotal: number }>;
  }>;

  const debtors: { name: string; amount: number; lastSale: Date | null }[] = [];
  for (const c of contacts) {
    let receivable = 0;
    for (const e of c.entries) {
      for (const l of e.lines) {
        if (l.account.code === "1103") receivable += l.debit - l.credit;
      }
    }
    if (receivable > 0) {
      const salesDates = c.invoices
        .filter((i) => i.type === "SALES")
        .map((i) => i.date)
        .sort((a, b) => b.getTime() - a.getTime());
      debtors.push({ name: c.name, amount: receivable, lastSale: salesDates[0] ?? null });
    }
  }
  const totalReceivable = debtors.reduce((s, d) => s + d.amount, 0);

  steps.push({
    id: "collect",
    title: "جمع‌آوری مانده مطالبات",
    status: "ok",
    message: `${fa(debtors.length)} مشتری بدهکار شناسایی شد`,
    metrics: [
      { label: "کل مطالبات", value: faMoney(totalReceivable) },
      { label: "مشتریان بدهکار", value: fa(debtors.length) },
    ],
  });

  const now = new Date();
  const buckets = { current: 0, mid: 0, late: 0 };
  const items = debtors
    .sort((a, b) => b.amount - a.amount)
    .map((d) => {
      const days = d.lastSale ? Math.floor((now.getTime() - d.lastSale.getTime()) / 86400000) : 999;
      let bucket = "کمتر از ۱ ماه";
      if (days > 60) {
        bucket = "بیش از ۲ ماه";
        buckets.late += d.amount;
      } else if (days > 30) {
        bucket = "۱ تا ۲ ماه";
        buckets.mid += d.amount;
      } else {
        buckets.current += d.amount;
      }
      return {
        label: d.name,
        value: Math.round(d.amount),
        hint: bucket,
        status: days > 60 ? ("error" as const) : days > 30 ? ("warn" as const) : ("ok" as const),
      };
    });

  steps.push({
    id: "aging",
    title: "دسته‌بندی سنی مطالبات",
    status: buckets.late > 0 ? "warn" : "ok",
    message:
      buckets.late > 0
        ? `${faMoney(buckets.late)} مطالبات با سررسید بیش از ۲ ماه`
        : "همه مطالبات در محدوده سالم هستند",
    metrics: [
      { label: "کمتر از ۱ ماه", value: faMoney(buckets.current) },
      { label: "۱ تا ۲ ماه", value: faMoney(buckets.mid) },
      { label: "بیش از ۲ ماه", value: faMoney(buckets.late) },
    ],
    items,
  });

  const recs: { label: string; value: number; status: "ok" | "warn" | "error" }[] = [];
  for (const it of items.filter((i) => i.status === "error")) {
    recs.push({ label: `تماس فوری و ارسال اخطار کتبی به «${it.label}»`, value: it.value, status: "error" });
  }
  for (const it of items.filter((i) => i.status === "warn")) {
    recs.push({ label: `یادآوری تلفنی به «${it.label}»`, value: it.value, status: "warn" });
  }
  if (recs.length === 0)
    recs.push({ label: "وضعیت وصول مطلوب است — پیگیری ماهانه کافی است", value: 0, status: "ok" });

  steps.push({
    id: "recommend",
    title: "توصیه‌های وصول",
    status: recs.some((r) => r.status === "error") ? "warn" : "ok",
    message: `${fa(recs.length)} اقدام پیشنهادی برای تسریع وصول`,
    items: recs,
  });

  steps.push({
    id: "final",
    title: "خروجی نهایی",
    status: "ok",
    message: "گزارش مطالبات برای اقدام مدیریتی آماده است",
    metrics: [
      { label: "کل مطالبات", value: faMoney(totalReceivable) },
      { label: "نیازمند اقدام فوری", value: faMoney(buckets.late) },
      {
        label: "سهم مطالبات نیازمند اقدام",
        value: `${fa(totalReceivable > 0 ? (buckets.late / totalReceivable) * 100 : 0)}٪`,
      },
    ],
  });

  return steps;
}

async function runAudit(): Promise<ProcessStep[]> {
  const steps: ProcessStep[] = [];

  // ۱) تراز اسناد قطعی
  const posted = (await db.journalEntry.findMany({
    where: { status: "POSTED" },
    include: { lines: true },
  })) as unknown as Array<{
    id: string;
    number: number;
    lines: Array<{ debit: number; credit: number }>;
  }>;
  const unbalanced = posted.filter((e) => {
    const td = e.lines.reduce((s, l) => s + l.debit, 0);
    const tc = e.lines.reduce((s, l) => s + l.credit, 0);
    return Math.abs(td - tc) > 0.5;
  });
  steps.push({
    id: "balance",
    title: "بررسی تراز اسناد قطعی",
    status: unbalanced.length === 0 ? "ok" : "error",
    message:
      unbalanced.length === 0
        ? `هر ${fa(posted.length)} سند قطعی تراز است`
        : `${fa(unbalanced.length)} سند نامتراز شناسایی شد`,
    metrics: [
      { label: "اسناد بررسی‌شده", value: fa(posted.length) },
      { label: "نامتراز", value: fa(unbalanced.length) },
    ],
    items: unbalanced.slice(0, 5).map((e) => ({
      label: `سند ${fa(e.number)}`,
      value: Math.round(e.lines.reduce((s, l) => s + l.debit - l.credit, 0)),
      status: "error" as const,
    })),
  });

  // ۲) اسناد بی‌مقدار
  const empty = posted.filter(
    (e) => e.lines.length === 0 || e.lines.every((l) => l.debit === 0 && l.credit === 0)
  );
  steps.push({
    id: "empty",
    title: "بررسی اسناد بی‌مقدار",
    status: empty.length === 0 ? "ok" : "warn",
    message: empty.length === 0 ? "هیچ سند بی‌مقدار وجود ندارد" : `${fa(empty.length)} سند بدون مبلغ یافت شد`,
    metrics: [{ label: "اسناد بی‌مقدار", value: fa(empty.length) }],
  });

  // ۳) اسناد مشکوک به تکرار
  const groups = new Map<string, number>();
  for (const e of posted) {
    const total = Math.round(e.lines.reduce((s, l) => s + l.debit, 0));
    const key = `${e.lines.length}x${total}`;
    groups.set(key, (groups.get(key) ?? 0) + 1);
  }
  const dupes = [...groups.entries()].filter(([, count]) => count > 2).slice(0, 5);
  steps.push({
    id: "dupes",
    title: "شناسایی اسناد مشکوک به تکرار",
    status: dupes.length === 0 ? "ok" : "warn",
    message:
      dupes.length === 0 ? "الگوی تکرار مشکوکی یافت نشد" : `${fa(dupes.length)} الگوی تکراری برای بازبینی`,
    items: dupes.map(([key, count]) => {
      const [lines, amount] = key.split("x");
      return {
        label: `${fa(count)} سند با الگوی مشابه (${fa(Number(lines))} آرتیکل × ${fa(Number(amount))})`,
        value: count,
        status: "warn" as const,
      };
    }),
  });

  // ۴) کنترل کدینگ
  const accounts = (await db.account.findMany({ include: { lines: true } })) as unknown as Array<{
    code: string;
    name: string;
    isGroup: boolean;
    lines: unknown[];
  }>;
  const unused = accounts.filter((a) => !a.isGroup && a.lines.length === 0);
  steps.push({
    id: "coding",
    title: "کنترل کدینگ حساب‌ها",
    status: "ok",
    message: `${fa(accounts.length)} حساب بررسی شد — ${fa(unused.length)} حساب بدون گردش`,
    metrics: [
      { label: "کل حساب‌ها", value: fa(accounts.length) },
      { label: "بدون گردش", value: fa(unused.length) },
    ],
    items: unused.slice(0, 6).map((a) => ({ label: `${a.code} — ${a.name}`, value: 0 })),
  });

  // ۵) ارزش افزوده
  const vatAcc = await db.account.findUnique({ where: { code: "2103" } });
  let vatBalance = 0;
  let salesTax = 0;
  let purchaseTax = 0;
  if (vatAcc) {
    const vatLines = (await db.journalLine.findMany({
      where: { accountId: (vatAcc as { id: string }).id, entry: { status: "POSTED" } },
    })) as unknown as Array<{ debit: number; credit: number }>;
    vatBalance = vatLines.reduce((s, l) => s + l.credit - l.debit, 0);
  }
  const invoices = (await db.invoice.findMany({})) as unknown as Array<{ type: string; taxAmount: number }>;
  for (const i of invoices) {
    if (i.type === "SALES") salesTax += i.taxAmount;
    else purchaseTax += i.taxAmount;
  }
  steps.push({
    id: "vat",
    title: "وضعیت مالیات ارزش افزوده",
    status: "info",
    message: `مانده بستانکار حساب ۲۱۰۳: ${faMoney(vatBalance)}`,
    metrics: [
      { label: "مالیات فروش", value: faMoney(salesTax) },
      { label: "مالیات خرید", value: faMoney(purchaseTax) },
      { label: "مانده قابل پرداخت", value: faMoney(vatBalance) },
    ],
  });

  // ۶) امتیاز سلامت
  const checks = 4;
  const passed =
    (unbalanced.length === 0 ? 1 : 0) +
    (empty.length === 0 ? 1 : 0) +
    (dupes.length === 0 ? 1 : 0) +
    (unused.length <= 3 ? 1 : 0);
  const score = Math.round((passed / checks) * 100);
  steps.push({
    id: "score",
    title: "امتیاز سلامت داده",
    status: score >= 75 ? "ok" : score >= 50 ? "warn" : "error",
    message: `امتیاز سلامت داده‌ها: ${fa(score)}٪`,
    metrics: [
      { label: "امتیاز", value: `${fa(score)}٪` },
      { label: "کنترل‌های موفق", value: `${fa(passed)} از ${fa(checks)}` },
    ],
  });

  return steps;
}

async function runAiAdvisor(): Promise<ProcessStep[]> {
  const steps: ProcessStep[] = [];

  const aggs = await aggregateAccounts();
  const revenue = sumBalances(aggs, "INCOME");
  const expenses = sumBalances(aggs, "EXPENSE");
  const profit = revenue - expenses;
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

  const leaf = (prefix: string) => [...aggs.values()].filter((a) => !a.isGroup && a.code.startsWith(prefix));
  const currentAssets = leaf("110").reduce((s, a) => s + a.balance, 0);
  const currentLiabilities = leaf("210").reduce((s, a) => s + a.balance, 0);
  const currentRatio = currentLiabilities > 0 ? currentAssets / currentLiabilities : 99;
  const cash = [...aggs.values()]
    .filter((a) => !a.isGroup && (a.code === "1101" || a.code === "1102"))
    .reduce((s, a) => s + a.balance, 0);
  const receivables = [...aggs.values()].find((a) => a.code === "1103")?.balance ?? 0;
  const totalAssets = sumBalances(aggs, "ASSET");

  steps.push({
    id: "kpis",
    title: "محاسبه شاخص‌های مالی",
    status: "ok",
    message: "شاخص‌های کلیدی از اسناد قطعی محاسبه شد",
    metrics: [
      { label: "درآمد کل", value: faMoney(revenue) },
      { label: "سود خالص", value: faMoney(profit) },
      { label: "حاشیه سود", value: `${fa(margin)}٪` },
      { label: "نسبت جاری", value: fa(currentRatio) },
      { label: "موجود نقد", value: faMoney(cash) },
      { label: "مطالبات", value: faMoney(receivables) },
    ],
  });

  // روند ۶ ماهه
  const now = new Date();
  const monthly: { month: string; revenue: number; profit: number }[] = [];
  for (let m = 5; m >= 0; m--) {
    const start = new Date(now.getFullYear(), now.getMonth() - m, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - m + 1, 1);
    const ag = await aggregateAccounts(start, end);
    const rev = sumBalances(ag, "INCOME");
    const exp = sumBalances(ag, "EXPENSE");
    monthly.push({ month: MONTH_NAMES_FA[start.getMonth()], revenue: rev, profit: rev - exp });
  }
  const firstRev = monthly[0]?.revenue ?? 0;
  const lastRev = monthly[monthly.length - 1]?.revenue ?? 0;
  const growth = firstRev > 0 ? ((lastRev - firstRev) / firstRev) * 100 : 0;
  const bestMonth = [...monthly].sort((a, b) => b.profit - a.profit)[0];
  steps.push({
    id: "trend",
    title: "تحلیل روند شش‌ماهه",
    status: growth >= 0 ? "ok" : "warn",
    message:
      growth >= 0
        ? `درآمد با روند ${fa(growth)}٪ رشد داشته است`
        : `درآمد با افت ${fa(Math.abs(growth))}٪ همراه بوده است`,
    metrics: [
      { label: "رشد درآمد", value: `${fa(growth)}٪` },
      { label: "بهترین ماه (سود)", value: bestMonth?.month ?? "—" },
      { label: "سود آن ماه", value: faMoney(bestMonth?.profit ?? 0) },
    ],
    items: monthly.map((m) => ({ label: m.month, value: Math.round(m.revenue) })),
  });

  // الگوها
  const topExpense = [...aggs.values()]
    .filter((a) => !a.isGroup && a.type === "EXPENSE" && a.balance > 0)
    .sort((a, b) => b.balance - a.balance)[0];
  const salesInvoices = (await db.invoice.findMany({
    where: { type: "SALES" },
    include: { contact: { select: { name: true } } },
  })) as unknown as Array<{ total: number; contact: { name: string } | null }>;
  const byCustomer = new Map<string, number>();
  for (const inv of salesInvoices) {
    const name = inv.contact?.name ?? "نامشخص";
    byCustomer.set(name, (byCustomer.get(name) ?? 0) + inv.total);
  }
  const topCustomer = [...byCustomer.entries()].sort((a, b) => b[1] - a[1])[0];
  const topShare = revenue > 0 && topCustomer ? (topCustomer[1] / revenue) * 100 : 0;
  const avgInvoice =
    salesInvoices.length > 0 ? salesInvoices.reduce((s, i) => s + i.total, 0) / salesInvoices.length : 0;
  steps.push({
    id: "patterns",
    title: "شناسایی الگوها",
    status: "ok",
    message: "الگوهای کلیدی عملکرد شناسایی شد",
    metrics: [
      { label: "بزرگ‌ترین هزینه", value: topExpense ? `${topExpense.name} (${faMoney(topExpense.balance)})` : "—" },
      { label: "مشتری برتر", value: topCustomer ? `${topCustomer[0]} (${fa(topShare)}٪ فروش)` : "—" },
      { label: "میانگین فاکتور فروش", value: faMoney(avgInvoice) },
    ],
  });

  // توصیه‌ها
  const recs: { label: string; value: number; status: "ok" | "warn" | "error" }[] = [];
  if (margin < 10)
    recs.push({
      label: "حاشیه سود زیر ۱۰٪ است — بازنگری قیمت‌گذاری و کاهش هزینه‌های غیرضروری اولویت دارد",
      value: Math.round(margin),
      status: "warn",
    });
  else
    recs.push({
      label: `حاشیه سود ${fa(margin)}٪ در محدوده سالم قرار دارد`,
      value: Math.round(margin),
      status: "ok",
    });
  if (receivables > revenue * 0.25)
    recs.push({
      label: "مطالبات بیش از ۲۵٪ درآمد است — تشکیل کارگروه وصول و پیش‌فاکتورهای مشروط پیشنهاد می‌شود",
      value: Math.round(receivables),
      status: "warn",
    });
  if (currentRatio < 1.5)
    recs.push({
      label: "نسبت جاری کمتر از ۱٫۵ — برنامه‌ریزی نقدینگی و مذاکره برای مهلت پرداخت تأمین‌کنندگان",
      value: Math.round(currentRatio * 100) / 100,
      status: "warn",
    });
  if (cash < totalAssets * 0.1)
    recs.push({
      label: "موجودی نقد کمتر از ۱۰٪ دارایی‌ها — حفظ ذخیره احتیاطی نقدی برای تعهدات ماهانه",
      value: Math.round(cash),
      status: "warn",
    });
  if (growth >= 0)
    recs.push({
      label: "روند رشد درآمد مثبت است — افزایش ظرفیت فروش و سرمایه‌گذاری در کانال‌های پرسود",
      value: Math.round(growth),
      status: "ok",
    });
  if (topExpense)
    recs.push({
      label: `پایش دقیق‌تر «${topExpense.name}» به‌عنوان بزرگ‌ترین سرفصل هزینه`,
      value: Math.round(topExpense.balance),
      status: "ok",
    });

  steps.push({
    id: "advice",
    title: "توصیه‌های هوشمند",
    status: "ok",
    message: `${fa(recs.length)} توصیه مدیریتی بر اساس داده واقعی شرکت`,
    items: recs.map((r) => ({ label: r.label, value: r.value, status: r.status })),
  });

  return steps;
}

// ─── هندلرها ─────────────────────────────────────────────────────

export async function GET() {
  const mode = await getDbKind();
  return NextResponse.json({ mode, processes: PROCESSES });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { processId } = body ?? {};
    const def = PROCESSES.find((p) => p.id === processId);
    if (!def) return NextResponse.json({ error: "فرآیند یافت نشد" }, { status: 404 });

    const mode = await getDbKind();
    if (def.memoryOnly && mode !== "memory") {
      return NextResponse.json(
        { error: "این فرآیند فقط در حالت حافظه (بدون دیتابیس) قابل اجراست" },
        { status: 400 }
      );
    }

    const startedAt = Date.now();
    let steps: ProcessStep[] = [];

    if (def.id === "reset-demo") {
      await resetIfMemory();
      const [entries, accounts, contacts, invoices] = await Promise.all([
        db.journalEntry.count(),
        db.account.count(),
        db.contact.count(),
        db.invoice.count(),
      ]);
      steps = [
        { id: "wipe", title: "پاک‌سازی داده‌ها", status: "fixed", message: "تمام داده‌های فعلی پاک شد" },
        {
          id: "rebuild",
          title: "بازسازی داده نمونه",
          status: "ok",
          message: "داده نمونه واقع‌گرایانه بازسازی شد",
          metrics: [
            { label: "اسناد", value: fa(entries) },
            { label: "حساب‌ها", value: fa(accounts) },
            { label: "طرف‌حساب‌ها", value: fa(contacts) },
            { label: "فاکتورها", value: fa(invoices) },
          ],
        },
        { id: "ready", title: "آماده‌سازی نهایی", status: "ok", message: "سیستم با داده تازه آماده استفاده است" },
      ];
    } else if (def.id === "close-month") {
      steps = await runCloseMonth();
    } else if (def.id === "sync-invoices") {
      steps = await runSyncInvoices();
    } else if (def.id === "collect-receivables") {
      steps = await runCollectReceivables();
    } else if (def.id === "audit") {
      steps = await runAudit();
    } else if (def.id === "ai-advisor") {
      steps = await runAiAdvisor();
    } else {
      return NextResponse.json({ error: "اجرای این فرآیند پشتیبانی نمی‌شود" }, { status: 400 });
    }

    const result: ProcessResult = {
      processId: def.id,
      name: def.name,
      startedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
      success: !steps.some((s) => s.status === "error"),
      steps,
    };
    return NextResponse.json(result);
  } catch (err) {
    console.error("process run error", err);
    return NextResponse.json({ error: "خطا در اجرای فرآیند" }, { status: 500 });
  }
}
