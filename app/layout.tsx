import type { Metadata, Viewport } from "next";
import { Big_Shoulders, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// "Big Shoulders Display" now lives in this family; the opsz axis picks the display cut.
const display = Big_Shoulders({
  subsets: ["latin"],
  axes: ["opsz"],
  variable: "--font-display",
  // Next has no fallback metrics for this family yet; name the fallback explicitly instead.
  adjustFontFallback: false,
  fallback: ["Arial Narrow", "sans-serif"],
});
const sans = Space_Grotesk({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-sans" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-mono" });

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
