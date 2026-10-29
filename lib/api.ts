import type { Finding, Severity } from "@/lib/findings";

export const SNIPPET_FILE = "untitled.py";

// Inlined at build time by next.config.mjs; the browser calls the backend directly.
const API = process.env.FIXR_API_URL;

export type ApiFinding = {
  rule_id: string;
  category: "security" | "dependency" | "style";
  severity: "low" | "medium" | "high" | "unknown";
  file_path: string;
  line: number | null;
  message: string;
  snippet: string | null;
  tp_probability?: number;
  metadata: { explanation?: string; likely_false_alarm?: boolean };
};

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(data: Uint8Array) {
  let c = 0xffffffff;
  for (const b of data) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const squeeze = async (data: BlobPart, format: CompressionFormat) =>
  new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new CompressionStream(format))).arrayBuffer());

/**
 * One-file deflated ZIP: the backend only accepts archives. Compressed, not stored: the CDN in
 * front of the backend blocks uploads whose raw bytes look like SQL injection or similar.
 */
export async function zipOne(name: string, text: string): Promise<Blob> {
  const enc = new TextEncoder();
  const raw = enc.encode(text);
  const data = await squeeze(raw, "deflate-raw");
  const fname = enc.encode(name);
  const crc = crc32(raw);

  const local = new DataView(new ArrayBuffer(30));
  local.setUint32(0, 0x04034b50, true);
  local.setUint16(4, 20, true);
  local.setUint16(8, 8, true);
  local.setUint32(14, crc, true);
  local.setUint32(18, data.length, true);
  local.setUint32(22, raw.length, true);
  local.setUint16(26, fname.length, true);

  const central = new DataView(new ArrayBuffer(46));
  central.setUint32(0, 0x02014b50, true);
  central.setUint16(4, 20, true);
  central.setUint16(6, 20, true);
  central.setUint16(10, 8, true);
  central.setUint32(16, crc, true);
  central.setUint32(20, data.length, true);
  central.setUint32(24, raw.length, true);
  central.setUint16(28, fname.length, true);

  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, 1, true);
  end.setUint16(10, 1, true);
  end.setUint32(12, 46 + fname.length, true);
  end.setUint32(16, 30 + fname.length + data.length, true);

  return new Blob([local, fname, data, central, fname, end], { type: "application/zip" });
}

const FENCE = /```[\w-]*\n([\s\S]*?)```/g;
const clean = (s: string) => s.replace(/\*\*/g, "").replace(/\n{3,}/g, "\n\n").trim();

function dedent(code: string) {
  const lines = code.trimEnd().split("\n");
  const pad = Math.min(...lines.filter((l) => l.trim()).map((l) => l.match(/^ */)![0].length));
  return lines.map((l) => l.slice(pad)).join("\n");
}

/** The last code block is the fix; earlier ones (attack examples) stay inline as text. */
export function splitExplanation(text: string) {
  const last = [...text.matchAll(FENCE)].at(-1);
  if (!last) return { description: clean(text), fix: "" };
  const rest = text.slice(0, last.index) + "(see the suggested fix)" + text.slice(last.index + last[0].length);
  return { description: clean(rest.replace(FENCE, "$1")), fix: dedent(last[1]) };
}

/** Bandit prefixes each snippet line with its number and pads with context lines; keep from the flagged line on. */
export function flaggedLines(snippet: string, line: number) {
  const rows = snippet.split("\n").map((l) => l.match(/^(\d+) ?(.*)$/)).filter((m) => m && Number(m[1]) >= line);
  return rows.map((m) => m![2]).join("\n").trimEnd() || snippet.trim();
}

export function toFinding(f: ApiFinding, i: number): Finding {
  const severity: Severity = f.severity === "high" || f.severity === "medium" ? f.severity : "low";
  const { description, fix } = splitExplanation(f.metadata?.explanation ?? "");
  // High severity is never hidden; when the classifier doubts it, it is kept and said so.
  const doubt = f.metadata?.likely_false_alarm
    ? `Likely false alarm: Fixr's classifier puts the chance this is real at ${(f.tp_probability ?? 0) < 0.01 ? "under 1" : Math.round((f.tp_probability ?? 0) * 100)}%. Check it before ignoring it. `
    : "";
  return {
    id: `api${i}`,
    style: f.category === "style",
    rule: f.rule_id,
    severity,
    title: f.message.replace(/:\s*'[^']*'$/, ""),
    description: doubt + (description || `${f.rule_id}: ${f.message}`),
    file: f.file_path.replace(/\\/g, "/").split("/repository/").pop() ?? f.file_path,
    line: f.line ?? 0,
    snippet: flaggedLines(f.snippet ?? "", f.line ?? 0),
    suggestedFix: fix,
  };
}

const SKIP_DIRS = /(^|\/)(\.?venv|env|site-packages|__pycache__|node_modules|\.git)\//;

/** Python files listed in a ZIP's central directory; read in the browser, nothing is uploaded for this. */
export async function zipPyFiles(file: Blob): Promise<string[]> {
  const buf = await file.arrayBuffer();
  const view = new DataView(buf);
  let end = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) { end = i; break; }
  }
  if (end < 0) return [];
  const dec = new TextDecoder();
  const files: string[] = [];
  let at = view.getUint32(end + 16, true);
  for (let n = view.getUint16(end + 10, true); n > 0 && at + 46 <= buf.byteLength; n--) {
    if (view.getUint32(at, true) !== 0x02014b50) break;
    const len = view.getUint16(at + 28, true);
    const name = dec.decode(new Uint8Array(buf, at + 46, len));
    if (name.endsWith(".py") && !SKIP_DIRS.test(name)) files.push(name);
    at += 46 + len + view.getUint16(at + 30, true) + view.getUint16(at + 32, true);
  }
  return files;
}

async function postScan(path: string, init: RequestInit): Promise<{ findings: Finding[]; files: string[] }> {
  let res: Response;
  try {
    res = await fetch(`${API}/api/v0/${path}`, { method: "POST", ...init });
  } catch {
    throw new Error("Could not reach the Fixr backend.");
  }
  if (res.status === 429) throw new Error("Too many scans in a short time. Try again in a minute.");
  if (!res.ok) {
    const detail = await res.json().then((d) => (typeof d.detail === "string" ? d.detail : ""), () => "");
    throw new Error(detail || (res.status === 413 ? "That upload is too large for the scanner." : `The Fixr backend returned ${res.status}.`));
  }
  const data: { findings: ApiFinding[]; files?: string[] } = await res.json();
  return { findings: data.findings.map(toFinding), files: data.files ?? [] };
}

export async function scanZip(zip: Blob): Promise<Finding[]> {
  const body = new FormData();
  body.append("file", zip, "upload.zip");
  return (await postScan("repositories", { body })).findings;
}

/** The backend downloads the public repo itself, then scans it exactly like an uploaded .zip. */
export const scanGithub = (url: string) =>
  postScan("repositories/github", { headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }) });

/** "owner/repo" from a GitHub link, or null when it is not one. */
export function githubRepo(url: string): string | null {
  const m = url.trim().match(/^(?:https?:\/\/)?(?:www\.)?github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:\/tree\/[\w./-]+)?\/?$/);
  return m ? `${m[1]}/${m[2]}` : null;
}

export type ChatMessage = { role: "user" | "assistant"; content: string };

export const CHAT_FINDINGS = 40;

export const CHAT_OFFLINE = "Chat is not switched on yet. It needs the chat endpoint on the Fixr backend.";

/** POST /api/v0/chat, stateless (full history each time); the reply streams back as plain text. */
export async function chat(
  messages: ChatMessage[],
  findings: Finding[],
  focusId: string | null,
  onChunk: (text: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  // The backend takes at most 300 findings and writes each one into the model prompt, so send
  // the focused finding and the top-ranked rest, clipped to the backend's field limits.
  const clip = (s: string, n: number) => s.slice(0, n);
  const ranked = [...findings.filter((f) => f.id === focusId), ...findings.filter((f) => f.id !== focusId && !f.style)];
  const sent = [...ranked.slice(0, CHAT_FINDINGS), ...findings.filter((f) => f.style).slice(0, 5)].map((f) => ({
    ...f,
    rule: f.rule && clip(f.rule, 32),
    title: clip(f.title, 500),
    file: clip(f.file, 500),
    snippet: clip(f.snippet, 8000),
    description: clip(f.description, 8000),
    suggestedFix: clip(f.suggestedFix, 8000),
  }));
  let res: Response;
  try {
    res = await fetch(`${API}/api/v0/chat`, {
      method: "POST",
      // gzipped for the same reason as zipOne: findings quote attack code the CDN would block
      headers: { "Content-Type": "application/json", "Content-Encoding": "gzip" },
      body: await squeeze(JSON.stringify({ messages, findings: sent, focus_id: focusId }), "gzip"),
      signal,
    });
  } catch (e) {
    if (signal?.aborted) return;
    throw new Error("Could not reach the Fixr backend.");
  }
  if (res.status === 404 || res.status === 405) throw new Error(CHAT_OFFLINE);
  if (!res.ok || !res.body) throw new Error(res.status === 429 ? "Too many questions in a short time. Try again in a minute." : `The chat returned ${res.status}.`);
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return;
      onChunk(value);
    }
  } catch (e) {
    if (!signal?.aborted) throw e;
  }
}

export const MAX_UPLOAD_MB = 25;

export async function checkBackend(): Promise<boolean> {
  try {
    // Long timeout: a sleeping Render instance takes up to a minute to wake.
    return (await fetch(`${API}/api/v0/health`, { cache: "no-store", signal: AbortSignal.timeout(90_000) })).ok;
  } catch {
    return false;
  }
}
