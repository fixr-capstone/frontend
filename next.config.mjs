import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(fileURLToPath(import.meta.url));
const api = process.env.FIXR_API_URL ?? "http://127.0.0.1:8000";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // A package-lock.json in a parent folder otherwise becomes the workspace root.
  outputFileTracingRoot: root,
  // Same-origin proxy to the FastAPI backend, so it needs no CORS setup.
  rewrites: async () => [{ source: "/api/v0/:path*", destination: `${api}/api/v0/:path*` }],
  experimental: { proxyTimeout: 180_000 },
};

export default nextConfig;
