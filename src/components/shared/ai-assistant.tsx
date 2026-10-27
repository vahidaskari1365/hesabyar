"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Bot, Send, Sparkles, X, Loader2, User } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { endpoints } from "@/lib/api";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

const QUICK_PROMPTS = [
  "وضعیت مالی شرکت را خلاصه کن",
  "حاشیه سود ما چطوره؟",
  "بزرگ‌ترین هزینه‌ها چی هستن؟",
  "مالیات ارزش افزوده چقدر بدهکاریم؟",
  "راهکار بهبود نقدینگی چیه؟",
];

export function AIAssistant() {
  const open = useAppStore((s) => s.assistantOpen);
  const setOpen = useAppStore((s) => s.setAssistantOpen);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || loading) return;
    const next = [...messages, { role: "user" as const, content }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await endpoints.chat(next.slice(-8));
      setMessages((m) => [...m, { role: "assistant", content: res.reply }]);
    } catch (err) {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: "متأسفانه ارتباط با دستیار برقرار نشد. لطفاً دوباره تلاش کنید." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* دکمه شناور */}
      <motion.button
        type="button"
        onClick={() => setOpen(!open)}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.95 }}
        className="fixed bottom-20 left-4 z-40 flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-600 to-amber-500 text-white shadow-lg shadow-emerald-900/25 lg:bottom-6"
        aria-label="دستیار هوشمند حسابداری"
      >
        {open ? <X className="size-6" /> : <Sparkles className="size-6" />}
        {!open && <span className="absolute -top-1 -right-1 size-3 animate-pulse rounded-full bg-amber-300" />}
      </motion.button>

      {/* پنل گفتگو */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            className="fixed bottom-36 left-4 z-40 flex h-[min(520px,calc(100vh-11rem))] w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden rounded-2xl border bg-card shadow-2xl lg:bottom-24"
            role="dialog"
            aria-label="دستیار هوشمند حسابداری"
          >
            {/* هدر */}
            <div className="flex items-center gap-2.5 border-b bg-gradient-to-l from-emerald-600/10 to-amber-500/10 px-4 py-3">
              <div className="flex size-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <Bot className="size-5" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold">دستیار هوشمند حساب‌یار</p>
                <p className="text-[11px] text-muted-foreground">با داده‌های مالی شما آموزش دیده است</p>
              </div>
              <Button variant="ghost" size="icon" className="size-8" onClick={() => setOpen(false)} aria-label="بستن">
                <X className="size-4" />
              </Button>
            </div>

            {/* پیام‌ها */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3">
              {messages.length === 0 && (
                <div className="flex h-full flex-col items-center justify-center px-4 text-center">
                  <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10">
                    <Sparkles className="size-7 text-primary" />
                  </div>
                  <p className="mt-3 text-sm font-semibold">سلام! من دستیار مالی شما هستم</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    درباره وضعیت مالی، اسناد، مالیات و تحلیل‌های حسابداری بپرسید
                  </p>
                </div>
              )}
              <div className="space-y-3">
                {messages.map((m, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn("flex gap-2", m.role === "user" ? "flex-row-reverse" : "")}
                  >
                    <div
                      className={cn(
                        "flex size-7 shrink-0 items-center justify-center rounded-lg",
                        m.role === "user" ? "bg-secondary text-secondary-foreground" : "bg-primary/12 text-primary"
                      )}
                    >
                      {m.role === "user" ? <User className="size-3.5" /> : <Bot className="size-4" />}
                    </div>
                    <div
                      className={cn(
                        "max-w-[80%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap",
                        m.role === "user"
                          ? "rounded-br-md bg-primary text-primary-foreground"
                          : "rounded-bl-md bg-muted text-foreground"
                      )}
                    >
                      {m.content}
                    </div>
                  </motion.div>
                ))}
                {loading && (
                  <div className="flex gap-2">
                    <div className="flex size-7 items-center justify-center rounded-lg bg-primary/12 text-primary">
                      <Bot className="size-4" />
                    </div>
                    <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md bg-muted px-4 py-3">
                      {[0, 1, 2].map((i) => (
                        <motion.span
                          key={i}
                          className="size-1.5 rounded-full bg-muted-foreground/60"
                          animate={{ opacity: [0.3, 1, 0.3] }}
                          transition={{ repeat: Infinity, duration: 1, delay: i * 0.2 }}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* پیشنهادهای سریع */}
            {messages.length === 0 && (
              <div className="flex flex-wrap gap-1.5 px-3 pb-2">
                {QUICK_PROMPTS.slice(0, 3).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => send(p)}
                    className="rounded-full border bg-background px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}

            {/* ورودی */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
              className="flex items-center gap-2 border-t p-3"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="سؤال خود را بنویسید..."
                className="h-10 flex-1 rounded-xl border bg-background px-3.5 text-[13px] outline-none placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-ring/40"
                aria-label="پیام شما"
              />
              <Button type="submit" size="icon" className="size-10 rounded-xl" disabled={loading || !input.trim()} aria-label="ارسال">
                {loading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4 rotate-180" />}
              </Button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
