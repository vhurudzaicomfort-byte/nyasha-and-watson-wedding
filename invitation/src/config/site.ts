/**
 * Runtime site configuration. Nothing in the app hardcodes a host: the public
 * URL comes from the environment, falling back to the request origin so the
 * same build works on localhost, a preview URL and the eGuest subdomain.
 */
export const siteConfig = {
  name: "eGuest",
  /** Public origin without trailing slash, or "" when unknown at build time. */
  publicUrl: (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/+$/, ""),
  musicSrc: process.env.NEXT_PUBLIC_MUSIC_SRC || "",
};

/** Resolve an absolute URL for a path, preferring the configured public URL. */
export function absoluteUrl(path: string, requestOrigin?: string): string {
  const origin = siteConfig.publicUrl || requestOrigin || "";
  return `${origin}${path.startsWith("/") ? path : `/${path}`}`;
}

export const routes = {
  invitation: (slug: string) => `/invitation/${slug}`,
  rsvp: (slug: string) => `/rsvp/${slug}`,
  calendar: (slug: string) => `/api/calendar/${slug}`,
};
