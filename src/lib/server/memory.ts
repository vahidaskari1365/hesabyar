// ─────────────────────────────────────────────────────────────────
// موتور داده درون‌حافظه (حالت بدون دیتابیس)
// ─────────────────────────────────────────────────────────────────
// پیاده‌سازی سازگار با زیرمجموعه‌ای از Prisma Client که پروژه استفاده می‌کند؛
// به‌محض نبود DATABASE_URL یا در دسترس نبودن دیتابیس، فعال می‌شود و
// با داده نمونه واقع‌گرایانه (همان منطق prisma/seed.ts) بالا می‌آید.
// ─────────────────────────────────────────────────────────────────

type Row = Record<string, unknown>;

type ModelName =
  | "account"
  | "journalEntry"
  | "journalLine"
  | "contact"
  | "invoice"
  | "invoiceItem"
  | "savedReport"
  | "setting";

interface RelDef {
  model: ModelName;
  /** کلید خارجی در همین مدل (رابطه چند-به-یک) */
  fk?: string;
  /** کلید خارجی در مدل مقابل (رابطه معکوس) */
  reverseFk?: string;
  many?: boolean;
  cascade?: boolean;
  setNull?: boolean;
}

const RELATIONS: Record<ModelName, Record<string, RelDef>> = {
  account: {
    parent: { model: "account", fk: "parentId" },
    children: { model: "account", reverseFk: "parentId", many: true },
    lines: { model: "journalLine", reverseFk: "accountId", many: true },
  },
  journalEntry: {
    contact: { model: "contact", fk: "contactId" },
    lines: { model: "journalLine", reverseFk: "entryId", many: true, cascade: true },
    invoice: { model: "invoice", reverseFk: "entryId", setNull: true },
  },
  journalLine: {
    entry: { model: "journalEntry", fk: "entryId" },
    account: { model: "account", fk: "accountId" },
  },
  contact: {
    entries: { model: "journalEntry", reverseFk: "contactId", many: true, setNull: true },
    invoices: { model: "invoice", reverseFk: "contactId", many: true },
  },
  invoice: {
    contact: { model: "contact", fk: "contactId" },
    items: { model: "invoiceItem", reverseFk: "invoiceId", many: true, cascade: true },
    entry: { model: "journalEntry", fk: "entryId" },
  },
  invoiceItem: {
    invoice: { model: "invoice", fk: "invoiceId" },
  },
  savedReport: {},
  setting: {},
};

const HAS_CREATED_AT: Partial<Record<ModelName, boolean>> = {
  account: true,
  journalEntry: true,
  contact: true,
  invoice: true,
  savedReport: true,
};

const DEFAULTS: Record<ModelName, Row> = {
  account: { isGroup: false, parentId: null },
  journalEntry: { status: "DRAFT", source: "MANUAL", aiNote: null, contactId: null },
  journalLine: { debit: 0, credit: 0, description: "", order: 0 },
  contact: { type: "CUSTOMER", phone: null, email: null, taxId: null },
  invoice: {
    status: "FINAL",
    taxRate: 10,
    total: 0,
    taxAmount: 0,
    grandTotal: 0,
    entryId: null,
    notes: null,
  },
  invoiceItem: { quantity: 1, unitPrice: 0, total: 0 },
  savedReport: {},
  setting: {
    companyName: "شرکت نمونه‌های حسابداری برتر",
    fiscalYear: "1404",
    taxRate: 10,
    currency: "تومان",
  },
};

// ─── انبار داده ──────────────────────────────────────────────────

const store: Record<ModelName, Row[]> = {
  account: [],
  journalEntry: [],
  journalLine: [],
  contact: [],
  invoice: [],
  invoiceItem: [],
  savedReport: [],
  setting: [],
};

let idCounter = 0;
function nextId(): string {
  idCounter += 1;
  return `mem_${idCounter.toString(36)}_${Math.abs(idCounter * 7919).toString(36)}`;
}

// ─── منطق شرط‌ها (where) ─────────────────────────────────────────

function eqVal(a: unknown, b: unknown): boolean {
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  return a === b;
}

function ordCmp(value: unknown, v: unknown, test: (r: number) => boolean): boolean {
  if (value === null || value === undefined) return false;
  let r: number;
  if (value instanceof Date && v instanceof Date) r = value.getTime() - v.getTime();
  else if (typeof value === "number" && typeof v === "number") r = value - v;
  else r = String(value).localeCompare(String(v), "en");
  return test(r);
}

function matchCond(value: unknown, cond: unknown): boolean {
  if (cond === null) return value === null || value === undefined;
  if (typeof cond !== "object" || cond instanceof Date) return eqVal(value, cond);
  const c = cond as Record<string, unknown>;
  for (const [op, v] of Object.entries(c)) {
    switch (op) {
      case "equals":
        if (!matchCond(value, v)) return false;
        break;
      case "not":
        if (matchCond(value, v)) return false;
        break;
      case "in": {
        const arr = (v ?? []) as unknown[];
        if (!arr.some((x) => eqVal(value, x))) return false;
        break;
      }
      case "notIn": {
        const arr = (v ?? []) as unknown[];
        if (arr.some((x) => eqVal(value, x))) return false;
        break;
      }
      case "lt":
        if (!ordCmp(value, v, (r) => r < 0)) return false;
        break;
      case "lte":
        if (!ordCmp(value, v, (r) => r <= 0)) return false;
        break;
      case "gt":
        if (!ordCmp(value, v, (r) => r > 0)) return false;
        break;
      case "gte":
        if (!ordCmp(value, v, (r) => r >= 0)) return false;
        break;
      case "contains": {
        const s = value === null || value === undefined ? "" : String(value);
        if (!s.toLowerCase().includes(String(v).toLowerCase())) return false;
        break;
      }
      case "startsWith": {
        const s = value === null || value === undefined ? "" : String(value);
        if (!s.toLowerCase().startsWith(String(v).toLowerCase())) return false;
        break;
      }
      case "mode":
        break;
      default:
        return false;
    }
  }
  return true;
}

function resolveOne(row: Row, rel: RelDef): Row | null {
  if (rel.fk) {
    const fk = row[rel.fk];
    if (fk === null || fk === undefined) return null;
    return store[rel.model].find((r) => r.id === fk) ?? null;
  }
  return store[rel.model].find((r) => r[rel.reverseFk!] === row.id) ?? null;
}

function resolveMany(row: Row, rel: RelDef): Row[] {
  return store[rel.model].filter((r) => r[rel.reverseFk!] === row.id);
}

function matchWhere(row: Row, where: unknown, model: ModelName): boolean {
  if (where === null || where === undefined) return true;
  const w = where as Record<string, unknown>;
  for (const [key, cond] of Object.entries(w)) {
    if (cond === undefined) continue;
    if (key === "OR") {
      const arr = (cond ?? []) as Record<string, unknown>[];
      if (!arr.some((sub) => matchWhere(row, sub, model))) return false;
    } else if (key === "AND") {
      const arr = (cond ?? []) as Record<string, unknown>[];
      if (!arr.every((sub) => matchWhere(row, sub, model))) return false;
    } else if (key === "NOT") {
      if (Array.isArray(cond)) {
        if ((cond as Record<string, unknown>[]).some((sub) => matchWhere(row, sub, model)))
          return false;
      } else if (matchWhere(row, cond, model)) {
        return false;
      }
    } else {
      const rel = RELATIONS[model][key];
      if (rel) {
        if (rel.many) {
          const list = resolveMany(row, rel);
          const c = (cond ?? {}) as Record<string, unknown>;
          if (c.some) {
            if (!list.some((r) => matchWhere(r, c.some, rel.model))) return false;
          } else if (c.none) {
            if (list.some((r) => matchWhere(r, c.none, rel.model))) return false;
          } else if (c.every) {
            if (!list.every((r) => matchWhere(r, c.every, rel.model))) return false;
          } else {
            if (!list.some((r) => matchWhere(r, cond, rel.model))) return false;
          }
        } else {
          const related = resolveOne(row, rel);
          if (cond === null) {
            if (related !== null) return false;
          } else {
            if (related === null) return false;
            if (!matchWhere(related, cond, rel.model)) return false;
          }
        }
      } else {
        if (!matchCond(row[key], cond)) return false;
      }
    }
  }
  return true;
}

// ─── مرتب‌سازی (orderBy) ─────────────────────────────────────────

function compareVals(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === null || a === undefined) return -1;
  if (b === null || b === undefined) return 1;
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "en");
}

type CmpFn = (a: Row, b: Row) => number;

function buildCmp(model: ModelName, ob: Record<string, unknown>): CmpFn {
  return (a: Row, b: Row) => {
    for (const [key, spec] of Object.entries(ob)) {
      if (spec === undefined || spec === null) continue;
      let va: unknown;
      let vb: unknown;
      let dir: unknown = spec;
      if (typeof spec === "object") {
        const rel = RELATIONS[model][key];
        const entries = Object.entries(spec as Record<string, unknown>);
        const [subKey, subDir] = entries[0] ?? [null, null];
        dir = subDir;
        if (rel) {
          const ra = resolveOne(a, rel);
          const rb = resolveOne(b, rel);
          va = ra ? ra[subKey as string] : null;
          vb = rb ? rb[subKey as string] : null;
        }
      } else {
        va = a[key];
        vb = b[key];
      }
      const c = compareVals(va, vb);
      if (c !== 0) return dir === "desc" ? -c : c;
    }
    return 0;
  };
}

function sortRows(model: ModelName, rows: Row[], orderBy: unknown): Row[] {
  const arr = Array.isArray(orderBy) ? orderBy : [orderBy];
  const cmps = arr
    .filter((o) => o && typeof o === "object")
    .map((o) => buildCmp(model, o as Record<string, unknown>));
  if (cmps.length === 0) return rows;
  return [...rows].sort((a, b) => {
    for (const cmp of cmps) {
      const c = cmp(a, b);
      if (c !== 0) return c;
    }
    return 0;
  });
}

// ─── شکل‌دهی خروجی (include / select) ────────────────────────────

interface FindArgs {
  where?: unknown;
  orderBy?: unknown;
  take?: number;
  skip?: number;
  include?: Record<string, unknown>;
  select?: Record<string, unknown>;
}

function shapeRow(model: ModelName, row: Row, args: FindArgs): Row {
  if (args.select) {
    const out: Row = {};
    for (const [k, v] of Object.entries(args.select)) {
      if (!v) continue;
      const rel = RELATIONS[model][k];
      if (rel) {
        out[k] = shapeRelation(row, rel, v);
      } else {
        out[k] = structuredClone(row[k] ?? null);
      }
    }
    return out;
  }
  const inc = args.include ?? {};
  const out: Row = {};
  for (const k of Object.keys(row)) {
    if (inc[k] === undefined) out[k] = structuredClone(row[k] ?? null);
  }
  for (const [k, v] of Object.entries(inc)) {
    if (!v) continue;
    const rel = RELATIONS[model][k];
    if (rel) out[k] = shapeRelation(row, rel, v);
  }
  return out;
}

function shapeRelation(row: Row, rel: RelDef, spec: unknown): unknown {
  interface RelSpec {
    where?: unknown;
    orderBy?: unknown;
    take?: number;
    skip?: number;
    include?: Record<string, unknown>;
    select?: Record<string, unknown>;
  }
  const s =
    spec && typeof spec === "object" ? (spec as RelSpec) : ({} as RelSpec);
  if (rel.many) {
    let list = resolveMany(row, rel);
    if (s.where) list = list.filter((r) => matchWhere(r, s.where, rel.model));
    if (s.orderBy) list = sortRows(rel.model, list, s.orderBy);
    if (s.skip) list = list.slice(s.skip);
    if (s.take !== undefined) list = list.slice(0, s.take);
    return list.map((r) => shapeRow(rel.model, r, s));
  }
  const related = resolveOne(row, rel);
  if (!related) return null;
  return shapeRow(rel.model, related, s);
}

// ─── نویسندگی (create / update / delete) ─────────────────────────

function findByUnique(model: ModelName, where: Record<string, unknown>): Row | null {
  return (
    store[model].find((r) =>
      Object.entries(where).every(([k, v]) => eqVal(r[k], v))
    ) ?? null
  );
}

function createRow(model: ModelName, data: Row): Row {
  const row: Row = {};
  const nested: [RelDef, Row[]][] = [];
  for (const [k, v] of Object.entries(data)) {
    const rel = RELATIONS[model][k];
    if (
      rel &&
      rel.many &&
      rel.reverseFk &&
      v &&
      typeof v === "object" &&
      "create" in (v as object)
    ) {
      const list = ((v as { create: unknown }).create ?? []) as Row[];
      nested.push([rel, list]);
    } else if (v !== undefined) {
      row[k] = v;
    }
  }
  for (const [k, v] of Object.entries(DEFAULTS[model])) {
    if (row[k] === undefined) row[k] = structuredClone(v);
  }
  if (!row.id) row.id = nextId();
  if (HAS_CREATED_AT[model]) row.createdAt ??= new Date();
  if (model === "journalEntry") row.updatedAt = new Date();
  store[model].push(row);
  for (const [rel, items] of nested) {
    for (const item of items) {
      createRow(rel.model, { ...item, [rel.reverseFk!]: row.id });
    }
  }
  return { ...row };
}

function updateRow(model: ModelName, where: Row, data: Row): Row {
  const row = findByUnique(model, where);
  if (!row) throw new Error(`رکورد ${model} یافت نشد (P2025)`);
  const nested: [RelDef, Row[]][] = [];
  for (const [k, v] of Object.entries(data)) {
    const rel = RELATIONS[model][k];
    if (
      rel &&
      rel.many &&
      rel.reverseFk &&
      v &&
      typeof v === "object" &&
      "create" in (v as object)
    ) {
      const list = ((v as { create: unknown }).create ?? []) as Row[];
      nested.push([rel, list]);
    } else if (v !== undefined) {
      row[k] = v;
    }
  }
  if (model === "journalEntry") row.updatedAt = new Date();
  for (const [rel, items] of nested) {
    for (const item of items) {
      createRow(rel.model, { ...item, [rel.reverseFk!]: row.id });
    }
  }
  return { ...row };
}

function deleteRow(model: ModelName, row: Row): void {
  for (const rel of Object.values(RELATIONS[model])) {
    if (!rel.many || !rel.reverseFk) continue;
    const children = store[rel.model].filter((r) => r[rel.reverseFk!] === row.id);
    if (rel.cascade) {
      children.forEach((c) => deleteRow(rel.model, c));
    } else if (rel.setNull) {
      children.forEach((c) => {
        c[rel.reverseFk!] = null;
      });
    }
  }
  store[model] = store[model].filter((r) => r !== row);
}

// ─── تولید id کلاینت هر مدل ──────────────────────────────────────

function modelApi(model: ModelName): Record<string, (...args: never[]) => Promise<unknown>> {
  return {
    findMany: async (args: FindArgs = {}) => {
      let rows = store[model].filter((r) => matchWhere(r, args.where, model));
      if (args.orderBy) rows = sortRows(model, rows, args.orderBy);
      const skip = args.skip ?? 0;
      rows = rows.slice(skip, args.take !== undefined ? skip + args.take : undefined);
      return rows.map((r) => shapeRow(model, r, args));
    },
    findUnique: async (args: { where: Row } & FindArgs) => {
      const row = findByUnique(model, args.where);
      if (!row) return null;
      return shapeRow(model, row, args);
    },
    create: async (args: { data: Row }) => createRow(model, args.data),
    update: async (args: { where: Row; data: Row }) => updateRow(model, args.where, args.data),
    upsert: async (args: { where: Row; create: Row; update: Row }) => {
      const existing = findByUnique(model, args.where);
      if (existing) return updateRow(model, args.where, args.update);
      return createRow(model, args.create);
    },
    delete: async (args: { where: Row }) => {
      const row = findByUnique(model, args.where);
      if (!row) throw new Error(`رکورد ${model} یافت نشد (P2025)`);
      deleteRow(model, row);
      return row;
    },
    deleteMany: async (args: { where?: unknown } = {}) => {
      const rows = store[model].filter((r) => matchWhere(r, args.where, model));
      rows.forEach((r) => deleteRow(model, r));
      return { count: rows.length };
    },
    count: async (args: { where?: unknown } = {}) => {
      return store[model].filter((r) => matchWhere(r, args.where, model)).length;
    },
    aggregate: async (args: { _max?: Record<string, boolean>; _min?: Record<string, boolean> }) => {
      const out: Row = {};
      if (args._max) {
        const m: Row = {};
        for (const field of Object.keys(args._max)) {
          const vals = store[model]
            .map((r) => r[field])
            .filter((v) => v !== null && v !== undefined) as (number | Date)[];
          m[field] = vals.length
            ? Math.max(...vals.map((v) => (v instanceof Date ? v.getTime() : (v as number))))
            : null;
        }
        out._max = m;
      }
      if (args._min) {
        const m: Row = {};
        for (const field of Object.keys(args._min)) {
          const vals = store[model]
            .map((r) => r[field])
            .filter((v) => v !== null && v !== undefined) as (number | Date)[];
          m[field] = vals.length
            ? Math.min(...vals.map((v) => (v instanceof Date ? v.getTime() : (v as number))))
            : null;
        }
        out._min = m;
      }
      return out;
    },
  };
}

// ─── داده نمونه (معادل prisma/seed.ts — تکرارپذیر) ───────────────

let seedState = 1404;
function rand(): number {
  seedState = (seedState * 1103515245 + 12345) % 2147483648;
  return seedState / 2147483648;
}
function randInt(min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min;
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

const ACCOUNTS: { code: string; name: string; type: string; isGroup?: boolean; parent?: string }[] = [
  { code: "1", name: "دارایی‌ها", type: "ASSET", isGroup: true },
  { code: "11", name: "دارایی‌های جاری", type: "ASSET", isGroup: true, parent: "1" },
  { code: "1101", name: "صندوق", type: "ASSET", parent: "11" },
  { code: "1102", name: "بانک", type: "ASSET", parent: "11" },
  { code: "1103", name: "حساب‌های دریافتنی", type: "ASSET", parent: "11" },
  { code: "1104", name: "پیش‌پرداخت‌ها", type: "ASSET", parent: "11" },
  { code: "1105", name: "موجودی کالا", type: "ASSET", parent: "11" },
  { code: "12", name: "دارایی‌های غیرجاری", type: "ASSET", isGroup: true, parent: "1" },
  { code: "1201", name: "اموال، ماشین‌آلات و تجهیزات", type: "ASSET", parent: "12" },
  { code: "1202", name: "استهلاک انباشته", type: "ASSET", parent: "12" },
  { code: "2", name: "بدهی‌ها", type: "LIABILITY", isGroup: true },
  { code: "21", name: "بدهی‌های جاری", type: "LIABILITY", isGroup: true, parent: "2" },
  { code: "2101", name: "حساب‌های پرداختنی", type: "LIABILITY", parent: "21" },
  { code: "2102", name: "پیش‌دریافت‌ها", type: "LIABILITY", parent: "21" },
  { code: "2103", name: "مالیات بر ارزش افزوده", type: "LIABILITY", parent: "21" },
  { code: "2104", name: "وام کوتاه‌مدت", type: "LIABILITY", parent: "21" },
  { code: "3", name: "سرمایه", type: "EQUITY", isGroup: true },
  { code: "3101", name: "سرمایه", type: "EQUITY", parent: "3" },
  { code: "3102", name: "سود و زیان انباشته", type: "EQUITY", parent: "3" },
  { code: "4", name: "درآمدها", type: "INCOME", isGroup: true },
  { code: "4101", name: "درآمد فروش کالا", type: "INCOME", parent: "4" },
  { code: "4102", name: "درآمد ارائه خدمات", type: "INCOME", parent: "4" },
  { code: "4103", name: "سایر درآمدها", type: "INCOME", parent: "4" },
  { code: "5", name: "هزینه‌ها", type: "EXPENSE", isGroup: true },
  { code: "5101", name: "بهای تمام‌شده کالای فروش‌رفته", type: "EXPENSE", parent: "5" },
  { code: "5201", name: "حقوق و دستمزد", type: "EXPENSE", parent: "5" },
  { code: "5202", name: "اجاره محل", type: "EXPENSE", parent: "5" },
  { code: "5203", name: "آب، برق، گاز و تلفن", type: "EXPENSE", parent: "5" },
  { code: "5204", name: "تبلیغات و بازاریابی", type: "EXPENSE", parent: "5" },
  { code: "5205", name: "حمل و نقل", type: "EXPENSE", parent: "5" },
  { code: "5206", name: "ملزومات اداری", type: "EXPENSE", parent: "5" },
  { code: "5207", name: "استهلاک", type: "EXPENSE", parent: "5" },
  { code: "5208", name: "سایر هزینه‌های عمومی", type: "EXPENSE", parent: "5" },
];

const CUSTOMERS = [
  "فروشگاه پارس‌الکترونیک",
  "بازرگانی آریا تجارت",
  "شرکت داده‌پردازان تهران",
  "مجموعه صنعتی کاوه",
  "فروشگاه آنلاین مارکت‌پلاس",
  "شرکت مهندسی پیوند",
  "بازرگانی صادراتی خاوران",
];
const SUPPLIERS = [
  "تولیدی نگین پلاست",
  "پخش سراسری البرز",
  "بسته‌بندی نوین صنعت",
  "واردات‌کننده آسیا ترید",
  "چاپ و بسته‌بندی هیرمند",
];

const PRODUCTS = [
  { name: "لپ‌تاپ مدل A", price: 42_000_000, cost: 24_500_000 },
  { name: "مانیتور ۲۷ اینچ", price: 18_500_000, cost: 11_000_000 },
  { name: "کارت شبکه صنعتی", price: 6_800_000, cost: 4_100_000 },
  { name: "پرینتر لیزری", price: 12_400_000, cost: 7_400_000 },
  { name: "کیبورد مکانیکال", price: 3_200_000, cost: 1_900_000 },
  { name: "هارد اکسترنال ۲ترابایت", price: 7_900_000, cost: 4_700_000 },
];

function wipeStore(): void {
  for (const key of Object.keys(store) as ModelName[]) {
    store[key] = [];
  }
  idCounter = 0;
  seedState = 1404;
}

function seedStore(): void {
  wipeStore();

  createRow("setting", {
    id: "main",
    companyName: "شرکت فناوری حساب‌یار هوشمند",
    fiscalYear: "1404",
    taxRate: 10,
    currency: "تومان",
  });

  const idByCode = new Map<string, string>();
  for (const a of ACCOUNTS) {
    const created = createRow("account", {
      code: a.code,
      name: a.name,
      type: a.type,
      isGroup: a.isGroup ?? false,
      parentId: a.parent ? idByCode.get(a.parent) ?? null : null,
    });
    idByCode.set(a.code, created.id as string);
  }

  const customerIds: string[] = [];
  for (const [i, name] of CUSTOMERS.entries()) {
    const c = createRow("contact", {
      name,
      type: "CUSTOMER",
      phone: `021-${randInt(3000, 9999)}${randInt(1000, 9999)}`,
      email: `info@${["pars", "aria", "dadeh", "kaveh", "market", "peyvand", "khavaran"][i]}.ir`,
      taxId: `411${randInt(100000000, 999999999)}`,
    });
    customerIds.push(c.id as string);
  }
  const supplierIds: string[] = [];
  for (const name of SUPPLIERS) {
    const c = createRow("contact", {
      name,
      type: "SUPPLIER",
      phone: `021-${randInt(3000, 9999)}${randInt(1000, 9999)}`,
      taxId: `411${randInt(100000000, 999999999)}`,
    });
    supplierIds.push(c.id as string);
  }

  const customers = customerIds.map((id) => ({ id }));
  const suppliers = supplierIds.map((id) => ({ id }));
  const acc = (code: string): string => idByCode.get(code)!;

  let entryNo = 1;
  function createEntry(
    date: Date,
    description: string,
    lines: { code: string; debit?: number; credit?: number; desc?: string }[],
    opts: {
      status?: string;
      source?: string;
      contactId?: string | null;
      aiNote?: string;
    } = {}
  ): Row {
    return createRow("journalEntry", {
      number: entryNo++,
      date,
      description,
      status: opts.status ?? "POSTED",
      source: opts.source ?? "MANUAL",
      contactId: opts.contactId ?? null,
      aiNote: opts.aiNote ?? null,
      lines: {
        create: lines.map((l, i) => ({
          accountId: acc(l.code),
          debit: l.debit ?? 0,
          credit: l.credit ?? 0,
          description: l.desc ?? "",
          order: i,
        })),
      },
    });
  }

  // سند افتتاحیه
  const opening = new Date();
  opening.setMonth(opening.getMonth() - 6, 1);
  createEntry(opening, "سند افتتاحیه سال مالی ۱۴۰۴", [
    { code: "1101", debit: 320_000_000, desc: "موجودی صندوق" },
    { code: "1102", debit: 1_850_000_000, desc: "موجودی بانک مرکزی" },
    { code: "1103", debit: 480_000_000, desc: "مطالبات اول دوره از مشتریان" },
    { code: "1105", debit: 620_000_000, desc: "ارزش‌گذاری موجودی اول دوره" },
    { code: "1201", debit: 940_000_000, desc: "تجهیزات اداری و تولیدی" },
    { code: "2104", credit: 400_000_000, desc: "وام بانکی کوتاه‌مدت" },
    { code: "3101", credit: 3_810_000_000, desc: "سرمایه اولیه" },
  ]);

  const today = new Date();
  const monthsBack = 6;

  for (let m = monthsBack - 1; m >= 0; m--) {
    const monthDate = new Date(today.getFullYear(), today.getMonth() - m, 1);
    const daysInMonth = new Date(
      monthDate.getFullYear(),
      monthDate.getMonth() + 1,
      0
    ).getDate();
    const maxDay = m === 0 ? Math.max(2, Math.min(today.getDate(), daysInMonth)) : daysInMonth;
    const seasonBoost = 1 + (monthsBack - m) * 0.06;

    // فاکتورهای فروش
    const salesCount = randInt(4, 7);
    for (let i = 0; i < salesCount; i++) {
      const day = randInt(1, maxDay);
      const date = new Date(monthDate.getFullYear(), monthDate.getMonth(), day);
      const product = pick(PRODUCTS);
      const qty = randInt(2, 12);
      const total = Math.round(product.price * qty * seasonBoost);
      const cost = Math.round(product.cost * qty);
      const tax = Math.round(total * 0.1);
      const grand = total + tax;
      const customer = pick(customers);
      const cashSale = rand() < 0.45;

      const inv = createRow("invoice", {
        number: 1000 + (monthsBack - m) * 10 + i + 1,
        type: "SALES",
        contactId: customer.id,
        date,
        status: "FINAL",
        total,
        taxRate: 10,
        taxAmount: tax,
        grandTotal: grand,
        items: {
          create: [
            {
              description: product.name,
              quantity: qty,
              unitPrice: Math.round(product.price * seasonBoost),
              total,
            },
          ],
        },
      });

      const lines: { code: string; debit?: number; credit?: number; desc?: string }[] = [
        {
          code: cashSale ? "1102" : "1103",
          debit: grand,
          desc: `فاکتور فروش شماره ${inv.number} - ${CUSTOMERS[customerIds.indexOf(customer.id)] ?? ""}`,
        },
        { code: "4101", credit: total, desc: `درآمد فروش ${product.name} (${qty} عدد)` },
        { code: "2103", credit: tax, desc: "مالیات بر ارزش افزوده فروش" },
      ];
      lines.push({ code: "5101", debit: cost, desc: `بهای تمام‌شده ${product.name}` });
      lines.push({ code: "1105", credit: cost, desc: "کاهش موجودی کالا" });
      const entry = createEntry(
        date,
        `فاکتور فروش ${inv.number} - ${CUSTOMERS[customerIds.indexOf(customer.id)] ?? ""}`,
        lines,
        { contactId: customer.id, source: "INVOICE" }
      );
      updateRow("invoice", { id: inv.id as string }, { entryId: entry.id });
    }

    // فاکتورهای خرید
    const buyCount = randInt(2, 3);
    for (let i = 0; i < buyCount; i++) {
      const day = randInt(1, maxDay);
      const date = new Date(monthDate.getFullYear(), monthDate.getMonth(), day);
      const product = pick(PRODUCTS);
      const qty = randInt(10, 30);
      const total = Math.round(product.cost * qty);
      const tax = Math.round(total * 0.1);
      const grand = total + tax;
      const supplier = pick(suppliers);
      const cashBuy = rand() < 0.3;

      const inv = createRow("invoice", {
        number: 2000 + (monthsBack - m) * 10 + i + 1,
        type: "PURCHASE",
        contactId: supplier.id,
        date,
        status: "FINAL",
        total,
        taxRate: 10,
        taxAmount: tax,
        grandTotal: grand,
        items: {
          create: [
            { description: product.name, quantity: qty, unitPrice: product.cost, total },
          ],
        },
      });
      const lines: { code: string; debit?: number; credit?: number; desc?: string }[] = [
        { code: "1105", debit: total, desc: `خرید ${product.name} (${qty} عدد) از ${SUPPLIERS[supplierIds.indexOf(supplier.id)] ?? ""}` },
        { code: "2103", debit: tax, desc: "مالیات ارزش افزوده خرید" },
        {
          code: cashBuy ? "1102" : "2101",
          credit: grand,
          desc: cashBuy ? "پرداخت نقدی/بانکی" : `بدهی به ${SUPPLIERS[supplierIds.indexOf(supplier.id)] ?? ""}`,
        },
      ];
      const entry = createEntry(
        date,
        `فاکتور خرید ${inv.number} - ${SUPPLIERS[supplierIds.indexOf(supplier.id)] ?? ""}`,
        lines,
        { contactId: supplier.id, source: "INVOICE" }
      );
      updateRow("invoice", { id: inv.id as string }, { entryId: entry.id });
    }

    // حقوق و دستمزد
    const payrollDay = Math.min(maxDay, randInt(26, 28));
    const payroll = randInt(180, 220) * 1_000_000;
    createEntry(
      new Date(monthDate.getFullYear(), monthDate.getMonth(), payrollDay),
      "حقوق و دستمزد پرسنل",
      [
        { code: "5201", debit: payroll, desc: "حقوق و مزایای ماهانه" },
        { code: "1102", credit: payroll, desc: "پرداخت از بانک" },
      ]
    );

    // اجاره
    const rent = 85_000_000;
    createEntry(
      new Date(monthDate.getFullYear(), monthDate.getMonth(), randInt(3, 6)),
      "اجاره محل دفتر و انبار",
      [
        { code: "5202", debit: rent, desc: "اجاره ماهانه" },
        { code: "1102", credit: rent, desc: "پرداخت از بانک" },
      ]
    );

    // آب و برق و گاز
    createEntry(
      new Date(monthDate.getFullYear(), monthDate.getMonth(), randInt(8, 15)),
      "مصارف آب، برق، گاز و تلفن",
      [
        { code: "5203", debit: randInt(12, 26) * 1_000_000, desc: "قبوض ماه جاری" },
        { code: "1102", credit: 0, desc: "" },
      ].map((l) => ({ ...l, credit: l.credit || l.debit }))
    );

    // تبلیغات
    if (rand() < 0.75) {
      const adAmount = randInt(20, 60) * 1_000_000;
      createEntry(
        new Date(monthDate.getFullYear(), monthDate.getMonth(), randInt(5, 20)),
        "هزینه تبلیغات و بازاریابی دیجیتال",
        [
          { code: "5204", debit: adAmount, desc: "کمپین تبلیغاتی" },
          { code: "1102", credit: adAmount, desc: "پرداخت از بانک" },
        ]
      );
    }

    // حمل و نقل
    if (rand() < 0.8) {
      const ship = randInt(6, 18) * 1_000_000;
      createEntry(
        new Date(monthDate.getFullYear(), monthDate.getMonth(), randInt(10, 25)),
        "هزینه حمل و نقل کالا",
        [
          { code: "5205", debit: ship, desc: "پیک و باربری" },
          { code: "1101", credit: ship, desc: "پرداخت از صندوق" },
        ]
      );
    }

    // ملزومات اداری
    if (rand() < 0.6) {
      const office = randInt(3, 9) * 1_000_000;
      createEntry(
        new Date(monthDate.getFullYear(), monthDate.getMonth(), randInt(12, 27)),
        "خرید ملزومات اداری",
        [
          { code: "5206", debit: office, desc: "کاغذ، تونر و ملزومات" },
          { code: "1101", credit: office, desc: "پرداخت نقدی" },
        ]
      );
    }

    // وصول مطالبات
    const collections = randInt(1, 2);
    for (let i = 0; i < collections; i++) {
      const amount = randInt(50, 130) * 1_000_000;
      const customer = pick(customers);
      createEntry(
        new Date(monthDate.getFullYear(), monthDate.getMonth(), randInt(5, maxDay)),
        `وصول مطالبات از ${CUSTOMERS[customerIds.indexOf(customer.id)] ?? ""}`,
        [
          { code: "1102", debit: amount, desc: "واریز به حساب بانکی" },
          { code: "1103", credit: amount, desc: `وصول طلب از ${CUSTOMERS[customerIds.indexOf(customer.id)] ?? ""}` },
        ],
        { contactId: customer.id }
      );
    }

    // پرداخت به تأمین‌کنندگان
    const payments = randInt(1, 2);
    for (let i = 0; i < payments; i++) {
      const amount = randInt(40, 120) * 1_000_000;
      const supplier = pick(suppliers);
      createEntry(
        new Date(monthDate.getFullYear(), monthDate.getMonth(), randInt(8, maxDay)),
        `تسویه بدهی به ${SUPPLIERS[supplierIds.indexOf(supplier.id)] ?? ""}`,
        [
          { code: "2101", debit: amount, desc: "پرداخت بدهی" },
          { code: "1102", credit: amount, desc: "خروج از بانک" },
        ],
        { contactId: supplier.id }
      );
    }

    // سایر درآمد
    if (rand() < 0.4) {
      const other = randInt(8, 25) * 1_000_000;
      createEntry(
        new Date(monthDate.getFullYear(), monthDate.getMonth(), randInt(10, 25)),
        "درآمد مشاوره و خدمات جانبی",
        [
          { code: "1102", debit: other, desc: "واریز وجه خدمات" },
          { code: "4102", credit: other, desc: "درآمد ارائه خدمات" },
        ]
      );
    }

    // استهلاک ماهانه
    createEntry(
      new Date(monthDate.getFullYear(), monthDate.getMonth(), Math.min(maxDay, 28)),
      "هزینه استهلاک تجهیزات (ماهانه)",
      [
        { code: "5207", debit: 15_600_000, desc: "استهلاک خطی تجهیزات" },
        { code: "1202", credit: 15_600_000, desc: "استهلاک انباشته" },
      ]
    );
  }

  // دو سند پیش‌نویس
  const draftDate = new Date();
  createEntry(
    draftDate,
    "پیش‌پرداخت اجاره کنفرانس سالانه",
    [
      { code: "1104", debit: 45_000_000, desc: "پیش‌پرداخت هتل" },
      { code: "1102", credit: 45_000_000, desc: "پرداخت از بانک" },
    ],
    { status: "DRAFT", source: "MANUAL" }
  );
  createEntry(
    draftDate,
    "خرید نرم‌افزار حسابداری (اشتراک سالانه)",
    [
      { code: "5208", debit: 96_000_000, desc: "اشتراک نرم‌افزار ابری" },
      { code: "2101", credit: 96_000_000, desc: "بدهی به فروشنده" },
    ],
    {
      status: "DRAFT",
      source: "AI_SUGGESTION",
      aiNote: "این سند با پیشنهاد هوش مصنوعی ایجاد شده است.",
    }
  );
}

function ensureSeeded(): void {
  if (store.account.length === 0) seedStore();
}

// ─── کلاینت حافظه‌ای ─────────────────────────────────────────────

export type MemoryClient = {
  reset: () => void;
} & Record<string, Record<string, (...args: never[]) => Promise<unknown>>>;

export function createMemoryClient(): MemoryClient {
  ensureSeeded();
  return {
    account: modelApi("account"),
    journalEntry: modelApi("journalEntry"),
    journalLine: modelApi("journalLine"),
    contact: modelApi("contact"),
    invoice: modelApi("invoice"),
    invoiceItem: modelApi("invoiceItem"),
    savedReport: modelApi("savedReport"),
    setting: modelApi("setting"),
    reset: () => seedStore(),
  } as unknown as MemoryClient;
}

/** بازنشانی داده نمونه (فقط حالت حافظه) */
export function resetMemoryData(): boolean {
  if (store.account.length === 0) {
    seedStore();
    return true;
  }
  return false;
}
