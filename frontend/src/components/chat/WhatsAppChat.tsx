"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useSiteConfig } from "@/components/SiteConfigProvider";
import { whatsappLink } from "@/lib/whatsapp";

const QUICK_REPLIES = [
  "I'd like a free solar quote",
  "Tell me about the subsidy",
  "I want a rooftop site visit",
  "I'd like to talk to an engineer",
];

/** "WhatsApp" tab of the chat widget: click-to-chat with a ready-typed message (free, nothing stored). */
export function WhatsAppChat({ active, onSent }: { active: boolean; onSent: () => void }) {
  const cfg = useSiteConfig();
  const pathname = usePathname();
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (active) inputRef.current?.focus();
  }, [active]);

  function send(message: string) {
    const body = message.trim() || "Hi, I'd like to know more about solar for my property.";
    const where = pathname && pathname !== "/" ? `\n(from ${cfg.name} website: ${pathname})` : "";
    window.open(whatsappLink(cfg.whatsapp, `${body}${where}`), "_blank", "noopener,noreferrer");
    setText("");
    onSent();
  }

  return (
    <div className={`${active ? "flex" : "hidden"} min-h-0 flex-1 flex-col`}>
      <div className="flex-1 space-y-3 overflow-y-auto bg-[#efeae2] px-4 py-4">
        <div className="max-w-[88%] rounded-2xl rounded-tl-sm bg-[#ffffff] px-3.5 py-2.5 text-sm shadow-sm">
          <p className="font-semibold text-[#075E54]">{cfg.name}</p>
          <p className="mt-0.5">Hi there 👋 Welcome to {cfg.name}! How can we help you go solar today?</p>
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
          style={{ background: "#25D366" }}
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
  );
}
