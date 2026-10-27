"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  FileUp,
  ImagePlus,
  Loader2,
  RotateCcw,
  ScanLine,
  Sparkles,
  Upload,
  Wand2,
  X,
} from "lucide-react";

import { endpoints } from "@/lib/api";
import type { AccountDTO, DocScanResult } from "@/lib/types";
import { faMoney, faNumber, faPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/lib/store";
import { EmptyState, SectionShell } from "@/components/shared/section-shell";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// ─── helpers محلی ────────────────────────────────────────────────

/** تبدیل رشتهٔ حاوی ارقام فارسی/انگلیسی و جداکننده‌ها به عدد */
function parseNum(s: string): number {
  if (!s) return 0;
  const fa = "۰۱۲۳۴۵۶۷۸۹";
  const ar = "٠١٢٣٤٥٦٧٨٩";
  const normalized = s
    .replace(/[۰-۹]/g, (d) => String(fa.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(ar.indexOf(d)))
    .replace(/[,٬،\s]/g, "");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

/** Date امروز → رشتهٔ yyyy-mm-dd محلی */
function toDateInput(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** برگ‌های درخت حساب‌ها */
function flattenLeaves(nodes: AccountDTO[]): AccountDTO[] {
  const out: AccountDTO[] = [];
  const walk = (list: AccountDTO[]) => {
    for (const a of list) {
      if (a.isGroup) walk(a.children ?? []);
      else out.push(a);
    }
  };
  walk(nodes);
  return out;
}

interface SugLine {
  accountCode: string;
  accountName?: string;
  description: string;
  debitText: string;
  creditText: string;
}

const MAX_SIZE = 4 * 1024 * 1024; // ۴ مگابایت
const ANALYZE_STEPS = ["خواندن تصویر", "استخراج اطلاعات", "پیشنهاد ثبت حسابداری"];

// ─── بخش اصلی اسکن هوشمند ────────────────────────────────────────

export default function SmartScanSection() {
  const navigate = useAppStore((s) => s.navigate);

  // فایل و پیش‌نمایش
  const [preview, setPreview] = useState<string | null>(null);
  const [base64, setBase64] = useState<string | null>(null);
  const [mime, setMime] = useState("image/jpeg");
  const [fileName, setFileName] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // تحلیل
  const [analyzing, setAnalyzing] = useState(false);
  const [step, setStep] = useState(0); // 0..2 جاری، ۳ = همه کامل
  const stepTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // نتیجه
  const [result, setResult] = useState<DocScanResult | null>(null);
  const [sugLines, setSugLines] = useState<SugLine[]>([]);

  // حساب‌ها و ثبت
  const [accounts, setAccounts] = useState<AccountDTO[]>([]);
  const leaves = useMemo(() => flattenLeaves(accounts), [accounts]);
  const [submitting, setSubmitting] = useState(false);
  const [registeredNumber, setRegisteredNumber] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setAccounts(await endpoints.accounts());
      } catch {
        toast.error("خطا در دریافت فهرست حساب‌ها");
      }
    })();
  }, []);

  // پاک‌سازی تایمر مراحل هنگام unmount
  useEffect(() => {
    return () => {
      if (stepTimer.current) clearInterval(stepTimer.current);
    };
  }, []);

  // ── انتخاب فایل تصویر ─────────────────────────────────────────
  const handleFile = useCallback((file: File | undefined | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("فقط فایل تصویری (عکس فاکتور یا رسید) پذیرفته می‌شود");
      return;
    }
    if (file.size > MAX_SIZE) {
      toast.error("حجم تصویر باید کمتر از ۴ مگابایت باشد");
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => toast.error("خطا در خواندن فایل");
    reader.onload = () => {
      const dataUrl = String(reader.result ?? "");
      const match = dataUrl.match(/^data:(image\/[^;]+);base64,(.+)$/);
      if (!match) {
        toast.error("فرمت تصویر پشتیبانی نمی‌شود");
        return;
      }
      setMime(match[1]);
      setBase64(match[2]); // payload خالص base64 بدون prefix
      setPreview(dataUrl);
      setFileName(file.name);
      setResult(null);
      setSugLines([]);
      setRegisteredNumber(null);
      setStep(0);
    };
    reader.readAsDataURL(file);
  }, []);

  function resetAll() {
    setPreview(null);
    setBase64(null);
    setFileName("");
    setResult(null);
    setSugLines([]);
    setRegisteredNumber(null);
    setStep(0);
    if (inputRef.current) inputRef.current.value = "";
  }

  // ── تحلیل هوشمند ──────────────────────────────────────────────
  async function analyze() {
    if (!base64) return;
    setAnalyzing(true);
    setStep(0);
    setResult(null);
    setSugLines([]);
    setRegisteredNumber(null);
    if (stepTimer.current) clearInterval(stepTimer.current);
    stepTimer.current = setInterval(() => {
      setStep((s) => Math.min(s + 1, ANALYZE_STEPS.length - 1));
    }, 1400);
    try {
      const r = await endpoints.analyzeDoc(base64, mime);
      if (stepTimer.current) clearInterval(stepTimer.current);
      setStep(ANALYZE_STEPS.length); // همهٔ مراحل کامل
      setResult(r);
      setSugLines(
        (r.suggestion?.lines ?? []).map((l) => ({
          accountCode: l.accountCode,
          accountName: l.accountName,
          description: l.description ?? "",
          debitText: l.debit ? String(l.debit) : "",
          creditText: l.credit ? String(l.credit) : "",
        }))
      );
      toast.success("تحلیل سند کامل شد — پیشنهاد را بازبینی کنید");
    } catch (err) {
      if (stepTimer.current) clearInterval(stepTimer.current);
      toast.error(err instanceof Error ? err.message : "خطا در تحلیل هوشمند سند");
    } finally {
      setAnalyzing(false);
    }
  }

  // ── ویرایش مبالغ پیشنهادی ─────────────────────────────────────
  function updateSugLine(idx: number, patch: Partial<SugLine>) {
    setSugLines((ls) => ls.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }
  function setSugDebit(idx: number, v: string) {
    setSugLines((ls) =>
      ls.map((l, i) => (i === idx ? { ...l, debitText: v, creditText: parseNum(v) > 0 ? "" : l.creditText } : l))
    );
  }
  function setSugCredit(idx: number, v: string) {
    setSugLines((ls) =>
      ls.map((l, i) => (i === idx ? { ...l, creditText: v, debitText: parseNum(v) > 0 ? "" : l.debitText } : l))
    );
  }

  const sugTotals = useMemo(() => {
    const d = sugLines.reduce((s, l) => s + parseNum(l.debitText), 0);
    const c = sugLines.reduce((s, l) => s + parseNum(l.creditText), 0);
    return { d, c, diff: Math.round(d - c), balanced: Math.abs(d - c) < 0.5 && d > 0 };
  }, [sugLines]);

  // ── ثبت به‌عنوان سند پیش‌نویس ─────────────────────────────────
  async function registerDraft() {
    if (!result) return;
    const byCode = new Map(leaves.map((a) => [a.code, a]));
    const payload = sugLines
      .filter((l) => byCode.has(l.accountCode) && (parseNum(l.debitText) > 0 || parseNum(l.creditText) > 0))
      .map((l, i) => ({
        accountId: byCode.get(l.accountCode)!.id,
        debit: parseNum(l.debitText),
        credit: parseNum(l.creditText),
        description: l.description,
        order: i,
      }));
    if (!payload.length) {
      toast.error("هیچ قلم قابل ثبتی با حساب معتبر وجود ندارد");
      return;
    }
    setSubmitting(true);
    try {
      const res = await endpoints.createEntry({
        date: toDateInput(new Date()),
        description:
          result.suggestion?.description ||
          `ثبت ${result.docType ?? "سند"}${result.vendor ? ` — ${result.vendor}` : ""}`,
        status: "DRAFT",
        source: "SCAN",
        aiNote: "ایجادشده توسط اسکن هوشمند",
        lines: payload,
      });
      setRegisteredNumber(res.number);
      toast.success("سند در بخش اسناد ثبت شد");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطا در ثبت سند پیش‌نویس");
    } finally {
      setSubmitting(false);
    }
  }

  const confidence = result?.suggestion?.confidence ?? 0;

  // ─── رندر ──────────────────────────────────────────────────────

  return (
    <SectionShell
      title="اسکن هوشمند اسناد"
      icon={ScanLine}
      description="تصویر فاکتور یا رسید را بارگذاری کنید؛ هوش مصنوعی اطلاعات را استخراج و سند پیشنهاد می‌دهد"
    >
      {/* ناحیه آپلود */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
        {preview ? (
          <div className="rounded-xl border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2 text-sm">
                <FileUp className="size-4 shrink-0 text-primary" />
                <span className="truncate font-medium">{fileName}</span>
                <Badge variant="secondary" className="shrink-0">
                  آمادهٔ تحلیل
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={analyzing}>
                  <Upload className="size-4" />
                  تغییر تصویر
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={resetAll}
                  disabled={analyzing}
                >
                  <X className="size-4" />
                  حذف تصویر
                </Button>
              </div>
            </div>
            <div className="mt-3 flex justify-center overflow-hidden rounded-lg border bg-muted/30 p-2">
              <img src={preview} alt="پیش‌نمایش سند" className="max-h-72 w-auto object-contain" />
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                تصویر واضح و کامل بارگذاری کنید تا دقت استخراج بالاتر رود.
              </p>
              <Button onClick={analyze} disabled={analyzing} className="shadow-sm">
                {analyzing ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}
                {analyzing ? "در حال تحلیل..." : "تحلیل هوشمند سند"}
              </Button>
            </div>
          </div>
        ) : (
          <div
            role="button"
            tabIndex={0}
            aria-label="بارگذاری تصویر سند"
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              handleFile(e.dataTransfer.files?.[0]);
            }}
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed bg-card/60 px-6 py-12 text-center transition-all hover:bg-accent/50 active:scale-[0.99]",
              dragOver && "border-primary bg-primary/5 ring-4 ring-primary/10"
            )}
          >
            <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Upload className="size-7" />
            </div>
            <p className="mt-4 font-semibold">تصویر فاکتور یا رسید را اینجا رها کنید</p>
            <p className="mt-1 text-sm text-muted-foreground">
              یا برای انتخاب فایل کلیک کنید — حداکثر ۴ مگابایت
            </p>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </motion.div>

      {/* مراحل تحلیل */}
      {analyzing && (
        <div className="rounded-xl border bg-card p-4 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-0">
            {ANALYZE_STEPS.map((label, i) => {
              const done = step > i || step >= ANALYZE_STEPS.length;
              const active = step === i && step < ANALYZE_STEPS.length;
              return (
                <div key={label} className="flex flex-1 items-center gap-2 sm:flex-col sm:gap-1.5 sm:text-center">
                  <div className="flex items-center gap-2">
                    {done ? (
                      <CheckCircle2 className="size-5 text-success" />
                    ) : active ? (
                      <Loader2 className="size-5 animate-spin text-primary" />
                    ) : (
                      <div className="size-5 rounded-full border-2 border-muted-foreground/30" />
                    )}
                    <span
                      className={cn(
                        "text-sm",
                        done || active ? "font-medium text-foreground" : "text-muted-foreground"
                      )}
                    >
                      {label}
                    </span>
                  </div>
                  {i < ANALYZE_STEPS.length - 1 && (
                    <div
                      className={cn(
                        "hidden h-0.5 flex-1 rounded-full sm:block",
                        step > i ? "bg-success/60" : "bg-muted-foreground/20"
                      )}
                    />
                  )}
                </div>
              );
            })}
          </div>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            تحلیل تصویر ممکن است چند ثانیه طول بکشد؛ لطفاً صفحه را نبندید.
          </p>
        </div>
      )}

      {/* حالت خالی پیش‌فرض */}
      {!preview && !analyzing && !result && (
        <EmptyState
          icon={ImagePlus}
          title="هنوز سندی تحلیل نشده است"
          text="یک عکس از فاکتور خرید، رسید پرداخت یا قبض بارگذاری کنید تا هوش مصنوعی اطلاعات آن را استخراج و سند حسابداری پیشنهاد دهد."
          action={
            <Button variant="outline" onClick={() => inputRef.current?.click()}>
              <Upload className="size-4" />
              بارگذاری تصویر
            </Button>
          }
        />
      )}

      {/* ── کارت نتیجه ─────────────────────────────────────────── */}
      {result && (
        <div className="space-y-4">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="rounded-xl border bg-card p-4 sm:p-6"
          >
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 font-bold">
                <ScanLine className="size-5 text-primary" />
                اطلاعات استخراج‌شده
              </h3>
              <Badge className="bg-primary/10 text-primary hover:bg-primary/15">{result.docType}</Badge>
            </div>

            <div className="grid gap-3 sm:grid-cols-4">
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">فروشنده / صادرکننده</p>
                <p className="mt-1 truncate text-sm font-semibold">{result.vendor || "—"}</p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">تاریخ سند</p>
                <p className="mt-1 truncate text-sm font-semibold">{result.date || "—"}</p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">مبلغ کل</p>
                <p className="tnum mt-1 text-sm font-semibold">
                  {result.total ? faMoney(result.total) : "—"}
                </p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">مالیات</p>
                <p className="tnum mt-1 text-sm font-semibold">
                  {result.taxAmount ? faMoney(result.taxAmount) : "—"}
                </p>
              </div>
            </div>

            {result.items && result.items.length > 0 && (
              <div className="mt-4 overflow-x-auto rounded-lg border">
                <Table className="min-w-[520px]">
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-start">شرح کالا / خدمات</TableHead>
                      <TableHead className="text-start">تعداد</TableHead>
                      <TableHead className="text-start">قیمت واحد</TableHead>
                      <TableHead className="text-start">جمع</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.items.map((it, i) => (
                      <TableRow key={i} className="hover:bg-transparent">
                        <TableCell className="font-medium">{it.description}</TableCell>
                        <TableCell className="tnum">{it.quantity ?? "—"}</TableCell>
                        <TableCell className="tnum">{it.unitPrice ? faNumber(it.unitPrice) : "—"}</TableCell>
                        <TableCell className="tnum">{it.total ? faNumber(it.total) : "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {result.rawSummary && (
              <p className="mt-4 rounded-lg border border-dashed bg-muted/20 px-3 py-2 text-xs leading-6 text-muted-foreground">
                <b className="text-foreground">خلاصهٔ سند: </b>
                {result.rawSummary}
              </p>
            )}
          </motion.div>

          {/* ── کارت سند پیشنهادی ──────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.1, ease: "easeOut" }}
            className="rounded-xl border border-primary/25 bg-card p-4 sm:p-6"
          >
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 font-bold">
                <Sparkles className="size-5 text-primary" />
                سند پیشنهادی
              </h3>
              {result.suggestion?.description && (
                <span className="max-w-full truncate rounded-md bg-muted px-2.5 py-1 text-xs text-muted-foreground sm:max-w-md">
                  {result.suggestion.description}
                </span>
              )}
            </div>

            {sugLines.length === 0 ? (
              <div className="flex items-center gap-2 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
                <AlertTriangle className="size-4 shrink-0" />
                هیچ قلم حسابداری معتبری از این سند استخراج نشد. ثبت دستی را امتحان کنید.
              </div>
            ) : (
              <>
                <div className="overflow-x-auto rounded-xl border">
                  <div className="min-w-[640px] space-y-2 p-3">
                    <div className="grid grid-cols-[70px_minmax(150px,1.6fr)_110px_110px_minmax(130px,1.4fr)] items-center gap-2 px-1 text-xs font-medium text-muted-foreground">
                      <span>کد</span>
                      <span>حساب</span>
                      <span>بدهکار (تومان)</span>
                      <span>بستانکار (تومان)</span>
                      <span>شرح</span>
                    </div>
                    {sugLines.map((l, idx) => {
                      const known = leaves.some((a) => a.code === l.accountCode);
                      return (
                        <div
                          key={`${l.accountCode}-${idx}`}
                          className="grid grid-cols-[70px_minmax(150px,1.6fr)_110px_110px_minmax(130px,1.4fr)] items-center gap-2"
                        >
                          <span className={cn("tnum truncate text-sm", !known && "text-destructive")}>
                            {l.accountCode}
                          </span>
                          <span className="truncate text-sm font-medium" title={l.accountName}>
                            {l.accountName ?? "—"}
                            {!known && <span className="ms-1 text-xs text-destructive">(نامعتبر)</span>}
                          </span>
                          <Input
                            dir="ltr"
                            inputMode="numeric"
                            value={l.debitText}
                            onChange={(e) => setSugDebit(idx, e.target.value)}
                            placeholder="0"
                            className="tnum h-9 text-start"
                            aria-label={`بدهکار ردیف ${idx + 1}`}
                          />
                          <Input
                            dir="ltr"
                            inputMode="numeric"
                            value={l.creditText}
                            onChange={(e) => setSugCredit(idx, e.target.value)}
                            placeholder="0"
                            className="tnum h-9 text-start"
                            aria-label={`بستانکار ردیف ${idx + 1}`}
                          />
                          <Input
                            value={l.description}
                            onChange={(e) => updateSugLine(idx, { description: e.target.value })}
                            placeholder="شرح قلم..."
                            className="h-9"
                            aria-label={`شرح ردیف ${idx + 1}`}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* نوار تراز */}
                <div
                  className={cn(
                    "mt-3 flex items-center justify-between gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium",
                    sugTotals.balanced
                      ? "border-success/30 bg-success/10 text-success"
                      : "border-destructive/30 bg-destructive/10 text-destructive"
                  )}
                >
                  <span className="flex items-center gap-2">
                    {sugTotals.balanced ? (
                      <CheckCircle2 className="size-4" />
                    ) : (
                      <AlertTriangle className="size-4" />
                    )}
                    {sugTotals.balanced ? "سند تراز است ✓" : "سند تراز نیست"}
                  </span>
                  {!sugTotals.balanced && (
                    <span className="tnum">اختلاف: {faNumber(Math.abs(sugTotals.diff))} تومان</span>
                  )}
                </div>

                {/* نوار اطمینان */}
                <div className="mt-3 rounded-xl border bg-muted/30 px-4 py-3">
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Sparkles className="size-4 text-primary" />
                      سطح اطمینان هوش مصنوعی
                    </span>
                    <span className="tnum font-bold text-primary">{faPercent(confidence * 100)}</span>
                  </div>
                  <Progress value={Math.round(confidence * 100)} aria-label="سطح اطمینان" />
                  {result.suggestion?.note && (
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">{result.suggestion.note}</p>
                  )}
                </div>
              </>
            )}

            <Separator className="my-4" />

            {registeredNumber !== null ? (
              <div className="flex flex-col items-start gap-3 rounded-xl border border-success/30 bg-success/10 p-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="flex items-center gap-2 text-sm font-semibold text-success">
                  <CheckCircle2 className="size-5" />
                  سند پیش‌نویس شماره {faNumber(registeredNumber)} با موفقیت ثبت شد
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={resetAll}>
                    <RotateCcw className="size-4" />
                    اسکن سند جدید
                  </Button>
                  <Button size="sm" onClick={() => navigate("entries")} className="shadow-sm">
                    رفتن به اسناد
                    <ArrowLeft className="size-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  سند به‌صورت پیش‌نویس (غیرقطعی) ثبت می‌شود؛ پس از بازبینی در بخش اسناد قطعی کنید.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={resetAll} disabled={submitting}>
                    <X className="size-4" />
                    انصراف
                  </Button>
                  <Button
                    onClick={registerDraft}
                    disabled={submitting || sugLines.length === 0}
                    className="shadow-sm"
                  >
                    {submitting ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}
                    {submitting ? "در حال ثبت..." : "ثبت به عنوان سند پیش‌نویس"}
                  </Button>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </SectionShell>
  );
}
