export function whatsappShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/**
 * Any written form of a phone number → "+<country><number>", so links work for
 * guests in Zimbabwe and abroad alike. Same rules as the portal's
 * WNPhone.toInternational (assets/js/countries.js):
 *   "077 277 3973", "77 277 3973", "+263 77 277 3973", "263…", "00263…" → +263772773973
 *   "+27 73 846 3892", "0027 73 846 3892" → +27738463892 (other countries keep their code)
 * A number without a country code is Zimbabwean.
 */
export function toInternational(phone: string): string {
  const s = String(phone || "").trim();
  let digits = s.replace(/\D/g, "");
  if (!digits) return "";
  const intl = s.startsWith("+") || digits.startsWith("00");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (!intl && digits.startsWith("0")) digits = "263" + digits.slice(1);
  else if (!intl && digits.length <= 9) digits = "263" + digits;
  return "+" + digits;
}

export function whatsappRsvpUrl(number: string, text: string): string {
  return `https://wa.me/${toInternational(number).replace(/^\+/, "")}?text=${encodeURIComponent(text)}`;
}

export function telHref(display: string): string {
  return `tel:${toInternational(display)}`;
}
