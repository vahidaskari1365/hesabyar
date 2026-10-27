"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import {
  ArrowLeft,
  Banknote,
  FileClock,
  FileText,
  HandCoins,
  Landmark,
  PiggyBank,
  RefreshCw,
  Sparkles,
  TrendingUp,
  Wallet,
  BadgePercent,
} from "lucide-react";
import { endpoints } from "@/lib/api";
import type { DashboardData } from "@/lib/types";
import { faCompact, faDateLong, faMoney, faNumber, faPercent } from "@/lib/format";
import { PIE_COLORS, axisTick, compactTick, tooltipStyle } from "@/lib/charts";
import { StatCard, StatCardSkeleton } from "@/components/shared/stat-card";
import { ChartCard, ChartLegend } from "@/components/shared/chart-card";
import { SectionShell } from "@/components/shared/section-shell";
import { EmptyState } from "@/components/shared/section-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export default function DashboardSection() {
  const navigate = useAppStore((s) => s.navigate);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [today, setToday] = useState("");

  useEffect(() => {
    setToday(faDateLong(new Date()));
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      setData(await endpoints.dashboard());
    } catch {
      // خطاها بی‌صدا در داشبورد؛ کارت‌ها خالی می‌مانند
    } finally {
      setLoading(false);
    }
  }

  const k = data?.kpi;

  return (
    <SectionShell
      title="داشبورد مالی"
      description={today ? `خلاصه وضعیت — ${today}` : "خلاصه وضعیت مالی شرکت"}
      icon={TrendingUp}
      actions={
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={cn("size-4", loading && "animate-spin")} />
          بروزرسانی
        </Button>
      }
    >
      {/* KPI ها */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {loading || !k ? (
          Array.from({ length: 6 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <StatCard index={0} title="جمع دارایی‌ها" value={faCompact(k.totalAssets)} sub={faMoney(k.totalAssets)} icon={Wallet} tone="primary" onClick={() => navigate("accounts")} />
            <StatCard index={1} title="نقد و بانک" value={faCompact(k.cashBalance)} sub="صندوق + بانک" icon={Banknote} tone="success" onClick={() => navigate("accounts")} />
            <StatCard index={2} title="مطالبات" value={faCompact(k.receivables)} sub="حساب‌های دریافتنی" icon={HandCoins} tone="warning" onClick={() => navigate("contacts")} />
            <StatCard index={3} title="جمع بدهی‌ها" value={faCompact(k.totalLiabilities)} sub={faMoney(k.payables) + " پرداختنی"} icon={Landmark} tone="destructive" onClick={() => navigate("reports", { reportType: "balance-sheet" })} />
            <StatCard index={4} title="درآمد دوره" value={faCompact(k.revenue)} sub="فروش و خدمات" icon={TrendingUp} tone="primary" onClick={() => navigate("reports", { reportType: "income-statement" })} />
            <StatCard index={5} title="سود خالص" value={faCompact(k.netProfit)} sub={`حاشیه: ${faPercent(k.margin)}`} icon={PiggyBank} tone={k.netProfit >= 0 ? "success" : "destructive"} onClick={() => navigate("reports", { reportType: "income-statement" })} />
          </>
        )}
      </div>

      {/* نمودارهای اصلی */}
      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard
          title="روند درآمد، هزینه و سود"
          subtitle="۶ ماه اخیر"
          icon={TrendingUp}
          className="lg:col-span-2"
          loading={loading}
          height={300}
        >
          {data && (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.monthly} margin={{ top: 8, left: 0, right: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10a37f" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#10a37f" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="gExp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#e07a3f" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#e07a3f" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="gProfit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#e8a13c" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#e8a13c" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="month" tick={axisTick} axisLine={false} tickLine={false} />
                <YAxis tick={axisTick} axisLine={false} tickLine={false} tickFormatter={compactTick} width={54} />
                <RTooltip {...tooltipStyle} formatter={(v: number) => faNumber(Math.round(v)) + " تومان"} />
                <Legend wrapperStyle={{ fontSize: 12, fontFamily: "inherit" }} />
                <Area type="monotone" dataKey="revenue" name="درآمد" stroke="#10a37f" strokeWidth={2.5} fill="url(#gRev)" />
                <Area type="monotone" dataKey="expenses" name="هزینه" stroke="#e07a3f" strokeWidth={2} fill="url(#gExp)" />
                <Area type="monotone" dataKey="profit" name="سود" stroke="#e8a13c" strokeWidth={2} fill="url(#gProfit)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard
          title="تفکیک هزینه‌ها"
          subtitle="بزرگ‌ترین بندهای هزینه"
          icon={BadgePercent}
          loading={loading}
          height={300}
          actions={
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => navigate("report-builder", { reportType: "expenses" })}>
              جزئیات
              <ArrowLeft className="size-3.5" />
            </Button>
          }
        >
          {data && data.expenseBreakdown.length > 0 && (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.expenseBreakdown}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="55%"
                  outerRadius="82%"
                  paddingAngle={2}
                  onClick={(entry: { name?: string }) => entry?.name && navigate("report-builder", { reportType: "expenses" })}
                >
                  {data.expenseBreakdown.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} className="cursor-pointer outline-none" />
                  ))}
                </Pie>
                <RTooltip {...tooltipStyle} formatter={(v: number) => faCompact(v)} />
                <Legend wrapperStyle={{ fontSize: 10.5, fontFamily: "inherit" }} iconSize={8} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard title="فروش در مقابل خرید" subtitle="ماهانه" icon={Wallet} loading={loading} height={260}>
          {data && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.monthly} margin={{ top: 8, left: 0, right: 0, bottom: 0 }} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="month" tick={axisTick} axisLine={false} tickLine={false} />
                <YAxis tick={axisTick} axisLine={false} tickLine={false} tickFormatter={compactTick} width={54} />
                <RTooltip {...tooltipStyle} formatter={(v: number) => faNumber(Math.round(v)) + " تومان"} cursor={{ fill: "var(--accent)" }} />
                <Legend wrapperStyle={{ fontSize: 12, fontFamily: "inherit" }} />
                <Bar dataKey="sales" name="فروش" fill="#10a37f" radius={[6, 6, 0, 0]} maxBarSize={26} />
                <Bar dataKey="purchases" name="خرید" fill="#e8a13c" radius={[6, 6, 0, 0]} maxBarSize={26} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="مشتریان برتر" subtitle="بر اساس مبلغ فروش" icon={HandCoins} loading={loading} height={260}>
          {data && data.topCustomers.length > 0 && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.topCustomers} layout="vertical" margin={{ top: 4, left: 8, right: 16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" tick={axisTick} axisLine={false} tickLine={false} tickFormatter={compactTick} />
                <YAxis type="category" dataKey="name" tick={{ ...axisTick, fontSize: 10 }} axisLine={false} tickLine={false} width={110} reversed />
                <RTooltip {...tooltipStyle} formatter={(v: number) => faCompact(v)} cursor={{ fill: "var(--accent)" }} />
                <Bar dataKey="value" name="فروش" fill="#10a37f" radius={[0, 6, 6, 0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="ترکیب دارایی‌ها" subtitle="سهم از جمع" icon={Landmark} loading={loading} height={260}>
          {data && data.assetBreakdown.length > 0 && (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data.assetBreakdown} dataKey="value" nameKey="name" innerRadius="50%" outerRadius="80%" paddingAngle={2}>
                  {data.assetBreakdown.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[(i + 3) % PIE_COLORS.length]} className="outline-none" />
                  ))}
                </Pie>
                <RTooltip {...tooltipStyle} formatter={(v: number) => faCompact(v)} />
                <Legend wrapperStyle={{ fontSize: 10.5, fontFamily: "inherit" }} iconSize={8} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* ردیف پایین: اسناد اخیر + تحلیل AI */}
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="rounded-xl border bg-card shadow-sm lg:col-span-3">
          <div className="flex items-center justify-between px-5 pt-4">
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <FileText className="size-4" />
              </div>
              <div>
                <p className="text-[15px] font-bold">اسناد اخیر</p>
                <p className="text-xs text-muted-foreground">آخرین تراکنش‌های ثبت‌شده</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => navigate("entries")}>
              همه اسناد
              <ArrowLeft className="size-3.5" />
            </Button>
          </div>
          <div className="p-4">
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-11 w-full rounded-lg" />
                ))}
              </div>
            ) : data && data.recentEntries.length > 0 ? (
              <ul className="max-h-80 space-y-1 overflow-y-auto">
                {data.recentEntries.map((e, i) => (
                  <motion.li
                    key={e.id}
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                  >
                    <button
                      type="button"
                      onClick={() => navigate("entries", { entryId: e.id })}
                      className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-start transition-colors hover:bg-accent"
                    >
                      <span
                        className={cn(
                          "tnum flex size-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold",
                          e.status === "POSTED" ? "bg-primary/10 text-primary" : "bg-warning/15 text-warning"
                        )}
                      >
                        {faNumber(e.number)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium">{e.description}</span>
                        <span className="block text-[11px] text-muted-foreground">
                          {faDateLong(e.date)}
                          {e.source !== "MANUAL" && " • ثبت هوشمند"}
                        </span>
                      </span>
                      <span className="tnum shrink-0 text-[13px] font-semibold">{faCompact(e.amount)}</span>
                    </button>
                  </motion.li>
                ))}
              </ul>
            ) : (
              <EmptyState icon={FileText} title="سندی ثبت نشده است" text="اولین سند حسابداری را ثبت کنید" />
            )}
          </div>
        </div>

        <div className="lg:col-span-2">
          <button
            type="button"
            onClick={() => navigate("ai-insights")}
            className="group relative block h-full w-full overflow-hidden rounded-xl border bg-gradient-to-bl from-emerald-600 to-emerald-800 p-5 text-start text-white shadow-md transition-shadow hover:shadow-xl"
          >
            <div className="absolute -left-8 -bottom-10 size-40 rounded-full bg-amber-400/20 blur-2xl transition-transform duration-500 group-hover:scale-125" />
            <div className="flex items-center gap-2.5">
              <div className="flex size-10 items-center justify-center rounded-xl bg-white/15">
                <Sparkles className="size-5" />
              </div>
              <div>
                <p className="font-bold">تحلیل هوشمند مالی</p>
                <p className="text-[11px] text-white/70">مبتنی بر هوش مصنوعی</p>
              </div>
            </div>
            {loading || !k ? (
              <div className="mt-4 space-y-2">
                <Skeleton className="h-4 w-3/4 bg-white/20" />
                <Skeleton className="h-4 w-1/2 bg-white/20" />
              </div>
            ) : (
              <div className="mt-5 space-y-2.5">
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-white/75">حاشیه سود دوره</span>
                  <span className="tnum font-bold">{faPercent(k.margin)}</span>
                </div>
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-white/75">اسناد در انتظار تأیید</span>
                  <span className="tnum font-bold">{faNumber(k.draftCount)} سند</span>
                </div>
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-white/75">فاکتورهای صادرشده</span>
                  <span className="tnum font-bold">{faNumber(k.invoiceCount)} فاکتور</span>
                </div>
                <div className="mt-4 flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-xs font-medium backdrop-blur transition-colors group-hover:bg-white/20">
                  <Sparkles className="size-4" />
                  مشاهده یافته‌ها و توصیه‌های هوش مصنوعی
                  <ArrowLeft className="mr-auto size-4 transition-transform group-hover:-translate-x-1" />
                </div>
              </div>
            )}
          </button>
        </div>
      </div>

      {/* نوار پیش‌نویس‌ها */}
      {!loading && k && k.draftCount > 0 && (
        <button
          type="button"
          onClick={() => navigate("entries")}
          className="flex items-center gap-3 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-start transition-colors hover:bg-warning/15"
        >
          <div className="flex size-9 items-center justify-center rounded-lg bg-warning/20 text-warning">
            <FileClock className="size-5" />
          </div>
          <div className="flex-1">
            <p className="text-[13px] font-bold">{faNumber(k.draftCount)} سند پیش‌نویس در انتظار تأیید</p>
            <p className="text-xs text-muted-foreground">اسناد پیش‌نویس در محاسبات گزارش‌ها اعمال نمی‌شوند</p>
          </div>
          <Badge variant="outline" className="border-warning/50 text-warning">
            بررسی کنید
          </Badge>
        </button>
      )}
    </SectionShell>
  );
}
