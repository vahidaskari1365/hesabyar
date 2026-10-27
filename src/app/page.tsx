"use client";

import { useState } from "react";
import { Check, Menu, Monitor, Moon, Sparkles, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useAppStore } from "@/lib/store";
import { SidebarNav } from "@/components/shared/sidebar-nav";
import { AIAssistant } from "@/components/shared/ai-assistant";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import DashboardSection from "@/components/sections/dashboard-section";
import EntriesSection from "@/components/sections/entries-section";
import SmartScanSection from "@/components/sections/smart-scan-section";
import AccountsSection from "@/components/sections/accounts-section";
import ContactsSection from "@/components/sections/contacts-section";
import InvoicesSection from "@/components/sections/invoices-section";
import ProcessesSection from "@/components/sections/processes-section";
import ReportsSection from "@/components/sections/reports-section";
import ReportBuilderSection from "@/components/sections/report-builder-section";
import AIInsightsSection from "@/components/sections/ai-insights-section";
import SettingsSection from "@/components/sections/settings-section";

const PAGE_TITLES: Record<string, string> = {
  dashboard: "داشبورد مالی",
  entries: "اسناد حسابداری",
  "smart-scan": "اسکن هوشمند اسناد",
  accounts: "کدینگ حساب‌ها",
  contacts: "طرف‌های حساب",
  invoices: "فاکتورها",
  processes: "فرآیندها و اتوماسیون",
  reports: "گزارش‌های مالی",
  "report-builder": "گزارش‌ساز",
  "ai-insights": "تحلیل هوشمند",
  settings: "تنظیمات",
};

const THEME_OPTIONS = [
  { value: "light", label: "روشن", icon: Sun },
  { value: "dark", label: "تاریک", icon: Moon },
  { value: "system", label: "سیستم", icon: Monitor },
] as const;

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  // بررسی نشانه‌ی انتخاب فقط پس از باز شدن منو — بدون hydration mismatch
  const [snapshot, setSnapshot] = useState<string | null>(null);
  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (open) setSnapshot(theme ?? "system");
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-9 rounded-lg"
          aria-label="انتخاب تم روشن/تاریک/سیستم"
        >
          <Sun className="size-4.5 dark:hidden" />
          <Moon className="hidden size-4.5 dark:block" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-36">
        {THEME_OPTIONS.map((opt) => (
          <DropdownMenuItem
            key={opt.value}
            onClick={() => setTheme(opt.value)}
            className="flex items-center gap-2"
          >
            <opt.icon className="size-4 text-muted-foreground" />
            <span className="flex-1">{opt.label}</span>
            {snapshot === opt.value && <Check className="size-4 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function Home() {
  const section = useAppStore((s) => s.section);
  const setAssistantOpen = useAppStore((s) => s.setAssistantOpen);
  const setMobileNavOpen = useAppStore((s) => s.setMobileNavOpen);

  return (
    <div className="flex min-h-screen w-full flex-col" dir="rtl">
      <div className="flex min-h-screen w-full flex-1">
        <SidebarNav />

        <div className="flex min-w-0 flex-1 flex-col">
          {/* هدر */}
          <header className="glass-header sticky top-0 z-30 border-b">
            <div className="flex h-14 items-center gap-2 px-4 sm:px-6">
              <Button
                variant="ghost"
                size="icon"
                className="size-9 lg:hidden"
                onClick={() => setMobileNavOpen(true)}
                aria-label="بازکردن منو"
              >
                <Menu className="size-5" />
              </Button>
              <h1 className="flex-1 truncate text-[15px] font-bold">{PAGE_TITLES[section] ?? "حساب‌یار"}</h1>
              <button
                type="button"
                onClick={() => setAssistantOpen(true)}
                className="hidden items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary sm:flex"
              >
                <Sparkles className="size-3.5 text-primary" />
                دستیار هوشمند
              </button>
              <ThemeToggle />
            </div>
          </header>

          {/* محتوای اصلی */}
          <main className="flex-1 px-4 py-5 sm:px-6 sm:py-6">
            {section === "dashboard" && <DashboardSection />}
            {section === "entries" && <EntriesSection />}
            {section === "smart-scan" && <SmartScanSection />}
            {section === "accounts" && <AccountsSection />}
            {section === "contacts" && <ContactsSection />}
            {section === "invoices" && <InvoicesSection />}
            {section === "processes" && <ProcessesSection />}
            {section === "reports" && <ReportsSection />}
            {section === "report-builder" && <ReportBuilderSection />}
            {section === "ai-insights" && <AIInsightsSection />}
            {section === "settings" && <SettingsSection />}
          </main>

          {/* فوتر چسبان */}
          <footer className="mt-auto border-t bg-card/60">
            <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-1.5 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-center sm:flex-row sm:text-start">
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="inline-block size-1.5 rounded-full bg-emerald-500" />
                حساب‌یار هوشمند — نرم‌افزار حسابداری مبتنی بر هوش مصنوعی و اتوماسیون
              </p>
              <p className="text-[11px] text-muted-foreground/70">
                نسخه ۱٫۰ • ساخته‌شده برای حسابداران ایرانی • داده‌های شما روی سرور اختصاصی
              </p>
            </div>
          </footer>
        </div>
      </div>

      <AIAssistant />
    </div>
  );
}
