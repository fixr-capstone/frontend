"use client";

import { SEVERITY_COLOR, type Finding } from "@/lib/findings";

const MAX_ROWS = 90;

/** A minimap of each scanned file: one bar per line, findings lit by severity and numbered by priority. */
export default function XRay({
  findings,
  notes,
  code,
  codeFile,
  onHot,
  onPick,
}: {
  findings: Finding[];
  notes: Finding[];
  code: string | null;
  codeFile: string | null;
  onHot: (id: string | null) => void;
  onPick: (id: string) => void;
}) {
  const files = [...new Set([...findings, ...notes].map((f) => f.file))];
  const rankOf = new Map(findings.map((f, i) => [f.id, i]));

  return (
    <div className="xray">
      {files.map((file) => {
        const source = file === codeFile && code ? code.replace(/\n$/, "").split("\n") : null;
        const inFile = findings.filter((f) => f.file === file);
        const fileNotes = notes.filter((n) => n.file === file);
        const lastLine = Math.max(source?.length ?? 0, ...[...inFile, ...fileNotes].map((f) => f.line + 1));
        const rows = Math.min(lastLine, MAX_ROWS);
        const scale = lastLine / rows;
        const rowOf = (line: number) => Math.min(rows - 1, Math.floor((Math.max(1, line) - 1) / scale));
        const hits = new Map<number, Finding>();
        inFile.forEach((f) => { if (!hits.has(rowOf(f.line))) hits.set(rowOf(f.line), f); });
        inFile.forEach((f) => {
          const span = Math.max(1, f.snippet.split("\n").length);
          for (let l = f.line; l < f.line + span; l++) if (!hits.has(rowOf(l))) hits.set(rowOf(l), f);
        });
        const noteRows = new Set(fileNotes.map((n) => rowOf(n.line)));

        return (
          <div className="xray__file" key={file}>
            <div className="xray__head">
              <span>{file}</span>
              <span>{lastLine} lines</span>
            </div>
            <div className="xray__map" style={{ ["--rows" as string]: rows }} onMouseLeave={() => onHot(null)}>
              {Array.from({ length: rows }, (_, r) => {
                const f = hits.get(r);
                const text = source?.[Math.floor(r * scale)] ?? "";
                const indent = source ? text.length - text.trimStart().length : 0;
                const width = source ? Math.min(text.trim().length, 72) / 72 : 0.3 + ((r * 37) % 11) / 30;
                const rank = f ? rankOf.get(f.id)! : -1;
                const first = f && rowOf(f.line) === r;
                return (
                  <div
                    key={r}
                    data-fid={f?.id}
                    className={`xr ${f ? "xr--hit" : ""} ${noteRows.has(r) ? "xr--note" : ""}`}
                    style={{
                      ["--ln" as string]: r,
                      ["--x" as string]: indent / 72,
                      ["--w" as string]: width,
                      ["--c" as string]: f ? SEVERITY_COLOR[f.severity] : undefined,
                      ["--r" as string]: rank,
                    }}
                    onMouseEnter={() => onHot(f?.id ?? null)}
                    onClick={f ? () => onPick(f.id) : undefined}
                  >
                    <i className="xr__bar" />
                    {first && (
                      <button
                        type="button"
                        className="xr__rank"
                        onFocus={() => onHot(f.id)}
                        onBlur={() => onHot(null)}
                        aria-label={`Finding ${rank + 1}: ${f.title}, line ${f.line}`}
                      >
                        {String(rank + 1).padStart(2, "0")}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      <p className="xray__key">
        <span><i className="xray__key-hit" />finding, numbered by priority</span>
        <span><i className="xray__key-note" />style note</span>
      </p>
    </div>
  );
}
