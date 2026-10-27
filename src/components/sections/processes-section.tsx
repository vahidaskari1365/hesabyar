"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  CalendarCheck,
  CheckCircle2,
  Database,
  FolderSync,
  HandCoins,
  Info,
  Loader2,
  Play,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  Workflow,
  XCircle,
  Clock,
  MemoryStick,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { SectionShell } from "@/components/shared/section-shell";
import { StatCard } from "@/components/shared/stat-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { endpoints } from "@/lib/api";
import { useAppStore } from "@/lib/store";
import { faNumber } from "@/lib/format";
import type { ProcessDefinition, ProcessResult } from "@/lib/types";
import { cn } from "@/lib/utils";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  CalendarCheck,
  FolderSync,
  HandCoins,
  ShieldCheck,
  Sparkles,
  RefreshCcw,
};

const CATEGORY_LABELS: Record<string, string> = {
  automation: "اتوماسیون",
  ai: "هوشمند",
  audit: "کنترل و ممیزی",
  system: "سیستمی",
};

const STEP_STATUS: Record<
  string,
  { icon: React.ComponentType<{ className?: string }>; className: string; label: string }
> = {
  ok: { icon: CheckCircle2, className: "text-emerald-500", label: "انجام شد" },
  fixed: { icon: CheckCircle2, className: "text-amber-500", label: "اصلاح شد" },
  warn: { icon: TriangleAlert, className: "text-amber-500", label: "هشدار" },
  error: { icon: XCircle, className: "text-red-500", label: "خطا" },
  info: { icon: Info, className: "text-muted-foreground", label: "اطلاعات" },
};

interface HistoryItem {
  processId: string;
  name: string;
  success: boolean;
  durationMs: number;
  result: ProcessResult;
}

export default function ProcessesSection() {
  const navigate = useAppStore((s) => s.navigate);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"database" | "memory">("memory");
  const [processes, setProcesses] = useState<ProcessDefinition[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pending, setPending] = useState<ProcessDefinition | null>(null);
  const [executing, setExecuting] = useState(false);
  const [animSteps, setAnimSteps] = useState(0);
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [expandedStep, setExpandedStep] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let alive = true;
    endpoints
      .processes()
      .then((res) => {
        if (!alive) return;
        setMode(res.mode);
        setProcesses(res.processes);
      })
      .catch(() => toast.error("خطا در دریافت فهرست فرآیندها"))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  function openDialog(p: ProcessDefinition) {
    setPending(p);
    setResult(null);
    setExecuting(false);
    setAnimSteps(0);
    setExpandedStep(null);
    setDialogOpen(true);
    if (!p.danger) {
      void execute(p);
    }
  }

  async function execute(p: ProcessDefinition) {
    setExecuting(true);
    setAnimSteps(0);
    setExpandedStep(null);
    // انیمیشن پیشرفت نمایشی
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setAnimSteps((s) => Math.min(s + 1, Math.max(p.steps.length - 1, 0)));
    }, 650);
    try {
      const res = await endpoints.runProcess(p.id);
      setResult(res);
      setAnimSteps(p.steps.length);
      setHistory((h) => [
        { processId: p.id, name: p.name, success: res.success, durationMs: res.durationMs, result: res },
        ...h.slice(0, 9),
      ]);
      toast.success(`فرآیند «${p.name}» اجرا شد`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا در اجرای فرآیند");
      setDialogOpen(false);
    } finally {
      if (timerRef.current) clearInterval(timerRef.current);
      setExecuting(false);
    }
  }

  if (loading) {
    return (
      <SectionShell title="فرآیندها و اتوماسیون" description="در حال بارگذاری...">
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      </SectionShell>
    );
  }

  const maxItemValue = (items: { value: number }[] | undefined) =>
    items && items.length > 0 ? Math.max(...items.map((i) => Math.abs(i.value)), 1) : 1;

  const dialogState: "confirm" | "running" | "result" =
    result ? "result" : executing ? "running" : pending?.danger ? "confirm" : "running";

  return (
    <SectionShell
      title="فرآیندها و اتوماسیون"
      description="اجرای خودکار چرخه‌های حسابداری با یک کلیک — هر فرآیند روی داده واقعی شما اجرا می‌شود"
    >
      {/* آمار بالای صفحه */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          title="فرآیندهای آماده"
          value={faNumber(processes.length)}
          icon={Workflow}
          hint="چرخه‌های اجرایی حسابداری"
          index={0}
        />
        <StatCard
          title="حالت داده"
          value={mode === "memory" ? "حافظه (بدون دیتابیس)" : "دیتابیس SQLite"}
          icon={mode === "memory" ? MemoryStick : Database}
          tone={mode === "memory" ? "warning" : "success"}
          hint={mode === "memory" ? "داده نمونه — بدون نیاز به دیتابیس" : "داده روی SQLite ذخیره می‌شود"}
          index={1}
        />
        <StatCard
          title="اجراهای اخیر"
          value={faNumber(history.length)}
          icon={Clock}
          tone="muted"
          hint="در همین نشست مرورگر"
          index={2}
        />
      </div>

      {/* کارت‌های فرآیند */}
      <div className="grid gap-4 sm:grid-cols-2">
        {processes.map((p, idx) => {
          const Icon = ICONS[p.icon] ?? Workflow;
          return (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
            >
              <button
                type="button"
                onClick={() => openDialog(p)}
                className={cn(
                  "group flex h-full w-full flex-col rounded-xl border bg-card p-5 text-start shadow-sm transition-all hover:border-primary/40 hover:shadow-md",
                  p.danger && "border-amber-500/30 hover:border-amber-500/60"
                )}
                aria-label={`اجرای فرآیند ${p.name}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div
                    className={cn(
                      "flex size-11 shrink-0 items-center justify-center rounded-xl",
                      p.category === "ai"
                        ? "bg-primary/10 text-primary"
                        : p.danger
                          ? "bg-amber-500/10 text-amber-600"
                          : "bg-emerald-500/10 text-emerald-600"
                    )}
                  >
                    <Icon className="size-5.5" />
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-1.5">
                    <Badge variant="secondary" className="text-[10px]">
                      {CATEGORY_LABELS[p.category]}
                    </Badge>
                    {p.category === "ai" && (
                      <Badge className="bg-primary/15 text-[10px] text-primary hover:bg-primary/15">AI</Badge>
                    )}
                    {p.memoryOnly && (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">
                        فقط حالت حافظه
                      </Badge>
                    )}
                  </div>
                </div>
                <h3 className="mt-3 text-[15px] font-bold">{p.name}</h3>
                <p className="mt-1.5 flex-1 text-xs leading-relaxed text-muted-foreground">{p.description}</p>
                <div className="mt-3 flex items-center justify-between gap-2 border-t pt-3">
                  <span className="text-[11px] text-muted-foreground">
                    {faNumber(p.steps.length)} مرحله اجرایی
                  </span>
                  <span
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors",
                      p.danger
                        ? "bg-amber-500/10 text-amber-600 group-hover:bg-amber-500/20"
                        : "bg-primary/10 text-primary group-hover:bg-primary/20"
                    )}
                  >
                    <Play className="size-3.5" />
                    اجرای فرآیند
                  </span>
                </div>
              </button>
            </motion.div>
          );
        })}
      </div>

      {/* تاریخچه اجراها */}
      {history.length > 0 && (
        <div className="rounded-xl border bg-card p-4">
          <h3 className="flex items-center gap-2 text-sm font-bold">
            <Clock className="size-4 text-muted-foreground" />
            تاریخچه اجراها — برای مشاهده جزئیات کلیک کنید
          </h3>
          <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pe-1">
            {history.map((h, i) => (
              <button
                key={`${h.processId}-${i}`}
                type="button"
                onClick={() => {
                  setPending(processes.find((p) => p.id === h.processId) ?? null);
                  setResult(h.result);
                  setExecuting(false);
                  setDialogOpen(true);
                }}
                className="flex w-full items-center justify-between gap-2 rounded-lg border bg-background/50 px-3 py-2 text-start text-xs transition-colors hover:border-primary/40 hover:bg-accent"
              >
                <span className="flex items-center gap-2 font-medium">
                  {h.success ? (
                    <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
                  ) : (
                    <XCircle className="size-4 shrink-0 text-red-500" />
                  )}
                  {h.name}
                </span>
                <span className="tnum shrink-0 text-muted-foreground">
                  {faNumber(h.durationMs)} میلی‌ثانیه
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* دیالوگ اجرای فرآیند */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Workflow className="size-5 text-primary" />
              {pending?.name ?? "اجرای فرآیند"}
            </DialogTitle>
            <DialogDescription>
              {dialogState === "result" && result
                ? `اجرا در ${faNumber(result.durationMs)} میلی‌ثانیه — ${result.success ? "با موفقیت انجام شد" : "با هشدار/خطا خاتمه یافت"}`
                : dialogState === "confirm"
                  ? "این فرآیند داده‌های فعلی را بازنویسی می‌کند"
                  : "فرآیند در حال اجرا روی داده واقعی شماست"}
            </DialogDescription>
          </DialogHeader>

          {/* تأیید فرآیند خطرناک */}
          {dialogState === "confirm" && pending && (
            <div className="space-y-4 py-2">
              <div className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/5 p-4">
                <TriangleAlert className="mt-0.5 size-5 shrink-0 text-amber-500" />
                <div className="text-sm">
                  <p className="font-bold text-amber-600">تأیید اجرا لازم است</p>
                  <p className="mt-1 leading-relaxed text-muted-foreground">
                    با اجرای «{pending.name}» تمام داده‌های فعلی پاک شده و داده نمونه تازه جایگزین می‌شود.
                    این عمل قابل بازگشت نیست.
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  className="flex-1 bg-amber-500 text-white hover:bg-amber-600"
                  onClick={() => void execute(pending)}
                >
                  <RefreshCcw className="size-4" />
                  بله، بازنشانی کن
                </Button>
                <Button variant="outline" className="flex-1" onClick={() => setDialogOpen(false)}>
                  انصراف
                </Button>
              </div>
            </div>
          )}

          {/* حالت در حال اجرا */}
          {dialogState === "running" && pending && (
            <div className="space-y-3 py-2">
              {pending.steps.map((stepTitle, i) => {
                const state = i < animSteps ? "done" : i === animSteps ? "active" : "pending";
                return (
                  <div key={i} className="flex items-center gap-3">
                    {state === "done" ? (
                      <CheckCircle2 className="size-5 shrink-0 text-emerald-500" />
                    ) : state === "active" ? (
                      <Loader2 className="size-5 shrink-0 animate-spin text-primary" />
                    ) : (
                      <span className="size-5 shrink-0 rounded-full border-2 border-muted" />
                    )}
                    <span
                      className={cn(
                        "text-sm",
                        state === "pending" ? "text-muted-foreground/50" : "font-medium"
                      )}
                    >
                      {stepTitle}
                    </span>
                  </div>
                );
              })}
              <Progress value={(animSteps / Math.max(pending.steps.length, 1)) * 100} className="mt-3" />
            </div>
          )}

          {/* نتیجه */}
          {dialogState === "result" && result && (
            <div className="space-y-3 py-1">
              {result.steps.map((step, i) => {
                const st = STEP_STATUS[step.status] ?? STEP_STATUS.info;
                const StepIcon = st.icon;
                const expanded = expandedStep === step.id;
                const hasDetail = Boolean((step.metrics?.length ?? 0) + (step.items?.length ?? 0));
                return (
                  <motion.div
                    key={step.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06 }}
                    className="rounded-xl border bg-card"
                  >
                    <button
                      type="button"
                      onClick={() => hasDetail && setExpandedStep(expanded ? null : step.id)}
                      className={cn(
                        "flex w-full items-center gap-3 p-3.5 text-start",
                        hasDetail && "cursor-pointer hover:bg-accent/50"
                      )}
                    >
                      <StepIcon className={cn("size-5 shrink-0", st.className)} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold">{step.title}</p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">{step.message}</p>
                      </div>
                      <Badge variant="secondary" className="shrink-0 text-[10px]">
                        {st.label}
                      </Badge>
                      {hasDetail && (
                        <ChevronDown
                          className={cn(
                            "size-4 shrink-0 text-muted-foreground transition-transform",
                            expanded && "rotate-180"
                          )}
                        />
                      )}
                    </button>

                    {expanded && (
                      <div className="space-y-4 border-t px-3.5 pb-4 pt-3">
                        {step.metrics && step.metrics.length > 0 && (
                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                            {step.metrics.map((m) => (
                              <div key={m.label} className="rounded-lg bg-accent/60 p-2.5">
                                <p className="text-[10px] text-muted-foreground">{m.label}</p>
                                <p className="tnum mt-1 text-xs font-bold leading-relaxed">{m.value}</p>
                              </div>
                            ))}
                          </div>
                        )}
                        {step.items && step.items.length > 0 && (
                          <div className="space-y-2">
                            {step.items.map((item, j) => {
                              const pct =
                                item.value > 0
                                  ? (Math.abs(item.value) / maxItemValue(step.items)) * 100
                                  : 0;
                              return (
                                <div
                                  key={`${item.label}-${j}`}
                                  className="rounded-lg border bg-background/50 p-2.5"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="flex min-w-0 items-center gap-1.5 text-xs">
                                      {item.status === "error" && (
                                        <XCircle className="size-3.5 shrink-0 text-red-500" />
                                      )}
                                      {item.status === "warn" && (
                                        <TriangleAlert className="size-3.5 shrink-0 text-amber-500" />
                                      )}
                                      {(!item.status || item.status === "ok") && (
                                        <CheckCircle2 className="size-3.5 shrink-0 text-emerald-500" />
                                      )}
                                      <span className="truncate font-medium">{item.label}</span>
                                      {item.hint && (
                                        <Badge variant="outline" className="shrink-0 text-[9px]">
                                          {item.hint}
                                        </Badge>
                                      )}
                                    </span>
                                    {item.value > 0 && (
                                      <span className="tnum shrink-0 text-[11px] text-muted-foreground">
                                        {faNumber(item.value)}
                                      </span>
                                    )}
                                  </div>
                                  {pct > 0 && <Progress value={pct} className="mt-2 h-1.5" />}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </motion.div>
                );
              })}

              {/* اکشن‌های پس از اجرا */}
              <div className="flex flex-wrap gap-2 pt-1">
                {result.processId === "close-month" || result.processId === "sync-invoices" ? (
                  <>
                    <Button size="sm" variant="outline" onClick={() => navigate("entries")}>
                      مشاهده اسناد
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate("reports", { reportType: "trial-balance" })}
                    >
                      تراز آزمایشی
                    </Button>
                  </>
                ) : null}
                {result.processId === "collect-receivables" && (
                  <Button size="sm" variant="outline" onClick={() => navigate("contacts")}>
                    مشاهده طرف‌حساب‌ها
                  </Button>
                )}
                {result.processId === "ai-advisor" && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => navigate("dashboard")}>
                      داشبورد مالی
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => navigate("ai-insights")}>
                      تحلیل هوشمند
                    </Button>
                  </>
                )}
                {result.processId === "audit" && (
                  <Button size="sm" variant="outline" onClick={() => navigate("reports")}>
                    گزارش‌های مالی
                  </Button>
                )}
                {result.processId === "reset-demo" && (
                  <Button size="sm" variant="outline" onClick={() => navigate("dashboard")}>
                    رفتن به داشبورد
                  </Button>
                )}
                {pending && !pending.danger && (
                  <Button size="sm" variant="ghost" onClick={() => void execute(pending)}>
                    <RefreshCcw className="size-3.5" />
                    اجرای مجدد
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </SectionShell>
  );
}
