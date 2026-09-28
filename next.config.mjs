import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(fileURLToPath(import.meta.url));
const configured = (process.env.FIXR_API_URL ?? "").replace(/\/$/, "");
// Fail the Vercel build instead of shipping a page that points at localhost.
if (process.env.VERCEL && !configured) throw new Error("Set FIXR_API_URL to the backend URL in the Vercel project settings.");
const api = configured || "http://127.0.0.1:8000";

const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  `connect-src 'self' ${api}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  // A package-lock.json in a parent folder otherwise becomes the workspace root.
  outputFileTracingRoot: root,
  // The browser calls the backend directly (CORS), avoiding Vercel's proxy body and timeout limits.
  env: { FIXR_API_URL: api },
  rewrites: async () => [{ source: "/favicon.ico", destination: "/icon.svg" }],
  headers: async () => [
    {
      source: "/:path*",
      headers: [
        // Dev needs eval for fast refresh, so the CSP is production only.
        ...(process.env.NODE_ENV === "production" ? [{ key: "Content-Security-Policy", value: csp }] : []),
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      ],
    },
  ],
  poweredByHeader: false,
  devIndicators: false,
};

export default nextConfig;
