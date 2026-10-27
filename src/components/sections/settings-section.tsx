"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { endpoints } from "@/lib/api";
import type { DashboardData, SettingDTO } from "@/lib/types";
import { faNumber, faCompact } from "@/lib/format";
import { SectionShell } from "@/components/shared/section-shell";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Settings,
  Building2,
  Sun,
  Moon,
  Monitor,
  Database,
  Info,
  CheckCircle2,
  FileText,
  Receipt,
  Wallet,
  Calendar,
  Percent,
  Save,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── کمکی: تبدیل ارقام فارسی/عربی به عدد ────────────────────────
const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";

function parseNum(s: string): number {
  const normalized = String(s ?? "")
    .replace(/[۰-۹]/g, (d) => String(FA_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d)))
    .replace(/[^\d.-]/g, "");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

const FEATURES = [
  "ثبت هوشمند اسناد با هوش مصنوعی",
  "اسکن و استخراج اسناد با AI",
  "گزارش‌ساز سفارشی و نمودارهای زنده",
  "تحلیل هوشمند مالی کسب‌وکار",
  "دستیار گفتگویی حسابداری",
];

// ─── بخش تنظیمات ────────────────────────────────────────────────
export default function SettingsSection() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dash, setDash] = useState<DashboardData | null>(null);
  const [saving, setSaving] = useState(false);

  const [companyName, setCompanyName] = useState("");
  const [fiscalYear, setFiscalYear] = useState("");
  const [taxRate, setTaxRate] = useState("");
  const [currency, setCurrency] = useState("");
  const initialized = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const load = useCallback(async () => {
    try {
      const [s, d] = await Promise.all([endpoints.settings(), endpoints.dashboard()]);
      setDash(d);
      if (!initialized.current) {
        initialized.current = true;
        setCompanyName(s.companyName);
        setFiscalYear(s.fiscalYear);
        setTaxRate(String(s.taxRate));
        setCurrency(s.currency);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطا در دریافت تنظیمات");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!companyName.trim()) {
      toast.error("نام شرکت نمی‌تواند خالی باشد");
      return;
    }
    setSaving(true);
    try {
      const updated: Partial<SettingDTO> = {
        companyName: companyName.trim(),
        fiscalYear: fiscalYear.trim(),
        taxRate: parseNum(taxRate),
        currency: currency.trim() || "تومان",
      };
      await endpoints.updateSettings(updated);
      toast.success("تنظیمات ذخیره شد");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطا در ذخیره تنظیمات");
    } finally {
      setSaving(false);
    }
  };

  const isDark = mounted && resolvedTheme === "dark";

  return (
    <SectionShell
      title="تنظیمات"
      description="اطلاعات شرکت و ترجیحات نرم‌افزار"
      icon={Settings}
    >
      <div className="grid gap-4 lg:grid-cols-2">
        {/* اطلاعات شرکت */}
        <Card className="shadow-sm">
          <CardHeader className="flex-row items-center gap-2.5 space-y-0 pb-3">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Building2 className="size-4" aria-hidden />
            </div>
            <div>
              <CardTitle className="text-[15px] font-bold">اطلاعات شرکت</CardTitle>
              <CardDescription className="mt-0.5 text-xs">
                در سربرگ اسناد، فاکتورها و گزارش‌ها استفاده می‌شود
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-3.5">
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="st-company">نام شرکت *</Label>
                  <Input
                    id="st-company"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="شرکت نمونه"
                  />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="st-year" className="gap-1.5">
                      <Calendar className="size-3.5 text-muted-foreground" aria-hidden />
                      سال مالی
                    </Label>
                    <Input
                      id="st-year"
                      value={fiscalYear}
                      onChange={(e) => setFiscalYear(e.target.value)}
                      placeholder="۱۴۰۴"
                      className="tnum"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="st-currency">واحد پول</Label>
                    <Input
                      id="st-currency"
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      placeholder="تومان"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="st-tax" className="gap-1.5">
                    <Percent className="size-3.5 text-muted-foreground" aria-hidden />
                    نرخ مالیات پیش‌فرض (٪)
                  </Label>
                  <Input
                    id="st-tax"
                    value={taxRate}
                    onChange={(e) => setTaxRate(e.target.value)}
                    inputMode="numeric"
                    placeholder="10"
                    className="tnum"
                  />
                </div>
                <Separator />
                <Button onClick={save} disabled={saving} className="gap-1.5">
                  <Save className="size-4" aria-hidden />
                  {saving ? "در حال ذخیره..." : "ذخیره تغییرات"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* ظاهر */}
        <Card className="shadow-sm">
          <CardHeader className="flex-row items-center gap-2.5 space-y-0 pb-3">
            <div className="flex size-8 items-center justify-center rounded-lg bg-warning/15 text-warning">
              <Sun className="size-4" aria-hidden />
            </div>
            <div>
              <CardTitle className="text-[15px] font-bold">ظاهر</CardTitle>
              <CardDescription className="mt-0.5 text-xs">حالت روشن یا تاریک نرم‌افزار</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-xl border bg-muted/40 p-4">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "flex size-10 items-center justify-center rounded-lg transition-colors",
                    isDark ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                  )}
                >
                  {isDark ? <Moon className="size-5" aria-hidden /> : <Sun className="size-5" aria-hidden />}
                </div>
                <div>
                  <p className="text-sm font-semibold">انتخاب تم</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    تم روشن، تاریک یا هماهنگ با سیستم را انتخاب کنید
                  </p>
                </div>
              </div>
              <div
                role="radiogroup"
                aria-label="انتخاب تم"
                className="mt-4 grid grid-cols-3 gap-2"
              >
                {[
                  { value: "light", label: "روشن", icon: Sun },
                  { value: "dark", label: "تاریک", icon: Moon },
                  { value: "system", label: "سیستم", icon: Monitor },
                ].map((opt) => {
                  const active = mounted && theme === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setTheme(opt.value)}
                      className={cn(
                        "flex flex-col items-center gap-1.5 rounded-lg border-2 p-3 text-xs font-medium transition-all",
                        active
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-transparent bg-background text-muted-foreground hover:border-border hover:text-foreground"
                      )}
                    >
                      <opt.icon className="size-4.5" aria-hidden />
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* وضعیت سیستم */}
        <Card className="shadow-sm">
          <CardHeader className="flex-row items-center gap-2.5 space-y-0 pb-3">
            <div className="flex size-8 items-center justify-center rounded-lg bg-success/10 text-success">
              <Database className="size-4" aria-hidden />
            </div>
            <div>
              <CardTitle className="text-[15px] font-bold">وضعیت سیستم</CardTitle>
              <CardDescription className="mt-0.5 text-xs">مرور سریع داده‌های ثبت‌شده</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {loading || !dash ? (
              <div className="grid grid-cols-2 gap-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-16" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-2.5 rounded-lg border p-3">
                  <FileText className="size-4 shrink-0 text-primary" aria-hidden />
                  <div className="min-w-0">
                    <p className="text-[11px] text-muted-foreground">اسناد ثبت‌شده</p>
                    <p className="tnum truncate text-sm font-bold">{faNumber(dash.kpi.entryCount)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 rounded-lg border p-3">
                  <Receipt className="size-4 shrink-0 text-warning" aria-hidden />
                  <div className="min-w-0">
                    <p className="text-[11px] text-muted-foreground">فاکتورها</p>
                    <p className="tnum truncate text-sm font-bold">{faNumber(dash.kpi.invoiceCount)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 rounded-lg border p-3">
                  <Database className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <div className="min-w-0">
                    <p className="text-[11px] text-muted-foreground">اسناد پیش‌نویس</p>
                    <p className="tnum truncate text-sm font-bold">{faNumber(dash.kpi.draftCount)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 rounded-lg border p-3">
                  <Wallet className="size-4 shrink-0 text-success" aria-hidden />
                  <div className="min-w-0">
                    <p className="text-[11px] text-muted-foreground">نقد و بانک</p>
                    <p className="tnum truncate text-sm font-bold">{faCompact(dash.kpi.cashBalance)}</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* درباره */}
        <Card className="shadow-sm">
          <CardHeader className="flex-row items-center gap-2.5 space-y-0 pb-3">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Info className="size-4" aria-hidden />
            </div>
            <div>
              <CardTitle className="flex items-center gap-2 text-[15px] font-bold">
                درباره حساب‌یار هوشمند
                <Badge variant="secondary" className="tnum">نسخه ۱٫۰</Badge>
              </CardTitle>
              <CardDescription className="mt-0.5 text-xs">حسابداری ابری با هوش مصنوعی فارسی</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm leading-6 text-muted-foreground">
              حساب‌یار هوشمند، حسابداری کسب‌وکارهای ایرانی را ساده می‌کند: از ثبت خودکار اسناد و فاکتور
              تا گزارش‌های ترازنامه و سود و زیان، همه‌چیز با رابط فارسی و راست‌به‌چپ و تحلیل هوشمند داده‌های شما.
            </p>
            <ul className="space-y-2">
              {FEATURES.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden />
                  {f}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </SectionShell>
  );
}
