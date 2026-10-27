"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, LayoutDashboard, ListTree, Receipt, Users, BarChart3, Settings2, FileText, ScanLine, Sparkles, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore, type SectionId } from "@/lib/store";
import { Logo } from "@/components/shared/logo";
import { faNumber } from "@/lib/format";
import { endpoints } from "@/lib/api";

interface NavItem {
  id: SectionId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  ai?: boolean;
}

const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: "عملیات اصلی",
    items: [
      { id: "dashboard", label: "داشبورد", icon: LayoutDashboard },
      { id: "entries", label: "اسناد حسابداری", icon: FileText },
      { id: "smart-scan", label: "اسکن هوشمند", icon: ScanLine, ai: true },
      { id: "invoices", label: "فاکتورها", icon: Receipt },
    ],
  },
  {
    title: "دفاتر و حساب‌ها",
    items: [
      { id: "accounts", label: "کدینگ حساب‌ها", icon: ListTree },
      { id: "contacts", label: "طرف‌های حساب", icon: Users },
    ],
  },
  {
    title: "گزارشگری",
    items: [
      { id: "reports", label: "گزارش‌های مالی", icon: BarChart3 },
      { id: "report-builder", label: "گزارش‌ساز", icon: Settings2 },
      { id: "ai-insights", label: "تحلیل هوشمند", icon: Sparkles, ai: true },
    ],
  },
  {
    title: "سیستم",
    items: [{ id: "settings", label: "تنظیمات", icon: Settings }],
  },
];

export function SidebarNav() {
  const section = useAppStore((s) => s.section);
  const navigate = useAppStore((s) => s.navigate);
  const mobileNavOpen = useAppStore((s) => s.mobileNavOpen);
  const setMobileNavOpen = useAppStore((s) => s.setMobileNavOpen);
  const [companyName, setCompanyName] = useState("حساب‌یار هوشمند");
  const [entryCount, setEntryCount] = useState<number | null>(null);

  useEffect(() => {
    endpoints
      .settings()
      .then((s) => setCompanyName(s.companyName))
      .catch(() => {});
    endpoints
      .dashboard()
      .then((d) => setEntryCount(d.kpi.entryCount))
      .catch(() => {});
  }, []);

  const content = (
    <div className="flex h-full flex-col">
      {/* برند */}
      <button
        type="button"
        onClick={() => navigate("dashboard")}
        className="flex items-center gap-3 px-5 pt-6 pb-5 text-start"
      >
        <Logo size={40} />
        <div className="min-w-0">
          <p className="truncate text-[15px] font-extrabold text-sidebar-foreground">حساب‌یار هوشمند</p>
          <p className="truncate text-[11px] text-sidebar-foreground/60">حسابداری مبتنی بر هوش مصنوعی</p>
        </div>
      </button>

      <nav className="flex-1 space-y-4 overflow-y-auto px-3 pb-4" aria-label="ناوبری اصلی">
        {NAV_GROUPS.map((group) => (
          <div key={group.title}>
            <p className="px-2.5 pb-1.5 text-[10.5px] font-semibold tracking-wide text-sidebar-foreground/40">
              {group.title}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = section === item.id;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => navigate(item.id)}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group relative flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-all",
                        active
                          ? "bg-sidebar-primary/15 text-sidebar-primary-foreground"
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      )}
                    >
                      {active && (
                        <motion.span
                          layoutId="nav-active"
                          className="absolute inset-y-1.5 right-0 w-1 rounded-full bg-sidebar-primary"
                          transition={{ type: "spring", stiffness: 400, damping: 30 }}
                        />
                      )}
                      <item.icon className={cn("size-4 shrink-0", active && "text-sidebar-primary")} />
                      <span className="flex-1 truncate text-start">{item.label}</span>
                      {item.ai && (
                        <span className="rounded-full bg-sidebar-primary/20 px-1.5 py-0.5 text-[9px] font-bold text-sidebar-primary">
                          AI
                        </span>
                      )}
                      {item.id === "entries" && entryCount !== null && (
                        <span className="tnum rounded-full bg-sidebar-accent px-1.5 py-0.5 text-[9.5px] text-sidebar-foreground/60">
                          {faNumber(entryCount)}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* کارت وضعیت */}
      <div className="mx-3 mb-4 rounded-xl border border-sidebar-border/60 bg-sidebar-accent/40 p-3">
        <div className="flex items-center gap-2">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
          </span>
          <p className="text-[11px] font-medium text-sidebar-foreground/80">سیستم فعال</p>
        </div>
        <p className="mt-1.5 text-[10.5px] leading-relaxed text-sidebar-foreground/50">
          {companyName}
          <br />
          نسخه ۱٫۰ — محیط نسخه اولیه
        </p>
      </div>
    </div>
  );

  return (
    <>
      {/* دسکتاپ */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 bg-sidebar lg:block" aria-label="منوی کناری">
        {content}
      </aside>

      {/* موبایل */}
      <AnimatePresence>
        {mobileNavOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/50 lg:hidden"
              onClick={() => setMobileNavOpen(false)}
            />
            <motion.aside
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
              className="fixed inset-y-0 right-0 z-50 w-72 bg-sidebar shadow-2xl lg:hidden"
              aria-label="منوی کناری موبایل"
            >
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                className="absolute top-4 left-3 rounded-lg p-2 text-sidebar-foreground/60 hover:bg-sidebar-accent"
                aria-label="بستن منو"
              >
                <ChevronDown className="size-5 rotate-90" />
              </button>
              {content}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
