import type { Finding, Severity } from "@/lib/findings";

export const SNIPPET_FILE = "untitled.py";

type ApiFinding = {
  rule_id: string;
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

function splitExplanation(text: string) {
  const fence = /```[a-z]*\n([\s\S]*?)```/;
  const fix = text.match(fence)?.[1].trimEnd() ?? "";
  return { description: text.replace(fence, "").replace(/\n{3,}/g, "\n\n").trim(), fix };
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
    severity,
    title: f.message,
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
    res = await fetch("/api/v0/repositories", { method: "POST", body });
  } catch {
    throw new Error("Could not reach the Fixr backend.");
  }
  if (!res.ok) throw new Error(`The Fixr backend returned ${res.status}. Is it running on port 8000?`);
  const data: { findings: ApiFinding[] } = await res.json();
  return data.findings.map(toFinding);
}
