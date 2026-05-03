"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { GlowButton } from "@/components/ui/GlowButton";
import { useSiteConfig } from "@/components/SiteConfigProvider";

type FieldErrors = Partial<Record<"name" | "phone" | "city" | "bill", string>>;

function validate(name: string, phone: string, city: string, bill: File | null) {
  const errors: FieldErrors = {};
  if (!name.trim()) errors.name = "Please enter your name.";
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) errors.phone = "Enter a valid 10-digit Indian mobile number.";
  if (!city.trim()) errors.city = "Tell us your city.";
  if (!bill) errors.bill = "Upload your latest bill (PDF/JPG/PNG).";
  else if (bill.size > 5 * 1024 * 1024) errors.bill = "File must be under 5 MB.";
  return errors;
}

export function QuoteForm() {
  const siteCfg = useSiteConfig();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [bill, setBill] = useState<File | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const waHref = useMemo(() => {
    const text = [
      `Hi ${siteCfg.name} — I'd like a solar quote.`,
      `Name: ${name}`,
      `Phone: ${phone}`,
      `City: ${city}`,
      bill ? `Bill file: ${bill.name}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    return `https://wa.me/${siteCfg.whatsapp}?text=${encodeURIComponent(text)}`;
  }, [name, phone, city, bill, siteCfg.name, siteCfg.whatsapp]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const nextErrors = validate(name, phone, city, bill);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      toast.error("Please fix the highlighted fields.");
      return;
    }
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 650));
    setSubmitting(false);
    toast.success("Thanks! Our engineer will call you within 24 hours.", {
      description: "We also opened WhatsApp with your details prefilled.",
    });
    window.open(waHref, "_blank", "noopener,noreferrer");
  }

  return (
    <form onSubmit={onSubmit} className="glass-panel space-y-5 rounded-3xl p-6 sm:p-8">
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-muted" htmlFor="qf-name">
            Full name
          </label>
          <input
            id="qf-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="focus-ring mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/30"
            placeholder="e.g. Harshil Mehta"
            autoComplete="name"
          />
          {errors.name ? <p className="mt-1 text-xs text-accent">{errors.name}</p> : null}
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-muted" htmlFor="qf-phone">
            Phone (WhatsApp preferred)
          </label>
          <input
            id="qf-phone"
            inputMode="numeric"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="focus-ring mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/30"
            placeholder="98250 12345"
            autoComplete="tel"
          />
          {errors.phone ? <p className="mt-1 text-xs text-accent">{errors.phone}</p> : null}
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-muted" htmlFor="qf-city">
            City
          </label>
          <input
            id="qf-city"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="focus-ring mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/30"
            placeholder="Ahmedabad, Vadodara..."
            autoComplete="address-level2"
          />
          {errors.city ? <p className="mt-1 text-xs text-accent">{errors.city}</p> : null}
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-muted" htmlFor="qf-bill">
            Latest electricity bill
          </label>
          <input
            id="qf-bill"
            type="file"
            accept=".pdf,image/*"
            onChange={(e) => setBill(e.target.files?.[0] ?? null)}
            className="focus-ring mt-2 block w-full cursor-pointer text-sm text-muted file:mr-4 file:rounded-full file:border-0 file:bg-primary/15 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-primary hover:file:bg-primary/25"
          />
          {errors.bill ? <p className="mt-1 text-xs text-accent">{errors.bill}</p> : null}
        </div>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <GlowButton type="submit" variant="primary" className="w-full justify-center sm:w-auto" disabled={submitting}>
          {submitting ? "Sending..." : "Submit & notify team"}
        </GlowButton>
        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex w-full items-center justify-center rounded-full border border-[#25D366]/40 bg-[#25D366]/10 px-6 py-2.5 text-sm font-semibold text-[#25D366] transition hover:bg-[#25D366]/20 sm:w-auto"
        >
          WhatsApp instead
        </a>
      </div>
      <p className="text-xs text-muted">
        By submitting, you agree to be contacted by {siteCfg.name} regarding solar installation. This demo does not upload
        files to a server — connect your CRM or form backend before production.
      </p>
    </form>
  );
}
