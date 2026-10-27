"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";


export function ChartCard({
  title,
  subtitle,
  icon: Icon,
  children,
  className,
  actions,
  height = 280,
  loading,
}: {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  children?: React.ReactNode; // معمولاً ResponsiveContainer
  className?: string;
  actions?: React.ReactNode;
  height?: number;
  loading?: boolean;
}) {
  return (
    <Card className={cn("overflow-hidden shadow-sm", className)}>
      <CardHeader className="flex-row items-start justify-between space-y-0 pb-2">
        <div className="flex items-start gap-2.5">
          {Icon && (
            <div className="mt-0.5 flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="size-4" aria-hidden />
            </div>
          )}
          <div>
            <CardTitle className="text-[15px] font-bold">{title}</CardTitle>
            {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="flex items-center gap-1 no-print">{actions}</div>}
      </CardHeader>
      <CardContent className="pt-1">
        {loading ? (
          <div style={{ height }} className="flex flex-col justify-center gap-2">
            <Skeleton className="h-full w-full rounded-lg" />
          </div>
        ) : (
          <div style={{ height }} className="w-full">
            {children}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function ChartLegend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {items.map((it) => (
        <span key={it.label} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="size-2.5 rounded-full" style={{ background: it.color }} aria-hidden />
          {it.label}
        </span>
      ))}
    </div>
  );
}
