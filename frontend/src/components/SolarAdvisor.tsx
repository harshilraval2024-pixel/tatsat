"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSiteConfig } from "@/components/SiteConfigProvider";
import { jfetch } from "@/lib/nrgs-api";
import { whatsappLink } from "@/lib/whatsapp";

type Estimate = {
  system_size: string;
  total_before_subsidy: number;
  subsidy: number;
  final_cost: number;
  monthly_units: number;
  state: string;
};

type ChatMsg = {
  role: "user" | "assistant";
  content: string;
  estimate?: Estimate | null;
  fallback?: boolean;
};

type ChatResponse = { reply: string; estimate: Estimate | null; fallback: boolean };
type Status = { enabled: boolean; greeting: string };

const SUGGESTIONS = ["What size system do I need?", "How much is the subsidy?", "What services do you offer?"];
const MAX_INPUT = 500;
const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

/**
 * AI "Solar Advisor": answers solar questions using the site's own estimator, subsidy
 * and services data (server-side tool calling). Hidden until the backend reports it is
 * configured and switched on (Admin → Website → Contact page & WhatsApp card).
 */
export function SolarAdvisor() {
  const cfg = useSiteConfig();
  const [status, setStatus] = useState<Status | null>(null);
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const inFlight = useRef(false);

  useEffect(() => {
    let cancelled = false;
    jfetch<Status>("/ai/status", { auth: false })
      .then((s) => !cancelled && setStatus(s))
      .catch(() => !cancelled && setStatus({ enabled: false, greeting: "" }));
    return () => {
      cancelled = true;
    };
  }, []);

  // Only one chat widget open at a time (WhatsApp widget announces itself the same way).
  useEffect(() => {
    const closeMe = () => setOpen(false);
    window.addEventListener("widget-open:wa", closeMe);
    return () => window.removeEventListener("widget-open:wa", closeMe);
  }, []);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, busy]);

  const send = useCallback(
    async (raw: string) => {
      const text = raw.trim().slice(0, MAX_INPUT);
      if (!text || inFlight.current) return;
      inFlight.current = true;
      setError(null);
      setInput("");
      const next: ChatMsg[] = [...msgs, { role: "user", content: text }];
      setMsgs(next);
      setBusy(true);
      try {
        const res = await jfetch<ChatResponse>("/ai/chat", {
          method: "POST",
          auth: false,
          body: JSON.stringify({
            messages: next.slice(-12).map((m) => ({ role: m.role, content: m.content })),
          }),
        });
        setMsgs([...next, { role: "assistant", content: res.reply, estimate: res.estimate, fallback: res.fallback }]);
      } catch (e) {
        const m = e instanceof Error ? e.message : "";
        setError(
          /too many/i.test(m)
            ? "You're sending questions very quickly. Please wait a minute and try again."
            : "Couldn't reach the advisor. Please try again, or chat with us on WhatsApp.",
        );
      } finally {
        inFlight.current = false;
        setBusy(false);
      }
    },
    [msgs],
  );

  if (!status?.enabled) return null;

  const lastEstimate = [...msgs].reverse().find((m) => m.estimate)?.estimate ?? null;
  const showWhatsApp = lastEstimate || msgs.some((m) => m.fallback);

  function handoff() {
    const lines = [`Hi ${cfg.name}, I just used your Solar Advisor.`];
    if (lastEstimate) {
      lines.push(
        `Estimate: ${lastEstimate.system_size}, about ${inr(lastEstimate.final_cost)} after subsidy (${lastEstimate.state}).`,
      );
    }
    lines.push("I'd like a free site visit and a firm quote.");
    window.open(whatsappLink(cfg.whatsapp, lines.join("\n")), "_blank", "noopener,noreferrer");
  }

  return (
    <div className="fixed bottom-24 right-5 z-40 flex flex-col items-end gap-3">
      {open ? (
        <div
          role="dialog"
          aria-label="Solar Advisor chat"
          className="wa-panel flex h-[min(32rem,70vh)] w-[min(92vw,22rem)] flex-col overflow-hidden rounded-3xl border border-black/10 bg-[#ffffff] text-[#1a1205] shadow-[0_24px_70px_rgba(0,0,0,0.35)]"
        >
          <div className="flex items-center gap-3 bg-gradient-to-r from-[#f6b400] to-[#ff8a00] px-4 py-3 text-[#1a1205]">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#ffffff]/80 text-lg" aria-hidden>
              ☀
            </span>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block text-sm font-bold">Solar Advisor</span>
              <span className="block text-xs opacity-80">AI assistant · estimates are indicative</span>
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full p-1.5 transition hover:bg-black/10"
              aria-label="Close advisor"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>

          <div ref={listRef} aria-live="polite" className="flex-1 space-y-3 overflow-y-auto bg-[#fffaf0] px-4 py-4">
            <div className="max-w-[88%] rounded-2xl rounded-tl-sm bg-[#ffffff] px-3.5 py-2.5 text-sm shadow-sm">
              {status.greeting}
            </div>
            {msgs.length === 0 ? (
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    className="rounded-full border border-[#f6b400]/60 bg-[#ffffff] px-3 py-1.5 text-xs font-medium text-[#7a4b00] transition hover:bg-[#fff3cc]"
                  >
                    {s}
                  </button>
                ))}
              </div>
            ) : null}

            {msgs.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : "flex flex-col items-start gap-2"}>
                <div
                  className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm shadow-sm ${
                    m.role === "user" ? "rounded-tr-sm bg-[#ffe9a8]" : "rounded-tl-sm bg-[#ffffff]"
                  }`}
                >
                  {m.content}
                </div>
                {m.estimate ? (
                  <div className="w-full max-w-[88%] rounded-2xl border border-[#f6b400]/50 bg-[#fff8e1] px-3.5 py-2.5 text-xs">
                    <p className="font-bold text-[#7a4b00]">Your estimate · {m.estimate.system_size}</p>
                    <p className="mt-1">
                      Before subsidy {inr(m.estimate.total_before_subsidy)} · Subsidy {inr(m.estimate.subsidy)}
                    </p>
                    <p className="font-bold">After subsidy ≈ {inr(m.estimate.final_cost)}</p>
                  </div>
                ) : null}
              </div>
            ))}

            {busy ? (
              <div className="flex max-w-[5rem] items-center gap-1 rounded-2xl rounded-tl-sm bg-[#ffffff] px-4 py-3 shadow-sm" aria-label="Advisor is typing">
                {[0, 1, 2].map((d) => (
                  <span
                    key={d}
                    className="h-2 w-2 animate-bounce rounded-full bg-[#f6b400]"
                    style={{ animationDelay: `${d * 0.15}s` }}
                  />
                ))}
              </div>
            ) : null}

            {error ? (
              <p role="alert" className="rounded-xl bg-[#fde8e4] px-3 py-2 text-xs text-[#a12c0b]">
                {error}
              </p>
            ) : null}

            {showWhatsApp ? (
              <button
                type="button"
                onClick={handoff}
                className="w-full rounded-full px-4 py-2.5 text-xs font-bold text-[#ffffff] transition hover:brightness-110"
                style={{ background: "#25D366" }}
              >
                Continue on WhatsApp →
              </button>
            ) : null}
          </div>

          <form
            className="flex items-end gap-2 border-t border-black/10 bg-[#ffffff] p-3"
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
          >
            <textarea
              ref={inputRef}
              value={input}
              disabled={busy}
              maxLength={MAX_INPUT}
              rows={1}
              placeholder={busy ? "Advisor is thinking…" : "Ask about solar, cost or subsidy…"}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send(input);
                }
              }}
              className="max-h-24 min-h-[40px] flex-1 resize-none rounded-2xl border border-black/15 bg-[#f6f6f6] px-3 py-2 text-sm text-[#1a1205] outline-none placeholder:text-[#7b7466] focus:border-[#f6b400] disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f6b400] text-[#1a1205] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Send message"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
                <path d="M3.4 20.4 21 12 3.4 3.6l.01 6.53L15 12 3.41 13.87z" />
              </svg>
            </button>
          </form>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => {
          const next = !open;
          setOpen(next);
          // Announce outside the state updater (updaters must stay pure).
          if (next) window.dispatchEvent(new Event("widget-open:ai"));
        }}
        aria-expanded={open}
        aria-label={open ? "Close Solar Advisor" : "Ask the Solar Advisor"}
        className="flex items-center gap-2 rounded-full bg-gradient-to-r from-[#f6b400] to-[#ff8a00] px-4 py-3 text-sm font-bold text-[#1a1205] shadow-[0_10px_30px_rgba(255,138,0,0.45)] ring-2 ring-[#ffffff]/60 transition hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ff8a00]"
      >
        <span aria-hidden>☀</span>
        Ask AI
      </button>
    </div>
  );
}
