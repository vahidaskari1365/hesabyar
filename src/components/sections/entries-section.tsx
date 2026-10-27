"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Eye,
  FileText,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";

import { api, endpoints } from "@/lib/api";
import type { AccountDTO, ContactDTO, JournalEntryDTO } from "@/lib/types";
import { ENTRY_STATUS_LABELS, SOURCE_LABELS } from "@/lib/types";
import { faCompact, faDate, faDateLong, faNumber, faPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/lib/store";
import { EmptyState, SectionShell } from "@/components/shared/section-shell";

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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

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

/** تاریخ ISO یا Date → رشتهٔ yyyy-mm-dd محلی برای Input type=date */
function toDateInput(d: string | Date): string {
  const dt = typeof d === "string" ? new Date(d) : d;
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** برگ‌های درخت حساب‌ها (فقط گره‌های قابل انتخاب) */
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

interface FormLine {
  accountId: string | null;
  accountCode?: string;
  accountName?: string;
  description: string;
  debitText: string;
  creditText: string;
}

const emptyLine = (): FormLine => ({
  accountId: null,
  description: "",
  debitText: "",
  creditText: "",
});

const PAGE_SIZE = 10;

// ─── انتخاب‌گر حساب (Popover + Command) ─────────────────────────

function AccountPicker({
  accounts,
  value,
  onSelect,
  invalid,
}: {
  accounts: AccountDTO[];
  value: string | null;
  onSelect: (id: string) => void;
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = accounts.find((a) => a.id === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "h-9 w-full justify-between font-normal",
            !selected && "text-muted-foreground",
            invalid && "border-destructive"
          )}
        >
          <span className="truncate">
            {selected ? `${selected.code} — ${selected.name}` : "انتخاب حساب..."}
          </span>
          <ChevronsUpDown className="ms-1.5 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <Command>
          <CommandInput placeholder="جستجوی کد یا نام حساب..." />
          <CommandList className="max-h-72">
            <CommandEmpty>حسابی یافت نشد</CommandEmpty>
            <CommandGroup>
              {accounts.map((a) => (
                <CommandItem
                  key={a.id}
                  value={`${a.code} ${a.name}`}
                  onSelect={() => {
                    onSelect(a.id);
                    setOpen(false);
                  }}
                  className="gap-2"
                >
                  <span className="tnum w-14 shrink-0 text-xs text-muted-foreground">{a.code}</span>
                  <span className="truncate">{a.name}</span>
                  {selected?.id === a.id && <CheckCircle2 className="ms-auto size-4 text-success" />}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ─── نوار تراز سند ──────────────────────────────────────────────

function BalanceBar({ totalDebit, totalCredit }: { totalDebit: number; totalCredit: number }) {
  const diff = Math.round(totalDebit - totalCredit);
  const balanced = Math.abs(diff) < 0.5 && totalDebit > 0;
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium",
        balanced
          ? "border-success/30 bg-success/10 text-success"
          : "border-destructive/30 bg-destructive/10 text-destructive"
      )}
    >
      <span className="flex items-center gap-2">
        {balanced ? <CheckCircle2 className="size-4" /> : <AlertTriangle className="size-4" />}
        {balanced ? "سند تراز است ✓" : "سند تراز نیست"}
      </span>
      {!balanced && (
        <span className="tnum">
          اختلاف: {faNumber(Math.abs(diff))} تومان
        </span>
      )}
    </div>
  );
}

// ─── بخش اصلی اسناد حسابداری ────────────────────────────────────

export default function EntriesSection() {
  const params = useAppStore((s) => s.params);

  // داده‌ها
  const [entries, setEntries] = useState<JournalEntryDTO[] | null>(null);
  const [contacts, setContacts] = useState<ContactDTO[]>([]);
  const [accounts, setAccounts] = useState<AccountDTO[]>([]);
  const leaves = useMemo(() => flattenLeaves(accounts), [accounts]);

  // فیلترها
  const [q, setQ] = useState("");
  const [qDeb, setQDeb] = useState("");
  const [statusF, setStatusF] = useState("ALL");
  const [sourceF, setSourceF] = useState("ALL");
  const [page, setPage] = useState(1);

  // دیالوگ‌ها
  const [detail, setDetail] = useState<JournalEntryDTO | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<JournalEntryDTO | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  // فرم سند
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<JournalEntryDTO | null>(null);
  const [fDate, setFDate] = useState(toDateInput(new Date()));
  const [fDesc, setFDesc] = useState("");
  const [fContact, setFContact] = useState("none");
  const [fLines, setFLines] = useState<FormLine[]>([emptyLine()]);
  const [fPost, setFPost] = useState(false);
  const [origin, setOrigin] = useState<"MANUAL" | "AI_SUGGESTION">("MANUAL");
  const [aiNote, setAiNote] = useState<string | undefined>(undefined);
  const [aiText, setAiText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiInfo, setAiInfo] = useState<{ confidence: number; note?: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const entriesRef = useRef<JournalEntryDTO[] | null>(null);
  entriesRef.current = entries;

  // debounce جستجو (۴۰۰ms)
  useEffect(() => {
    const t = setTimeout(() => {
      setQDeb(q);
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(async (): Promise<JournalEntryDTO[]> => {
    try {
      const sp = new URLSearchParams();
      if (qDeb.trim()) sp.set("q", qDeb.trim());
      if (statusF !== "ALL") sp.set("status", statusF);
      if (sourceF !== "ALL") sp.set("source", sourceF);
      const data = await endpoints.entries(sp.toString());
      setEntries(data);
      return data;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطا در دریافت اسناد");
      setEntries([]);
      return [];
    }
  }, [qDeb, statusF, sourceF]);

  useEffect(() => {
    load();
  }, [load]);

  // طرف‌حساب‌ها و حساب‌ها برای فرم
  useEffect(() => {
    (async () => {
      try {
        const [c, a] = await Promise.all([endpoints.contacts(), endpoints.accounts()]);
        setContacts(c);
        setAccounts(a);
      } catch {
        /* غیرحیاتی — خطا هنگام ذخیره هم چک می‌شود */
      }
    })();
  }, []);

  // بازکردن خودکار سند با params.entryId
  useEffect(() => {
    const id = params.entryId;
    if (!id) return;
    (async () => {
      const local = entriesRef.current?.find((e) => e.id === id);
      if (local) {
        setDetail(local);
        return;
      }
      try {
        const fresh = await api.get<JournalEntryDTO>(`/api/entries/${id}`);
        setDetail(fresh);
      } catch {
        toast.error("سند موردنظر یافت نشد");
      }
    })();
  }, [params]);

  // صفحه‌بندی کلاینت‌ساید
  const total = entries?.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = useMemo(
    () => (entries ?? []).slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [entries, safePage]
  );

  // ── قطعی / بازگشت به پیش‌نویس ──────────────────────────────────
  async function togglePost(e: JournalEntryDTO) {
    setBusyId(e.id);
    try {
      await endpoints.updateEntry(e.id, { action: e.status === "POSTED" ? "unpost" : "post" });
      toast.success(
        e.status === "POSTED"
          ? `سند شماره ${faNumber(e.number)} به پیش‌نویس برگشت`
          : `سند شماره ${faNumber(e.number)} قطعی شد`
      );
      const fresh = await load();
      setDetail((d) => (d ? fresh.find((x) => x.id === d.id) ?? d : d));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطا در تغییر وضعیت سند");
    } finally {
      setBusyId(null);
    }
  }

  // ── حذف سند ────────────────────────────────────────────────────
  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await endpoints.deleteEntry(deleteTarget.id);
      toast.success(`سند شماره ${faNumber(deleteTarget.number)} حذف شد`);
      const removedId = deleteTarget.id;
      setDeleteTarget(null);
      setDetail((d) => (d?.id === removedId ? null : d));
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطا در حذف سند");
    } finally {
      setDeleting(false);
    }
  }

  // ── فرم: باز و بسته ───────────────────────────────────────────
  function openNew() {
    setEditing(null);
    setFDate(toDateInput(new Date()));
    setFDesc("");
    setFContact("none");
    setFLines([emptyLine()]);
    setFPost(false);
    setOrigin("MANUAL");
    setAiNote(undefined);
    setAiText("");
    setAiInfo(null);
    setFormOpen(true);
  }

  function openEdit(e: JournalEntryDTO) {
    setEditing(e);
    setFDate(toDateInput(e.date));
    setFDesc(e.description);
    setFContact(e.contactId ?? "none");
    setFLines(
      e.lines.length
        ? e.lines.map((l) => ({
            accountId: l.accountId,
            accountCode: l.accountCode,
            accountName: l.accountName,
            description: l.description ?? "",
            debitText: l.debit ? String(l.debit) : "",
            creditText: l.credit ? String(l.credit) : "",
          }))
        : [emptyLine()]
    );
    setFPost(e.status === "POSTED");
    setOrigin(e.source === "AI_SUGGESTION" ? "AI_SUGGESTION" : "MANUAL");
    setAiNote(e.aiNote ?? undefined);
    setAiText("");
    setAiInfo(null);
    setFormOpen(true);
  }

  // ── فرم: جمع‌های زنده ─────────────────────────────────────────
  const fTotals = useMemo(() => {
    const d = fLines.reduce((s, l) => s + parseNum(l.debitText), 0);
    const c = fLines.reduce((s, l) => s + parseNum(l.creditText), 0);
    return { d, c, diff: Math.round(d - c), balanced: Math.abs(d - c) < 0.5 && d > 0 };
  }, [fLines]);

  function updateLine(idx: number, patch: Partial<FormLine>) {
    setFLines((ls) => ls.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  function setDebit(idx: number, v: string) {
    setFLines((ls) =>
      ls.map((l, i) => (i === idx ? { ...l, debitText: v, creditText: parseNum(v) > 0 ? "" : l.creditText } : l))
    );
  }

  function setCredit(idx: number, v: string) {
    setFLines((ls) =>
      ls.map((l, i) => (i === idx ? { ...l, creditText: v, debitText: parseNum(v) > 0 ? "" : l.debitText } : l))
    );
  }

  // ── پیشنهاد هوشمند ────────────────────────────────────────────
  async function applyAiSuggestion() {
    if (!aiText.trim()) {
      toast.error("شرح تراکنش را به زبان ساده بنویسید");
      return;
    }
    setAiLoading(true);
    try {
      const sug = await endpoints.suggestEntry(aiText.trim());
      const byCode = new Map(leaves.map((a) => [a.code, a]));
      const missing: string[] = [];
      const lines: FormLine[] = sug.lines.map((l) => {
        const acc = byCode.get(l.accountCode);
        if (!acc) missing.push(l.accountCode);
        return {
          accountId: acc?.id ?? null,
          accountCode: l.accountCode,
          accountName: acc?.name ?? l.accountName,
          description: l.description ?? "",
          debitText: l.debit ? String(l.debit) : "",
          creditText: l.credit ? String(l.credit) : "",
        };
      });
      if (!lines.length) {
        toast.error("پیشنهاد معتبری دریافت نشد — دوباره تلاش کنید");
        return;
      }
      setFLines(lines);
      if (sug.description) setFDesc(sug.description);
      setOrigin("AI_SUGGESTION");
      setAiNote(
        sug.note ? `پیشنهاد هوش مصنوعی: ${sug.note}` : "این سند با پیشنهاد هوش مصنوعی ایجاد شده است."
      );
      setAiInfo({ confidence: sug.confidence, note: sug.note });
      if (missing.length) {
        toast.warning(`حساب با کد ${missing.join("، ")} در کدینگ یافت نشد — انتخاب دستی لازم است`);
      } else {
        toast.success("پیشنهاد هوشمند اعمال شد — بازبینی کنید و ذخیره کنید");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطا در دریافت پیشنهاد هوشمند");
    } finally {
      setAiLoading(false);
    }
  }

  // ── ذخیره سند ─────────────────────────────────────────────────
  async function saveEntry() {
    if (!fDesc.trim()) {
      toast.error("شرح سند الزامی است");
      return;
    }
    const linesPayload = fLines
      .filter((l) => l.accountId && (parseNum(l.debitText) > 0 || parseNum(l.creditText) > 0))
      .map((l, i) => ({
        accountId: l.accountId as string,
        debit: parseNum(l.debitText),
        credit: parseNum(l.creditText),
        description: l.description,
        order: i,
      }));
    if (!linesPayload.length) {
      toast.error("حداقل یک قلم با حساب و مبلغ لازم است");
      return;
    }
    const status = fPost && fTotals.balanced ? "POSTED" : "DRAFT";
    const contactId = fContact === "none" ? null : fContact;
    setSaving(true);
    try {
      if (editing) {
        await endpoints.updateEntry(editing.id, {
          date: fDate,
          description: fDesc.trim(),
          status,
          contactId,
          aiNote,
          lines: linesPayload,
        });
        toast.success("سند با موفقیت ویرایش شد");
      } else {
        const res = await endpoints.createEntry({
          date: fDate,
          description: fDesc.trim(),
          status,
          source: origin,
          contactId,
          aiNote,
          lines: linesPayload,
        });
        toast.success(`سند شماره ${faNumber(res.number)} ثبت شد`);
      }
      setFormOpen(false);
      const fresh = await load();
      setDetail((d) => (d ? fresh.find((x) => x.id === d.id) ?? null : null));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطا در ذخیره سند");
    } finally {
      setSaving(false);
    }
  }

  // ─── رندر ──────────────────────────────────────────────────────

  return (
    <SectionShell
      title="اسناد حسابداری"
      icon={FileText}
      description="ثبت، مشاهده و کنترل اسناد حسابداری با پیشنهاد هوشمند"
      actions={
        <Button onClick={openNew} className="shadow-sm">
          <Plus className="size-4" />
          سند جدید
        </Button>
      }
    >
      {/* نوار ابزار */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="جستجو در شرح، اقلام یا طرف‌حساب..."
            className="ps-9"
            aria-label="جستجوی اسناد"
          />
        </div>
        <Select
          value={statusF}
          onValueChange={(v) => {
            setStatusF(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[150px]" aria-label="فیلتر وضعیت">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">همه وضعیت‌ها</SelectItem>
            <SelectItem value="POSTED">قطعی</SelectItem>
            <SelectItem value="DRAFT">پیش‌نویس</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={sourceF}
          onValueChange={(v) => {
            setSourceF(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[190px]" aria-label="فیلتر منبع">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">همه منابع</SelectItem>
            <SelectItem value="MANUAL">دستی</SelectItem>
            <SelectItem value="AI_SUGGESTION">پیشنهاد هوش مصنوعی</SelectItem>
            <SelectItem value="SCAN">اسکن</SelectItem>
            <SelectItem value="INVOICE">فاکتور</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* جدول اسناد */}
      {entries === null ? (
        <div className="space-y-2 rounded-xl border bg-card p-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-11 w-full" />
          ))}
        </div>
      ) : total === 0 ? (
        <EmptyState
          icon={FileText}
          title="سندی یافت نشد"
          text="هیچ سندي با این فیلترها ثبت نشده است. اولین سند خود را ثبت کنید یا فیلترها را تغییر دهید."
          action={
            <Button onClick={openNew} variant="outline">
              <Plus className="size-4" />
              ثبت سند جدید
            </Button>
          }
        />
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="rounded-xl border bg-card"
        >
          <div className="overflow-x-auto">
            <Table className="min-w-[860px]">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-16 text-start">شماره</TableHead>
                  <TableHead className="text-start">تاریخ</TableHead>
                  <TableHead className="text-start">شرح</TableHead>
                  <TableHead className="text-start">طرف‌حساب</TableHead>
                  <TableHead className="text-start">مبلغ</TableHead>
                  <TableHead className="text-start">وضعیت</TableHead>
                  <TableHead className="text-start">منبع</TableHead>
                  <TableHead className="w-12 text-start"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageItems.map((e) => (
                  <TableRow
                    key={e.id}
                    onClick={() => setDetail(e)}
                    className="cursor-pointer transition-colors hover:bg-accent/60 active:bg-accent"
                  >
                    <TableCell className="tnum font-semibold">{faNumber(e.number)}</TableCell>
                    <TableCell className="tnum whitespace-nowrap text-muted-foreground">
                      {faDate(e.date)}
                    </TableCell>
                    <TableCell className="max-w-56 truncate ps-0 font-medium" title={e.description}>
                      {e.description}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {e.contactName ?? "—"}
                    </TableCell>
                    <TableCell className="tnum whitespace-nowrap font-semibold">
                      {faCompact(e.totalDebit)}
                    </TableCell>
                    <TableCell>
                      {e.status === "POSTED" ? (
                        <Badge variant="outline" className="border-success/40 bg-success/10 text-success">
                          {ENTRY_STATUS_LABELS.POSTED}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-warning/40 bg-warning/10 text-warning">
                          {ENTRY_STATUS_LABELS.DRAFT}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {e.source !== "MANUAL" ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex size-7 cursor-help items-center justify-center rounded-md bg-primary/10 text-primary">
                              <Sparkles className="size-4" />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>{SOURCE_LABELS[e.source] ?? e.source}</TooltipContent>
                        </Tooltip>
                      ) : (
                        <span className="text-sm text-muted-foreground">دستی</span>
                      )}
                    </TableCell>
                    <TableCell onClick={(ev) => ev.stopPropagation()} className="ps-0">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            aria-label={`عملیات سند ${faNumber(e.number)}`}
                            disabled={busyId === e.id}
                          >
                            {busyId === e.id ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <ChevronsUpDown className="size-4" />
                            )}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-44">
                          <DropdownMenuItem onClick={() => setDetail(e)}>
                            <Eye className="size-4" />
                            مشاهده
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => togglePost(e)}>
                            {e.status === "POSTED" ? (
                              <>
                                <RotateCcw className="size-4" />
                                بازگشت به پیش‌نویس
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="size-4" />
                                قطعی‌کردن سند
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEdit(e)}>
                            <Pencil className="size-4" />
                            ویرایش
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => setDeleteTarget(e)}
                          >
                            <Trash2 className="size-4" />
                            حذف
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* صفحه‌بندی */}
          <Separator />
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
            <span className="text-muted-foreground">
              نمایش {faNumber((safePage - 1) * PAGE_SIZE + 1)} تا{" "}
              {faNumber(Math.min(safePage * PAGE_SIZE, total))} از {faNumber(total)} سند
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronRight className="size-4" />
                قبلی
              </Button>
              <span className="tnum text-muted-foreground">
                صفحه {faNumber(safePage)} از {faNumber(totalPages)}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                بعدی
                <ChevronLeft className="size-4" />
              </Button>
            </div>
          </div>
        </motion.div>
      )}

      {/* ── دیالوگ جزئیات سند ─────────────────────────────────── */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader className="items-start text-start">
            <DialogTitle className="flex flex-wrap items-center gap-2">
              <span>سند شماره {detail ? faNumber(detail.number) : ""}</span>
              {detail?.status === "POSTED" ? (
                <Badge variant="outline" className="border-success/40 bg-success/10 text-success">
                  قطعی
                </Badge>
              ) : (
                <Badge variant="outline" className="border-warning/40 bg-warning/10 text-warning">
                  پیش‌نویس
                </Badge>
              )}
              {detail?.aiNote && (
                <Badge variant="outline" className="border-warning/40 bg-warning/10 text-warning">
                  <Sparkles className="size-3" />
                  هوش مصنوعی
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <span>تاریخ: {detail ? faDateLong(detail.date) : ""}</span>
              <span>طرف‌حساب: {detail?.contactName ?? "—"}</span>
              {detail && detail.source !== "MANUAL" && (
                <span className="inline-flex items-center gap-1">
                  <Sparkles className="size-3.5 text-primary" />
                  {SOURCE_LABELS[detail.source] ?? detail.source}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {detail && (
            <div className="space-y-4">
              {detail.aiNote && (
                <div className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/10 px-3 py-2.5 text-sm text-warning">
                  <Sparkles className="mt-0.5 size-4 shrink-0" />
                  <span>{detail.aiNote}</span>
                </div>
              )}

              <div className="overflow-x-auto rounded-xl border">
                <div className="max-h-96 overflow-y-auto">
                  <Table className="min-w-[540px]">
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="text-start">کد</TableHead>
                        <TableHead className="text-start">نام حساب</TableHead>
                        <TableHead className="text-start">شرح</TableHead>
                        <TableHead className="text-start">بدهکار</TableHead>
                        <TableHead className="text-start">بستانکار</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detail.lines.map((l) => (
                        <TableRow key={l.accountId + (l.order ?? "")} className="hover:bg-transparent">
                          <TableCell className="tnum text-muted-foreground">{l.accountCode}</TableCell>
                          <TableCell className="font-medium">{l.accountName}</TableCell>
                          <TableCell className="max-w-40 truncate text-muted-foreground" title={l.description}>
                            {l.description || "—"}
                          </TableCell>
                          <TableCell className="tnum">
                            {l.debit ? faNumber(l.debit) : "—"}
                          </TableCell>
                          <TableCell className="tnum">
                            {l.credit ? faNumber(l.credit) : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <TableFooter>
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={3} className="font-semibold">
                          جمع کل
                        </TableCell>
                        <TableCell className="tnum font-bold">{faNumber(detail.totalDebit)}</TableCell>
                        <TableCell className="tnum font-bold">{faNumber(detail.totalCredit)}</TableCell>
                      </TableRow>
                    </TableFooter>
                  </Table>
                </div>
              </div>

              <BalanceBar totalDebit={detail.totalDebit} totalCredit={detail.totalCredit} />

              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="outline" onClick={() => openEdit(detail)}>
                  <Pencil className="size-4" />
                  ویرایش سند
                </Button>
                {detail.status === "DRAFT" ? (
                  <Button
                    onClick={() => togglePost(detail)}
                    disabled={busyId === detail.id}
                    className="shadow-sm"
                  >
                    {busyId === detail.id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="size-4" />
                    )}
                    قطعی‌کردن سند
                  </Button>
                ) : (
                  <Button variant="outline" onClick={() => togglePost(detail)} disabled={busyId === detail.id}>
                    {busyId === detail.id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <RotateCcw className="size-4" />
                    )}
                    بازگشت به پیش‌نویس
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── دیالوگ سند جدید / ویرایش ───────────────────────────── */}
      <Dialog open={formOpen} onOpenChange={(o) => !o && !saving && setFormOpen(o)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader className="items-start text-start">
            <DialogTitle>{editing ? "ویرایش سند" : "سند جدید"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "اقلام سند را ویرایش کنید؛ برای حفظ تراز، مبالغ را کنترل کنید."
                : "اقلام بدهکار و بستانکار را وارد کنید؛ سند نامتراز به‌صورت پیش‌نویس ذخیره می‌شود."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            {/* پنل ثبت هوشمند */}
            <div className="rounded-xl border border-primary/25 bg-primary/5 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-primary">
                <Sparkles className="size-4" />
                ثبت هوشمند ✨
              </div>
              <Textarea
                value={aiText}
                onChange={(e) => setAiText(e.target.value)}
                placeholder="شرح تراکنش را به زبان ساده بنویسید... مثلا: اجاره دفتر ماهانه ۵۰ میلیون تومان از بانک پرداخت شد"
                rows={2}
                className="bg-background"
              />
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  هوش مصنوعی حساب‌ها و مبالغ را پیشنهاد می‌دهد؛ پیش از ذخیره بازبینی کنید.
                </p>
                <Button type="button" size="sm" onClick={applyAiSuggestion} disabled={aiLoading}>
                  {aiLoading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                  {aiLoading ? "در حال دریافت..." : "دریافت پیشنهاد هوشمند"}
                </Button>
              </div>
              {aiInfo && (
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-xs text-success">
                  <span className="font-semibold">
                    سطح اطمینان: {faPercent(aiInfo.confidence * 100)}
                  </span>
                  {aiInfo.note && <span>{aiInfo.note}</span>}
                </div>
              )}
            </div>

            {/* فیلدهای اصلی */}
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="entry-date">تاریخ سند</Label>
                <Input id="entry-date" type="date" value={fDate} onChange={(e) => setFDate(e.target.value)} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="entry-desc">شرح سند</Label>
                <Input
                  id="entry-desc"
                  value={fDesc}
                  onChange={(e) => setFDesc(e.target.value)}
                  placeholder="مثلا: پرداخت اجاره بهمن ماه"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-3">
                <Label>طرف‌حساب (اختیاری)</Label>
                <Select value={fContact} onValueChange={setFContact}>
                  <SelectTrigger className="w-full" aria-label="طرف‌حساب">
                    <SelectValue placeholder="بدون طرف‌حساب" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">بدون طرف‌حساب</SelectItem>
                    {contacts.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* ویرایشگر اقلام */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>اقلام سند (آرتیکل)</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setFLines((ls) => [...ls, emptyLine()])}
                >
                  <Plus className="size-4" />
                  افزودن ردیف
                </Button>
              </div>
              <div className="overflow-x-auto rounded-xl border">
                <div className="min-w-[720px] space-y-2 p-3">
                  {/* سرستون */}
                  <div className="grid grid-cols-[minmax(200px,1.4fr)_minmax(140px,2fr)_120px_120px_36px] items-center gap-2 px-1 text-xs font-medium text-muted-foreground">
                    <span>حساب</span>
                    <span>شرح قلم</span>
                    <span>بدهکار (تومان)</span>
                    <span>بستانکار (تومان)</span>
                    <span></span>
                  </div>
                  {fLines.map((l, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-[minmax(200px,1.4fr)_minmax(140px,2fr)_120px_120px_36px] items-center gap-2"
                    >
                      <AccountPicker
                        accounts={leaves}
                        value={l.accountId}
                        invalid={!l.accountId && (parseNum(l.debitText) > 0 || parseNum(l.creditText) > 0)}
                        onSelect={(id) => updateLine(idx, { accountId: id })}
                      />
                      <Input
                        value={l.description}
                        onChange={(e) => updateLine(idx, { description: e.target.value })}
                        placeholder="شرح قلم..."
                        className="h-9"
                      />
                      <Input
                        dir="ltr"
                        inputMode="numeric"
                        value={l.debitText}
                        onChange={(e) => setDebit(idx, e.target.value)}
                        placeholder="0"
                        className="tnum h-9 text-start"
                      />
                      <Input
                        dir="ltr"
                        inputMode="numeric"
                        value={l.creditText}
                        onChange={(e) => setCredit(idx, e.target.value)}
                        placeholder="0"
                        className="tnum h-9 text-start"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-9 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        aria-label="حذف ردیف"
                        disabled={fLines.length <= 1}
                        onClick={() => setFLines((ls) => ls.filter((_, i) => i !== idx))}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              {/* فوتر زندهٔ تراز */}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-muted/40 px-4 py-2.5 text-sm">
                <span>
                  جمع بدهکار:{" "}
                  <b className="tnum text-foreground">{faNumber(fTotals.d)}</b> تومان
                </span>
                <span>
                  جمع بستانکار:{" "}
                  <b className="tnum text-foreground">{faNumber(fTotals.c)}</b> تومان
                </span>
                {fTotals.balanced ? (
                  <Badge variant="outline" className="border-success/40 bg-success/10 text-success">
                    <CheckCircle2 className="size-3" />
                    تراز
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-destructive/40 bg-destructive/10 text-destructive">
                    <AlertTriangle className="size-3" />
                    اختلاف: {faNumber(Math.abs(fTotals.diff))} تومان
                  </Badge>
                )}
              </div>
            </div>

            {/* ثبت قطعی */}
            <div className="flex items-center justify-between gap-3 rounded-xl border px-4 py-3">
              <div>
                <Label htmlFor="post-switch" className="cursor-pointer">
                  ثبت قطعی
                </Label>
                <p className="text-xs text-muted-foreground">
                  {fTotals.balanced
                    ? "سند تراز است و می‌تواند قطعی شود."
                    : "فقط وقتی سند تراز باشد می‌توانید قطعی ثبت کنید."}
                </p>
              </div>
              <Switch
                id="post-switch"
                checked={fPost}
                onCheckedChange={setFPost}
                disabled={!fTotals.balanced}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
              انصراف
            </Button>
            <Button onClick={saveEntry} disabled={saving} className="shadow-sm">
              {saving ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
              {saving ? "در حال ذخیره..." : editing ? "ذخیره تغییرات" : "ذخیره سند"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── تأیید حذف ───────────────────────────────────────────── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader className="text-start">
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-destructive" />
              حذف سند شماره {deleteTarget ? faNumber(deleteTarget.number) : ""}؟
            </AlertDialogTitle>
            <AlertDialogDescription>
              این عملیات قابل بازگشت نیست و سند «{deleteTarget?.description}» به همراه اقلام آن حذف خواهد شد.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel disabled={deleting}>انصراف</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
              disabled={deleting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              {deleting ? "در حال حذف..." : "حذف قطعی"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SectionShell>
  );
}
