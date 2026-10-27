"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useSiteConfig } from "@/components/SiteConfigProvider";
import { jfetch } from "@/lib/nrgs-api";
import { AdvisorChat } from "@/components/chat/AdvisorChat";
import { WhatsAppChat } from "@/components/chat/WhatsAppChat";

type Tab = "ai" | "wa";
type Status = { enabled: boolean; greeting: string };

/**
 * One floating chat for the whole site. Two tabs in a single panel:
 *   - "Ask AI": the Solar Advisor (only shown when the AI is configured and switched on)
 *   - "WhatsApp": free click-to-chat with the team
 * When the AI is off, it is simply the WhatsApp chat with no tabs.
 */
export function ChatWidget() {
  const cfg = useSiteConfig();
  const [status, setStatus] = useState<Status | null>(null);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("ai");
  const [hint, setHint] = useState(false);

  useEffect(() => {
    let cancelled = false;
    jfetch<Status>("/ai/status", { auth: false })
      .then((s) => !cancelled && setStatus(s))
      .catch(() => !cancelled && setStatus({ enabled: false, greeting: "" }));
    return () => {
      cancelled = true;
    };
  }, []);

  const aiOn = !!status?.enabled;
  const current: Tab = aiOn ? tab : "wa";

  // One-time nudge per browser session.
  useEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem("chat-hint") === "1";
    } catch {
      /* storage unavailable */
    }
    if (seen) return;
    const show = setTimeout(() => setHint(true), 4000);
    const hide = setTimeout(() => {
      setHint(false);
      try {
        sessionStorage.setItem("chat-hint", "1");
      } catch {
        /* ignore */
      }
    }, 12000);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const subtitle = current === "ai" ? "AI assistant · estimates are indicative" : "Typically replies within minutes";

  return (
    <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-3">
      {open ? (
        <div
          role="dialog"
          aria-label={`Chat with ${cfg.name}`}
          className="wa-panel flex h-[min(34rem,78vh)] w-[min(92vw,22rem)] flex-col overflow-hidden rounded-3xl border border-black/10 bg-[#ffffff] text-[#111b21] shadow-[0_24px_70px_rgba(0,0,0,0.35)]"
        >
          <div className="bg-gradient-to-r from-[#f6b400] to-[#ff8a00] px-4 pb-3 pt-3 text-[#1a1205]">
            <div className="flex items-center gap-3">
              <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-black ring-2 ring-[#ffffff]/60">
                <Image
                  src="/tatsat-mark.png"
                  alt=""
                  width={120}
                  height={120}
                  className="h-full w-full object-cover"
                  style={{ clipPath: "none", transform: "scale(1.42)" }}
                />
              </span>
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block truncate text-sm font-bold">{cfg.name}</span>
                <span className="flex items-center gap-1.5 text-xs opacity-85">
                  <span className="h-2 w-2 rounded-full bg-[#1f9d55]" aria-hidden />
                  {subtitle}
                </span>
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full p-1.5 transition hover:bg-black/10"
                aria-label="Close chat"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </div>

            {aiOn ? (
              <div role="tablist" aria-label="Chat type" className="mt-3 grid grid-cols-2 gap-1 rounded-full bg-black/15 p-1">
                {(
                  [
                    ["ai", "☀ Ask AI"],
                    ["wa", "WhatsApp"],
                  ] as const
                ).map(([id, text]) => (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={current === id}
                    onClick={() => setTab(id)}
                    className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                      current === id ? "bg-[#ffffff] text-[#1a1205] shadow-sm" : "text-[#1a1205]/80 hover:bg-white/30"
                    }`}
                  >
                    {text}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {aiOn ? (
            <AdvisorChat active={current === "ai"} greeting={status?.greeting ?? ""} onWhatsApp={() => setTab("wa")} />
          ) : null}
          <WhatsAppChat active={current === "wa"} onSent={() => setOpen(false)} />
        </div>
      ) : null}

      <div className="relative flex items-center gap-3">
        {hint && !open ? (
          <span className="wa-panel hidden rounded-full bg-[#ffffff] px-4 py-2 text-sm font-medium text-[#111b21] shadow-lg sm:block">
            {aiOn ? "Ask our AI or chat on WhatsApp 💬" : "Chat with us on WhatsApp 💬"}
          </span>
        ) : null}
        <button
          type="button"
          onClick={() => {
            setOpen((o) => !o);
            setHint(false);
          }}
          aria-expanded={open}
          aria-label={open ? "Close chat" : aiOn ? "Open chat: ask the AI advisor or message us on WhatsApp" : "Chat on WhatsApp"}
          className="chat-fab relative flex h-14 items-center gap-2 rounded-full bg-gradient-to-r from-[#f6b400] to-[#ff8a00] px-4 text-sm font-bold text-[#1a1205] shadow-[0_10px_34px_rgba(255,138,0,0.5)] ring-2 ring-[#ffffff]/60 transition hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ff8a00]"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden>
            <path d="M12 3C6.5 3 2 6.9 2 11.7c0 2.4 1.1 4.5 2.9 6.1L4 21.5l4.1-1.7c1.2.4 2.5.6 3.9.6 5.5 0 10-3.9 10-8.7S17.5 3 12 3Zm-4 9.6a1.3 1.3 0 1 1 0-2.6 1.3 1.3 0 0 1 0 2.6Zm4 0a1.3 1.3 0 1 1 0-2.6 1.3 1.3 0 0 1 0 2.6Zm4 0a1.3 1.3 0 1 1 0-2.6 1.3 1.3 0 0 1 0 2.6Z" />
          </svg>
          <span className="hidden sm:inline">{open ? "Close" : "Chat"}</span>
        </button>
      </div>
    </div>
  );
}
