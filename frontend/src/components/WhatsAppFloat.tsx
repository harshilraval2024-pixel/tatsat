"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { useSiteConfig } from "@/components/SiteConfigProvider";
import { whatsappLink } from "@/lib/whatsapp";

const GREEN = "#25D366";

const QUICK_REPLIES = [
  "I'd like a free solar quote",
  "Tell me about the subsidy",
  "I want a rooftop site visit",
  "I'd like to talk to an engineer",
];

function WhatsAppIcon({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden fill="currentColor">
      <path d="M16.04 3C9.4 3 4 8.4 4 15.03c0 2.12.55 4.19 1.6 6.01L4 29l8.15-2.14a12.03 12.03 0 0 0 5.9 1.5h.01C24.7 28.36 30 22.96 30 16.3 30 9.7 24.66 3 16.04 3Zm0 22.27h-.01a10.1 10.1 0 0 1-5.15-1.41l-.37-.22-4.83 1.27 1.29-4.7-.24-.38a10.07 10.07 0 0 1-1.55-5.4c0-5.57 4.55-10.1 10.15-10.1 2.71 0 5.25 1.05 7.16 2.96a10.04 10.04 0 0 1 2.97 7.15c0 5.57-4.55 10.13-10.42 10.13Zm5.56-7.58c-.3-.15-1.8-.89-2.08-.99-.28-.1-.48-.15-.68.15-.2.3-.78.99-.96 1.19-.18.2-.35.22-.65.08-.3-.15-1.28-.47-2.44-1.5-.9-.8-1.5-1.8-1.68-2.1-.18-.3-.02-.46.13-.6.14-.13.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.38-.03-.53-.07-.15-.68-1.64-.93-2.25-.25-.59-.5-.51-.68-.52h-.58c-.2 0-.53.08-.8.38-.28.3-1.05 1.02-1.05 2.5 0 1.47 1.08 2.9 1.23 3.1.15.2 2.1 3.2 5.1 4.5.71.31 1.27.5 1.7.63.72.23 1.37.2 1.88.12.57-.09 1.8-.74 2.05-1.45.25-.7.25-1.3.18-1.43-.08-.13-.28-.2-.58-.35Z" />
    </svg>
  );
}

export function WhatsAppFloat() {
  const cfg = useSiteConfig();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [hint, setHint] = useState(false);
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // One-time "Chat with us" nudge per browser session.
  useEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem("wa-hint") === "1";
    } catch {
      /* storage unavailable */
    }
    if (seen) return;
    const t = setTimeout(() => setHint(true), 4000);
    const h = setTimeout(() => {
      setHint(false);
      try {
        sessionStorage.setItem("wa-hint", "1");
      } catch {
        /* ignore */
      }
    }, 12000);
    return () => {
      clearTimeout(t);
      clearTimeout(h);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function send(message: string) {
    const body = message.trim() || "Hi, I'd like to know more about solar for my property.";
    const where = pathname && pathname !== "/" ? `\n(from ${cfg.name} website: ${pathname})` : "";
    window.open(whatsappLink(cfg.whatsapp, `${body}${where}`), "_blank", "noopener,noreferrer");
    setText("");
    setOpen(false);
  }

  return (
    <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-3">
      {open ? (
        <div
          role="dialog"
          aria-label={`Chat with ${cfg.name} on WhatsApp`}
          className="wa-panel w-[min(92vw,22rem)] overflow-hidden rounded-3xl border border-black/10 bg-[#ffffff] text-[#111b21] shadow-[0_24px_70px_rgba(0,0,0,0.35)]"
        >
          <div className="flex items-center gap-3 bg-gradient-to-r from-[#075E54] to-[#128C7E] px-4 py-3 text-[#ffffff]">
            <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-black ring-2 ring-[#ffffff]/40">
              <Image
                src="/tatsat-mark.png"
                alt=""
                width={120}
                height={120}
                className="h-full w-full scale-[1.42] object-cover"
                style={{ clipPath: "none", transform: "scale(1.42)" }}
              />
            </span>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-sm font-semibold">{cfg.name}</span>
              <span className="flex items-center gap-1.5 text-xs text-[#ffffff]/85">
                <span className="h-2 w-2 rounded-full bg-[#7CFFB2]" aria-hidden />
                Typically replies within minutes
              </span>
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full p-1.5 text-[#ffffff]/90 transition hover:bg-[#ffffff]/15"
              aria-label="Close chat"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>

          <div className="space-y-3 bg-[#efeae2] px-4 py-4">
            <div className="max-w-[88%] rounded-2xl rounded-tl-sm bg-[#ffffff] px-3.5 py-2.5 text-sm shadow-sm">
              <p className="font-semibold text-[#075E54]">{cfg.name}</p>
              <p className="mt-0.5">
                Hi there 👋 Welcome to {cfg.name}! How can we help you go solar today?
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {QUICK_REPLIES.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => send(q)}
                  className="rounded-full border border-[#128C7E]/40 bg-[#ffffff] px-3 py-1.5 text-xs font-medium text-[#075E54] transition hover:border-[#128C7E] hover:bg-[#e7f8ef]"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          <form
            className="flex items-end gap-2 border-t border-black/10 bg-[#ffffff] p-3"
            onSubmit={(e) => {
              e.preventDefault();
              send(text);
            }}
          >
            <textarea
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(text);
                }
              }}
              maxLength={500}
              rows={1}
              placeholder="Type your message…"
              className="max-h-24 min-h-[40px] flex-1 resize-none rounded-2xl border border-black/15 bg-[#f6f6f6] px-3 py-2 text-sm text-[#111b21] outline-none placeholder:text-[#667781] focus:border-[#128C7E]"
            />
            <button
              type="submit"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#ffffff] transition hover:brightness-110"
              style={{ background: GREEN }}
              aria-label="Send on WhatsApp"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
                <path d="M3.4 20.4 21 12 3.4 3.6l.01 6.53L15 12 3.41 13.87z" />
              </svg>
            </button>
          </form>
          <p className="bg-[#ffffff] px-4 pb-3 text-center text-[11px] text-[#667781]">
            Opens WhatsApp on your phone or desktop. Free — no sign-up needed.
          </p>
        </div>
      ) : null}

      <div className="relative flex items-center gap-3">
        {hint && !open ? (
          <span className="wa-panel hidden rounded-full bg-[#ffffff] px-4 py-2 text-sm font-medium text-[#111b21] shadow-lg sm:block">
            Chat with us on WhatsApp 💬
          </span>
        ) : null}
        <button
          type="button"
          onClick={() => {
            setOpen((o) => !o);
            setHint(false);
          }}
          aria-expanded={open}
          aria-label={open ? "Close WhatsApp chat" : "Chat on WhatsApp"}
          className="wa-fab relative flex h-14 w-14 items-center justify-center rounded-full text-[#ffffff] shadow-[0_10px_34px_rgba(37,211,102,0.5)] ring-2 ring-[#ffffff]/60 transition hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#25D366]"
          style={{ background: GREEN }}
        >
          <WhatsAppIcon />
        </button>
      </div>
    </div>
  );
}
