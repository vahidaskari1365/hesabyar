"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { endpoints } from "@/lib/api";
import type { ContactDTO } from "@/lib/types";
import { faNumber, faCompact, faMoney } from "@/lib/format";
import { SectionShell, EmptyState } from "@/components/shared/section-shell";
import { StatCard, StatCardSkeleton } from "@/components/shared/stat-card";
import { Button } from "@/components/ui/button";
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
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users,
  Plus,
  Pencil,
  Trash2,
  Search,
  Phone,
  Mail,
  Building2,
  Wallet,
  Receipt,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/utils";

type ContactType = "CUSTOMER" | "SUPPLIER" | "BOTH";

const CONTACT_TYPE_LABELS: Record<ContactType, string> = {
  CUSTOMER: "مشتری",
  SUPPLIER: "تأمین‌کننده",
  BOTH: "هر دو",
};

const contactTypeBadge: Record<ContactType, string> = {
  CUSTOMER: "border-success/30 bg-success/15 text-success",
  SUPPLIER: "border-warning/40 bg-warning/15 text-warning",
  BOTH: "border-border bg-muted text-muted-foreground",
};

const emptyForm = { name: "", type: "CUSTOMER" as ContactType, phone: "", email: "", taxId: "" };

// ─── بخش طرف‌های حساب ───────────────────────────────────────────
export default function ContactsSection() {
  const [contacts, setContacts] = useState<ContactDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ContactDTO | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ContactDTO | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [detail, setDetail] = useState<ContactDTO | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await endpoints.contacts();
      setContacts(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطا در دریافت طرف‌حساب‌ها");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter(
      (c) => c.name.toLowerCase().includes(q) || (c.phone ?? "").includes(q)
    );
  }, [contacts, query]);

  const stats = useMemo(() => {
    const customers = contacts.filter((c) => c.type === "CUSTOMER" || c.type === "BOTH").length;
    const suppliers = contacts.filter((c) => c.type === "SUPPLIER" || c.type === "BOTH").length;
    const receivable = contacts.reduce((s, c) => s + c.receivable, 0);
    return { customers, suppliers, receivable };
  }, [contacts]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (c: ContactDTO) => {
    setEditing(c);
    setForm({
      name: c.name,
      type: c.type,
      phone: c.phone ?? "",
      email: c.email ?? "",
      taxId: c.taxId ?? "",
    });
    setDialogOpen(true);
  };

  const submit = async () => {
    if (!form.name.trim()) {
      toast.error("نام طرف‌حساب الزامی است");
      return;
    }
    setSaving(true);
    try {
      const body = {
        name: form.name.trim(),
        type: form.type,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        taxId: form.taxId.trim() || null,
      };
      if (editing) {
        await endpoints.updateContact(editing.id, body);
        toast.success(`«${body.name}» ویرایش شد`);
      } else {
        await endpoints.createContact(body);
        toast.success(`«${body.name}» اضافه شد`);
      }
      setDialogOpen(false);
      setDetail(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطا در ذخیره طرف‌حساب");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await endpoints.deleteContact(deleteTarget.id);
      toast.success(`«${deleteTarget.name}» حذف شد`);
      setDeleteTarget(null);
      setDetail(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطا در حذف طرف‌حساب");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <SectionShell
      title="طرف‌های حساب"
      description="مشتریان و تأمین‌کنندگان با مانده بدهی/طلب"
      icon={Users}
      actions={
        <Button onClick={openCreate} className="gap-1.5">
          <Plus className="size-4" aria-hidden />
          طرف‌حساب جدید
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
          <StatCard title="مشتریان" value={faNumber(stats.customers)} sub="شامل مشتری‌های دو منظوره" icon={UserRound} tone="primary" />
          <StatCard title="تأمین‌کنندگان" value={faNumber(stats.suppliers)} sub="شامل تأمین‌کننده‌های دو منظوره" icon={Building2} tone="warning" />
          <StatCard title="جمع مطالبات" value={faCompact(stats.receivable)} sub={`معادل ${faMoney(stats.receivable)}`} icon={Wallet} tone="success" />
        </div>
      )}

      {/* جستجو */}
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="جستجو بر اساس نام یا تلفن..."
          className="ps-9"
        />
      </div>

      {/* جدول */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title={query ? "نتیجه‌ای یافت نشد" : "هنوز طرف‌حسابی ثبت نشده"}
          text={query ? "عبارت جستجو را تغییر دهید." : "اولین مشتری یا تأمین‌کننده را اضافه کنید."}
          action={
            !query && (
              <Button variant="outline" onClick={openCreate} className="gap-1.5">
                <Plus className="size-4" aria-hidden />
                طرف‌حساب جدید
              </Button>
            )
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
          <Table className="min-w-[720px]">
            <TableHeader>
              <TableRow>
                <TableHead className="text-start">نام</TableHead>
                <TableHead className="text-start">نوع</TableHead>
                <TableHead className="text-start">تلفن</TableHead>
                <TableHead className="text-end">طلب ما از وی</TableHead>
                <TableHead className="text-end">بدهی وی به ما</TableHead>
                <TableHead className="text-end">فاکتورها</TableHead>
                <TableHead className="text-end">عملیات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => (
                <TableRow
                  key={c.id}
                  className="cursor-pointer hover:bg-accent/40"
                  onClick={() => setDetail(c)}
                >
                  <TableCell className="font-bold">{c.name}</TableCell>
                  <TableCell>
                    <Badge className={cn("border", contactTypeBadge[c.type])} variant="outline">
                      {CONTACT_TYPE_LABELS[c.type]}
                    </Badge>
                  </TableCell>
                  <TableCell className="tnum whitespace-nowrap text-sm text-muted-foreground" dir="ltr">
                    {c.phone ? (
                      <span className="inline-flex items-center gap-1">
                        <Phone className="size-3" aria-hidden />
                        {c.phone}
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="tnum text-end">
                    {c.receivable > 0 ? (
                      <span className="font-bold text-success">{faNumber(c.receivable)}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="tnum text-end">
                    {c.payable > 0 ? (
                      <span className="font-bold text-destructive">{faNumber(c.payable)}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="tnum text-end">{faNumber(c.invoiceCount)}</TableCell>
                  <TableCell className="text-end" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground hover:text-foreground"
                        onClick={() => openEdit(c)}
                        title="ویرایش"
                      >
                        <Pencil className="size-3.5" aria-hidden />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground hover:text-destructive"
                        onClick={() => setDeleteTarget(c)}
                        title="حذف"
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

      {/* Dialog افزودن/ویرایش */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "ویرایش طرف‌حساب" : "طرف‌حساب جدید"}</DialogTitle>
            <DialogDescription>
              {editing ? `ویرایش اطلاعات «${editing.name}»` : "مشتری یا تأمین‌کننده جدید"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3.5 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="c-name">نام *</Label>
              <Input
                id="c-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="فروشگاه نمونه"
              />
            </div>
            <div className="space-y-1.5">
              <Label>نوع</Label>
              <Select
                value={form.type}
                onValueChange={(v) => setForm((f) => ({ ...f, type: v as ContactType }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CUSTOMER">مشتری</SelectItem>
                  <SelectItem value="SUPPLIER">تأمین‌کننده</SelectItem>
                  <SelectItem value="BOTH">هر دو</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="c-phone">تلفن</Label>
                <Input
                  id="c-phone"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="۰۹۱۲..."
                  inputMode="numeric"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-email">ایمیل</Label>
                <Input
                  id="c-email"
                  type="email"
                  dir="ltr"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="info@example.com"
                  className="text-start"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-taxid">شناسه ملی / کد اقتصادی</Label>
              <Input
                id="c-taxid"
                value={form.taxId}
                onChange={(e) => setForm((f) => ({ ...f, taxId: e.target.value }))}
                inputMode="numeric"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              انصراف
            </Button>
            <Button onClick={submit} disabled={saving}>
              {saving ? "در حال ذخیره..." : editing ? "ذخیره تغییرات" : "افزودن"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog جزئیات */}
      <Dialog open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent className="sm:max-w-lg">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="flex flex-wrap items-center gap-2">
                  {detail.name}
                  <Badge className={cn("border", contactTypeBadge[detail.type])} variant="outline">
                    {CONTACT_TYPE_LABELS[detail.type]}
                  </Badge>
                </DialogTitle>
                <DialogDescription>جزئیات کامل طرف‌حساب</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {/* کارت‌های مانده بزرگ */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-success/30 bg-success/5 p-4">
                    <p className="text-xs text-muted-foreground">طلب ما از وی</p>
                    <p className={cn("tnum mt-1.5 text-xl font-bold", detail.receivable > 0 ? "text-success" : "text-muted-foreground")}>
                      {faNumber(detail.receivable)}
                    </p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">تومان</p>
                  </div>
                  <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
                    <p className="text-xs text-muted-foreground">بدهی وی به ما</p>
                    <p className={cn("tnum mt-1.5 text-xl font-bold", detail.payable > 0 ? "text-destructive" : "text-muted-foreground")}>
                      {faNumber(detail.payable)}
                    </p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">تومان</p>
                  </div>
                </div>
                <div className="space-y-2.5 rounded-xl border bg-card p-4 text-sm">
                  <p className="flex items-center gap-2">
                    <Phone className="size-4 text-muted-foreground" aria-hidden />
                    <span className="text-muted-foreground">تلفن:</span>
                    <span className="tnum" dir="ltr">{detail.phone || "—"}</span>
                  </p>
                  <p className="flex items-center gap-2">
                    <Mail className="size-4 text-muted-foreground" aria-hidden />
                    <span className="text-muted-foreground">ایمیل:</span>
                    <span dir="ltr">{detail.email || "—"}</span>
                  </p>
                  <p className="flex items-center gap-2">
                    <Building2 className="size-4 text-muted-foreground" aria-hidden />
                    <span className="text-muted-foreground">شناسه ملی:</span>
                    <span className="tnum">{detail.taxId || "—"}</span>
                  </p>
                  <Separator />
                  <p className="flex items-center gap-2">
                    <Receipt className="size-4 text-muted-foreground" aria-hidden />
                    <span className="text-muted-foreground">تعداد فاکتور:</span>
                    <span className="tnum font-bold">{faNumber(detail.invoiceCount)}</span>
                  </p>
                </div>
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setDetail(null)}>
                  بستن
                </Button>
                <Button
                  onClick={() => {
                    const target = detail;
                    setDetail(null);
                    openEdit(target);
                  }}
                  className="gap-1.5"
                >
                  <Pencil className="size-4" aria-hidden />
                  ویرایش
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* تأیید حذف */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف طرف‌حساب؟</AlertDialogTitle>
            <AlertDialogDescription>
              «{deleteTarget?.name}» برای همیشه حذف می‌شود. اگر این طرف‌حساب فاکتور یا سند داشته باشد، حذف ممکن نخواهد بود.
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
