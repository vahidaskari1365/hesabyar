"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  BarChart3 as BarChartIcon,
  BookOpen,
  Download,
  FileText,
  Landmark,
  LineChart as LineChartIcon,
  PieChart as PieChartIcon,
  Printer,
  Scale,
  TrendingUp,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { endpoints } from "@/lib/api";
import { useAppStore } from "@/lib/store";
import type { AccountDTO, ReportData } from "@/lib/types";
import { faCompact, faDate, faNumber } from "@/lib/format";
import { CHART_COLORS, PIE_COLORS, axisTick, compactTick, tooltipStyle } from "@/lib/charts";
import { cn } from "@/lib/utils";
import { EmptyState, SectionShell } from "@/components/shared/section-shell";
import { ChartCard } from "@/components/shared/chart-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

// ─── انواع و ثوابت ───────────────────────────────────────────────

type ReportType =
  | "trial-balance"
  | "income-statement"
  | "balance-sheet"
  | "general-ledger"
  | "journal-book";

interface ReportMeta {
  type: ReportType;
  label: string;
  icon: LucideIcon;
  chartTitle?: string;
  chartSubtitle?: string;
}

const REPORTS: ReportMeta[] = [
  {
    type: "trial-balance",
    label: "تراز آزمایشی",
    icon: Scale,
    chartTitle: "ده حساب پرگردش",
    chartSubtitle: "بدهکار و بستانکار کنار هم",
  },
  {
    type: "income-statement",
    label: "سود و زیان",
    icon: TrendingUp,
    chartTitle: "مهم‌ترین حساب‌های درآمد و هزینه",
    chartSubtitle: "به تفکیک مبلغ",
  },
  {
    type: "balance-sheet",
    label: "ترازنامه",
    icon: Landmark,
    chartTitle: "ترکیب دارایی‌ها",
    chartSubtitle: "سهم هر دارایی از کل",
  },
  {
    type: "general-ledger",
    label: "دفتر کل",
    icon: BookOpen,
    chartTitle: "گردش ماهانه حساب",
    chartSubtitle: "خالص بدهکار منهای بستانکار",
  },
  { type: "journal-book", label: "دفتر روزنامه", icon: FileText },
];

type StatTone = "primary" | "warning" | "destructive" | "muted" | "success";

interface ReportStat {
  label: string;
  value: string;
  sub?: string;
  icon: LucideIcon;
  tone: StatTone;
  badge?: { text: string; className: string };
}

const TONE_CLASS: Record<StatTone, string> = {
  primary: "bg-primary/10 text-primary",
  warning: "bg-warning/15 text-warning",
  destructive: "bg-destructive/10 text-destructive",
  muted: "bg-muted text-muted-foreground",
  success: "bg-success/10 text-success",
};

// ─── توابع کمکی ──────────────────────────────────────────────────

/** تبدیل رشته فارسی/لاتین عدد به number (برای جمع ستون‌ها) */
function parseFa(v: string | number | null | undefined): number {
  if (typeof v === "number") return v;
  if (!v) return 0;
  const n = Number(
    v
      .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
      .replace(/[^\d.-]/g, "")
  );
  return Number.isNaN(n) ? 0 : n;
}

function csvEscape(v: string | number): string {
  const s = String(v ?? "");
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadCsv(data: ReportData) {
  const lines: string[] = [data.columns.map(csvEscape).join(",")];
  for (const row of data.rows) lines.push(row.map(csvEscape).join(","));
  if (data.totals) lines.push(data.totals.map(csvEscape).join(","));
  const blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${data.title || "گزارش"}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toast.success("خروجی CSV با موفقیت دانلود شد");
}

function kindIcon(kind: "bar" | "pie" | "line" | "waterfall" | "none"): LucideIcon {
  if (kind === "pie") return PieChartIcon;
  if (kind === "line") return LineChartIcon;
  return BarChartIcon;
}

// ─── نمودار گزارش ────────────────────────────────────────────────

function ReportChart({ chart }: { chart: NonNullable<ReportData["chart"]> }) {
  if (!chart.data?.length) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        داده‌ای برای نمایش نمودار وجود ندارد
      </div>
    );
  }

  if (chart.kind === "pie") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chart.data}
            dataKey="value"
            nameKey="name"
            innerRadius="52%"
            outerRadius="82%"
            paddingAngle={2}
            stroke="var(--card)"
            strokeWidth={2}
          >
            {chart.data.map((d, i) => (
              <Cell key={`${d.name}-${i}`} fill={PIE_COLORS[i % PIE_COLORS.length]} />
            ))}
          </Pie>
          <RTooltip {...tooltipStyle} formatter={(v) => faCompact(Number(v))} />
          <Legend wrapperStyle={{ fontSize: 11 }} iconSize={9} />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (chart.kind === "line") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chart.data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
          <XAxis dataKey="name" tick={axisTick} tickLine={false} axisLine={{ stroke: "var(--border)" }} interval={0} />
          <YAxis tick={axisTick} tickLine={false} axisLine={false} tickFormatter={compactTick} width={48} />
          <RTooltip {...tooltipStyle} formatter={(v) => faNumber(Number(v))} cursor={{ stroke: "var(--border)" }} />
          <Line
            type="monotone"
            dataKey="value"
            name="خالص گردش"
            stroke={CHART_COLORS[0]}
            strokeWidth={2.5}
            dot={{ r: 3, strokeWidth: 0, fill: CHART_COLORS[0] }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  // bar — اگر نام‌ها بلندند چیدمان افقی (ستون‌های افقی با برچسب راست)
  const hasExtra = chart.data.some((d) => typeof d.extra === "number");
  const longNames = chart.data.some((d) => d.name.length > 10);

  if (longNames) {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chart.data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
          <XAxis type="number" tick={axisTick} tickLine={false} axisLine={false} tickFormatter={compactTick} />
          <YAxis
            type="category"
            dataKey="name"
            width={140}
            tick={axisTick}
            tickLine={false}
            axisLine={false}
            orientation="right"
          />
          <RTooltip {...tooltipStyle} formatter={(v) => faNumber(Number(v))} cursor={{ fill: "var(--accent)", fillOpacity: 0.35 }} />
          {hasExtra ? (
            <>
              <Bar dataKey="value" name="بدهکار" fill={CHART_COLORS[0]} radius={[0, 4, 4, 0]} barSize={9} />
              <Bar dataKey="extra" name="بستانکار" fill={CHART_COLORS[1]} radius={[0, 4, 4, 0]} barSize={9} />
            </>
          ) : (
            <Bar dataKey="value" name="مبلغ" fill={CHART_COLORS[0]} radius={[0, 4, 4, 0]} barSize={14} />
          )}
          {hasExtra && <Legend wrapperStyle={{ fontSize: 11 }} iconSize={9} />}
        </BarChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chart.data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
        <XAxis dataKey="name" tick={axisTick} tickLine={false} axisLine={{ stroke: "var(--border)" }} interval={0} />
        <YAxis tick={axisTick} tickLine={false} axisLine={false} tickFormatter={compactTick} width={48} />
        <RTooltip {...tooltipStyle} formatter={(v) => faNumber(Number(v))} cursor={{ fill: "var(--accent)", fillOpacity: 0.35 }} />
        <Bar dataKey="value" name="مبلغ" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} barSize={26} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── کارت خلاصه ──────────────────────────────────────────────────

function ReportStatCard({
  stat,
  onClick,
  index,
}: {
  stat: ReportStat;
  onClick: () => void;
  index: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="مشاهده جدول گزارش"
      style={{ animationDelay: `${index * 60}ms` }}
      className="animate-rise rounded-xl border bg-card p-4 text-start shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{stat.label}</p>
          <p className="tnum mt-1.5 truncate text-lg font-bold tracking-tight">{stat.value}</p>
          {stat.badge ? (
            <Badge variant="secondary" className={cn("mt-2", stat.badge.className)}>
              {stat.badge.text}
            </Badge>
          ) : (
            stat.sub && <p className="mt-1 truncate text-xs text-muted-foreground">{stat.sub}</p>
          )}
        </div>
        <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", TONE_CLASS[stat.tone])}>
          <stat.icon className="size-5" aria-hidden />
        </div>
      </div>
    </button>
  );
}

// ─── بخش اصلی ────────────────────────────────────────────────────

export default function ReportsSection() {
  const navigate = useAppStore((s) => s.navigate);
  const params = useAppStore((s) => s.params);

  const [active, setActive] = useState<ReportType>("trial-balance");
  const [fromInput, setFromInput] = useState("");
  const [toInput, setToInput] = useState("");
  const [applied, setApplied] = useState({ from: "", to: "" });
  const [accountId, setAccountId] = useState("");
  const [accounts, setAccounts] = useState<AccountDTO[]>([]);
  const [data, setData] = useState<ReportData | null>(null);
  const [loadedKey, setLoadedKey] = useState("");
  const tableRef = useRef<HTMLDivElement>(null);

  // اعمال پارامترهای ناوبری (reportType / accountId) — الگوی استخراج حالت در رندر
  const [syncedParams, setSyncedParams] = useState(params);
  if (params !== syncedParams) {
    setSyncedParams(params);
    if (params.accountId) {
      setAccountId(params.accountId);
      setActive("general-ledger");
    } else if (params.reportType && REPORTS.some((r) => r.type === params.reportType)) {
      setActive(params.reportType as ReportType);
    }
  }

  const requestKey = `${active}|${applied.from}|${applied.to}|${active === "general-ledger" ? accountId : ""}`;
  const glMissing = active === "general-ledger" && !accountId;
  const loading = !glMissing && requestKey !== loadedKey;
  const effectiveData = glMissing ? null : data;

  // اجرای گزارش فعال — setState فقط در کالبک‌های ناهمگام
  useEffect(() => {
    if (glMissing) return;
    if (requestKey === loadedKey) return;
    let cancelled = false;
    const p: Record<string, string> = {};
    if (applied.from) p.from = applied.from;
    if (applied.to) p.to = applied.to;
    if (active === "general-ledger") p.accountId = accountId;
    endpoints
      .reports(active, p)
      .then((d) => {
        if (!cancelled) {
          setData(d);
          setLoadedKey(requestKey);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          toast.error(e instanceof Error ? e.message : "خطا در دریافت گزارش");
          setLoadedKey(requestKey);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [active, applied, accountId, glMissing, loadedKey, requestKey]);

  // حساب‌ها برای انتخاب دفتر کل
  useEffect(() => {
    endpoints
      .accounts()
      .then(setAccounts)
      .catch(() => undefined);
  }, []);

  // حساب‌های برگ برای دفتر کل
  const leafAccounts = useMemo(() => {
    const out: AccountDTO[] = [];
    const walk = (list: AccountDTO[]) => {
      for (const a of list) {
        if (a.children?.length) walk(a.children);
        else if (!a.isGroup) out.push(a);
      }
    };
    walk(accounts);
    return out.sort((a, b) => a.code.localeCompare(b.code, "en"));
  }, [accounts]);

  // کارت‌های خلاصه هر گزارش
  const stats: ReportStat[] = useMemo(() => {
    if (!effectiveData) return [];
    if (active === "trial-balance" && effectiveData.trial?.length) {
      const td = effectiveData.trial.reduce((s, r) => s + r.debit, 0);
      const tc = effectiveData.trial.reduce((s, r) => s + r.credit, 0);
      const diff = td - tc;
      return [
        { label: "جمع بدهکار", value: faCompact(td), icon: TrendingUp, tone: "primary" },
        { label: "جمع بستانکار", value: faCompact(tc), icon: Wallet, tone: "warning" },
        {
          label: "وضعیت تراز",
          value: faCompact(Math.abs(diff)),
          sub: "اختلاف جمع بدهکار و بستانکار",
          icon: Scale,
          tone: "muted",
          badge:
            diff === 0
              ? { text: "متراز است", className: "bg-success/10 text-success" }
              : { text: "تراز ندارد", className: "bg-destructive/10 text-destructive" },
        },
      ];
    }
    if (active === "income-statement") {
      const d2 = effectiveData.chart?.data2 ?? [];
      const rev = d2[0]?.value ?? 0;
      const exp = d2[1]?.value ?? 0;
      const net = d2[2]?.value ?? rev - exp;
      return [
        { label: "جمع درآمدها", value: faCompact(rev), icon: TrendingUp, tone: "success" },
        { label: "جمع هزینه‌ها", value: faCompact(exp), icon: Wallet, tone: "warning" },
        {
          label: net >= 0 ? "سود خالص دوره" : "زیان خالص دوره",
          value: faCompact(net),
          icon: Scale,
          tone: net >= 0 ? "primary" : "destructive",
        },
      ];
    }
    if (active === "balance-sheet") {
      const assets = (effectiveData.chart?.data ?? []).reduce((s, d) => s + d.value, 0);
      const d2 = effectiveData.chart?.data2 ?? [];
      return [
        { label: "جمع دارایی‌ها", value: faCompact(assets), icon: Wallet, tone: "primary" },
        { label: "جمع بدهی‌ها", value: faCompact(d2[0]?.value ?? 0), icon: Landmark, tone: "warning" },
        { label: "سرمایه و سود", value: faCompact(d2[1]?.value ?? 0), icon: Scale, tone: "muted" },
      ];
    }
    if (active === "general-ledger") {
      return [
        { label: "تعداد ردیف گردش", value: faNumber(effectiveData.rows.length), icon: BookOpen, tone: "muted" },
        { label: "جمع بدهکار", value: faCompact(parseFa(effectiveData.totals?.[4])), icon: TrendingUp, tone: "primary" },
        { label: "جمع بستانکار", value: faCompact(parseFa(effectiveData.totals?.[5])), icon: Wallet, tone: "warning" },
      ];
    }
    // دفتر روزنامه
    const entryCount = effectiveData.rows.filter((r) => String(r[1] ?? "").trim() !== "").length;
    return [
      { label: "تعداد اسناد", value: faNumber(entryCount), icon: FileText, tone: "muted" },
      { label: "جمع بدهکار", value: faCompact(parseFa(effectiveData.totals?.[5])), icon: TrendingUp, tone: "primary" },
      { label: "جمع بستانکار", value: faCompact(parseFa(effectiveData.totals?.[6])), icon: Wallet, tone: "warning" },
    ];
  }, [effectiveData, active]);

  // ستون‌های عددی (برای tnum و راست‌چینی)
  const numericCols = useMemo(() => {
    const s = new Set<number>();
    if (!effectiveData) return s;
    effectiveData.columns.forEach((_, i) => {
      const sample = effectiveData.rows.slice(0, 12).map((r) => String(r[i] ?? ""));
      if (!sample.length) return;
      const numeric = sample.filter(
        (v) => /\d/.test(v) && !/[a-zA-Zآ-ی]/.test(v.replace(/[۰-۹]/g, ""))
      ).length;
      if (numeric / sample.length > 0.5) s.add(i);
    });
    return s;
  }, [effectiveData]);

  const meta = REPORTS.find((r) => r.type === active) ?? REPORTS[0];
  const chart = effectiveData?.chart;
  const rangeText =
    applied.from || applied.to
      ? `بازه: ${applied.from ? faDate(applied.from) : "ابتدای دوره"} تا ${applied.to ? faDate(applied.to) : "امروز"}`
      : "";

  const scrollToTable = () => tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <SectionShell
      title="گزارش‌های مالی"
      icon={BarChartIcon}
      description="گزارش‌های استاندارد با نمودارهای تعاملی"
      actions={
        <>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => window.print()} disabled={!effectiveData}>
            <Printer className="size-4" aria-hidden />
            چاپ / PDF
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => effectiveData && downloadCsv(effectiveData)} disabled={!effectiveData}>
            <Download className="size-4" aria-hidden />
            خروجی CSV
          </Button>
        </>
      }
    >
      {/* انتخاب گزارش و فیلترها */}
      <div className="no-print space-y-3">
        <div className="hidden sm:block">
          <Tabs value={active} onValueChange={(v) => setActive(v as ReportType)}>
            <TabsList className="h-auto w-full grid-cols-5 gap-1 p-1">
              {REPORTS.map((r) => (
                <TabsTrigger
                  key={r.type}
                  value={r.type}
                  className="gap-1.5 px-1 py-1.5 text-xs sm:text-[13px]"
                >
                  <r.icon className="size-4 shrink-0" aria-hidden />
                  <span className="truncate">{r.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
        <div className="sm:hidden">
          <Select value={active} onValueChange={(v) => setActive(v as ReportType)}>
            <SelectTrigger className="w-full" aria-label="انتخاب گزارش">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REPORTS.map((r) => (
                <SelectItem key={r.type} value={r.type}>
                  <span className="inline-flex items-center gap-2">
                    <r.icon className="size-4" aria-hidden />
                    {r.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Card className="shadow-sm">
          <CardContent className="flex flex-wrap items-end gap-3 p-3 sm:p-4">
            <div className="space-y-1">
              <Label htmlFor="report-from" className="text-xs text-muted-foreground">
                از تاریخ
              </Label>
              <Input
                id="report-from"
                type="date"
                value={fromInput}
                onChange={(e) => setFromInput(e.target.value)}
                className="h-9 w-36 tnum sm:w-40"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="report-to" className="text-xs text-muted-foreground">
                تا تاریخ
              </Label>
              <Input
                id="report-to"
                type="date"
                value={toInput}
                onChange={(e) => setToInput(e.target.value)}
                className="h-9 w-36 tnum sm:w-40"
              />
            </div>
            <Button size="sm" className="h-9" onClick={() => setApplied({ from: fromInput, to: toInput })}>
              اعمال
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-9"
              onClick={() => {
                setFromInput("");
                setToInput("");
                setApplied({ from: "", to: "" });
              }}
            >
              پاک‌کردن
            </Button>
            {active === "general-ledger" && (
              <div className="min-w-52 flex-1 space-y-1 sm:max-w-72">
                <Label className="text-xs text-muted-foreground">حساب (الزامی)</Label>
                <Select value={accountId} onValueChange={setAccountId}>
                  <SelectTrigger className="h-9 w-full">
                    <SelectValue placeholder="انتخاب حساب…" />
                  </SelectTrigger>
                  <SelectContent>
                    {leafAccounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.code} — {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* کارت‌های خلاصه */}
      {loading ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <Skeleton className="h-[92px] rounded-xl" />
          <Skeleton className="h-[92px] rounded-xl" />
          <Skeleton className="h-[92px] rounded-xl" />
        </div>
      ) : (
        stats.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-3">
            {stats.map((s, i) => (
              <ReportStatCard key={s.label} stat={s} index={i} onClick={scrollToTable} />
            ))}
          </div>
        )
      )}

      {/* نمودار گزارش */}
      {meta.type !== "journal-book" && (loading || chart) && (
        <ChartCard
          title={meta.chartTitle ?? "نمودار گزارش"}
          subtitle={meta.chartSubtitle}
          icon={chart ? kindIcon(chart.kind) : BarChartIcon}
          height={300}
          loading={loading}
        >
          {chart ? <ReportChart chart={chart} /> : <div className="h-full w-full" />}
        </ChartCard>
      )}

      {/* پیام انتخاب حساب برای دفتر کل */}
      {glMissing && (
        <EmptyState
          icon={BookOpen}
          title="حسابی انتخاب نشده است"
          text="برای مشاهده دفتر کل، ابتدا یک حساب از فهرست «حساب (الزامی)» در نوار بالا انتخاب کنید."
        />
      )}

      {/* جدول گزارش */}
      {!glMissing && (loading || data) && (
        <Card className="overflow-hidden shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <CardTitle className="text-base">{data?.title ?? meta.label}</CardTitle>
                {data?.subtitle && (
                  <p className="mt-0.5 text-xs text-muted-foreground">{data.subtitle}</p>
                )}
              </div>
              {rangeText && <p className="tnum text-xs text-muted-foreground">{rangeText}</p>}
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-9 w-full" />
                ))}
              </div>
            ) : data && data.rows.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="داده‌ای یافت نشد"
                text="در بازه انتخابی، تراکنشی برای این گزارش وجود ندارد."
                className="border-0 bg-transparent"
              />
            ) : data ? (
              <div
                ref={tableRef}
                className="max-h-96 overflow-x-auto overflow-y-auto rounded-lg border print:max-h-none print:overflow-visible"
              >
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-card shadow-[0_1px_0_var(--border)]">
                    <TableRow className="hover:bg-transparent">
                      {data.columns.map((c) => (
                        <TableHead key={c} className="text-right font-bold text-foreground/80">
                          {c}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.rows.map((row, ri) => {
                      const trialRow = data.trial?.[ri];
                      const cells = row.map((cell, ci) => (
                        <TableCell
                          key={ci}
                          className={cn(
                            "text-right",
                            numericCols.has(ci) ? "tnum" : "min-w-40 whitespace-normal",
                            String(cell) === "—" && "text-muted-foreground/60"
                          )}
                        >
                          {String(cell)}
                        </TableCell>
                      ));
                      if (!trialRow) {
                        return (
                          <Fragment key={ri}>
                            <TableRow>{cells}</TableRow>
                          </Fragment>
                        );
                      }
                      return (
                        <Tooltip key={ri}>
                          <TooltipTrigger asChild>
                            <TableRow
                              onClick={() => navigate("accounts", { accountId: trialRow.accountId })}
                              className="cursor-pointer hover:bg-accent/50"
                            >
                              {cells}
                            </TableRow>
                          </TooltipTrigger>
                          <TooltipContent>مشاهده دفتر کل حساب</TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </TableBody>
                  {data.totals && (
                    <TableFooter className="bg-muted font-bold">
                      <TableRow className="hover:bg-muted">
                        {data.totals.map((cell, i) => (
                          <TableCell key={i} className={cn("text-right", numericCols.has(i) && "tnum")}>
                            {String(cell)}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableFooter>
                  )}
                </Table>
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}
    </SectionShell>
  );
}
