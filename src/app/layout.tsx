import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/shared/theme-provider";

export const metadata: Metadata = {
  title: "حساب‌یار هوشمند | نرم‌افزار حسابداری مبتنی بر هوش مصنوعی",
  description:
    "نرم‌افزار حسابداری اختصاصی ایرانی با ثبت هوشمند اسناد، گزارش‌های گرافیکی، گزارش‌ساز و تحلیل هوشمند مالی مبتنی بر هوش مصنوعی",
  keywords: ["حسابداری", "نرم‌افزار حسابداری", "هوش مصنوعی", "گزارش مالی", "سند حسابداری", "حساب‌یار"],
  authors: [{ name: "حساب‌یار هوشمند" }],
  icons: {
    icon: "/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@33.003/Vazirmatn-font-face.css"
        />
      </head>
      <body className="antialiased bg-background text-foreground min-h-screen flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          {children}
          <Toaster position="bottom-left" dir="rtl" richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
