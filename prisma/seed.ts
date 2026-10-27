/**
 * Seed داده‌های اولیه نرم‌افزار حسابداری هوشمند
 * - کدینگ استاندارد حساب‌های ایرانی (سطح ۱ تا ۳)
 * - حدود ۶ ماه تراکنش واقع‌گرایانه
 */
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

// تولید اعداد شبه‌تصادفی قابل تکرار (seeded)
let seedState = 1404
function rand() {
  seedState = (seedState * 1103515245 + 12345) % 2147483648
  return seedState / 2147483648
}
function randInt(min: number, max: number) {
  return Math.floor(rand() * (max - min + 1)) + min
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)]
}

const ACCOUNTS: { code: string; name: string; type: string; isGroup?: boolean; parent?: string }[] = [
  // ۱: دارایی‌ها
  { code: '1', name: 'دارایی‌ها', type: 'ASSET', isGroup: true },
  { code: '11', name: 'دارایی‌های جاری', type: 'ASSET', isGroup: true, parent: '1' },
  { code: '1101', name: 'صندوق', type: 'ASSET', parent: '11' },
  { code: '1102', name: 'بانک', type: 'ASSET', parent: '11' },
  { code: '1103', name: 'حساب‌های دریافتنی', type: 'ASSET', parent: '11' },
  { code: '1104', name: 'پیش‌پرداخت‌ها', type: 'ASSET', parent: '11' },
  { code: '1105', name: 'موجودی کالا', type: 'ASSET', parent: '11' },
  { code: '12', name: 'دارایی‌های غیرجاری', type: 'ASSET', isGroup: true, parent: '1' },
  { code: '1201', name: 'اموال، ماشین‌آلات و تجهیزات', type: 'ASSET', parent: '12' },
  { code: '1202', name: 'استهلاک انباشته', type: 'ASSET', parent: '12' },
  // ۲: بدهی‌ها
  { code: '2', name: 'بدهی‌ها', type: 'LIABILITY', isGroup: true },
  { code: '21', name: 'بدهی‌های جاری', type: 'LIABILITY', isGroup: true, parent: '2' },
  { code: '2101', name: 'حساب‌های پرداختنی', type: 'LIABILITY', parent: '21' },
  { code: '2102', name: 'پیش‌دریافت‌ها', type: 'LIABILITY', parent: '21' },
  { code: '2103', name: 'مالیات بر ارزش افزوده', type: 'LIABILITY', parent: '21' },
  { code: '2104', name: 'وام کوتاه‌مدت', type: 'LIABILITY', parent: '21' },
  // ۳: سرمایه
  { code: '3', name: 'سرمایه', type: 'EQUITY', isGroup: true },
  { code: '3101', name: 'سرمایه', type: 'EQUITY', parent: '3' },
  { code: '3102', name: 'سود و زیان انباشته', type: 'EQUITY', parent: '3' },
  // ۴: درآمدها
  { code: '4', name: 'درآمدها', type: 'INCOME', isGroup: true },
  { code: '4101', name: 'درآمد فروش کالا', type: 'INCOME', parent: '4' },
  { code: '4102', name: 'درآمد ارائه خدمات', type: 'INCOME', parent: '4' },
  { code: '4103', name: 'سایر درآمدها', type: 'INCOME', parent: '4' },
  // ۵: هزینه‌ها
  { code: '5', name: 'هزینه‌ها', type: 'EXPENSE', isGroup: true },
  { code: '5101', name: 'بهای تمام‌شده کالای فروش‌رفته', type: 'EXPENSE', parent: '5' },
  { code: '5201', name: 'حقوق و دستمزد', type: 'EXPENSE', parent: '5' },
  { code: '5202', name: 'اجاره محل', type: 'EXPENSE', parent: '5' },
  { code: '5203', name: 'آب، برق، گاز و تلفن', type: 'EXPENSE', parent: '5' },
  { code: '5204', name: 'تبلیغات و بازاریابی', type: 'EXPENSE', parent: '5' },
  { code: '5205', name: 'حمل و نقل', type: 'EXPENSE', parent: '5' },
  { code: '5206', name: 'ملزومات اداری', type: 'EXPENSE', parent: '5' },
  { code: '5207', name: 'استهلاک', type: 'EXPENSE', parent: '5' },
  { code: '5208', name: 'سایر هزینه‌های عمومی', type: 'EXPENSE', parent: '5' },
]

const CUSTOMERS = [
  'فروشگاه پارس‌الکترونیک',
  'بازرگانی آریا تجارت',
  'شرکت داده‌پردازان تهران',
  'مجموعه صنعتی کاوه',
  'فروشگاه آنلاین مارکت‌پلاس',
  'شرکت مهندسی پیوند',
  'بازرگانی صادراتی خاوران',
]
const SUPPLIERS = [
  'تولیدی نگین پلاست',
  'پخش سراسری البرز',
  'بسته‌بندی نوین صنعت',
  'واردات‌کننده آسیا ترید',
  'چاپ و بسته‌بندی هیرمند',
]

const PRODUCTS = [
  { name: 'لپ‌تاپ مدل A', price: 42_000_000, cost: 24_500_000 },
  { name: 'مانیتور ۲۷ اینچ', price: 18_500_000, cost: 11_000_000 },
  { name: 'کارت شبکه صنعتی', price: 6_800_000, cost: 4_100_000 },
  { name: 'پرینتر لیزری', price: 12_400_000, cost: 7_400_000 },
  { name: 'کیبورد مکانیکال', price: 3_200_000, cost: 1_900_000 },
  { name: 'هارد اکسترنال ۲ترابایت', price: 7_900_000, cost: 4_700_000 },
]

async function main() {
  console.log('🧹 پاک‌سازی دیتابیس...')
  await db.invoiceItem.deleteMany()
  await db.invoice.deleteMany()
  await db.journalLine.deleteMany()
  await db.journalEntry.deleteMany()
  await db.account.deleteMany()
  await db.contact.deleteMany()
  await db.savedReport.deleteMany()
  await db.setting.deleteMany()

  console.log('⚙️ تنظیمات...')
  await db.setting.create({
    data: { id: 'main', companyName: 'شرکت فناوری حساب‌یار هوشمند', fiscalYear: '1404', taxRate: 10 },
  })

  console.log('📚 ایجاد کدینگ حساب‌ها...')
  const idByCode = new Map<string, string>()
  for (const a of ACCOUNTS) {
    const created = await db.account.create({
      data: {
        code: a.code,
        name: a.name,
        type: a.type,
        isGroup: a.isGroup,
        parentId: a.parent ? idByCode.get(a.parent) : null,
      },
    })
    idByCode.set(a.code, created.id)
  }

  console.log('👥 طرف‌های حساب...')
  const customers: { id: string; name: string }[] = []
  for (const name of CUSTOMERS) {
    const c = await db.contact.create({
      data: {
        name,
        type: 'CUSTOMER',
        phone: `021-${randInt(3000, 9999)}${randInt(1000, 9999)}`,
        email: `info@${['pars', 'aria', 'dadeh', 'kaveh', 'market', 'peyvand', 'khavaran'][customers.length]}.ir`,
        taxId: `411${randInt(100000000, 999999999)}`,
      },
    })
    customers.push({ id: c.id, name })
  }
  const suppliers: { id: string; name: string }[] = []
  for (const name of SUPPLIERS) {
    const c = await db.contact.create({
      data: { name, type: 'SUPPLIER', phone: `021-${randInt(3000, 9999)}${randInt(1000, 9999)}`, taxId: `411${randInt(100000000, 999999999)}` },
    })
    suppliers.push({ id: c.id, name })
  }

  let entryNo = 1
  const acc = (code: string) => idByCode.get(code)!

  async function createEntry(
    date: Date,
    description: string,
    lines: { code: string; debit?: number; credit?: number; desc?: string }[],
    opts: { status?: string; source?: string; contactId?: string | null; aiNote?: string } = {}
  ) {
    const entry = await db.journalEntry.create({
      data: {
        number: entryNo++,
        date,
        description,
        status: opts.status ?? 'POSTED',
        source: opts.source ?? 'MANUAL',
        contactId: opts.contactId ?? null,
        aiNote: opts.aiNote ?? null,
        lines: {
          create: lines.map((l, i) => ({
            accountId: acc(l.code),
            debit: l.debit ?? 0,
            credit: l.credit ?? 0,
            description: l.desc ?? '',
            order: i,
          })),
        },
      },
    })
    return entry
  }

  console.log('💰 سند افتتاحیه...')
  const opening = new Date()
  opening.setMonth(opening.getMonth() - 6, 1)
  await createEntry(opening, 'سند افتتاحیه سال مالی ۱۴۰۴', [
    { code: '1101', debit: 320_000_000, desc: 'موجودی صندوق' },
    { code: '1102', debit: 1_850_000_000, desc: 'موجودی بانک مرکزی' },
    { code: '1103', debit: 480_000_000, desc: 'مطالبات اول دوره از مشتریان' },
    { code: '1105', debit: 620_000_000, desc: 'ارزش‌گذاری موجودی اول دوره' },
    { code: '1201', debit: 940_000_000, desc: 'تجهیزات اداری و تولیدی' },
    { code: '2104', credit: 400_000_000, desc: 'وام بانکی کوتاه‌مدت' },
    { code: '3101', credit: 3_810_000_000, desc: 'سرمایه اولیه' },
  ])

  // ── ۶ ماه تراکنش ──────────────────────────────
  const today = new Date()
  const monthsBack = 6

  for (let m = monthsBack - 1; m >= 0; m--) {
    const monthDate = new Date(today.getFullYear(), today.getMonth() - m, 1)
    const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate()
    const maxDay = m === 0 ? Math.max(2, Math.min(today.getDate(), daysInMonth)) : daysInMonth
    const seasonBoost = 1 + (monthsBack - m) * 0.06 // رشد تدریجی فروش

    console.log(`📆 ماه ${monthDate.getFullYear()}-${monthDate.getMonth() + 1} ...`)

    // ۱) فاکتورهای فروش (۴ تا ۷ در ماه)
    const salesCount = randInt(4, 7)
    for (let i = 0; i < salesCount; i++) {
      const day = randInt(1, maxDay)
      const date = new Date(monthDate.getFullYear(), monthDate.getMonth(), day)
      const product = pick(PRODUCTS)
      const qty = randInt(2, 12)
      const total = Math.round(product.price * qty * seasonBoost)
      const cost = Math.round(product.cost * qty)
      const tax = Math.round(total * 0.1)
      const grand = total + tax
      const customer = pick(customers)
      const cashSale = rand() < 0.45

      // فاکتور
      const inv = await db.invoice.create({
        data: {
          number: 1000 + (monthsBack - m) * 10 + i + 1,
          type: 'SALES',
          contactId: customer.id,
          date,
          status: 'FINAL',
          total,
          taxRate: 10,
          taxAmount: tax,
          grandTotal: grand,
          items: {
            create: [{ description: product.name, quantity: qty, unitPrice: Math.round(product.price * seasonBoost), total }],
          },
        },
      })

      // سند حسابداری فاکتور
      const lines: { code: string; debit?: number; credit?: number; desc?: string }[] = [
        { code: cashSale ? '1102' : '1103', debit: grand, desc: `فاکتور فروش شماره ${inv.number} - ${customer.name}` },
        { code: '4101', credit: total, desc: `درآمد فروش ${product.name} (${qty} عدد)` },
        { code: '2103', credit: tax, desc: 'مالیات بر ارزش افزوده فروش' },
      ]
      // ثبت بهای تمام‌شده
      lines.push({ code: '5101', debit: cost, desc: `بهای تمام‌شده ${product.name}` })
      lines.push({ code: '1105', credit: cost, desc: 'کاهش موجودی کالا' })
      const entry = await createEntry(date, `فاکتور فروش ${inv.number} - ${customer.name}`, lines, {
        contactId: customer.id,
        source: 'INVOICE',
      })
      await db.invoice.update({ where: { id: inv.id }, data: { entryId: entry.id } })
    }

    // ۲) فاکتورهای خرید (۲ تا ۳ در ماه)
    const buyCount = randInt(2, 3)
    for (let i = 0; i < buyCount; i++) {
      const day = randInt(1, maxDay)
      const date = new Date(monthDate.getFullYear(), monthDate.getMonth(), day)
      const product = pick(PRODUCTS)
      const qty = randInt(10, 30)
      const total = Math.round(product.cost * qty)
      const tax = Math.round(total * 0.1)
      const grand = total + tax
      const supplier = pick(suppliers)
      const cashBuy = rand() < 0.3

      const inv = await db.invoice.create({
        data: {
          number: 2000 + (monthsBack - m) * 10 + i + 1,
          type: 'PURCHASE',
          contactId: supplier.id,
          date,
          status: 'FINAL',
          total,
          taxRate: 10,
          taxAmount: tax,
          grandTotal: grand,
          items: {
            create: [{ description: product.name, quantity: qty, unitPrice: product.cost, total }],
          },
        },
      })
      const lines: { code: string; debit?: number; credit?: number; desc?: string }[] = [
        { code: '1105', debit: total, desc: `خرید ${product.name} (${qty} عدد) از ${supplier.name}` },
        { code: '2103', debit: tax, desc: 'مالیات ارزش افزوده خرید' },
        { code: cashBuy ? '1102' : '2101', credit: grand, desc: cashBuy ? 'پرداخت نقدی/بانکی' : `بدهی به ${supplier.name}` },
      ]
      const entry = await createEntry(date, `فاکتور خرید ${inv.number} - ${supplier.name}`, lines, {
        contactId: supplier.id,
        source: 'INVOICE',
      })
      await db.invoice.update({ where: { id: inv.id }, data: { entryId: entry.id } })
    }

    // ۳) حقوق و دستمزد (پایان ماه)
    const payrollDay = Math.min(maxDay, randInt(26, 28))
    const payroll = randInt(180, 220) * 1_000_000
    await createEntry(
      new Date(monthDate.getFullYear(), monthDate.getMonth(), payrollDay),
      'حقوق و دستمزد پرسنل',
      [
        { code: '5201', debit: payroll, desc: 'حقوق و مزایای ماهانه' },
        { code: '1102', credit: payroll, desc: 'پرداخت از بانک' },
      ]
    )

    // ۴) اجاره
    const rent = 85_000_000
    await createEntry(
      new Date(monthDate.getFullYear(), monthDate.getMonth(), randInt(3, 6)),
      'اجاره محل دفتر و انبار',
      [
        { code: '5202', debit: rent, desc: 'اجاره ماهانه' },
        { code: '1102', credit: rent, desc: 'پرداخت از بانک' },
      ]
    )

    // ۵) آب و برق و گاز
    await createEntry(
      new Date(monthDate.getFullYear(), monthDate.getMonth(), randInt(8, 15)),
      'مصارف آب، برق، گاز و تلفن',
      [
        { code: '5203', debit: randInt(12, 26) * 1_000_000, desc: 'قبوض ماه جاری' },
        { code: '1102', credit: 0, desc: '' },
      ].map((l) => ({ ...l, credit: l.credit || l.debit }))
    )

    // ۶) تبلیغات (اغلب ماه‌ها)
    if (rand() < 0.75) {
      const adAmount = randInt(20, 60) * 1_000_000
      await createEntry(
        new Date(monthDate.getFullYear(), monthDate.getMonth(), randInt(5, 20)),
        'هزینه تبلیغات و بازاریابی دیجیتال',
        [
          { code: '5204', debit: adAmount, desc: 'کمپین تبلیغاتی' },
          { code: '1102', credit: adAmount, desc: 'پرداخت از بانک' },
        ]
      )
    }

    // ۷) حمل و نقل
    if (rand() < 0.8) {
      const ship = randInt(6, 18) * 1_000_000
      await createEntry(
        new Date(monthDate.getFullYear(), monthDate.getMonth(), randInt(10, 25)),
        'هزینه حمل و نقل کالا',
        [
          { code: '5205', debit: ship, desc: 'پیک و باربری' },
          { code: '1101', credit: ship, desc: 'پرداخت از صندوق' },
        ]
      )
    }

    // ۸) ملزومات اداری گاهی
    if (rand() < 0.6) {
      const office = randInt(3, 9) * 1_000_000
      await createEntry(
        new Date(monthDate.getFullYear(), monthDate.getMonth(), randInt(12, 27)),
        'خرید ملزومات اداری',
        [
          { code: '5206', debit: office, desc: 'کاغذ، تونر و ملزومات' },
          { code: '1101', credit: office, desc: 'پرداخت نقدی' },
        ]
      )
    }

    // ۹) وصول مطالبات از مشتریان (درآمد نقدی از دریافتنی‌های قبلی)
    const collections = randInt(1, 2)
    for (let i = 0; i < collections; i++) {
      const amount = randInt(50, 130) * 1_000_000
      const customer = pick(customers)
      await createEntry(
        new Date(monthDate.getFullYear(), monthDate.getMonth(), randInt(5, maxDay)),
        `وصول مطالبات از ${customer.name}`,
        [
          { code: '1102', debit: amount, desc: 'واريز به حساب بانکی' },
          { code: '1103', credit: amount, desc: `وصول طلب از ${customer.name}` },
        ],
        { contactId: customer.id }
      )
    }

    // ۱۰) پرداخت به تأمین‌کنندگان
    const payments = randInt(1, 2)
    for (let i = 0; i < payments; i++) {
      const amount = randInt(40, 120) * 1_000_000
      const supplier = pick(suppliers)
      await createEntry(
        new Date(monthDate.getFullYear(), monthDate.getMonth(), randInt(8, maxDay)),
        `تسویه بدهی به ${supplier.name}`,
        [
          { code: '2101', debit: amount, desc: 'پرداخت بدهی' },
          { code: '1102', credit: amount, desc: 'خروج از بانک' },
        ],
        { contactId: supplier.id }
      )
    }

    // ۱۱) سایر درآمد (گاهی)
    if (rand() < 0.4) {
      const other = randInt(8, 25) * 1_000_000
      await createEntry(
        new Date(monthDate.getFullYear(), monthDate.getMonth(), randInt(10, 25)),
        'درآمد مشاوره و خدمات جانبی',
        [
          { code: '1102', debit: other, desc: 'واريز وجه خدمات' },
          { code: '4102', credit: other, desc: 'درآمد ارائه خدمات' },
        ]
      )
    }

    // ۱۲) استهلاک ماهانه
    await createEntry(
      new Date(monthDate.getFullYear(), monthDate.getMonth(), Math.min(maxDay, 28)),
      'هزینه استهلاک تجهیزات (ماهانه)',
      [
        { code: '5207', debit: 15_600_000, desc: 'استهلاک خطی تجهیزات' },
        { code: '1202', credit: 15_600_000, desc: 'استهلاک انباشته' },
      ]
    )
  }

  // دو سند پیش‌نویس برای نمایش گردش‌کار پیش‌نویس
  const draftDate = new Date()
  await createEntry(draftDate, 'پیش‌پرداخت اجاره کنفرانس سالانه', [
    { code: '1104', debit: 45_000_000, desc: 'پیش‌پرداخت هتل' },
    { code: '1102', credit: 45_000_000, desc: 'پرداخت از بانک' },
  ], { status: 'DRAFT', source: 'MANUAL' })
  await createEntry(draftDate, 'خرید نرم‌افزار حسابداری (اشتراک سالانه)', [
    { code: '5208', debit: 96_000_000, desc: 'اشتراک نرم‌افزار ابری' },
    { code: '2101', credit: 96_000_000, desc: 'بدهی به فروشنده' },
  ], { status: 'DRAFT', source: 'AI_SUGGESTION', aiNote: 'این سند با پیشنهاد هوش مصنوعی ایجاد شده است.' })

  console.log(`✅ تمام شد — ${entryNo - 1} سند ایجاد شد.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
