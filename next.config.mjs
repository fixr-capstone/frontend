import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Pin the project root. Without this, a package-lock.json in a parent folder
  // (e.g. the user's home directory) makes Next pick that folder as the root.
  outputFileTracingRoot: root,
};

export default nextConfig;
