// ─── قالب‌بندی اعداد و تاریخ فارسی ───────────────────────────────

/** عدد با جداکننده هزارگان فارسی: ۱٬۲۳۴٬۵۶۷ */
export function faNumber(n: number | null | undefined, digits = 0): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "۰";
  return n.toLocaleString("fa-IR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/** مبلغ کامل با واحد تومان */
export function faMoney(n: number | null | undefined): string {
  return `${faNumber(n)} تومان`;
}

/** خلاصه مبلغ بزرگ: ۱٫۲ میلیارد / ۴۵ میلیون */
export function faCompact(n: number | null | undefined): string {
  const abs = Math.abs(n ?? 0);
  if (abs >= 1_000_000_000) {
    const v = (n ?? 0) / 1_000_000_000;
    return `${faNumber(v, v >= 10 ? 1 : 2)} میلیارد`;
  }
  if (abs >= 1_000_000) {
    const v = (n ?? 0) / 1_000_000;
    return `${faNumber(v, v >= 10 ? 0 : 1)} میلیون`;
  }
  if (abs >= 1_000) return `${faNumber((n ?? 0) / 1_000, 0)} هزار`;
  return faNumber(n);
}

/** تاریخ شمسی: ۱۴۰۴/۰۸/۱۵ */
export function faDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("fa-IR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** تاریخ شمسی خوانا: ۱۵ آبان ۱۴۰۴ */
export function faDateLong(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("fa-IR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

/** ماه شمسی کوتاه برای نمودارها: آبان */
const FA_MONTHS = [
  "فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور",
  "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند",
];
export function faMonthName(date: Date): string {
  return FA_MONTHS[date.getMonth()];
}
export const faMonthNames = FA_MONTHS;

/** درصد فارسی */
export function faPercent(n: number | null | undefined, digits = 1): string {
  return `${faNumber(n, digits)}٪`;
}

/** تبدیل اعداد لاتین رشته به فارسی */
export function toFaDigits(s: string): string {
  return s.replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
}

/** دریافت نام ماه شمسی از تاریخ میلادی + شماره ماه سال مالی */
export function monthLabel(date: Date): string {
  return `${faMonthName(date)}`;
}
