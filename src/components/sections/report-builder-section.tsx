"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AreaChart as AreaChartIcon,
  BarChart3 as BarChartIcon,
  FileText,
  LineChart as LineChartIcon,
  PieChart as PieChartIcon,
  Play,
  RefreshCw,
  Save,
  Settings2,
  Trash2,
  TrendingUp,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  Area,
  AreaChart,
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
import type { CustomReportConfig, CustomReportResult, SavedReportItem } from "@/lib/types";
import { faCompact, faMoney, faNumber, faPercent } from "@/lib/format";
import { CHART_COLORS, PIE_COLORS, axisTick, compactTick, tooltipStyle } from "@/lib/charts";
import { cn } from "@/lib/utils";
import { EmptyState, SectionShell } from "@/components/shared/section-shell";
import { ChartCard } from "@/components/shared/chart-card";
import { StatCard } from "@/components/shared/stat-card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// ─── انواع و ثوابت ───────────────────────────────────────────────

/** سنجه‌های اضافی موتور گزارش‌ساز که در تایپ مشترک نیامده‌اند */
type BuilderMetric = CustomReportConfig["metric"] | "tax" | "grandTotal";
type BuilderConfig = Omit<CustomReportConfig, "metric"> & { metric: BuilderMetric };

const DEFAULT_CONFIG: BuilderConfig = {
  dataset: "entries",
  groupBy: "month",
  metric: "amount",
  chartType: "bar",
  entryStatus: "POSTED",
  invoiceType: "ALL",
  limit: 10,
};

const DATASETS = [
  { value: "entries", label: "اسناد حسابداری" },
  { value: "expenses", label: "هزینه‌ها" },
  { value: "revenue", label: "درآمدها" },
  { value: "invoices", label: "فاکتورها" },
  { value: "accounts", label: "مانده حساب‌ها" },
] as const;

const GROUPBYS = [
  { value: "month", label: "ماه" },
  { value: "account", label: "حساب" },
  { value: "type", label: "نوع" },
  { value: "contact", label: "طرف‌حساب" },
] as const;

const METRICS = [
  { value: "amount", label: "مبلغ" },
  { value: "count", label: "تعداد" },
  { value: "tax", label: "مالیات" },
  { value: "grandTotal", label: "جمع نهایی" },
] as const;

const CHART_TYPES = [
  { value: "bar", label: "ستونی" },
  { value: "line", label: "خطی" },
  { value: "area", label: "مساحتی" },
  { value: "pie", label: "دایره‌ای" },
] as const;

const ENTRY_STATUSES = [
  { value: "POSTED", label: "فقط قطعی" },
  { value: "ALL", label: "همه" },
  { value: "DRAFT", label: "پیش‌نویس" },
] as const;

const INVOICE_TYPES = [
  { value: "ALL", label: "همه" },
  { value: "SALES", label: "فروش" },
  { value: "PURCHASE", label: "خرید" },
] as const;

const LIMITS = [5, 10, 15, 20] as const;

const CHART_ICON: Record<CustomReportResult["chartType"], LucideIcon> = {
  bar: BarChartIcon,
  line: LineChartIcon,
  area: AreaChartIcon,
  pie: PieChartIcon,
};

function labelOf(list: readonly { value: string; label: string }[], value: string): string {
  return list.find((x) => x.value === value)?.label ?? value;
}

// ─── اجزای کوچک ──────────────────────────────────────────────────

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[13px]">{label}</Label>
      {children}
      {hint && <p className="text-[11px] leading-4 text-muted-foreground">{hint}</p>}
    </div>
  );
}

// ─── نمودار گزارش سفارشی ─────────────────────────────────────────

function BuilderChart({
  rows,
  type,
}: {
  rows: { name: string; value: number }[];
  type: "bar" | "line" | "area" | "pie";
}) {
  if (!rows.length) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        داده‌ای برای نمایش وجود ندارد
      </div>
    );
  }

  if (type === "pie") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={rows}
            dataKey="value"
            nameKey="name"
            innerRadius="50%"
            outerRadius="80%"
            paddingAngle={2}
            stroke="var(--card)"
            strokeWidth={2}
          >
            {rows.map((r, i) => (
              <Cell key={`${r.name}-${i}`} fill={PIE_COLORS[i % PIE_COLORS.length]} />
            ))}
          </Pie>
          <RTooltip {...tooltipStyle} formatter={(v) => faMoney(Number(v))} />
          <Legend wrapperStyle={{ fontSize: 11 }} iconSize={9} />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (type === "line") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
          <XAxis dataKey="name" tick={axisTick} tickLine={false} axisLine={{ stroke: "var(--border)" }} interval={0} />
          <YAxis tick={axisTick} tickLine={false} axisLine={false} tickFormatter={compactTick} width={48} />
          <RTooltip {...tooltipStyle} formatter={(v) => faMoney(Number(v))} cursor={{ stroke: "var(--border)" }} />
          <Line
            type="monotone"
            dataKey="value"
            name="مبلغ"
            stroke={CHART_COLORS[0]}
            strokeWidth={2.5}
            dot={{ r: 3, strokeWidth: 0, fill: CHART_COLORS[0] }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (type === "area") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={rows} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="builder-area-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_COLORS[0]} stopOpacity={0.32} />
              <stop offset="100%" stopColor={CHART_COLORS[0]} stopOpacity={0.04} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
          <XAxis dataKey="name" tick={axisTick} tickLine={false} axisLine={{ stroke: "var(--border)" }} interval={0} />
          <YAxis tick={axisTick} tickLine={false} axisLine={false} tickFormatter={compactTick} width={48} />
          <RTooltip {...tooltipStyle} formatter={(v) => faMoney(Number(v))} cursor={{ stroke: "var(--border)" }} />
          <Area
            type="monotone"
            dataKey="value"
            name="مبلغ"
            stroke={CHART_COLORS[0]}
            strokeWidth={2.5}
            fill="url(#builder-area-fill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  // bar — نام‌های بلند → چیدمان عمودی با برچسب در سمت راست
  const vertical = rows.length > 4 && rows.some((r) => r.name.length > 12);

  if (vertical) {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
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
          <RTooltip {...tooltipStyle} formatter={(v) => faMoney(Number(v))} cursor={{ fill: "var(--accent)", fillOpacity: 0.35 }} />
          <Bar dataKey="value" name="مبلغ" fill={CHART_COLORS[0]} radius={[0, 4, 4, 0]} barSize={13} />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
        <XAxis dataKey="name" tick={axisTick} tickLine={false} axisLine={{ stroke: "var(--border)" }} interval={0} />
        <YAxis tick={axisTick} tickLine={false} axisLine={false} tickFormatter={compactTick} width={48} />
        <RTooltip {...tooltipStyle} formatter={(v) => faMoney(Number(v))} cursor={{ fill: "var(--accent)", fillOpacity: 0.35 }} />
        <Bar dataKey="value" name="مبلغ" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} barSize={26} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── بخش اصلی ────────────────────────────────────────────────────

export default function ReportBuilderSection() {
  const [config, setConfig] = useState<BuilderConfig>(DEFAULT_CONFIG);
  const [result, setResult] = useState<CustomReportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [executed, setExecuted] = useState(false);
  const [saved, setSaved] = useState<SavedReportItem[]>([]);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SavedReportItem | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  const scrollToTable = () => tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  const run = useCallback(async (cfg: BuilderConfig) => {
    setLoading(true);
    try {
      const res = await endpoints.customReport(cfg as CustomReportConfig);
      setResult(res);
      setExecuted(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا در اجرای گزارش سفارشی");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSaved = useCallback(async () => {
    try {
      setSaved(await endpoints.savedReports());
    } catch {
      /* بارگذاری گزارش‌های ذخیره‌شده اختیاری است */
    }
  }, []);

  useEffect(() => {
    void loadSaved();
  }, [loadSaved]);

  function update<K extends keyof BuilderConfig>(key: K, value: BuilderConfig[K]) {
    setConfig((prev) => {
      const next = { ...prev, [key]: value };
      // فاکتورها با تجمیع حساب سازگار نیستند
      if (key === "dataset" && value === "invoices" && prev.groupBy === "account") {
        next.groupBy = "contact";
      }
      return next;
    });
  }

  function applySaved(item: SavedReportItem) {
    const cfg: BuilderConfig = {
      ...DEFAULT_CONFIG,
      ...item.config,
      metric: (item.config.metric ?? "amount") as BuilderMetric,
    };
    setConfig(cfg);
    void run(cfg);
  }

  async function handleSave() {
    const name = saveName.trim();
    if (!name) {
      toast.error("نام گزارش را وارد کنید");
      return;
    }
    setSaving(true);
    try {
      await endpoints.saveReport(name, config as CustomReportConfig);
      toast.success(`گزارش «${name}» ذخیره شد`);
      setSaveOpen(false);
      setSaveName("");
      void loadSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا در ذخیره گزارش");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await endpoints.deleteSavedReport(deleteTarget.id);
      toast.success("گزارش ذخیره‌شده حذف شد");
      setSaved((prev) => prev.filter((s) => s.id !== deleteTarget.id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا در حذف گزارش");
    } finally {
      setDeleteTarget(null);
    }
  }

  const invalidGroupBy = config.dataset === "invoices" && config.groupBy === "account";
  const showEntryStatus = config.dataset === "entries" || config.dataset === "expenses" || config.dataset === "revenue";
  const showInvoiceType = config.dataset === "invoices";
  const avg = result && result.count > 0 ? result.total / result.count : 0;

  return (
    <SectionShell
      title="گزارش‌ساز"
      icon={Settings2}
      description="گزارش سفارشی بساز: داده، بعد، سنجه و نوع نمودار را انتخاب کنید"
    >
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        {/* ── پنل تنظیمات ── */}
        <Card className="h-fit w-full shrink-0 shadow-sm lg:w-72">
          <CardContent className="space-y-4 p-4 sm:p-5">
            <Field label="مجموعه داده">
              <Select
                value={config.dataset}
                onValueChange={(v) => update("dataset", v as BuilderConfig["dataset"])}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DATASETS.map((d) => (
                    <SelectItem key={d.value} value={d.value}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field
              label="تجمیع بر اساس"
              hint={
                config.dataset === "invoices"
                  ? "تجمیع فاکتورها بر اساس حساب امکان‌پذیر نیست؛ از طرف‌حساب استفاده کنید"
                  : undefined
              }
            >
              <Select
                value={config.groupBy}
                onValueChange={(v) => update("groupBy", v as BuilderConfig["groupBy"])}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GROUPBYS.map((g) => (
                    <SelectItem
                      key={g.value}
                      value={g.value}
                      disabled={config.dataset === "invoices" && g.value === "account"}
                    >
                      {g.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="سنجه">
              <Select
                value={config.metric}
                onValueChange={(v) => update("metric", v as BuilderMetric)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {METRICS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="نوع نمودار">
              <Select
                value={config.chartType}
                onValueChange={(v) => update("chartType", v as BuilderConfig["chartType"])}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHART_TYPES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Separator />

            <div className="grid grid-cols-2 gap-3">
              <Field label="از تاریخ">
                <Input
                  type="date"
                  value={config.dateFrom ?? ""}
                  onChange={(e) => update("dateFrom", e.target.value || undefined)}
                  className="h-9 tnum"
                />
              </Field>
              <Field label="تا تاریخ">
                <Input
                  type="date"
                  value={config.dateTo ?? ""}
                  onChange={(e) => update("dateTo", e.target.value || undefined)}
                  className="h-9 tnum"
                />
              </Field>
            </div>

            {showEntryStatus && (
              <Field label="وضعیت سند">
                <Select
                  value={config.entryStatus ?? "POSTED"}
                  onValueChange={(v) => update("entryStatus", v as BuilderConfig["entryStatus"])}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ENTRY_STATUSES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}

            {showInvoiceType && (
              <Field label="نوع فاکتور">
                <Select
                  value={config.invoiceType ?? "ALL"}
                  onValueChange={(v) => update("invoiceType", v as BuilderConfig["invoiceType"])}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INVOICE_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}

            <Field label="نمایش موارد برتر">
              <Select value={String(config.limit ?? 10)} onValueChange={(v) => update("limit", Number(v))}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LIMITS.map((l) => (
                    <SelectItem key={l} value={String(l)}>
                      {l} مورد اول
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <div className="flex gap-2 pt-1">
              <Button
                className="flex-1 gap-1.5"
                onClick={() => void run(config)}
                disabled={loading || invalidGroupBy}
              >
                {loading ? (
                  <RefreshCw className="size-4 animate-spin" aria-hidden />
                ) : (
                  <Play className="size-4" aria-hidden />
                )}
                اجرای گزارش
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="size-9 shrink-0"
                aria-label="ذخیره گزارش"
                title="ذخیره گزارش"
                onClick={() => setSaveOpen(true)}
                disabled={loading}
              >
                <Save className="size-4" aria-hidden />
              </Button>
            </div>

            <Separator />

            {/* گزارش‌های ذخیره‌شده */}
            <div className="space-y-2">
              <p className="text-[13px] font-semibold">گزارش‌های ذخیره‌شده</p>
              {saved.length === 0 ? (
                <p className="rounded-lg bg-muted/60 px-3 py-2.5 text-xs leading-5 text-muted-foreground">
                  هنوز گزارشی ذخیره نشده است. تنظیمات را انتخاب کنید و با دکمه ذخیره، آن را برای اجرای سریع نگه دارید.
                </p>
              ) : (
                <div className="max-h-60 space-y-1.5 overflow-y-auto pl-1">
                  {saved.map((item) => (
                    <div
                      key={item.id}
                      className="group flex items-center gap-1 rounded-lg border bg-card transition-colors hover:border-primary/40 hover:bg-accent/40"
                    >
                      <button
                        type="button"
                        onClick={() => applySaved(item)}
                        className="min-w-0 flex-1 px-3 py-2 text-start"
                        title="بارگذاری و اجرای گزارش"
                      >
                        <p className="truncate text-[13px] font-medium">{item.name}</p>
                        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                          {labelOf(DATASETS, item.config.dataset)} × {labelOf(GROUPBYS, item.config.groupBy)} ×{" "}
                          {labelOf(METRICS, item.config.metric)}
                        </p>
                      </button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="mr-auto size-8 shrink-0 text-muted-foreground hover:text-destructive"
                        aria-label={`حذف گزارش ${item.name}`}
                        onClick={() => setDeleteTarget(item)}
                      >
                        <Trash2 className="size-3.5" aria-hidden />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ── ناحیه نتیجه ── */}
        <div className="min-w-0 flex-1 space-y-4">
          {!executed && !loading ? (
            <EmptyState
              icon={Settings2}
              title="هنوز گزارشی اجرا نشده است"
              text="مجموعه داده، بعد تجمیع، سنجه و نوع نمودار را از پنل تنظیمات انتخاب کنید و روی «اجرای گزارش» بزنید."
              action={
                <Button className="gap-1.5" onClick={() => void run(config)}>
                  <Play className="size-4" aria-hidden />
                  اجرای گزارش
                </Button>
              }
            />
          ) : (
            <>
              {/* کارت‌های خلاصه */}
              {loading && !result ? (
                <div className="grid gap-3 sm:grid-cols-3">
                  <Skeleton className="h-[104px] rounded-xl" />
                  <Skeleton className="h-[104px] rounded-xl" />
                  <Skeleton className="h-[104px] rounded-xl" />
                </div>
              ) : (
                result && (
                  <div className="grid gap-3 sm:grid-cols-3">
                    <StatCard
                      title="مجموع"
                      value={faCompact(result.total)}
                      icon={Wallet}
                      tone="primary"
                      index={0}
                      hint="مشاهده جدول داده‌ها"
                      onClick={scrollToTable}
                    />
                    <StatCard
                      title="تعداد ردیف‌ها"
                      value={faNumber(result.count)}
                      icon={FileText}
                      tone="muted"
                      index={1}
                      hint="مشاهده جدول داده‌ها"
                      onClick={scrollToTable}
                    />
                    <StatCard
                      title="میانگین هر ردیف"
                      value={faCompact(avg)}
                      icon={TrendingUp}
                      tone="success"
                      index={2}
                      hint="مشاهده جدول داده‌ها"
                      onClick={scrollToTable}
                    />
                  </div>
                )
              )}

              {/* نمودار */}
              <ChartCard
                title={result?.title || "نتایج گزارش"}
                subtitle="نمودار گزارش سفارشی"
                icon={result ? CHART_ICON[result.chartType] : BarChartIcon}
                height={320}
                loading={loading}
              >
                {result ? (
                  <BuilderChart rows={result.rows} type={result.chartType} />
                ) : (
                  <div className="h-full w-full" />
                )}
              </ChartCard>

              {/* جدول داده‌ها */}
              <Card className="shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">جدول داده‌ها</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  {loading ? (
                    <div className="space-y-2">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Skeleton key={i} className="h-9 w-full" />
                      ))}
                    </div>
                  ) : result && result.rows.length === 0 ? (
                    <EmptyState
                      icon={RefreshCw}
                      title="داده‌ای یافت نشد"
                      text="با این تنظیمات ردیفی برای نمایش وجود ندارد. بازه تاریخ یا مجموعه داده را تغییر دهید."
                      action={
                        <Button variant="outline" className="gap-1.5" onClick={() => void run(config)}>
                          <RefreshCw className="size-4" aria-hidden />
                          اجرای دوباره
                        </Button>
                      }
                      className="border-0 bg-transparent"
                    />
                  ) : (
                    result && (
                      <div ref={tableRef} className="max-h-96 overflow-x-auto overflow-y-auto rounded-lg border">
                        <Table>
                          <TableHeader className="sticky top-0 z-10 bg-card shadow-[0_1px_0_var(--border)]">
                            <TableRow className="hover:bg-transparent">
                              <TableHead className="text-right font-bold text-foreground/80">نام</TableHead>
                              <TableHead className="text-right font-bold text-foreground/80">مبلغ</TableHead>
                              <TableHead className="w-1/3 text-right font-bold text-foreground/80">
                                سهم از کل
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {result.rows.map((r, i) => {
                              const pct = result.total > 0 ? (r.value / result.total) * 100 : 0;
                              return (
                                <TableRow key={`${r.name}-${i}`} className="hover:bg-accent/50">
                                  <TableCell className="whitespace-normal">{r.name}</TableCell>
                                  <TableCell className="tnum text-right">{faNumber(r.value)}</TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-2">
                                      <div className="h-1.5 w-20 shrink-0 overflow-hidden rounded-full bg-muted sm:w-28">
                                        <div
                                          className={cn(
                                            "h-full rounded-full",
                                            i === 0 ? "bg-primary" : "bg-primary/60"
                                          )}
                                          style={{ width: `${Math.max(pct, 1.5)}%` }}
                                        />
                                      </div>
                                      <span className="tnum text-xs text-muted-foreground">
                                        {faPercent(pct, 1)}
                                      </span>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                          <TableFooter className="bg-muted font-bold">
                            <TableRow className="hover:bg-muted">
                              <TableCell>جمع کل</TableCell>
                              <TableCell className="tnum text-right">{faNumber(result.total)}</TableCell>
                              <TableCell />
                            </TableRow>
                          </TableFooter>
                        </Table>
                      </div>
                    )
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>

      {/* دیالوگ ذخیره گزارش */}
      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>ذخیره گزارش</DialogTitle>
            <DialogDescription>
              یک نام برای این ترکیب تنظیمات انتخاب کنید تا بعداً با یک کلیک اجرا کنید.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="saved-report-name">نام گزارش</Label>
            <Input
              id="saved-report-name"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="مثلاً: روند ماهانه فروش"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleSave();
              }}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setSaveOpen(false)}>
              انصراف
            </Button>
            <Button className="gap-1.5" onClick={() => void handleSave()} disabled={saving}>
              {saving ? (
                <RefreshCw className="size-4 animate-spin" aria-hidden />
              ) : (
                <Save className="size-4" aria-hidden />
              )}
              ذخیره
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* دیالوگ حذف گزارش ذخیره‌شده */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف گزارش ذخیره‌شده</AlertDialogTitle>
            <AlertDialogDescription>
              آیا از حذف «{deleteTarget?.name}» مطمئن هستید؟ این عمل قابل بازگشت نیست.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>انصراف</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void handleDelete()}
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SectionShell>
  );
}
