// ─── تایپ‌های مشترک کلاینت/سرور ─────────────────────────────────

export type AccountType = "ASSET" | "LIABILITY" | "EQUITY" | "INCOME" | "EXPENSE";

export interface AccountDTO {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  isGroup: boolean;
  parentId: string | null;
  balance: number; // مانده (بدهکار مثبت)
  debit: number;
  credit: number;
  children: AccountDTO[];
}

export interface JournalLineDTO {
  id?: string;
  accountId: string;
  accountCode?: string;
  accountName?: string;
  debit: number;
  credit: number;
  description: string;
  order?: number;
}

export interface JournalEntryDTO {
  id: string;
  number: number;
  date: string;
  description: string;
  status: "DRAFT" | "POSTED";
  source: "MANUAL" | "AI_SUGGESTION" | "SCAN" | "INVOICE";
  aiNote?: string | null;
  contactId?: string | null;
  contactName?: string | null;
  totalDebit: number;
  totalCredit: number;
  lines: JournalLineDTO[];
  createdAt?: string;
}

export interface ContactDTO {
  id: string;
  name: string;
  type: "CUSTOMER" | "SUPPLIER" | "BOTH";
  phone?: string | null;
  email?: string | null;
  taxId?: string | null;
  receivable: number; // مانده بدهی مشتری به ما
  payable: number; // مانده بدهی ما به تأمین‌کننده
  invoiceCount: number;
  createdAt?: string;
}

export interface InvoiceItemDTO {
  id?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface InvoiceDTO {
  id: string;
  number: number;
  type: "SALES" | "PURCHASE";
  contactId: string;
  contactName?: string;
  date: string;
  status: string;
  total: number;
  taxRate: number;
  taxAmount: number;
  grandTotal: number;
  entryId?: string | null;
  notes?: string | null;
  items: InvoiceItemDTO[];
}

export interface DashboardKPI {
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  revenue: number;
  expenses: number;
  netProfit: number;
  cashBalance: number;
  receivables: number;
  payables: number;
  entryCount: number;
  draftCount: number;
  invoiceCount: number;
  salesCount: number;
  purchaseCount: number;
  margin: number;
}

export interface MonthlyPoint {
  month: string; // نام ماه فارسی
  key: string; // yyyy-mm
  revenue: number;
  expenses: number;
  profit: number;
  sales: number;
  purchases: number;
}

export interface DashboardData {
  kpi: DashboardKPI;
  monthly: MonthlyPoint[];
  expenseBreakdown: { name: string; value: number }[];
  topCustomers: { name: string; value: number }[];
  assetBreakdown: { name: string; value: number }[];
  recentEntries: {
    id: string;
    number: number;
    date: string;
    description: string;
    status: string;
    source: string;
    amount: number;
  }[];
  companyName: string;
}

export interface TrialBalanceRow {
  accountId: string;
  code: string;
  name: string;
  type: AccountType;
  debit: number;
  credit: number;
  balanceDebit: number;
  balanceCredit: number;
}

export interface ReportData {
  title: string;
  subtitle?: string;
  columns: string[];
  rows: (string | number)[][];
  totals?: (string | number)[];
  trial?: TrialBalanceRow[];
  chart?: {
    kind: "bar" | "pie" | "line" | "waterfall" | "none";
    data: { name: string; value: number; extra?: number }[];
    data2?: { name: string; value: number }[];
    series?: { key: string; label: string; color?: string }[];
  };
}

export interface CustomReportConfig {
  dataset: "entries" | "expenses" | "revenue" | "invoices" | "accounts";
  groupBy: "month" | "account" | "type" | "contact";
  metric: "amount" | "count" | "debit" | "credit" | "total" | "tax" | "grandTotal";
  chartType: "bar" | "line" | "area" | "pie";
  dateFrom?: string;
  dateTo?: string;
  entryStatus?: "ALL" | "POSTED" | "DRAFT";
  invoiceType?: "ALL" | "SALES" | "PURCHASE";
  limit?: number;
}

export interface CustomReportResult {
  rows: { name: string; value: number; secondary?: number }[];
  total: number;
  count: number;
  chartType: "bar" | "line" | "area" | "pie";
  title: string;
}

export interface AISuggestionLine {
  accountCode: string;
  accountName?: string;
  debit: number;
  credit: number;
  description?: string;
}

export interface AISuggestion {
  description: string;
  lines: AISuggestionLine[];
  confidence: number; // 0..1
  note?: string;
}

export interface DocScanResult {
  docType: string; // فاکتور فروش، رسید، قبض...
  vendor?: string;
  date?: string;
  total?: number;
  taxAmount?: number;
  items?: { description: string; quantity?: number; unitPrice?: number; total?: number }[];
  suggestion: AISuggestion;
  rawSummary?: string;
}

export interface AIInsight {
  type: "insight" | "warning" | "success" | "recommendation";
  title: string;
  text: string;
  metric?: string;
}

export interface SettingDTO {
  companyName: string;
  fiscalYear: string;
  taxRate: number;
  currency: string;
}

export interface SavedReportItem {
  id: string;
  name: string;
  config: CustomReportConfig;
  createdAt: string;
}

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  ASSET: "دارایی",
  LIABILITY: "بدهی",
  EQUITY: "سرمایه",
  INCOME: "درآمد",
  EXPENSE: "هزینه",
};

export const SOURCE_LABELS: Record<string, string> = {
  MANUAL: "دستی",
  AI_SUGGESTION: "پیشنهاد هوش مصنوعی",
  SCAN: "اسکن هوشمند",
  INVOICE: "فاکتور",
};

export const ENTRY_STATUS_LABELS: Record<string, string> = {
  DRAFT: "پیش‌نویس",
  POSTED: "قطعی",
};
