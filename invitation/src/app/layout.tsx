import type { Metadata, Viewport } from "next";
import "@fontsource/cormorant-garamond/400.css";
import "@fontsource/cormorant-garamond/500.css";
import "@fontsource/cormorant-garamond/600.css";
import "@fontsource/cormorant-garamond/400-italic.css";
import "@fontsource/cormorant-garamond/500-italic.css";
import "@fontsource/pinyon-script/400.css";
import "@fontsource/jost/300.css";
import "@fontsource/jost/400.css";
import "@fontsource/jost/500.css";
import "./globals.css";
import "./decor.css";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.publicUrl || "https://nyasha-watson.e-guests.com"),
  title: "Nyasha & Watson · Wedding Invitation",
  description: "You are cordially invited to celebrate the wedding of Nyasha Mazuruse & Watson Chin'ombe · Saturday 5 December 2026 · Colne Valley Nature Reserve Park, Harare.",
  robots: { index: false, follow: false },
  icons: { icon: "/favicon.svg" },
  openGraph: {
    title: "Nyasha & Watson · Our Love Story",
    description: "Saturday 5 December 2026 · Colne Valley Nature Reserve Park, Harare. Open your invitation and RSVP.",
    images: [{ url: "/og-card.jpg", width: 1200, height: 630 }],
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#3b2531",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
