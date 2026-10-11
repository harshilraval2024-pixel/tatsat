"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useSiteConfig } from "@/components/SiteConfigProvider";
import { whatsappLink } from "@/lib/whatsapp";

const PROPERTY_TYPES = ["Home / bungalow", "Apartment / society", "Shop / office", "Factory / industry", "Farm"] as const;
const ROOF_TYPES = ["RCC (flat)", "Metal sheet", "Ground / open land", "Not sure"] as const;

type FieldErrors = Partial<Record<"name" | "phone" | "city" | "bill", string>>;

const input =
  "focus-ring mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/30";
const lab = "text-xs font-semibold uppercase tracking-wide text-muted";

function validate(name: string, phone: string, city: string, bill: string): FieldErrors {
  const errors: FieldErrors = {};
  if (!name.trim()) errors.name = "Please enter your name.";
  if (!city.trim()) errors.city = "Tell us your city.";
  if (phone.trim() && phone.replace(/\D/g, "").length < 10) {
    errors.phone = "Enter a valid 10-digit mobile number, or leave it blank.";
  }
  if (bill.trim() && !(Number(bill) > 0)) errors.bill = "Enter the bill amount in rupees, e.g. 4500.";
  return errors;
}

/**
 * Quote request that completes on WhatsApp (free wa.me click-to-chat): the details are
 * written into a ready-to-send message. Nothing is stored on our servers.
 */
export function QuoteForm() {
  const cfg = useSiteConfig();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [bill, setBill] = useState("");
  const [property, setProperty] = useState<(typeof PROPERTY_TYPES)[number]>(PROPERTY_TYPES[0]);
  const [roof, setRoof] = useState<(typeof ROOF_TYPES)[number]>(ROOF_TYPES[0]);
  const [errors, setErrors] = useState<FieldErrors>({});

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next = validate(name, phone, city, bill);
    setErrors(next);
    if (Object.keys(next).length) {
      toast.error("Please fix the highlighted fields.");
      return;
    }
    const text = [
      `Hi ${cfg.name}, I'd like a free solar quote.`,
      `Name: ${name.trim()}`,
      `City: ${city.trim()}`,
      `Property: ${property}`,
      `Roof: ${roof}`,
      bill.trim() ? `Monthly bill: ₹${Number(bill).toLocaleString("en-IN")}` : "",
      phone.trim() ? `Call me on: ${phone.trim()}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    window.open(whatsappLink(cfg.whatsapp, text), "_blank", "noopener,noreferrer");
    toast.success("WhatsApp opened with your request.", {
      description: "Press send, and attach a photo of your latest electricity bill in the chat.",
    });
  }

  return (
    <form onSubmit={onSubmit} className="glass-panel space-y-5 rounded-3xl p-6 sm:p-8" noValidate>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={lab} htmlFor="qf-name">
            Full name
          </label>
          <input
            id="qf-name"
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            className={input}
            placeholder="e.g. Harshil Mehta"
            autoComplete="name"
          />
          {errors.name ? <p className="mt-1 text-xs text-accent">{errors.name}</p> : null}
        </div>
        <div>
          <label className={lab} htmlFor="qf-city">
            City
          </label>
          <input
            id="qf-city"
            value={city}
            maxLength={80}
            onChange={(e) => setCity(e.target.value)}
            className={input}
            placeholder="Ahmedabad, Vadodara…"
            autoComplete="address-level2"
          />
          {errors.city ? <p className="mt-1 text-xs text-accent">{errors.city}</p> : null}
        </div>
        <div>
          <label className={lab} htmlFor="qf-bill">
            Monthly electricity bill (₹, optional)
          </label>
          <input
            id="qf-bill"
            inputMode="numeric"
            value={bill}
            maxLength={9}
            onChange={(e) => setBill(e.target.value.replace(/[^\d]/g, ""))}
            className={input}
            placeholder="e.g. 4500"
          />
          {errors.bill ? <p className="mt-1 text-xs text-accent">{errors.bill}</p> : null}
        </div>

        <fieldset className="sm:col-span-2">
          <legend className={lab}>Property type</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {PROPERTY_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={property === t}
                onClick={() => setProperty(t)}
                className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
                  property === t
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-white/15 text-muted hover:border-primary/50 hover:text-white"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="sm:col-span-2">
          <legend className={lab}>Roof type</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {ROOF_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={roof === t}
                onClick={() => setRoof(t)}
                className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
                  roof === t
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-white/15 text-muted hover:border-primary/50 hover:text-white"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="sm:col-span-2">
          <label className={lab} htmlFor="qf-phone">
            Phone for a call-back (optional)
          </label>
          <input
            id="qf-phone"
            inputMode="tel"
            value={phone}
            maxLength={20}
            onChange={(e) => setPhone(e.target.value)}
            className={input}
            placeholder="98250 12345"
            autoComplete="tel"
          />
          {errors.phone ? <p className="mt-1 text-xs text-accent">{errors.phone}</p> : null}
        </div>
      </div>

      <button
        type="submit"
        className="flex w-full items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-[#ffffff] shadow-[0_10px_30px_rgba(37,211,102,0.4)] transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#25D366]"
        style={{ background: "#25D366" }}
      >
        Send quote request on WhatsApp
        <span aria-hidden>→</span>
      </button>

      <p className="text-xs text-muted">
        This opens WhatsApp with your details already typed — just press send, then attach a photo of your latest
        electricity bill in the chat for an accurate estimate. {cfg.name} will only use your details to prepare your
        quote.
      </p>
    </form>
  );
}
