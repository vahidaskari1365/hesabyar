"use client";

import { create } from "zustand";

export type SectionId =
  | "dashboard"
  | "entries"
  | "smart-scan"
  | "accounts"
  | "contacts"
  | "invoices"
  | "reports"
  | "report-builder"
  | "ai-insights"
  | "settings";

export interface SectionParams {
  accountId?: string;
  reportType?: string;
  entryId?: string;
  [key: string]: string | undefined;
}

interface AppState {
  section: SectionId;
  params: SectionParams;
  assistantOpen: boolean;
  mobileNavOpen: boolean;
  navigate: (section: SectionId, params?: SectionParams) => void;
  setAssistantOpen: (open: boolean) => void;
  setMobileNavOpen: (open: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  section: "dashboard",
  params: {},
  assistantOpen: false,
  mobileNavOpen: false,
  navigate: (section, params = {}) => {
    set({ section, params, mobileNavOpen: false });
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  },
  setAssistantOpen: (assistantOpen) => set({ assistantOpen }),
  setMobileNavOpen: (mobileNavOpen) => set({ mobileNavOpen }),
}));
