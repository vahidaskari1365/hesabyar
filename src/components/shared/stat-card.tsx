"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";
import { faNumber } from "@/lib/format";

interface StatCardProps {
  title: string;
  value: string;
  sub?: string;
  icon: LucideIcon;
  tone?: "primary" | "warning" | "destructive" | "muted" | "success";
  trend?: number; // درصد تغییر
  onClick?: () => void;
  index?: number;
  hint?: string;
}

const toneMap: Record<string, string> = {
  primary: "bg-primary/10 text-primary",
  warning: "bg-warning/15 text-warning",
  destructive: "bg-destructive/10 text-destructive",
  muted: "bg-muted text-muted-foreground",
  success: "bg-success/10 text-success",
};

export function StatCard({
  title,
  value,
  sub,
  icon: Icon,
  tone = "primary",
  trend,
  onClick,
  index = 0,
  hint,
}: StatCardProps) {
  const clickable = Boolean(onClick);
  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      whileHover={clickable ? { y: -3, transition: { duration: 0.15 } } : undefined}
      onClick={onClick}
      disabled={!clickable}
      className={cn(
        "text-start relative overflow-hidden rounded-xl border bg-card p-5 shadow-sm transition-shadow",
        clickable && "cursor-pointer hover:shadow-md hover:border-primary/30 focus-visible:ring-2 focus-visible:ring-ring"
      )}
      title={hint}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-muted-foreground">{title}</p>
          <p className="mt-1.5 text-xl font-bold tnum tracking-tight truncate">{value}</p>
          {sub && <p className="mt-1 text-xs text-muted-foreground truncate">{sub}</p>}
        </div>
        <div className={cn("flex size-11 shrink-0 items-center justify-center rounded-lg", toneMap[tone])}>
          <Icon className="size-5" aria-hidden />
        </div>
      </div>
      {typeof trend === "number" && (
        <div
          className={cn(
            "mt-3 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
            trend >= 0 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
          )}
        >
          {trend >= 0 ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
          {faNumber(Math.abs(trend), 1)}٪ نسبت به ماه قبل
        </div>
      )}
    </motion.button>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
        <Skeleton className="size-11 rounded-lg" />
      </div>
    </div>
  );
}
