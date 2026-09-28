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
  metadata: { explanation?: string };
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

/** One-file stored ZIP: the backend only accepts archives. */
export function zipOne(name: string, text: string): Blob {
  const enc = new TextEncoder();
  const data = enc.encode(text);
  const fname = enc.encode(name);
  const crc = crc32(data);

  const local = new DataView(new ArrayBuffer(30));
  local.setUint32(0, 0x04034b50, true);
  local.setUint16(4, 20, true);
  local.setUint32(14, crc, true);
  local.setUint32(18, data.length, true);
  local.setUint32(22, data.length, true);
  local.setUint16(26, fname.length, true);

  const central = new DataView(new ArrayBuffer(46));
  central.setUint32(0, 0x02014b50, true);
  central.setUint16(4, 20, true);
  central.setUint16(6, 20, true);
  central.setUint32(16, crc, true);
  central.setUint32(20, data.length, true);
  central.setUint32(24, data.length, true);
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
  return {
    id: `api${i}`,
    style: f.category === "style",
    rule: f.rule_id,
    severity,
    title: f.message.replace(/:\s*'[^']*'$/, ""),
    description: description || `${f.rule_id}: ${f.message}`,
    file: f.file_path.replace(/\\/g, "/").split("/repository/").pop() ?? f.file_path,
    line: f.line ?? 0,
    snippet: flaggedLines(f.snippet ?? "", f.line ?? 0),
    suggestedFix: fix,
  };
}

export async function scanZip(zip: Blob): Promise<Finding[]> {
  const body = new FormData();
  body.append("file", zip, "upload.zip");
  let res: Response;
  try {
    res = await fetch(`${API}/api/v0/repositories`, { method: "POST", body });
  } catch {
    throw new Error("Could not reach the Fixr backend.");
  }
  if (res.status === 413) throw new Error("That upload is too large for the scanner.");
  if (res.status === 429) throw new Error("Too many scans in a short time. Try again in a minute.");
  if (!res.ok) throw new Error(`The Fixr backend returned ${res.status}.`);
  const data: { findings: ApiFinding[] } = await res.json();
  return data.findings.map(toFinding);
}

export type ChatMessage = { role: "user" | "assistant"; content: string };

export const CHAT_OFFLINE = "Chat is not switched on yet. It needs the chat endpoint on the Fixr backend.";

/** POST /api/v0/chat, stateless (full history each time); the reply streams back as plain text. */
export async function chat(
  messages: ChatMessage[],
  findings: Finding[],
  focusId: string | null,
  onChunk: (text: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${API}/api/v0/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, findings, focus_id: focusId }),
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
