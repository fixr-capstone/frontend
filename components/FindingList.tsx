"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { SEVERITY_COLOR, type Finding, type Severity } from "@/lib/findings";
import { highlight } from "@/lib/highlight";
import { Markdown } from "@/lib/markdown";

const SEVERITIES: Severity[] = ["critical", "high", "medium", "low"];
const RANK: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 };
// A big scan is hundreds of rows: render a page at a time, and a group's first few places.
const PAGE = 40;
const GROUP_PAGE = 20;
const GROUP_BY_DEFAULT = 25;

type Mode = "issue" | "file" | "priority";
const MODES: [Mode, string][] = [["issue", "By issue"], ["file", "By file"], ["priority", "By priority"]];
const pad = (n: number) => String(n).padStart(2, "0");
const keyOf = (f: Finding, mode: Mode) => (mode === "file" ? f.file : `${f.rule ?? ""}|${f.title}`);
const worst = (items: Finding[]) => items.reduce((w, f) => (RANK[f.severity] < RANK[w] ? f.severity : w), items[0].severity);

/** Per file: count and severity mix, most findings first. */
function fileStats(findings: Finding[]) {
  const stats = new Map<string, { n: number; c: Record<Severity, number> }>();
  for (const f of findings) {
    const s = stats.get(f.file) ?? { n: 0, c: { critical: 0, high: 0, medium: 0, low: 0 } };
    s.n++;
    s.c[f.severity]++;
    stats.set(f.file, s);
  }
  return [...stats.entries()].sort((a, b) => b[1].n - a[1].n);
}

/** The folder every file shares (a zip's "<repo>-main/" wrapper), so it is shown once, not on every row. */
export function commonRoot(paths: string[]) {
  const dirs = paths.map((p) => p.split("/").slice(0, -1));
  const root: string[] = [];
  for (let i = 0; dirs.every((d) => i < d.length && d[i] === dirs[0][i]); i++) root.push(dirs[0][i]);
  return root.length ? root.join("/") + "/" : "";
}

/** A path that may wrap after each "/" instead of mid-name. */
const breakable = (path: string) =>
  path.split("/").flatMap((part, i, all) => (i < all.length - 1 ? [part + "/", <wbr key={i} />] : [part]));

/** Short path for display: without the shared root. */
export const shortPath = (path: string, root: string) => (root && path.startsWith(root) ? path.slice(root.length) : path);

/**
 * Left column for multi-file scans, laid out like an editor's explorer: files under their folders, each with a
 * signal bar as long as its share of the worst file and coloured by its severity mix. A click scopes the list.
 */
export function FileIndex({ findings, file, onFile }: { findings: Finding[]; file: string | null; onFile: (f: string | null) => void }) {
  const { root, dirs, max, fileCount } = useMemo(() => {
    const files = fileStats(findings);
    const root = commonRoot(files.map(([name]) => name));
    const byDir = new Map<string, { total: number; files: typeof files }>();
    for (const entry of files) {
      const short = shortPath(entry[0], root);
      const dir = short.includes("/") ? short.slice(0, short.lastIndexOf("/") + 1) : "";
      const d = byDir.get(dir) ?? { total: 0, files: [] };
      d.total += entry[1].n;
      d.files.push(entry);
      byDir.set(dir, d);
    }
    const dirs = [...byDir.entries()].sort((a, b) => b[1].total - a[1].total);
    return { root, dirs, max: files[0]?.[1].n ?? 1, fileCount: files.length };
  }, [findings]);

  return (
    <nav className="tree" aria-label="Files with findings">
      <div className="tree__head">
        <span className="tree__root" title={root}>{root ? root.replace(/\/$/, "") : "project"}</span>
        <span className="tree__sum">{fileCount} files · {findings.length}</span>
      </div>
      {file && <button type="button" className="tree__all" onClick={() => onFile(null)}>Show every file</button>}
      {dirs.map(([dir, d]) => (
        <section key={dir} className="tree__dir">
          <p className="tree__dirname"><span>{dir || "./"}</span><b>{d.total}</b></p>
          <ul>
            {d.files.map(([name, s]) => (
              <li key={name}>
                <button
                  type="button"
                  className={`tree__file ${file === name ? "is-on" : ""} ${file && file !== name ? "is-dim" : ""}`}
                  aria-pressed={file === name}
                  title={name}
                  onClick={() => onFile(file === name ? null : name)}
                >
                  <span className="tree__name">{name.slice(name.lastIndexOf("/") + 1)}</span>
                  <span className="tree__n">{s.n}</span>
                  <span className="tree__bar" style={{ ["--w" as string]: s.n / max }} aria-hidden="true">
                    {SEVERITIES.map((sev) => s.c[sev] > 0 && <i key={sev} style={{ flexGrow: s.c[sev], background: SEVERITY_COLOR[sev] }} />)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </nav>
  );
}

export default function FindingList({
  findings,
  focus,
  file,
  onFile,
  onHot,
  onAsk,
  hasIndex = false,
}: {
  findings: Finding[];
  focus: { id: string; n: number } | null;
  hasIndex?: boolean;
  file: string | null;
  onFile: (f: string | null) => void;
  onHot: (id: string | null) => void;
  onAsk: (f: Finding) => void;
}) {
  const files = useMemo(() => fileStats(findings), [findings]);
  const root = useMemo(() => commonRoot(files.map(([name]) => name)), [files]);
  const short = (path: string) => shortPath(path, root);
  const searchRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<Mode>(findings.length > GROUP_BY_DEFAULT ? "issue" : "priority");
  const [severity, setSeverity] = useState<Severity | null>(null);
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(PAGE);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [groupOpen, setGroupOpen] = useState<Record<string, boolean>>({});
  const [groupAll, setGroupAll] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState<string | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const rankOf = useMemo(() => new Map(findings.map((f, i) => [f.id, i])), [findings]);
  const q = query.trim().toLowerCase();
  const visible = findings.filter(
    (f) =>
      (!severity || f.severity === severity) &&
      (!file || f.file === file) &&
      (!q || `${f.title} ${f.file} ${f.rule ?? ""} ${f.description}`.toLowerCase().includes(q)),
  );
  const grouped = new Map<string, Finding[]>();
  if (mode !== "priority") for (const f of visible) grouped.set(keyOf(f, mode), [...(grouped.get(keyOf(f, mode)) ?? []), f]);
  const groups = [...grouped.entries()];
  // groups of one (e.g. scoped to a single file) are just headers over a row: show the plain list
  const flat = mode === "priority" || groups.every(([, items]) => items.length === 1);
  const counts = SEVERITIES.map((s) => ({ s, n: findings.filter((f) => f.severity === s && (!file || f.file === file)).length }));
  const filtered = Boolean(severity || file || q);

  // Something outside the list (x-ray, gutter, hero) picked a finding: clear what hides it and open it.
  useEffect(() => {
    if (!focus) return;
    const f = findings.find((x) => x.id === focus.id);
    if (!f) return;
    setSeverity(null);
    setQuery("");
    onFile(null);
    setOpen((o) => ({ ...o, [f.id]: true }));
    setShown((n) => Math.max(n, (rankOf.get(f.id) ?? 0) + 1));
    setGroupOpen((g) => ({ ...g, [keyOf(f, mode)]: true }));
    setGroupAll((g) => ({ ...g, [keyOf(f, mode)]: true }));
    // onFile and mode are read when a finding is picked; re-running on their change would re-open it
  }, [focus, findings, rankOf]);

  // "/" jumps to the filter, as in editors and GitHub
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key !== "/" || e.metaKey || e.ctrlKey || t.closest("input, textarea, select, [contenteditable]")) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const copy = (id: string, text: string) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopied(id);
    clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(null), 1400);
  };

  const row = (f: Finding, i: number, inGroup: boolean) => {
    const rank = (rankOf.get(f.id) ?? 0) + 1;
    // inside an issue group the title is the group's, so the row only needs where
    const where = inGroup && mode === "issue";
    return (
      <li
        key={f.id}
        id={`finding-${f.id}`}
        data-fid={f.id}
        className={`finding ${inGroup ? "finding--compact" : ""} ${where ? "finding--where" : ""} ${open[f.id] ? "is-open" : ""}`}
        onMouseEnter={() => onHot(f.id)}
        onMouseLeave={() => onHot(null)}
        style={{ ["--c" as string]: SEVERITY_COLOR[f.severity], ["--i" as string]: i }}
      >
        <button className="finding__head" onClick={() => setOpen((o) => ({ ...o, [f.id]: !o[f.id] }))} aria-expanded={!!open[f.id]}>
          <span className="finding__rank">{pad(rank)}</span>
          {!where && <span className="finding__sev">{f.severity}</span>}
          <span className="finding__main">
            {where ? (
              <span className="finding__where">{breakable(short(f.file))}<span>:{f.line}</span></span>
            ) : (
              <>
                <span className="finding__title">{f.title}</span>
                <span className="finding__loc">{inGroup || file ? `line ${f.line}` : `${short(f.file)}, line ${f.line}`}{f.rule ? ` · ${f.rule}` : ""}</span>
              </>
            )}
          </span>
          <span className="finding__toggle" aria-hidden="true" />
        </button>
        {open[f.id] && (
          <div className="finding__body">
            <Markdown className="finding__desc" text={f.description} />
            {(f.snippet || f.suggestedFix) && (
              <div className="snips">
                {f.snippet && (
                  <div className="snip snip--bad">
                    <div className="snip__head">
                      <span>Flagged code</span>
                      <button className="copy" onClick={() => copy(f.id + "s", f.snippet)}>{copied === f.id + "s" ? "Copied" : "Copy"}</button>
                    </div>
                    <pre>{highlight(f.snippet)}</pre>
                  </div>
                )}
                {f.suggestedFix && (
                  <div className="snip snip--fix">
                    <div className="snip__head">
                      <span>Suggested fix</span>
                      <button className="copy" onClick={() => copy(f.id + "f", f.suggestedFix)}>{copied === f.id + "f" ? "Copied" : "Copy"}</button>
                    </div>
                    <pre>{highlight(f.suggestedFix)}</pre>
                  </div>
                )}
              </div>
            )}
            <button className="ask" onClick={() => onAsk(f)}>Ask about this finding</button>
          </div>
        )}
      </li>
    );
  };

  return (
    <>
      <div className="toolbar">
        <div className="toolbar__row">
          <label className="search">
            <span className="search__prompt" aria-hidden="true">&gt;</span>
            <input
              ref={searchRef}
              type="search"
              placeholder="filter by file, rule or text"
              aria-label="Filter findings"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setShown(PAGE); }}
            />
            {!query && <kbd className="search__kbd" aria-hidden="true">/</kbd>}
          </label>
          {files.length > 1 && (
            // the explorer is the file picker on wide screens; this select covers phones and small scans
            <select className={`toolbar__file ${hasIndex ? "toolbar__file--index" : ""}`} aria-label="Show one file" value={file ?? ""} onChange={(e) => { onFile(e.target.value || null); setShown(PAGE); }}>
              <option value="">All {files.length} files</option>
              {files.map(([name, s]) => <option key={name} value={name}>{short(name)} ({s.n})</option>)}
            </select>
          )}
          <div className="seg" role="group" aria-label="Group findings">
            {MODES.filter(([m]) => m !== "file" || files.length > 1).map(([m, label]) => (
              <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)}>{label}</button>
            ))}
          </div>
        </div>
        <div className="chips">
          {counts.map(({ s, n }) => (
            <button
              key={s}
              className={`chip ${severity === s ? "is-on" : ""}`}
              disabled={n === 0}
              aria-pressed={severity === s}
              style={{ ["--c" as string]: SEVERITY_COLOR[s] }}
              onClick={() => { setSeverity((cur) => (cur === s ? null : s)); setShown(PAGE); }}
            >
              <b>{n}</b> {s}
            </button>
          ))}
          {file && (
            <button type="button" className="scope" title={`${file}: show every file`} onClick={() => onFile(null)}>
              in <b>{short(file)}</b><span aria-hidden="true">×</span>
            </button>
          )}
          {filtered && (
            <button className="chips__clear" onClick={() => { setSeverity(null); setQuery(""); onFile(null); }}>Clear filters</button>
          )}
          <span className="toolbar__count" aria-live="polite">
            {filtered ? `${visible.length} of ${findings.length} shown` : `${findings.length} ${findings.length === 1 ? "finding" : "findings"}`}
            {!flat && ` in ${groups.length} ${groups.length === 1 ? "group" : "groups"}`}
          </span>
        </div>
      </div>

      {visible.length === 0 && <p className="findings__empty">Nothing matches these filters.</p>}

      {flat ? (
        <>
          <ul className="findings">{visible.slice(0, shown).map((f, i) => row(f, i, false))}</ul>
          {visible.length > shown && (
            <button className="more" onClick={() => setShown((n) => n + PAGE)}>
              Show {Math.min(PAGE, visible.length - shown)} more <span>{shown} of {visible.length}</span>
            </button>
          )}
        </>
      ) : (
        <ul className="findings groups">
          {groups.map(([key, items], gi) => {
            const isOpen = groupOpen[key] ?? gi === 0;
            const all = groupAll[key] || items.length <= GROUP_PAGE;
            const sev = worst(items);
            const head = items[0];
            const fileCount = new Set(items.map((f) => f.file)).size;
            return (
              <li key={key} className={`group ${isOpen ? "is-open" : ""}`} style={{ ["--c" as string]: SEVERITY_COLOR[sev], ["--i" as string]: gi }}>
                <button className="group__head" aria-expanded={isOpen} onClick={() => setGroupOpen((g) => ({ ...g, [key]: !isOpen }))}>
                  <span className="finding__rank">{pad((rankOf.get(head.id) ?? 0) + 1)}</span>
                  <span className="finding__sev">{sev}</span>
                  <span className="group__main">
                    <span className="group__title">{mode === "issue" ? head.title : short(key)}</span>
                    <span className="group__meta">
                      {mode === "issue"
                        ? `${head.rule ? `${head.rule} · ` : ""}${items.length} ${items.length === 1 ? "place" : "places"}${fileCount > 1 ? ` in ${fileCount} files` : ""}`
                        : `${items.length} ${items.length === 1 ? "finding" : "findings"}`}
                    </span>
                  </span>
                  <span className="group__n">{items.length}</span>
                  <span className="finding__toggle" aria-hidden="true" />
                </button>
                {isOpen && (
                  <ul className="group__items">
                    {(all ? items : items.slice(0, GROUP_PAGE)).map((f, i) => row(f, i, true))}
                    {!all && (
                      <li>
                        <button className="more more--inline" onClick={() => setGroupAll((g) => ({ ...g, [key]: true }))}>
                          Show all {items.length} <span>{GROUP_PAGE} shown</span>
                        </button>
                      </li>
                    )}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
