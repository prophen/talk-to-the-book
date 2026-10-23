import type { Metadata, Viewport } from "next";
import { Archivo, Source_Serif_4 } from "next/font/google";
import { BRAND, SITE_DESCRIPTION, SITE_NAME } from "@/lib/brand";
import "./globals.css";

// Archivo carries the UI and the condensed headlines (its width axis does the
// condensing); Source Serif 4 is for anything she reads as prose.
const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-archivo",
  display: "swap",
});

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
});

// Share links and the canonical URL need an absolute address. The site lives
// at talktothebook.tech; set NEXT_PUBLIC_SITE_URL to point somewhere else.
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://talktothebook.tech";

// The favicon, Apple icon and share images come from the icon, apple-icon,
// opengraph-image and twitter-image files in this folder.
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: SITE_NAME,
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    url: "/",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: BRAND.bg },
    { media: "(prefers-color-scheme: dark)", color: "#1b1120" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${archivo.variable} ${sourceSerif.variable}`}>
      <body>{children}</body>
    </html>
  );
}
