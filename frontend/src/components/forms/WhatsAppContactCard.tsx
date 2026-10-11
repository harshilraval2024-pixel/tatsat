"use client";

import { useState } from "react";
import { useSiteConfig } from "@/components/SiteConfigProvider";
import { whatsappLink } from "@/lib/whatsapp";

const field =
  "focus-ring mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/30";

/** Fills {placeholders}; any line whose placeholder value is empty is dropped. */
function fillTemplate(template: string, values: Record<string, string>): string {
  return template
    .split(/\r?\n/)
    .map((line) => {
      let drop = false;
      const out = line.replace(/\{(\w+)\}/g, (m, key: string) => {
        if (!(key in values)) return m;
        if (!values[key]) drop = true;
        return values[key];
      });
      return drop ? null : out;
    })
    .filter((l): l is string => l !== null && l.trim() !== "")
    .join("\n");
}

/**
 * WhatsApp contact card. All wording is editable in Admin → Site settings →
 * "Contact page & WhatsApp card". Free (wa.me click-to-chat) — nothing is stored.
 */
export function WhatsAppContactCard() {
  const cfg = useSiteConfig();
  const c = cfg.contact;
  const [picked, setPicked] = useState(0);
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const topic = c.topics[Math.min(picked, c.topics.length - 1)] ?? "";

  function open(e: React.FormEvent) {
    e.preventDefault();
    const text = fillTemplate(c.message_template, {
      business: cfg.name,
      name: name.trim(),
      topic,
      note: note.trim(),
      phone: cfg.phoneDisplay,
    });
    window.open(whatsappLink(cfg.whatsapp, text), "_blank", "noopener,noreferrer");
  }

  return (
    <form onSubmit={open} className="glass-panel space-y-5 rounded-3xl p-6 sm:p-8">
      <div className="flex items-start gap-4">
        <span
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-[#ffffff]"
          style={{ background: "#25D366" }}
          aria-hidden
        >
          <svg viewBox="0 0 32 32" className="h-7 w-7" fill="currentColor">
            <path d="M16.04 3C9.4 3 4 8.4 4 15.03c0 2.12.55 4.19 1.6 6.01L4 29l8.15-2.14a12.03 12.03 0 0 0 5.9 1.5h.01C24.7 28.36 30 22.96 30 16.3 30 9.7 24.66 3 16.04 3Zm0 22.27h-.01a10.1 10.1 0 0 1-5.15-1.41l-.37-.22-4.83 1.27 1.29-4.7-.24-.38a10.07 10.07 0 0 1-1.55-5.4c0-5.57 4.55-10.1 10.15-10.1 2.71 0 5.25 1.05 7.16 2.96a10.04 10.04 0 0 1 2.97 7.15c0 5.57-4.55 10.13-10.42 10.13Zm5.56-7.58c-.3-.15-1.8-.89-2.08-.99-.28-.1-.48-.15-.68.15-.2.3-.78.99-.96 1.19-.18.2-.35.22-.65.08-.3-.15-1.28-.47-2.44-1.5-.9-.8-1.5-1.8-1.68-2.1-.18-.3-.02-.46.13-.6.14-.13.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.38-.03-.53-.07-.15-.68-1.64-.93-2.25-.25-.59-.5-.51-.68-.52h-.58c-.2 0-.53.08-.8.38-.28.3-1.05 1.02-1.05 2.5 0 1.47 1.08 2.9 1.23 3.1.15.2 2.1 3.2 5.1 4.5.71.31 1.27.5 1.7.63.72.23 1.37.2 1.88.12.57-.09 1.8-.74 2.05-1.45.25-.7.25-1.3.18-1.43-.08-.13-.28-.2-.58-.35Z" />
          </svg>
        </span>
        <div>
          <h2 className="font-display text-xl font-semibold text-white">{c.card_title}</h2>
          <p className="mt-1 text-sm text-muted">
            {c.card_subtitle} {cfg.hours}
          </p>
        </div>
      </div>

      <fieldset>
        <legend className="text-xs font-semibold uppercase tracking-wide text-muted">{c.topics_label}</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {c.topics.map((t, i) => (
            <button
              key={`${t}-${i}`}
              type="button"
              onClick={() => setPicked(i)}
              aria-pressed={picked === i}
              className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
                picked === i
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-white/15 text-muted hover:border-primary/50 hover:text-white"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-muted" htmlFor="wa-name">
            {c.name_label}
          </label>
          <input
            id="wa-name"
            className={field}
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            placeholder={c.name_placeholder}
          />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-muted" htmlFor="wa-note">
            {c.note_label}
          </label>
          <input
            id="wa-note"
            className={field}
            value={note}
            maxLength={200}
            onChange={(e) => setNote(e.target.value)}
            placeholder={c.note_placeholder}
          />
        </div>
      </div>

      <button
        type="submit"
        className="flex w-full items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-[#ffffff] shadow-[0_10px_30px_rgba(37,211,102,0.4)] transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#25D366]"
        style={{ background: "#25D366" }}
      >
        {c.button_label}
        <span aria-hidden>→</span>
      </button>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4 text-xs text-muted">
        {c.call_prompt ? <span>{c.call_prompt}</span> : <span />}
        {c.call_text ? (
          <a className="font-semibold text-primary hover:underline" href={`tel:${cfg.phoneTel}`}>
            {c.call_text.replace("{phone}", cfg.phoneDisplay)}
          </a>
        ) : null}
        {c.email_text ? (
          <a className="font-semibold text-primary hover:underline" href={`mailto:${cfg.email}`}>
            {c.email_text}
          </a>
        ) : null}
      </div>
    </form>
  );
}
