import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { ServerProvider } from "@/components/ServerStatus";
import "./globals.css";

// Self-hosted latin fonts: no build-time download that can silently fall back.
// Anybody (variable width) for display, Schibsted Grotesk for text, IBM Plex Mono for code and labels.
const display = localFont({ src: "./fonts/anybody.woff2", weight: "100 900", variable: "--font-display", fallback: ["Arial Narrow", "sans-serif"] });
const sans = localFont({ src: "./fonts/schibsted.woff2", weight: "400 900", variable: "--font-sans" });
const mono = localFont({
  src: [
    { path: "./fonts/plexmono-400.woff2", weight: "400" },
    { path: "./fonts/plexmono-500.woff2", weight: "500" },
    { path: "./fonts/plexmono-600.woff2", weight: "600" },
  ],
  variable: "--font-mono",
});

const description = "Fixr runs four Python scanners, filters out their false alarms, and shows the exact line to change in AI-written code.";

export const metadata: Metadata = {
  title: { default: "Fixr: security triage for AI-written Python", template: "%s · Fixr" },
  description,
  applicationName: "Fixr",
  openGraph: { title: "Fixr", description, type: "website" },
  twitter: { card: "summary", title: "Fixr", description },
};

export const viewport: Viewport = { themeColor: "#131218", colorScheme: "dark" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body>
        <a className="skip" href="#main">Skip to content</a>
        <ServerProvider>
          <SiteHeader />
          <main id="main">{children}</main>
          <SiteFooter />
        </ServerProvider>
      </body>
    </html>
  );
}
