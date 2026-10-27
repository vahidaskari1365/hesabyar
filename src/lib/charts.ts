// ─── تنظیمات نمودارها (recharts) ────────────────────────────────

export const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
  "var(--chart-7)",
];

export const PIE_COLORS = [
  "#10a37f", "#e8a13c", "#e07a3f", "#4a9d9c", "#c76a94", "#8db653", "#8b6fc9", "#d9b658",
];

export const axisTick = {
  fontSize: 11,
  fill: "var(--muted-foreground)",
  fontFamily: "inherit",
};

export const tooltipStyle = {
  contentStyle: {
    background: "var(--popover)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    fontSize: 12,
    fontFamily: "inherit",
    boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
  },
  labelStyle: {
    color: "var(--popover-foreground)",
    fontWeight: 700,
    marginBottom: 4,
  },
  itemStyle: { color: "var(--popover-foreground)" },
};

/** قالب‌بندی محورها با خلاصه مبلغ فارسی — برای استفاده در_tickFormatter */
export function compactTick(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${Math.round(value / 1_000_000)}M`;
  if (abs >= 1_000) return `${Math.round(value / 1_000)}K`;
  return String(value);
}
