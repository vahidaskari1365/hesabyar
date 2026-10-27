// ─── کلاینت API (سمت مرورگر) ────────────────────────────────────

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  if (!res.ok) {
    let msg = `خطای ${res.status}`;
    try {
      const body = await res.json();
      if (body?.error) msg = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(url: string) => request<T>(url),
  post: <T>(url: string, body: unknown) =>
    request<T>(url, { method: "POST", body: JSON.stringify(body) }),
  put: <T>(url: string, body: unknown) =>
    request<T>(url, { method: "PUT", body: JSON.stringify(body) }),
  del: <T>(url: string) => request<T>(url, { method: "DELETE" }),
};

// ─── نقاط انتهایی دامنه ─────────────────────────────────────────

import type {
  AccountDTO,
  ContactDTO,
  DashboardData,
  InvoiceDTO,
  JournalEntryDTO,
  CustomReportConfig,
  CustomReportResult,
  SettingDTO,
  AISuggestion,
  DocScanResult,
  AIInsight,
  SavedReportItem,
  ProcessesResponse,
  ProcessResult,
} from "./types";

export const endpoints = {
  dashboard: () => api.get<DashboardData>("/api/dashboard"),

  accounts: () => api.get<AccountDTO[]>("/api/accounts"),
  createAccount: (b: { code: string; name: string; type: string; parentId?: string | null; isGroup?: boolean }) =>
    api.post<{ id: string }>("/api/accounts", b),

  entries: (q?: string) => api.get<JournalEntryDTO[]>(`/api/entries${q ? `?${q}` : ""}`),
  createEntry: (b: unknown) => api.post<{ id: string; number: number }>("/api/entries", b),
  updateEntry: (id: string, b: unknown) => api.put<JournalEntryDTO>(`/api/entries/${id}`, b),
  deleteEntry: (id: string) => api.del<{ ok: boolean }>(`/api/entries/${id}`),

  contacts: () => api.get<ContactDTO[]>("/api/contacts"),
  createContact: (b: unknown) => api.post<{ id: string }>("/api/contacts", b),
  updateContact: (id: string, b: unknown) => api.put<ContactDTO>(`/api/contacts/${id}`, b),
  deleteContact: (id: string) => api.del<{ ok: boolean }>(`/api/contacts/${id}`),

  invoices: () => api.get<InvoiceDTO[]>("/api/invoices"),
  createInvoice: (b: unknown) => api.post<{ id: string; number: number; entryId?: string }>("/api/invoices", b),
  deleteInvoice: (id: string) => api.del<{ ok: boolean }>(`/api/invoices/${id}`),

  reports: (type: string, params?: Record<string, string>) => {
    const usp = new URLSearchParams(params ?? {});
    return api.get<import("./types").ReportData>(`/api/reports?type=${type}${usp.toString() ? `&${usp}` : ""}`);
  },
  customReport: (config: CustomReportConfig) => api.post<CustomReportResult>("/api/reports/custom", config),
  savedReports: () => api.get<SavedReportItem[]>("/api/saved-reports"),
  saveReport: (name: string, config: CustomReportConfig) =>
    api.post<{ id: string }>("/api/saved-reports", { name, config }),
  deleteSavedReport: (id: string) => api.del<{ ok: boolean }>(`/api/saved-reports/${id}`),

  settings: () => api.get<SettingDTO>("/api/settings"),
  updateSettings: (b: Partial<SettingDTO>) => api.put<SettingDTO>("/api/settings", b),

  suggestEntry: (text: string) => api.post<AISuggestion>("/api/ai/suggest-entry", { text }),
  analyzeDoc: (imageBase64: string, mime: string) =>
    api.post<DocScanResult>("/api/ai/analyze-doc", { imageBase64, mime }),
  insights: () => api.get<AIInsight[]>("/api/ai/insights"),
  chat: (messages: { role: string; content: string }[]) =>
    api.post<{ reply: string }>("/api/ai/chat", { messages }),

  processes: () => api.get<ProcessesResponse>("/api/processes"),
  runProcess: (processId: string) => api.post<ProcessResult>("/api/processes", { processId }),
};
