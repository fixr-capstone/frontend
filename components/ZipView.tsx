import { SEVERITY_COLOR, type Finding, type Severity } from "@/lib/findings";

const SHOWN = 11;
const RANK: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 };

/** The uploaded project's Python files: a read head steps down them while scanning, counts land after. */
export default function ZipView({ files, live, findings }: { files: string[]; live: boolean; findings: Finding[] | null }) {
  const hits = new Map<string, { n: number; worst: Severity }>();
  for (const f of findings ?? []) {
    if (f.style) continue;
    const h = hits.get(f.file);
    hits.set(f.file, { n: (h?.n ?? 0) + 1, worst: h && RANK[h.worst] <= RANK[f.severity] ? h.worst : f.severity });
  }
  const rows = findings ? [...files].sort((a, b) => (hits.get(b)?.n ?? 0) - (hits.get(a)?.n ?? 0)) : files;
  const shown = rows.slice(0, SHOWN);

  return (
    <div className={`unpack ${live ? "is-live" : ""}`} style={{ ["--n" as string]: Math.max(shown.length, 1) }}>
      <p className="unpack__head">
        {files.length ? `${files.length} Python ${files.length === 1 ? "file" : "files"}` : "Reading the archive"}
        <span>{live ? "Scanning the project" : findings ? "Scanned" : ""}</span>
      </p>
      <ol className="unpack__files">
        {shown.map((path, i) => {
          const h = hits.get(path);
          const cut = path.lastIndexOf("/") + 1;
          return (
            <li key={path} className="unpack__row" style={{ ["--i" as string]: i }}>
              <span className="unpack__path">{path.slice(0, cut)}<b>{path.slice(cut)}</b></span>
              {findings && (
                <span className="unpack__tag" style={h ? { color: SEVERITY_COLOR[h.worst] } : undefined}>
                  {h ? `${h.n} ${h.n === 1 ? "finding" : "findings"}` : "clean"}
                </span>
              )}
            </li>
          );
        })}
        {rows.length > SHOWN && <li className="unpack__more">+{rows.length - SHOWN} more</li>}
      </ol>
    </div>
  );
}
