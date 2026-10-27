import { PrismaClient } from '@prisma/client'
import { createMemoryClient } from './server/memory'

/**
 * لایه داده با تعویض خودکار:
 * - اگر DATABASE_URL موجود و دیتابیس در دسترس باشد → Prisma (SQLite)
 * - در غیر این صورت → موتور درون‌حافظه با داده نمونه (بدون نیاز به دیتابیس)
 * برای اجبار به حالت حافظه: متغیر محیطی MEMORY_DB=1
 */

type AnyClient = Record<string, Record<string, (...args: never[]) => Promise<unknown>>>;

const globalForDb = globalThis as unknown as {
  __hesabyarClient?: Promise<{ kind: "database" | "memory"; client: AnyClient }>;
};

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("timeout: دیتابیس پاسخ نداد")), ms)
    ),
  ]);
}

async function resolveClient(): Promise<{ kind: "database" | "memory"; client: AnyClient }> {
  // حالت حافظه اجباری یا نبود آدرس دیتابیس
  if (process.env.MEMORY_DB === "1" || !process.env.DATABASE_URL) {
    return { kind: "memory", client: createMemoryClient() };
  }
  try {
    const prisma = new PrismaClient({ log: ["error"] });
    // پروب: بررسی دسترسی واقعی جداول
    await withTimeout(prisma.setting.count(), 3000);
    return { kind: "database", client: prisma as unknown as AnyClient };
  } catch {
    console.warn("[db] دیتابیس در دسترس نیست — حالت حافظه با داده نمونه فعال شد");
    return { kind: "memory", client: createMemoryClient() };
  }
}

const resolved = (globalForDb.__hesabyarClient ??= resolveClient());

/** نوع داده فعلی: database | memory */
export async function getDbKind(): Promise<"database" | "memory"> {
  return (await resolved).kind;
}

/** بازنشانی داده نمونه (فقط حالت حافظه) */
export async function resetIfMemory(): Promise<boolean> {
  const { kind, client } = await resolved;
  if (kind !== "memory") return false;
  const reset = (client as unknown as { reset: () => void }).reset;
  if (typeof reset === "function") reset();
  return true;
}

const methodCache = new Map<string, (...args: unknown[]) => Promise<unknown>>();

export const db = new Proxy(
  {},
  {
    get(_target, model: string) {
      return new Proxy(
        {},
        {
          get(_t2, method: string) {
            const key = `${model}.${method}`;
            if (!methodCache.has(key)) {
              methodCache.set(key, (...args: unknown[]) =>
                resolved.then(({ client }) =>
                  (
                    client[model]?.[method] as unknown as (
                      ...a: unknown[]
                    ) => Promise<unknown>
                  )(...args)
                )
              );
            }
            return methodCache.get(key);
          },
        }
      );
    },
  }
) as unknown as PrismaClient;

if (process.env.NODE_ENV !== "production") {
  // نگهداری مرجع سراسری برای جلوگیری از تولید مجدد در HMR
  void globalForDb.__hesabyarClient;
}
