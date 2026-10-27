"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  Lightbulb,
  Loader2,
  RefreshCw,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { endpoints } from "@/lib/api";
import type { AIInsight } from "@/lib/types";
import { SectionShell, EmptyState } from "@/components/shared/section-shell";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

const TYPE_META: Record<
  AIInsight["type"],
  { label: string; icon: React.ComponentType<{ className?: string }>; ring: string; bg: string; text: string }
> = {
  insight: {
    label: "تحلیل روند",
    icon: TrendingUp,
    ring: "border-primary/25",
    bg: "bg-primary/10",
    text: "text-primary",
  },
  warning: {
    label: "هشدار",
    icon: AlertTriangle,
    ring: "border-destructive/25",
    bg: "bg-destructive/10",
    text: "text-destructive",
  },
  success: {
    label: "نقطه قوت",
    icon: CheckCircle2,
    ring: "border-emerald-500/25",
    bg: "bg-emerald-500/10",
    text: "text-emerald-600 dark:text-emerald-400",
  },
  recommendation: {
    label: "توصیه",
    icon: Lightbulb,
    ring: "border-warning/30",
    bg: "bg-warning/10",
    text: "text-warning",
  },
};

export default function AIInsightsSection() {
  const [insights, setInsights] = useState<AIInsight[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (force = false) => {
    if (force) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      setInsights(await endpoints.insights());
    } catch {
      setInsights([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <SectionShell
      title="تحلیل هوشمند مالی"
      description="یافته‌ها، هشدارها و توصیه‌های تولیدشده توسط هوش مصنوعی بر اساس داده‌های واقعی حساب‌ها"
      icon={BrainCircuit}
      actions={
        <Button variant="outline" size="sm" onClick={() => load(true)} disabled={refreshing}>
          <RefreshCw className={cn("size-4", refreshing && "animate-spin")} />
          تحلیل مجدد
        </Button>
      }
    >
      {/* هدر توضیحی */}
      <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-gradient-to-l from-primary/10 via-primary/5 to-transparent p-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <Sparkles className="size-5" />
        </div>
        <div>
          <p className="text-sm font-bold">موتور تحلیل حساب‌یار</p>
          <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">
            تمام اسناد قطعی، گردش حساب‌ها و صورت‌های مالی به‌صورت خودکار بررسی می‌شوند و هر ۱۰ دقیقه یافته‌های
            تازه به‌روزرسانی می‌گردد. نتایج جایگزین قضاوت حرفه‌ای حسابدار نیست.
          </p>
        </div>
      </div>

      {/* کارت‌های یافته */}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border bg-card p-5">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <Skeleton className="mt-3 h-5 w-2/3" />
              <Skeleton className="mt-2 h-4 w-full" />
              <Skeleton className="mt-1 h-4 w-3/4" />
            </div>
          ))}
        </div>
      ) : !insights || insights.length === 0 ? (
        <EmptyState
          icon={BrainCircuit}
          title="یافته‌ای موجود نیست"
          text="برای دریافت تحلیل، دکمه «تحلیل مجدد» را بزنید. در صورت ادامه مشکل، از دستیار هوشمند استفاده کنید."
          action={
            <Button onClick={() => load(true)} disabled={refreshing} size="sm">
              {refreshing ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              تحلیل مجدد
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {insights.map((ins, i) => {
            const meta = TYPE_META[ins.type] ?? TYPE_META.insight;
            return (
              <motion.article
                key={`${ins.title}-${i}`}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                className={cn("group relative overflow-hidden rounded-xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md", meta.ring)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className={cn("flex size-10 items-center justify-center rounded-xl", meta.bg, meta.text)}>
                    <meta.icon className="size-5" />
                  </div>
                  <Badge variant="outline" className={cn("border-current/30 text-[10px]", meta.text)}>
                    {meta.label}
                  </Badge>
                </div>
                <h3 className="mt-3 text-[15px] font-bold leading-snug">{ins.title}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{ins.text}</p>
                {ins.metric && (
                  <div className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1.5">
                    <TrendingUp className="size-3.5 text-muted-foreground" />
                    <span className="tnum text-xs font-semibold">{ins.metric}</span>
                  </div>
                )}
                <span className="pointer-events-none absolute -left-5 -bottom-6 size-20 rounded-full bg-primary/5 transition-transform duration-500 group-hover:scale-150" />
              </motion.article>
            );
          })}
        </div>
      )}
    </SectionShell>
  );
}
