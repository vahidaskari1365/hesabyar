"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { endpoints, api } from "@/lib/api";
import type { AccountDTO, AccountType } from "@/lib/types";
import { ACCOUNT_TYPE_LABELS } from "@/lib/types";
import { faNumber, faCompact, faDate } from "@/lib/format";
import { SectionShell, EmptyState } from "@/components/shared/section-shell";
import { ChartCard } from "@/components/shared/chart-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ListTree,
  Plus,
  ChevronDown,
  Folder,
  FolderOpen,
  Eye,
  ArrowRightLeft,
  Info,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { axisTick, tooltipStyle, compactTick } from "@/lib/charts";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";

// ─── رنگ Badge بر اساس نوع حساب ─────────────────────────────────
const typeBadgeClass: Record<AccountType, string> = {
  ASSET: "border-success/30 bg-success/15 text-success",
  LIABILITY: "border-warning/40 bg-warning/15 text-warning",
  INCOME: "border-transparent bg-success text-success-foreground",
  EXPENSE: "border-destructive/25 bg-destructive/10 text-destructive",
  EQUITY: "border-border bg-muted text-muted-foreground",
};

// ─── تایپ جزئیات حساب (API مستقیم) ──────────────────────────────
interface LedgerRow {
  id: string;
  date: string;
  entryNumber: number;
  entryId: string;
  entryDesc: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
}

interface AccountDetailData {
  account: { id: string; code: string; name: string; type: AccountType; isGroup: boolean };
  ledger: LedgerRow[];
  monthly: { name: string; value: number }[];
  totals: { debit: number; credit: number; balance: number };
}

// ─── مسیر پدران یک حساب در درخت ─────────────────────────────────
function findPath(nodes: AccountDTO[], id: string, trail: string[] = []): string[] | null {
  for (const n of nodes) {
    if (n.id === id) return [...trail, n.id];
    const found = findPath(n.children, id, [...trail, n.id]);
    if (found) return found;
  }
  return null;
}

interface FlatGroup {
  id: string;
  code: string;
  name: string;
  depth: number;
}

function flattenGroups(nodes: AccountDTO[], depth = 0, out: FlatGroup[] = []): FlatGroup[] {
  for (const n of nodes) {
    if (n.isGroup) out.push({ id: n.id, code: n.code, name: n.name, depth });
    flattenGroups(n.children, depth + 1, out);
  }
  return out;
}

// ─── گره درخت ───────────────────────────────────────────────────
function TreeNode({
  node,
  depth,
  expanded,
  onToggle,
  selectedId,
  onSelect,
}: {
  node: AccountDTO;
  depth: number;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const hasChildren = node.children.length > 0;
  const isOpen = expanded.has(node.id);

  if (node.isGroup || hasChildren) {
    return (
      <Collapsible open={isOpen} onOpenChange={() => onToggle(node.id)}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-start transition-colors hover:bg-accent/60"
            style={{ paddingInlineStart: depth * 14 + 6 }}
          >
            <ChevronDown
              className={cn(
                "size-3.5 shrink-0 text-muted-foreground transition-transform",
                !isOpen && "-rotate-90"
              )}
              aria-hidden
            />
            {isOpen ? (
              <FolderOpen className="size-4 shrink-0 text-warning" aria-hidden />
            ) : (
              <Folder className="size-4 shrink-0 text-warning/80" aria-hidden />
            )}
            <span className="truncate text-[13px] font-semibold">{node.name}</span>
            <span className="ms-auto tnum shrink-0 text-xs font-medium text-muted-foreground">
              {faCompact(node.balance)}
            </span>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="relative">
            <span
              className="absolute top-0 bottom-1 w-px bg-border"
              style={{ insetInlineStart: depth * 14 + 14 }}
              aria-hidden
            />
            {[...node.children]
              .sort((a, b) => a.code.localeCompare(b.code))
              .map((child) => (
                <TreeNode
                  key={child.id}
                  node={child}
                  depth={depth + 1}
                  expanded={expanded}
                  onToggle={onToggle}
                  selectedId={selectedId}
                  onSelect={onSelect}
                />
              ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    );
  }

  const selected = selectedId === node.id;
  return (
    <button
      type="button"
      onClick={() => onSelect(node.id)}
      className={cn(
        "flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-start transition-colors",
        selected ? "bg-accent ring-1 ring-primary/30" : "hover:bg-accent/60"
      )}
      style={{ paddingInlineStart: depth * 14 + 24 }}
    >
      <span className="tnum hidden shrink-0 font-mono text-[10px] text-muted-foreground sm:inline">
        {node.code}
      </span>
      <span className={cn("truncate text-[13px]", selected && "font-semibold")}>{node.name}</span>
      <span
        className={cn(
          "tnum ms-auto shrink-0 text-xs",
          node.balance < 0 ? "text-destructive" : "text-foreground/80"
        )}
      >
        {faCompact(node.balance)}
      </span>
      <Badge className={cn("shrink-0 border px-1.5 text-[10px]", typeBadgeClass[node.type])} variant="outline">
        {ACCOUNT_TYPE_LABELS[node.type]}
      </Badge>
    </button>
  );
}

// ─── بخش کدینگ حساب‌ها ──────────────────────────────────────────
export default function AccountsSection() {
  const navigate = useAppStore((s) => s.navigate);

  const [tree, setTree] = useState<AccountDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AccountDetailData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [mobileOpen, setMobileOpen] = useState(false);
  const paramConsumed = useRef(false);

  // حالت Dialog حساب جدید
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    code: "",
    name: "",
    type: "ASSET" as AccountType,
    parentId: "",
    isGroup: false,
  });

  const loadTree = useCallback(async () => {
    try {
      const data = await endpoints.accounts();
      setTree(data);
      return data;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطا در دریافت کدینگ حساب‌ها");
      return [];
    }
  }, []);

  const openAccount = useCallback(async (id: string) => {
    setSelectedId(id);
    setDetailLoading(true);
    setDetail(null);
    try {
      const d = await api.get<AccountDetailData>(`/api/accounts/${id}`);
      setDetail(d);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطا در جزئیات حساب");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  // لود اولیه + انتخاب حساب از params
  useEffect(() => {
    (async () => {
      const data = await loadTree();
      setExpanded(new Set(data.map((r) => r.id))); // باز بودن ریشه‌ها
      if (!paramConsumed.current) {
        paramConsumed.current = true;
        const wanted = useAppStore.getState().params.accountId;
        if (wanted) {
          const path = findPath(data, wanted);
          if (path) {
            setExpanded(new Set(path));
            setSelectedId(wanted);
            openAccount(wanted);
          }
        }
      }
      setLoading(false);
    })();
  }, [loadTree, openAccount]);

  const toggle = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSelect = useCallback(
    (id: string) => {
      openAccount(id);
      if (typeof window !== "undefined" && window.innerWidth < 1024) {
        setMobileOpen(true);
      }
    },
    [openAccount]
  );

  const submitNewAccount = async () => {
    if (!form.code.trim() || !form.name.trim()) {
      toast.error("کد و نام حساب الزامی است");
      return;
    }
    setSaving(true);
    try {
      await endpoints.createAccount({
        code: form.code.trim(),
        name: form.name.trim(),
        type: form.type,
        parentId: form.parentId || null,
        isGroup: form.isGroup,
      });
      toast.success(`حساب «${form.name.trim()}» ایجاد شد`);
      setCreateOpen(false);
      setForm({ code: "", name: "", type: "ASSET", parentId: "", isGroup: false });
      await loadTree();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطا در ایجاد حساب");
    } finally {
      setSaving(false);
    }
  };

  const groups = flattenGroups(tree);

  // ── محتوای پنل جزئیات (دسکتاپ و موبایل مشترک) ──
  const renderDetail = () => {
    if (detailLoading) {
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-5 w-14" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
          <Skeleton className="h-52" />
          <Skeleton className="h-64" />
        </div>
      );
    }
    if (!selectedId) {
      return (
        <EmptyState
          icon={ArrowRightLeft}
          title="حسابی انتخاب نشده است"
          text="برای مشاهده دفتر کل و گردش ماهانه، یک حساب از درخت کنار انتخاب کنید."
          className="h-full"
        />
      );
    }
    if (!detail) return null;
    const acc = detail.account;
    const label = ACCOUNT_TYPE_LABELS[acc.type] ?? acc.type;

    return (
      <div className="space-y-4">
        {/* هدر حساب */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="tnum font-mono text-sm font-bold text-primary">{acc.code}</span>
          <h3 className="text-base font-bold sm:text-lg">{acc.name}</h3>
          <Badge className={cn("border", typeBadgeClass[acc.type])} variant="outline">
            {label}
          </Badge>
          {acc.isGroup && (
            <Badge variant="secondary" className="gap-1 text-[10px]">
              <Folder className="size-3" aria-hidden /> گروهی
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            className="ms-auto gap-1.5"
            onClick={() => navigate("reports", { reportType: "general-ledger", accountId: acc.id })}
          >
            <Eye className="size-4" aria-hidden />
            مشاهده در گزارش‌ها
          </Button>
        </div>

        {/* آمار خلاصه */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <div className="rounded-lg border bg-card p-3">
            <p className="text-[11px] text-muted-foreground">جمع بدهکار</p>
            <p className="tnum mt-1 truncate text-sm font-bold sm:text-base">{faCompact(detail.totals.debit)}</p>
          </div>
          <div className="rounded-lg border bg-card p-3">
            <p className="text-[11px] text-muted-foreground">جمع بستانکار</p>
            <p className="tnum mt-1 truncate text-sm font-bold sm:text-base">{faCompact(detail.totals.credit)}</p>
          </div>
          <div
            className={cn(
              "rounded-lg border p-3",
              detail.totals.balance < 0 ? "border-destructive/30 bg-destructive/5" : "border-success/30 bg-success/5"
            )}
          >
            <p className="text-[11px] text-muted-foreground">مانده</p>
            <p
              className={cn(
                "tnum mt-1 truncate text-sm font-bold sm:text-base",
                detail.totals.balance < 0 ? "text-destructive" : "text-success"
              )}
            >
              {faCompact(detail.totals.balance)}
            </p>
          </div>
        </div>

        {/* گردش ماهانه */}
        <ChartCard title="گردش ماهانه" subtitle="خالص گردش بدهکار منهای بستانکار" height={208} className="no-print">
          {detail.monthly.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
              <Info className="size-5" aria-hidden />
              گردشی برای این حساب ثبت نشده است
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={detail.monthly} margin={{ top: 8, left: 0, right: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="name" tick={axisTick} tickLine={false} axisLine={false} reversed />
                <YAxis
                  tick={axisTick}
                  tickLine={false}
                  axisLine={false}
                  width={44}
                  orientation="right"
                  tickFormatter={(v: number) => compactTick(v)}
                />
                <Tooltip
                  {...tooltipStyle}
                  formatter={(v) => [faNumber(Number(v)), "گردش"]}
                  cursor={{ fill: "var(--accent)", opacity: 0.5 }}
                />
                <Bar dataKey="value" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={34} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* دفتر کل */}
        <Card className="shadow-sm">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[15px] font-bold">دفتر کل حساب</CardTitle>
            <span className="tnum text-xs text-muted-foreground">{faNumber(detail.ledger.length)} آرتیکل</span>
          </CardHeader>
          <CardContent className="pt-0">
            {detail.ledger.length === 0 ? (
              <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                <Info className="size-4" aria-hidden />
                این حساب آرتیکل مستقیمی ندارد (حساب گروهی یا بدون تراکنش).
              </p>
            ) : (
              <div className="max-h-80 overflow-y-auto rounded-lg border">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-card shadow-[0_1px_0_0_var(--border)]">
                    <TableRow>
                      <TableHead className="text-start">تاریخ</TableHead>
                      <TableHead className="text-start">سند</TableHead>
                      <TableHead className="text-start">شرح سند</TableHead>
                      <TableHead className="hidden text-start md:table-cell">شرح آرتیکل</TableHead>
                      <TableHead className="text-end">بدهکار</TableHead>
                      <TableHead className="text-end">بستانکار</TableHead>
                      <TableHead className="text-end">مانده</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detail.ledger.map((l) => (
                      <TableRow key={l.id} className="hover:bg-accent/40">
                        <TableCell className="tnum whitespace-nowrap text-xs">{faDate(l.date)}</TableCell>
                        <TableCell>
                          <button
                            type="button"
                            onClick={() => navigate("entries", { entryId: l.entryId })}
                            className="tnum rounded px-1 font-bold text-primary hover:underline"
                            title="مشاهده سند"
                          >
                            {faNumber(l.entryNumber)}
                          </button>
                        </TableCell>
                        <TableCell className="max-w-40 truncate text-xs">{l.entryDesc}</TableCell>
                        <TableCell className="hidden max-w-48 truncate text-xs text-muted-foreground md:table-cell">
                          {l.description || "—"}
                        </TableCell>
                        <TableCell className="tnum text-end text-xs">
                          {l.debit ? faNumber(l.debit) : "—"}
                        </TableCell>
                        <TableCell className="tnum text-end text-xs">
                          {l.credit ? faNumber(l.credit) : "—"}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "tnum text-end text-xs font-bold",
                            l.balance < 0 ? "text-destructive" : "text-success"
                          )}
                        >
                          {faNumber(l.balance)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <SectionShell
      title="کدینگ حساب‌ها"
      description="درخت استاندارد حساب‌ها با مانده زنده"
      icon={ListTree}
      actions={
        <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
          <Plus className="size-4" aria-hidden />
          حساب جدید
        </Button>
      }
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        {/* درخت حساب‌ها — در RTL سمت راست */}
        <Card className="w-full shrink-0 shadow-sm lg:w-80">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="flex items-center gap-2 text-[15px] font-bold">
              <ListTree className="size-4 text-primary" aria-hidden />
              درخت حساب‌ها
            </CardTitle>
            <span className="tnum text-xs text-muted-foreground">{faNumber(countLeaves(tree))} حساب</span>
          </CardHeader>
          <CardContent className="pt-0">
            {loading ? (
              <div className="space-y-2 py-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" style={{ marginInlineStart: (i % 3) * 14 }} />
                ))}
              </div>
            ) : tree.length === 0 ? (
              <EmptyState icon={Folder} title="حسابی ثبت نشده" text="اولین حساب را ایجاد کنید." />
            ) : (
              <div className="max-h-[26rem] overflow-y-auto pe-1 lg:max-h-[calc(100vh-16rem)]">
                {tree.map((root) => (
                  <TreeNode
                    key={root.id}
                    node={root}
                    depth={0}
                    expanded={expanded}
                    onToggle={toggle}
                    selectedId={selectedId}
                    onSelect={handleSelect}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* پنل جزئیات — دسکتاپ */}
        <div className="hidden min-w-0 flex-1 lg:block">{renderDetail()}</div>

        {/* پنل جزئیات — موبایل (Dialog تمام‌عرض) */}
        <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
          <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader className="sr-only">
              <DialogTitle>جزئیات حساب</DialogTitle>
              <DialogDescription>دفتر کل و گردش ماهانه حساب انتخاب‌شده</DialogDescription>
            </DialogHeader>
            {renderDetail()}
          </DialogContent>
        </Dialog>
      </div>

      {/* Dialog حساب جدید */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="size-4 text-primary" aria-hidden />
              حساب جدید
            </DialogTitle>
            <DialogDescription>افزودن حساب به کدینگ استاندارد شرکت</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3.5 py-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="acc-code">کد حساب *</Label>
                <Input
                  id="acc-code"
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                  placeholder="۱۱۰۸"
                  className="tnum font-mono"
                  dir="ltr"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="acc-name">نام حساب *</Label>
                <Input
                  id="acc-name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="صندوق فروشگاه"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>نوع حساب *</Label>
              <Select
                value={form.type}
                onValueChange={(v) => setForm((f) => ({ ...f, type: v as AccountType }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="انتخاب نوع" />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(ACCOUNT_TYPE_LABELS) as AccountType[]).map((t) => (
                    <SelectItem key={t} value={t}>
                      {ACCOUNT_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>حساب والد</Label>
              <Select
                value={form.parentId || "__none"}
                onValueChange={(v) => setForm((f) => ({ ...f, parentId: v === "__none" ? "" : v }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="انتخاب والد" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">بدون والد (سطح اول)</SelectItem>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      <span style={{ paddingInlineStart: g.depth * 12 }} className="tnum">
                        {g.code} — {g.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="acc-group">حساب گروهی</Label>
                <p className="mt-0.5 text-xs text-muted-foreground">حساب سرستون بدون تراکنش مستقیم</p>
              </div>
              <Switch
                id="acc-group"
                checked={form.isGroup}
                onCheckedChange={(v) => setForm((f) => ({ ...f, isGroup: v }))}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              انصراف
            </Button>
            <Button onClick={submitNewAccount} disabled={saving}>
              {saving ? "در حال ثبت..." : "ثبت حساب"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SectionShell>
  );
}

function countLeaves(nodes: AccountDTO[]): number {
  let c = 0;
  for (const n of nodes) {
    if (n.isGroup || n.children.length > 0) c += countLeaves(n.children);
    else c += 1;
  }
  return c;
}
