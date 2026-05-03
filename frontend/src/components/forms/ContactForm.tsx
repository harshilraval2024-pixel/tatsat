"use client";

import { useState } from "react";
import { toast } from "sonner";
import { GlowButton } from "@/components/ui/GlowButton";

type Errors = Partial<Record<"name" | "email" | "message", string>>;

export function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);

  function validate() {
    const e: Errors = {};
    if (!name.trim()) e.name = "Name is required.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = "Enter a valid email.";
    if (message.trim().length < 12) e.message = "Please add a bit more detail (12+ characters).";
    return e;
  }

  async function onSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) {
      toast.error("Check the form for errors.");
      return;
    }
    setBusy(true);
    await new Promise((r) => setTimeout(r, 600));
    setBusy(false);
    toast.success("Message recorded (demo). Connect your API route to deliver email.");
    setName("");
    setEmail("");
    setMessage("");
  }

  return (
    <form onSubmit={onSubmit} className="glass-panel space-y-4 rounded-3xl p-6">
      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-muted" htmlFor="cf-name">
          Name
        </label>
        <input
          id="cf-name"
          value={name}
          onChange={(x) => setName(x.target.value)}
          className="focus-ring mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white"
        />
        {errors.name ? <p className="mt-1 text-xs text-accent">{errors.name}</p> : null}
      </div>
      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-muted" htmlFor="cf-email">
          Email
        </label>
        <input
          id="cf-email"
          type="email"
          value={email}
          onChange={(x) => setEmail(x.target.value)}
          className="focus-ring mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white"
        />
        {errors.email ? <p className="mt-1 text-xs text-accent">{errors.email}</p> : null}
      </div>
      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-muted" htmlFor="cf-msg">
          Message
        </label>
        <textarea
          id="cf-msg"
          rows={4}
          value={message}
          onChange={(x) => setMessage(x.target.value)}
          className="focus-ring mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white"
        />
        {errors.message ? <p className="mt-1 text-xs text-accent">{errors.message}</p> : null}
      </div>
      <GlowButton type="submit" variant="primary" className="w-full justify-center" disabled={busy}>
        {busy ? "Sending..." : "Send message"}
      </GlowButton>
    </form>
  );
}
