# Worklog — نرم‌افزار حسابداری هوشمند «حساب‌یار»

پروژه: Next.js 16 + TypeScript + Tailwind 4 + shadcn/ui + Prisma(SQLite) — تک‌صفحه‌ای SPA با RTL فارسی کامل.

## قراردادهای مشترک (برای همه ایجنت‌ها)

- ناوبری: `useAppStore` از `src/lib/store.ts` → `navigate(sectionId, params)` — بخش‌ها: dashboard, entries, smart-scan, accounts, contacts, invoices, reports, report-builder, ai-insights, settings
- فراخوانی API (کلاینت): `endpoints.*` از `src/lib/api.ts`
- تایپ‌ها: `src/lib/types.ts` (AccountDTO, JournalEntryDTO, ContactDTO, InvoiceDTO, DashboardData, ReportData, CustomReportConfig/Result, AISuggestion, DocScanResult, AIInsight, SettingDTO)
- قالب‌بندی فارسی: `src/lib/format.ts` (faNumber, faMoney, faCompact, faDate, faDateLong, faPercent)
- نمودار: recharts + `src/lib/charts.ts` (CHART_COLORS, PIE_COLORS, tooltipStyle, axisTick, compactTick)
- کامپوننت مشترک: `src/components/shared/` → SectionShell, EmptyState, StatCard(+Skeleton), ChartCard, ChartLegend, Logo
- Toast: `import { toast } from "sonner"`
- کامپوننت‌های shadcn در `src/components/ui/`
- پالت: سبز emerald + کهربایی amber گرم — ممنوع: آبی/ایندیگو
- تمام بخش‌ها: `'use client'`، default export، بدون props، خودشان داده می‌گیرند، loading skeleton، toast خطا، ریسپانسیو موبایل-اول، لیست بلند: max-h-96 overflow-y-auto

---
Task ID: 1
Agent: main (Z.ai Code)
Task: طراحی اسکیمای دیتابیس و seed داده اولیه

Work Log:
- ساخت prisma/schema.prisma با مدل‌های: Account (درختی با کدینگ ایرانی), JournalEntry, JournalLine, Contact, Invoice, InvoiceItem, SavedReport, Setting
- `bun run db:push` موفق
- ساخت prisma/seed.ts: کدینگ ۳۰ حساب استاندارد ایرانی (سطح ۱/۲/۳)، ۱۲ طرف‌حساب، سند افتتاحیه + ۶ ماه تراکنش (فروش/خرید/حقوق/اجاره/تبلیغات/وصول/پرداخت/استهلاک) + ۲ سند پیش‌نویس
- اصلاح نسبت بهای تمام‌شده برای سودآوری واقع‌گرایانه

Stage Summary:
- دیتابیس: ۱۱۲ سند قطعی، ۴۸ فاکتور، سود خالص ۴۵۵M با حاشیه ۹.۶٪، مطالبات ۱.۱۸B
- DB: db/custom.db (DATABASE_URL در .env)

---
Task ID: 2
Agent: main (Z.ai Code)
Task: سیستم طراحی و لایه مشترک

Work Log:
- globals.css: پالت گرم سفارشی (oklch) light/dark، فونت وزیرمتن (CDN)، کلاس tnum، اسکرول‌بار سفارشی، انیمیشن rise، استایل چاپ
- layout.tsx: html lang="fa" dir="rtl"، ThemeProvider (next-themes)، Toaster (sonner)
- lib/format.ts: faNumber/faMoney/faCompact/faDate/faDateLong/faPercent (Intl fa-IR)
- lib/types.ts: همه DTO ها + برچسب‌های فارسی
- lib/api.ts: client fetch + endpoints.* (dashboard/accounts/entries/contacts/invoices/reports/customReport/savedReports/settings/ai)
- lib/store.ts: zustand — section/params/navigate/assistantOpen/mobileNavOpen
- lib/charts.ts: پالت نمودار، tooltipStyle فارسی
- shared: SectionShell/EmptyState، StatCard+Skeleton، ChartCard/ChartLegend، Logo (SVG گرادیان سبز→کهربایی)
- public/logo.svg جایگزین شد

Stage Summary:
- قرارداد کامل قرارداد UI آماده؛ همه بخش‌ها باید از این helpers استفاده کنند

---
Task ID: 3
Agent: main (Z.ai Code)
Task: API Routes حسابداری

Work Log:
- /api/dashboard: KPI + سری ۶ ماهه + تفکیک هزینه/دارایی + مشتریان برتر + اسناد اخیر
- /api/accounts (GET tree با مانده تجمیعی، POST) + /api/accounts/[id] (دفتر کل + گردش ماهانه)
- /api/entries (GET با فیلتر q/status/source/from/to، POST با اعتبارسنجی تراز) + /api/entries/[id] (GET/PUT post-unpost/DELETE)
- /api/contacts CRUD با مانده دریافتنی/پرداختنی
- /api/invoices (GET، POST با تولید خودکار سند حسابداری دوطرفه + VAT) + [id] (GET/DELETE با حذف سند)
- /api/reports?type=trial-balance|income-statement|balance-sheet|general-ledger|journal-book (تست شد ✓)
- /api/reports/custom: موتور گزارش‌ساز (dataset×groupBy×metric×chartType) — تست شد ✓
- /api/saved-reports CRUD
- /api/settings GET/PUT

Stage Summary:
- تمام API های CRUD و گزارش‌گری تست و تأیید شدند

---
Task ID: 4
Agent: main (Z.ai Code)
Task: API هوش مصنوعی (z-ai-web-dev-sdk — فقط بک‌اند)

Work Log:
- /api/ai/suggest-entry: LLM → پیشنهاد سند تراز از شرح فارسی (با کدینگ واقعی در پرامپت، اعتبارسنجی کد حساب‌ها)
- /api/ai/analyze-doc: VLM (createVision) → استخراج فاکتور/رسید از تصویر + پیشنهاد سند
- /api/ai/insights: تحلیل‌گر مالی — کش ۱۰ دقیقه‌ای + fallback قانون‌محور (نسبت جاری، حاشیه سود، وصول مطالبات)
- /api/ai/chat: دستیار گفتگویی با بستر داده واقعی شرکت (سیستم‌پرامپت حاوی KPI ها)

Stage Summary:
- ۴ قابلیت AI آماده: پیشنهاد ثبت، اسکن اسناد، تحلیل هوشمند، دستیار گفتگو

---
Task ID: 5-a
Agent: general-purpose
Task: UI اسناد حسابداری + اسکن هوشمند

Work Log:
- ساخت src/components/sections/entries-section.tsx: SectionShell + نوار ابزار (جستجو با debounce ۴۰۰ms، فیلتر وضعیت/منبع سمت سرور، دکمه سند جدید) + جدول ریسپانسیو (overflow-x-auto، min-w) با صفحه‌بندی کلاینت‌ساید ۱۰تایی + DropdownMenu عملیات (مشاهده/قطعی یا بازگشت/ویرایش/حذف AlertDialog) + کلیک ردیف → دیالوگ جزئیات (Badge وضعیت، Badge هوش مصنوعی + نمایش aiNote، جدول آرتیکل با جمع، نوار تراز سبز/قرمز)
- فرم سند جدید/ویرایش: پنل «ثبت هوشمند ✨» (Textarea → suggestEntry → پرکردن خودکار شرح و اقلام با resolve accountId از accountCode، نمایش سطح اطمینان faPercent و note)، ویرایشگر اقلام با انتخاب‌گر حساب Popover+Command (لیست flat برگ‌های درخت حساب‌ها، نمایش «کد — نام»)، فوتر زنده جمع بدهکار/بستانکار + Badge تراز/اختلاف، سوییچ «ثبت قطعی» فقط با تراز فعال، ورودی‌های مبلغ text+inputMode=numeric با parseNum (پشتیبانی ارقام فارسی/عربی/جداکننده) و پاک‌سازی خودکار طرف مقابل، ذخیره createEntry/updateEntry با status=DRAFT خودکار در عدم تراز
- params.entryId از useAppStore → باز شدن خودکار دیالوگ جزئیات (با fallback دریافت تکی سند)
- ساخت src/components/sections/smart-scan-section.tsx: آپلود drag&drop + کلیک با Input hidden accept=image/*، محدودیت ۴MB، پیش‌نمایش object-contain max-h-72، ارسال payload base64 خالص (بدون data: prefix) به analyzeDoc
- مراحل انیمیشنی تحلیل (خواندن تصویر → استخراج اطلاعات → پیشنهاد ثبت) با CheckCircle2 سبز مراحل تمام‌شده و Loader2 جاری + تایمر پیشرونده با cleanup در unmount
- کارت اطلاعات استخراج‌شده (Badge نوع سند، فروشنده، تاریخ، مبلغ، مالیات، جدول اقلام، rawSummary) + کارت سند پیشنهادی با مبالغ قابل ویرایش (Input عددی)، نوار تراز، نوار اطمینان Progress+faPercent
- «ثبت به عنوان سند پیش‌نویس»: createEntry با status=DRAFT، source=SCAN، aiNote=«ایجادشده توسط اسکن هوشمند»، accountId از کد حساب؛ toast + کارت موفقیت با دکمه «رفتن به اسناد» → navigate('entries')؛ EmptyState با ImagePlus
- طراحی: RTL کامل با ps/pe/ms/me، پالت سبز/کهربایی (Badge های success/warning)، rounded-xl، framer-motion ورود ملایم، loading با Skeleton/Loader2، toast.error خطاها، اعداد جدولی tnum، فرمت‌های فارسی faNumber/faCompact/faDate/faDateLong/faPercent
- بررسی: `bun run lint` → ۰ خطا و ۰ هشدار (تنها warning اولیه directive بلااستفاده بود که حذف شد)؛ tsc --noEmit → هر دو فایل بدون خطا (خطاهای موجود examples/prisma/skills خارج از محدوده)؛ bun build هر دو کامپوننت OK
- تست curl: GET entries با فیلترهای q/status/source/from/to ✓، چرخه کامل CRUD سند (create با source=SCAN و aiNote → post → unpost → ویرایش کامل POSTED → delete) ✓، contacts و accounts ✓، POST suggest-entry (پیشنهاد واقعی اجاره با اطمینان ۹۵٪) ✓، POST analyze-doc با PNG کوچک → 200 و پاسخ منطقی «نامشخص» ✓

Stage Summary:
- دو بخش «اسناد حسابداری» و «اسکن هوشمند» کامل و متصل به API های واقعی آماده شدند
- هر دو فایل صرفاً از helpers مشترک (endpoints/types/format/shared/store) استفاده می‌کنند؛ هیچ فایل دیگری تغییر نکرد
- نکته برای ایجنت بعدی: page.tsx هنوز placeholder است — این بخش‌ها default export دارند و بدون props با navigate('entries'|'smart-scan') رندر می‌شوند؛ پارامتر entryId دیالوگ جزئیات سند را خودکار باز می‌کند

---
Task ID: 5-c
Agent: general-purpose
Task: UI حساب‌ها + طرف‌حساب‌ها + فاکتورها + تنظیمات

Work Log:
- accounts-section.tsx: درخت بازگشتی حساب‌ها با Collapsible/Folder+مانده تجمیعی، انتخاب برگ با highlight bg-accent، Badge رنگی بر اساس نوع (دارایی سبز/بدهی کهربایی/درآمد سبز پر/هزینه قرمز/سرمایه خنثی)، پنل جزئیات دسکتاپ (۳ آمار بدهکار/بستانکار/مانده + ChartCard گردش ماهانه BarChart RTL با XAxis reversed و YAxis راست + جدول دفتر کل max-h-80 با شماره سند کلیک‌پذیر → navigate('entries',{entryId}))، جزئیات موبایل در Dialog تمام‌عرض (media query 1024px)، دکمه «مشاهده در گزارش‌ها» → navigate('reports',{reportType:'general-ledger',accountId})، Dialog «حساب جدید» (کد/نام/نوع Select ۵گانه/والد از گروه‌های تخت «کد — نام»/سوییچ گروهی) با refresh، پشتیبانی params.accountId (باز کردن مسیر پدران + انتخاب خودکار، یک‌بارمصرف با ref)، api.get مستقیم برای /api/accounts/[id]
- contacts-section.tsx: ۳ StatCard (مشتریان/تأمین‌کنندگان/جمع مطالبات faCompact)، جستجوی نام/تلفن، جدول با Badge نوع (مشتری سبز/تأمین‌کننده کهربایی/هر دو خنثی)، مانده receivable سبز و payable قرمز ملایم، عملیات ویرایش/حذف (stopPropagation) با AlertDialog، Dialog مشترک افزودن/ویرایش (نام*، نوع، تلفن، ایمیل، شناسه ملی)، Dialog جزئیات با کارت‌های مانده بزرگ + اطلاعات تماس، EmptyState برای خالی/بی‌نتیجه
- invoices-section.tsx: Tabs همه/فروش/خرید (فیلتر client-side)، ۳ StatCard (جمع فروش/خرید از grandTotal، تعداد)، جدول با Badge نوع کنار شماره، مبلغ/مالیات/جمع نهایی bold، Dialog جزئیات (هدر + faDateLong + جدول ردیف‌ها + جمع‌ها با faPercent نرخ + کارت «سند مرتبط» با دکمه → navigate('entries',{entryId}))، Dialog فاکتور جدید: Segmented نوع (از تب فعال)، Select طرف‌حساب*، Input date با امروز، ردیف‌های داینامیک (شرح/تعداد/قیمت واحد/جمع خودکار با parseNum ارقام فارسی)، نرخ مالیات (پیش‌فرض ۱۰)، نحوه پرداخت نقدی/نسیه، سوییچ ثبت خودکار سند (روشن)، جمع‌های زنده سبز؛ ثبت → toast «فاکتور … ثبت شد» → refresh invoices+contacts؛ حذف با AlertDialog
- settings-section.tsx: کارت اطلاعات شرکت (نام/سال مالی/نرخ مالیات/واحد پول → updateSettings → toast «تنظیمات ذخیره شد»)، کارت ظاهر با useTheme (resolvedTheme + guard mounted) و سوییچ setTheme، کارت وضعیت سیستم از endpoints.dashboard (اسناد/فاکتورها/پیش‌نویس‌ها + نقد و بانک faCompact)، کارت «درباره حساب‌یار هوشمند» نسخه ۱٫۰ با ۵ امکان CheckCircle2، بدون دکمه بازنشانی (امنیت)
- هماهنگ با قراردادها: SectionShell/EmptyState/StatCard/ChartCard مشترک، faNumber/faCompact/faDate/faPercent، axisTick/tooltipStyle از lib/charts، RTL و ps/pe/ms/me، بدون آبی/ایندیگو، tnum در همه ستون‌های مالی، hover ردیف‌ها، Skeleton لودینگ، toast.success/error در همه اکشن‌ها، اعداد ورودی inputMode=numeric
- bunx tsc --noEmit: بدون خطا در ۴ فایل (خطاهای موجود فقط در api routes/seed قبلی)؛ bunx eslint روی ۴ فایل: تمیز (exit 0)؛ API ها با curl راستی‌آزمایی شد (درخت تجمیعی، جزئیات حساب، contacts، settings)

Stage Summary:
- ۴ بخش UI کامل و آماده اتصال به page.tsx: کدینگ درختی با دفتر کل زنده، طرف‌حساب‌ها با مانده دوطرفه، فاکتورها با فرم چندردیفی و سند خودکار، تنظیمات با تم/وضعیت سیستم — همه با الگوی مشترک پروژه و ریسپانسیو موبایل-اول

---
Task ID: 5-b
Agent: general-purpose (main completed finalization)
Task: UI گزارش‌های مالی گرافیکی + گزارش‌ساز

Work Log:
- reports-section.tsx: ۵ گزارش استاندارد (تراز آزمایشی/سود و زیان/ترازنامه/دفتر کل/دفتر روزنامه) با تب‌ها، فیلتر تاریخ، انتخاب حساب برای دفتر کل، کارت‌های آماری + ChartCard (bar/pie/line مطابق chart.kind) + جدول کامل با totals، کلیک ردیف تراز → navigate accounts، چاپ window.print + خروجی CSV با BOM
- report-builder-section.tsx: پنل تنظیمات (dataset/groupBy/metric/chartType/بازه تاریخ/وضعیت/نوع فاکتور/limit) + گزارش‌های ذخیره‌شده (بارگذاری/حذف با AlertDialog) + ۳ کارت خلاصه (مجموع/تعداد/میانگین) + نمودار ۴ نوعه + جدول سهم درصدی
- توجه: اجرای ساب‌ایجنت با timeout قطع شد اما هر دو فایل کامل نوشته شده بودند؛ main validation و worklog را تکمیل کرد

Stage Summary:
- هر دو فایل default export بدون props و مطابق قرارداد مشترک

---
Task ID: 6
Agent: main (Z.ai Code)
Task: Shell اصلی + داشبورد + تحلیل هوشمند + دستیار شناور

Work Log:
- page.tsx: شِل RTL با SidebarNav (دسکتاپ ثابت + موبایل drawer با framer-motion)، هدر شیشه‌ای (glass) با ThemeToggle (next-themes بدون hydration mismatch)، فوتر چسبان (min-h-screen flex-col + mt-auto + safe-area)
- sidebar-nav.tsx: ناوبری ۴ گروهی با indicator متحرک layoutId، badge AI، شمارنده اسناد، کارت وضعیت سیستم
- ai-assistant.tsx: دکمه شناور گرادیانی + پنل چت با پاسخ‌های سریع، typing indicator، تاریخچه ۸ پیام، ارتفاع واکنش‌گرا min(520px, 100vh-11rem)
- dashboard-section.tsx: ۶ KPI کلیک‌پذیر (ناوبری به بخش مربوط)، AreaChart روند درآمد/هزینه/سود با گرادیان، PieChart تفکیک هزینه‌ها (کلیک‌پذیر)، BarChart فروش/خرید، مشتریان برتر (افقی RTL)، ترکیب دارایی‌ها، اسناد اخیر کلیک‌پذیر، کارت CTA تحلیل هوشمند، نوار هشدار پیش‌نویس‌ها
- ai-insights-section.tsx: کارت‌های یافته AI با ۴ نوع (تحلیل/هشدار/نقطه قوت/توصیه) رنگ‌بندی شده، انیمیشن stagger، بروزرسانی دستی

Stage Summary:
- تک‌صفحه‌ای کامل با ۱۰ بخش و ناوبری زنده؛ دیزاین سیستم گرم (سبز+کهربایی) با تم روشن/تاریک

---
Task ID: 7
Agent: main (Z.ai Code)
Task: یکپارچه‌سازی و رفع خطاها

Work Log:
- حذف صفحات تستی ساب‌ایجنت‌ها (__report-test، zz-report-test)
- رفع lint: ThemeToggle بدون setState-in-effect (آیکون CSS-only)، اصلاح no-unused-expressions
- رفع tsc: TreeNode بازگشتی در buildTree، نوع children در ChartCard، metric types، import db در insights، تایپ parsedItems در invoices، cast برای createVision (مدل پیش‌فرض سرور)
- devIndicators:false در next.config (تداخل با دکمه دستیار)
- اصلاح داده: سند افتتاحیه تراز شد (سرمایه ۳٫۸۱B)، پرداخت/خرید نسیه متعادل شد → همه KPI مثبت
- نتیجه: eslint 0/0، tsc پاک، فقط خطاهای pre-existing در skills/examples

Stage Summary:
- پروژه کاملاً تمیز از نظر lint و تایپ

---
Task ID: 8
Agent: main (Z.ai Code)
Task: تست مرورگری E2E با Agent Browser

Work Log:
- داشبورد دسکتاپ: رندر کامل، ۶ KPI فارسی، هر ۵ نمودار، اسناد اخیر ✓
- اسناد: جدول RTL، دیالوگ جزئیات سند ۱۱۱ با جدول آرتیکل و نوار تراز، «قطعی‌کردن» → toast «قطعی شد» ✓
- ثبت هوشمند: شرح «خرید ۵ لپ‌تاپ ۴۵M نسیه» → پیشنهاد AI با اطمینان ۹۵٪ → خطوط تراز پر شد → ذخیره سند ۱۱۳ (AI_SUGGESTION) ✓
- گزارش‌ها: تراز آزمایشی (پس از اصلاح seed: تراز دارد ۱۷٫۴B=۱۷٫۴B)، سود و زیان با کارت‌ها/نمودار/جدول ✓
- گزارش‌ساز: اجرای اسناد×ماه با نمودار ستونی + جدول سهم ٪ ✓
- دستیار AI: پاسخ فارسی مفصل با داده واقعی شرکت (فروش ۴٫۴۸B، سود ۳۲۹M) ✓
- کدینگ: درخت باز/بسته، انتخاب بانک ۱۱۰۲، گردش ماهانه ✓
- فاکتورها: کارت‌ها + تب‌ها + جدول ✓
- اسکن هوشمند E2E: آپلود فاکتور PNG → VLM استخراج کامل (فروشنده/تاریخ/مبالغ/ردیف‌ها) → سند پیشنهادی تراز ۹۵٪ → ثبت پیش‌نویس سند ۱۱۳ (SCAN) در DB ✓
- تم تاریک ✓، موبایل ۳۹۰px (کارت‌محور، drawer) ✓، فوتر چسبان/پایانی ✓
- رفع کشف‌شده: پنل چت از ویوپورت کوتاه بیرون می‌زد → h واکنش‌گرا
- داده نهایی: re-seed تمیز (۱۱۲ سند) بدون داده تستی

Stage Summary:
- همه جریان‌های طلایی مرورگر-تأیید شدند؛ بدون خطای runtime در dev.log
