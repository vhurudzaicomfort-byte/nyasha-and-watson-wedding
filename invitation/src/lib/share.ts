export function whatsappShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export function whatsappRsvpUrl(number: string, text: string): string {
  return `https://wa.me/${number.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
}

export function telHref(display: string): string {
  return `tel:${display.replace(/[^\d+]/g, "")}`;
}
