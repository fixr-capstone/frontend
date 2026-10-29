import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Self-hosted latin variable fonts: no build-time download that can silently fall back.
const display = localFont({ src: "./fonts/bigshoulders.woff2", weight: "100 900", variable: "--font-display", adjustFontFallback: false, fallback: ["Arial Narrow", "sans-serif"] });
const sans = localFont({ src: "./fonts/spacegrotesk.woff2", weight: "300 700", variable: "--font-sans" });
const mono = localFont({ src: "./fonts/jetbrainsmono.woff2", weight: "100 800", variable: "--font-mono" });

const description = "Fixr runs four Python scanners, filters out their false alarms, and explains the findings worth fixing.";

export const metadata: Metadata = {
  title: "Fixr: security triage for AI-written Python",
  description,
  applicationName: "Fixr",
  openGraph: { title: "Fixr", description, type: "website" },
  twitter: { card: "summary", title: "Fixr", description },
};

export const viewport: Viewport = { themeColor: "#131218", colorScheme: "dark" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
