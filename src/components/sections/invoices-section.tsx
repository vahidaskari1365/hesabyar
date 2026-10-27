"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { endpoints } from "@/lib/api";
import type { ContactDTO, InvoiceDTO } from "@/lib/types";
import { faNumber, faCompact, faDate, faDateLong, faPercent } from "@/lib/format";
import { SectionShell, EmptyState } from "@/components/shared/section-shell";
import { StatCard, StatCardSkeleton } from "@/components/shared/stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Receipt,
  Plus,
  Trash2,
  Eye,
  FileSpreadsheet,
  Database,
  FileText,
  Calendar,
  Percent,
  Wallet,
  UserRound,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
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

function localToday(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

type InvoiceType = "SALES" | "PURCHASE";
type TabKey = "ALL" | InvoiceType;

const typeBadge: Record<InvoiceType, string> = {
  SALES: "border-success/30 bg-success/15 text-success",
  PURCHASE: "border-warning/40 bg-warning/15 text-warning",
};

const TYPE_LABELS: Record<InvoiceType, string> = { SALES: "فروش", PURCHASE: "خرید" };

interface DraftItem {
  description: string;
  quantity: string;
  unitPrice: string;
}

const emptyItem: DraftItem = { description: "", quantity: "1", unitPrice: "" };

// ─── بخش فاکتورها ───────────────────────────────────────────────
export default function InvoicesSection() {
  const navigate = useAppStore((s) => s.navigate);

  const [invoices, setInvoices] = useState<InvoiceDTO[]>([]);
  const [contacts, setContacts] = useState<ContactDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>("ALL");
  const [detailInvoice, setDetailInvoice] = useState<InvoiceDTO | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<InvoiceDTO | null>(null);
  const [deleting, setDeleting] = useState(false);

  // فرم فاکتور جدید
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fType, setFType] = useState<InvoiceType>("SALES");
  const [fContact, setFContact] = useState("");
  const [fDate, setFDate] = useState(localToday());
  const [fItems, setFItems] = useState<DraftItem[]>([{ ...emptyItem }]);
  const [fTax, setFTax] = useState("10");
  const [fPayment, setFPayment] = useState<"CASH" | "CREDIT">("CASH");
  const [fCreateEntry, setFCreateEntry] = useState(true);

  const load = useCallback(async () => {
    try {
      const [inv, cnt] = await Promise.all([endpoints.invoices(), endpoints.contacts()]);
      setInvoices(inv);
      setContacts(cnt);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطا در دریافت فاکتورها");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(
    () => (tab === "ALL" ? invoices : invoices.filter((i) => i.type === tab)),
    [invoices, tab]
  );

  const stats = useMemo(() => {
    let sales = 0;
    let purchase = 0;
    for (const i of invoices) {
      if (i.type === "SALES") sales += i.grandTotal;
      else purchase += i.grandTotal;
    }
    return { sales, purchase, count: invoices.length };
  }, [invoices]);

  // جمع‌های زنده فرم
  const formTotals = useMemo(() => {
    const total = fItems.reduce((s, it) => s + parseNum(it.quantity) * parseNum(it.unitPrice), 0);
    const rate = parseNum(fTax);
    const tax = Math.round((total * rate) / 100);
    return { total, tax, grand: total + tax, rate };
  }, [fItems, fTax]);

  const openCreate = () => {
    setFType(tab === "ALL" ? "SALES" : tab);
    setFContact("");
    setFDate(localToday());
    setFItems([{ ...emptyItem }]);
    setFTax("10");
    setFPayment("CASH");
    setFCreateEntry(true);
    setCreateOpen(true);
  };

  const updateItem = (idx: number, patch: Partial<DraftItem>) => {
    setFItems((items) => items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  const submitInvoice = async () => {
    if (!fContact) {
      toast.error("انتخاب طرف‌حساب الزامی است");
      return;
    }
    const items = fItems.map((it) => ({
      description: it.description.trim(),
      quantity: parseNum(it.quantity),
      unitPrice: parseNum(it.unitPrice),
    }));
    if (items.reduce((s, it) => s + it.quantity * it.unitPrice, 0) <= 0) {
      toast.error("حداقل یک ردیف با مبلغ بزرگ‌تر از صفر وارد کنید");
      return;
    }
    setSaving(true);
    try {
      const res = await endpoints.createInvoice({
        type: fType,
        contactId: fContact,
        date: fDate,
        items,
        taxRate: parseNum(fTax),
        paymentType: fPayment,
        createEntry: fCreateEntry,
      });
      toast.success(`فاکتور ${faNumber(res.number)} ثبت شد`);
      setCreateOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطا در ثبت فاکتور");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await endpoints.deleteInvoice(deleteTarget.id);
      toast.success(`فاکتور ${faNumber(deleteTarget.number)} حذف شد`);
      setDeleteTarget(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطا در حذف فاکتور");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <SectionShell
      title="فاکتورها"
      description="فاکتور فروش و خرید با ثبت خودکار سند حسابداری"
      icon={Receipt}
      actions={
        <Button onClick={openCreate} className="gap-1.5">
          <Plus className="size-4" aria-hidden />
          فاکتور جدید
        </Button>
      }
    >
      {/* کارت‌های آماری */}
      {loading ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard title="جمع فروش" value={faCompact(stats.sales)} sub="جمع نهایی فاکتورهای فروش" icon={Receipt} tone="success" />
          <StatCard title="جمع خرید" value={faCompact(stats.purchase)} sub="جمع نهایی فاکتورهای خرید" icon={FileSpreadsheet} tone="warning" />
          <StatCard title="تعداد کل فاکتورها" value={faNumber(stats.count)} icon={Database} tone="primary" />
        </div>
      )}

      {/* تب‌های فیلتر */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="ALL" className="flex-1 sm:flex-none">همه</TabsTrigger>
          <TabsTrigger value="SALES" className="flex-1 sm:flex-none">فروش</TabsTrigger>
          <TabsTrigger value="PURCHASE" className="flex-1 sm:flex-none">خرید</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* جدول فاکتورها */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="فاکتوری یافت نشد"
          text={tab === "ALL" ? "اولین فاکتور را ثبت کنید." : "در این دسته فاکتوری وجود ندارد."}
          action={
            <Button variant="outline" onClick={openCreate} className="gap-1.5">
              <Plus className="size-4" aria-hidden />
              فاکتور جدید
            </Button>
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
          <Table className="min-w-[720px]">
            <TableHeader>
              <TableRow>
                <TableHead className="text-start">شماره</TableHead>
                <TableHead className="text-start">تاریخ</TableHead>
                <TableHead className="text-start">طرف‌حساب</TableHead>
                <TableHead className="text-end">مبلغ</TableHead>
                <TableHead className="text-end">مالیات</TableHead>
                <TableHead className="text-end">جمع نهایی</TableHead>
                <TableHead className="text-end">عملیات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((inv) => (
                <TableRow
                  key={inv.id}
                  className="cursor-pointer hover:bg-accent/40"
                  onClick={() => setDetailInvoice(inv)}
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="tnum font-bold">{faNumber(inv.number)}</span>
                      <Badge className={cn("border px-1.5 text-[10px]", typeBadge[inv.type])} variant="outline">
                        {TYPE_LABELS[inv.type]}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="tnum whitespace-nowrap text-sm">{faDate(inv.date)}</TableCell>
                  <TableCell className="max-w-40 truncate text-sm">{inv.contactName ?? "—"}</TableCell>
                  <TableCell className="tnum text-end text-sm">{faNumber(inv.total)}</TableCell>
                  <TableCell className="tnum text-end text-sm text-muted-foreground">
                    {faNumber(inv.taxAmount)}
                  </TableCell>
                  <TableCell className="tnum text-end font-bold">{faNumber(inv.grandTotal)}</TableCell>
                  <TableCell className="text-end" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground hover:text-foreground"
                        title="مشاهده"
                        onClick={() => setDetailInvoice(inv)}
                      >
                        <Eye className="size-3.5" aria-hidden />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground hover:text-destructive"
                        title="حذف"
                        onClick={() => setDeleteTarget(inv)}
                      >
                        <Trash2 className="size-3.5" aria-hidden />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Dialog جزئیات فاکتور */}
      <Dialog open={!!detailInvoice} onOpenChange={(v) => !v && setDetailInvoice(null)}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-xl">
          {detailInvoice && (
            <>
              <DialogHeader>
                <DialogTitle className="flex flex-wrap items-center gap-2">
                  <span className="tnum">فاکتور {faNumber(detailInvoice.number)}</span>
                  <Badge className={cn("border", typeBadge[detailInvoice.type])} variant="outline">
                    {TYPE_LABELS[detailInvoice.type]}
                  </Badge>
                </DialogTitle>
                <DialogDescription className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span className="inline-flex items-center gap-1">
                    <UserRound className="size-3.5" aria-hidden />
                    {detailInvoice.contactName ?? "—"}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="size-3.5" aria-hidden />
                    {faDateLong(detailInvoice.date)}
                  </span>
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {/* ردیف‌ها */}
                <div className="overflow-hidden rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-start">شرح</TableHead>
                        <TableHead className="text-end">تعداد</TableHead>
                        <TableHead className="text-end">قیمت واحد</TableHead>
                        <TableHead className="text-end">جمع</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detailInvoice.items.map((it) => (
                        <TableRow key={it.id ?? it.description}>
                          <TableCell className="text-sm">{it.description}</TableCell>
                          <TableCell className="tnum text-end text-sm">{faNumber(it.quantity)}</TableCell>
                          <TableCell className="tnum text-end text-sm">{faNumber(it.unitPrice)}</TableCell>
                          <TableCell className="tnum text-end text-sm font-bold">{faNumber(it.total)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* جمع‌ها */}
                <div className="space-y-1.5 rounded-lg bg-muted/60 p-3 text-sm">
                  <p className="flex items-center justify-between">
                    <span className="text-muted-foreground">مبلغ کل</span>
                    <span className="tnum font-medium">{faNumber(detailInvoice.total)}</span>
                  </p>
                  <p className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <Percent className="size-3.5" aria-hidden />
                      مالیات ({faPercent(detailInvoice.taxRate, 0)})
                    </span>
                    <span className="tnum font-medium">{faNumber(detailInvoice.taxAmount)}</span>
                  </p>
                  <Separator />
                  <p className="flex items-center justify-between text-base font-bold">
                    <span>جمع نهایی</span>
                    <span className="tnum text-success">{faNumber(detailInvoice.grandTotal)} تومان</span>
                  </p>
                </div>

                {/* سند مرتبط */}
                {detailInvoice.entryId && (
                  <Card className="border-primary/30 bg-primary/5 shadow-none">
                    <CardContent className="flex flex-wrap items-center justify-between gap-2 p-3">
                      <p className="flex items-center gap-2 text-sm font-medium">
                        <FileText className="size-4 text-primary" aria-hidden />
                        سند حسابداری مرتبط به‌صورت خودکار ثبت شده است
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5"
                        onClick={() => navigate("entries", { entryId: detailInvoice.entryId as string })}
                      >
                        <FileText className="size-3.5" aria-hidden />
                        مشاهده سند
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog فاکتور جدید */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="size-4 text-primary" aria-hidden />
              فاکتور جدید
            </DialogTitle>
            <DialogDescription>ثبت فاکتور با ثبت خودکار سند حسابداری دوطرفه</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-1">
            {/* نوع + نحوه پرداخت */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>نوع فاکتور</Label>
                <div className="grid grid-cols-2 rounded-lg bg-muted p-1" role="group" aria-label="نوع فاکتور">
                  {(["SALES", "PURCHASE"] as InvoiceType[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setFType(t)}
                      className={cn(
                        "rounded-md px-3 py-1.5 text-sm font-medium transition-all",
                        fType === t
                          ? "bg-card text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {TYPE_LABELS[t]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>نحوه پرداخت</Label>
                <Select value={fPayment} onValueChange={(v) => setFPayment(v as "CASH" | "CREDIT")}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CASH">
                      <span className="inline-flex items-center gap-1.5">
                        <Wallet className="size-3.5" aria-hidden /> نقدی
                      </span>
                    </SelectItem>
                    <SelectItem value="CREDIT">
                      <span className="inline-flex items-center gap-1.5">
                        <Calendar className="size-3.5" aria-hidden /> نسیه (اعتباری)
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* طرف‌حساب + تاریخ */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>
                  طرف‌حساب <span className="text-destructive">*</span>
                </Label>
                <Select value={fContact || "__none"} onValueChange={(v) => setFContact(v === "__none" ? "" : v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="انتخاب کنید..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none" disabled>
                      انتخاب کنید...
                    </SelectItem>
                    {contacts.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="inv-date">تاریخ</Label>
                <Input
                  id="inv-date"
                  type="date"
                  dir="ltr"
                  className="tnum text-start"
                  value={fDate}
                  onChange={(e) => setFDate(e.target.value)}
                />
              </div>
            </div>

            {/* ردیف‌ها */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>ردیف‌های فاکتور</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={() => setFItems((items) => [...items, { ...emptyItem }])}
                >
                  <Plus className="size-3.5" aria-hidden />
                  افزودن ردیف
                </Button>
              </div>
              <div className="space-y-2">
                {fItems.map((it, idx) => {
                  const rowTotal = parseNum(it.quantity) * parseNum(it.unitPrice);
                  return (
                    <div
                      key={idx}
                      className="grid grid-cols-2 items-center gap-2 rounded-lg border bg-muted/30 p-2 sm:grid-cols-[1fr_4.5rem_6.5rem_6.5rem_2rem]"
                    >
                      <div className="col-span-2 sm:col-span-1">
                        <Input
                          value={it.description}
                          onChange={(e) => updateItem(idx, { description: e.target.value })}
                          placeholder="شرح کالا / خدمات"
                          className="h-8 text-sm"
                        />
                      </div>
                      <Input
                        value={it.quantity}
                        onChange={(e) => updateItem(idx, { quantity: e.target.value })}
                        placeholder="تعداد"
                        inputMode="numeric"
                        className="tnum h-8 text-center text-sm"
                      />
                      <Input
                        value={it.unitPrice}
                        onChange={(e) => updateItem(idx, { unitPrice: e.target.value })}
                        placeholder="قیمت واحد"
                        inputMode="numeric"
                        className="tnum h-8 text-center text-sm"
                      />
                      <span className="tnum col-span-1 px-1 text-end text-xs font-bold text-muted-foreground sm:text-sm">
                        {faNumber(rowTotal)}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground hover:text-destructive"
                        title="حذف ردیف"
                        onClick={() =>
                          setFItems((items) =>
                            items.length > 1 ? items.filter((_, i) => i !== idx) : [{ ...emptyItem }]
                          )
                        }
                      >
                        <Trash2 className="size-3.5" aria-hidden />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* مالیات + سند خودکار */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="inv-tax">نرخ مالیات (٪)</Label>
                <Input
                  id="inv-tax"
                  value={fTax}
                  onChange={(e) => setFTax(e.target.value)}
                  inputMode="numeric"
                  className="tnum"
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label htmlFor="inv-entry">ثبت خودکار سند حسابداری</Label>
                  <p className="mt-0.5 text-xs text-muted-foreground">سند دوطرفه به‌صورت خودکار</p>
                </div>
                <Switch id="inv-entry" checked={fCreateEntry} onCheckedChange={setFCreateEntry} />
              </div>
            </div>

            {/* جمع‌های زنده */}
            <div className="space-y-1.5 rounded-xl border border-primary/25 bg-primary/5 p-3 text-sm">
              <p className="flex items-center justify-between">
                <span className="text-muted-foreground">مبلغ کل</span>
                <span className="tnum font-medium">{faNumber(formTotals.total)}</span>
              </p>
              <p className="flex items-center justify-between">
                <span className="text-muted-foreground">مالیات ({faPercent(formTotals.rate, 0)})</span>
                <span className="tnum font-medium">{faNumber(formTotals.tax)}</span>
              </p>
              <Separator />
              <p className="flex items-center justify-between text-base font-bold">
                <span>جمع نهایی</span>
                <span className="tnum text-primary">{faNumber(formTotals.grand)} تومان</span>
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              انصراف
            </Button>
            <Button onClick={submitInvoice} disabled={saving}>
              {saving ? "در حال ثبت..." : "ثبت فاکتور"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* تأیید حذف */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف فاکتور؟</AlertDialogTitle>
            <AlertDialogDescription>
              فاکتور شماره {deleteTarget ? faNumber(deleteTarget.number) : ""} به‌همراه سند حسابداری مرتبطش حذف می‌شود و این عمل بازگشت‌پذیر نیست.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>انصراف</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleting ? "در حال حذف..." : "حذف کن"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SectionShell>
  );
}
