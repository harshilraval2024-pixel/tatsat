/**
 * WhatsApp click-to-chat helpers (free; uses wa.me, no API account needed).
 */

/** Digits only, with India's +91 added when a bare 10-digit mobile number was stored. */
export function normalizeWhatsAppNumber(raw: string | undefined | null): string {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) return `91${digits.slice(1)}`;
  return digits;
}

export function whatsappLink(rawNumber: string | undefined | null, text?: string): string {
  const num = normalizeWhatsAppNumber(rawNumber);
  const q = text ? `?text=${encodeURIComponent(text)}` : "";
  return `https://wa.me/${num}${q}`;
}
