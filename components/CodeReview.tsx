"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { SEVERITY_COLOR, type Finding, type Severity, type Sources } from "@/lib/findings";
import { highlightLine } from "@/lib/highlight";
import { hintFor, markSpan } from "@/lib/hints";
import { buildFixPrompt, firstSentence } from "@/lib/fixPrompt";
import { Markdown } from "@/lib/markdown";
import { commonRoot, shortPath } from "@/components/FindingList";

/**
 * The scan as a code review: each file with its flagged code marked and a review note under the line.
 * It points at what to change and how to check it; it never edits the user's code.
 */

const CONTEXT_BEFORE = 3;
const CONTEXT_AFTER = 2;
// short files read better whole than folded
const SHOW_WHOLE = 80;
const RANK: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 };
const pad = (n: number) => String(n).padStart(2, "0");

type Props = {
  findings: Finding[];
  sources: Sources;
  handled: Set<string>;
  onHandled: (id: string) => void;
  onAsk?: (f: Finding) => void;
  focus: { id: string; n: number } | null;
};

/** Line ranges to show: each flagged line with a little context, close ranges merged. */
function ranges(total: number, flagged: number[]): [number, number][] {
  if (total <= SHOW_WHOLE) return [[1, total]];
  const out: [number, number][] = [];
  for (const l of [...new Set(flagged)].sort((a, b) => a - b)) {
    const from = Math.max(1, l - CONTEXT_BEFORE);
    const to = Math.min(total, l + CONTEXT_AFTER);
    const last = out[out.length - 1];
    if (last && from <= last[1] + 3) last[1] = Math.max(last[1], to);
    else out.push([from, to]);
  }
  return out;
}

function Code({ text, span }: { text: string; span: [number, number] | null }) {
  if (!span) return <>{highlightLine(text)}</>;
  const [s, e] = span;
  return (
    <>
      {highlightLine(text.slice(0, s))}
      <mark className="cr__mark">{highlightLine(text.slice(s, e))}</mark>
      {highlightLine(text.slice(e))}
    </>
  );
}

/** `code` spans in a sentence, as code. */
const inline = (text: string) => text.split(/`([^`]+)`/).map((part, i) => (i % 2 ? <code key={i}>{part}</code> : part));

function Note({ f, rank, line, open, handled, onToggle, onHandled, onAsk }: {
  f: Finding; rank: number; line: string | null; open: boolean; handled: boolean;
  onToggle: () => void; onHandled: () => void; onAsk?: () => void;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const hint = hintFor(f);
  const copy = (key: string, text: string) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopied(key);
    setTimeout(() => setCopied((c) => (c === key ? null : c)), 1400);
  };
  const lead = firstSentence(f.description);
  const rest = f.description.slice(f.description.indexOf(lead) + lead.length).trim();

  return (
    <div id={`note-${f.id}`} className={`note ${open ? "is-open" : ""} ${handled ? "is-handled" : ""}`} style={{ ["--c" as string]: SEVERITY_COLOR[f.severity] }}>
      <button type="button" className="note__head" aria-expanded={open} onClick={onToggle}>
        <span className="note__rank">{pad(rank)}</span>
        <span className="note__sev">{f.severity}</span>
        <span className="note__title">{f.title}</span>
        {f.rule && <span className="note__rule">{f.rule}</span>}
        {handled && <span className="note__done">handled</span>}
      </button>
      {open && (
        <div className="note__body">
          <p className="note__lead">{inline(lead)}</p>
          <dl className="note__steps">
            <div>
              <dt>Change</dt>
              <dd>{hint?.change ?? "See the explanation below, and the example change."}</dd>
            </div>
            <div>
              <dt>Check</dt>
              <dd>{hint?.check ?? "Re-scan the file: this finding should be gone."}</dd>
            </div>
          </dl>
          {rest && (
            <details className="note__more">
              <summary>Why it matters</summary>
              <Markdown className="note__desc" text={rest} />
            </details>
          )}
          {f.suggestedFix && (
            <details className="note__more">
              <summary>Example change, from the AI explanation</summary>
              <pre className="diff">
                {line && <span className="diff__del"><i>-</i>{line}{"\n"}</span>}
                {f.suggestedFix.split("\n").map((l, i) => <span key={i} className="diff__add"><i>+</i>{l}{"\n"}</span>)}
              </pre>
              <p className="note__fine">A starting point for your AI tool, not a patch: adapt it to the code around it.</p>
            </details>
          )}
          <div className="note__actions">
            <button type="button" className={copied === "loc" ? "is-copied" : ""} onClick={() => copy("loc", `${f.file}:${f.line}`)}>
              {copied === "loc" ? "Copied" : `Copy ${f.file.split("/").pop()}:${f.line}`}
            </button>
            <button type="button" className={copied === "prompt" ? "is-copied" : ""} onClick={() => copy("prompt", buildFixPrompt([f], []))}>
              {copied === "prompt" ? "Copied" : "Copy prompt for this issue"}
            </button>
            {onAsk && <button type="button" onClick={onAsk}>Ask Fixr</button>}
            <button type="button" className="note__handle" aria-pressed={handled} onClick={onHandled}>
              {handled ? "Mark not handled" : "Mark handled"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CodeReview({ findings, sources, handled, onHandled, onAsk, focus }: Props) {
  const rankOf = useMemo(() => new Map(findings.map((f, i) => [f.id, i + 1])), [findings]);
  const files = useMemo(() => {
    const by = new Map<string, Finding[]>();
    for (const f of findings) if (sources[f.file] !== undefined) by.set(f.file, [...(by.get(f.file) ?? []), f]);
    return [...by.entries()];
  }, [findings, sources]);
  const outside = findings.filter((f) => sources[f.file] === undefined);
  const root = useMemo(() => commonRoot(files.map(([name]) => name)), [files]);

  const [file, setFile] = useState<string | null>(files[0]?.[0] ?? null);
  const [open, setOpen] = useState<Record<string, boolean>>(() => (findings[0] ? { [findings[0].id]: true } : {}));
  const [unfolded, setUnfolded] = useState<Record<string, boolean>>({});

  // something outside picked a finding: show its file, open its note and bring it into view
  useEffect(() => {
    if (!focus) return;
    const f = findings.find((x) => x.id === focus.id);
    if (!f) return;
    if (sources[f.file] !== undefined) setFile(f.file);
    setOpen((o) => ({ ...o, [f.id]: true }));
    const t = setTimeout(() => document.getElementById(`note-${f.id}`)?.scrollIntoView({ block: "center", behavior: "smooth" }), 60);
    return () => clearTimeout(t);
  }, [focus, findings, sources]);

  const current = files.find(([name]) => name === file) ?? files[0];
  const lines = current ? sources[current[0]].replace(/\n$/, "").split("\n") : [];
  const byLine = new Map<number, Finding[]>();
  for (const f of current?.[1] ?? []) byLine.set(f.line, [...(byLine.get(f.line) ?? []), f]);
  const shown = current ? ranges(lines.length, current[1].map((f) => f.line).filter((l) => l >= 1)) : [];

  const rows: React.ReactNode[] = [];
  let next = 1;
  const pushLines = (from: number, to: number) => {
    for (let n = from; n <= to; n++) {
      const text = lines[n - 1] ?? "";
      const here = (byLine.get(n) ?? []).sort((a, b) => (rankOf.get(a.id) ?? 0) - (rankOf.get(b.id) ?? 0));
      const top = here[0];
      rows.push(
        <Fragment key={n}>
          <div className={`cr__line ${top ? "is-flag" : ""}`} style={top ? { ["--c" as string]: SEVERITY_COLOR[top.severity] } : undefined}>
            <span className="cr__n">{n}</span>
            <code className="cr__code"><Code text={text} span={top ? markSpan(text, top) : null} /></code>
          </div>
          {here.map((f) => (
            <Note
              key={f.id}
              f={f}
              rank={rankOf.get(f.id) ?? 0}
              line={text.trim() ? text : null}
              open={!!open[f.id]}
              handled={handled.has(f.id)}
              onToggle={() => setOpen((o) => ({ ...o, [f.id]: !o[f.id] }))}
              onHandled={() => onHandled(f.id)}
              onAsk={onAsk && (() => onAsk(f))}
            />
          ))}
        </Fragment>,
      );
    }
  };
  const fold = (from: number, to: number, last: boolean) => {
    const key = `${current?.[0]}:${from}`;
    if (unfolded[key]) return pushLines(from, to);
    const n = to - from + 1;
    rows.push(
      <button key={key} type="button" className="cr__fold" onClick={() => setUnfolded((u) => ({ ...u, [key]: true }))}>
        {last ? `Show the last ${n}` : `Show ${n} more`} {n === 1 ? "line" : "lines"}
      </button>,
    );
  };
  for (const [from, to] of shown) {
    if (from > next) fold(next, from - 1, false);
    pushLines(from, to);
    next = to + 1;
  }
  if (current && next <= lines.length) fold(next, lines.length, true);

  return (
    <div className={`review ${files.length > 1 ? "review--files" : ""}`}>
      {files.length > 1 && (
        <nav className="review__files" aria-label="Files with findings">
          <p className="review__root" title={root}>{root ? root.replace(/\/$/, "") : "project"}</p>
          <ul>
            {files.map(([name, items]) => {
              const worst = items.reduce((w, f) => (RANK[f.severity] < RANK[w] ? f.severity : w), items[0].severity);
              const left = items.filter((f) => !handled.has(f.id)).length;
              return (
                <li key={name}>
                  <button type="button" aria-current={current?.[0] === name ? "true" : undefined} onClick={() => setFile(name)} style={{ ["--c" as string]: SEVERITY_COLOR[worst] }}>
                    <span className="review__name">{shortPath(name, root)}</span>
                    <span className="review__n">{left === 0 ? "done" : left}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      )}

      <div className="review__main">
        {current ? (
          <section className="cr" aria-label={`Review of ${current[0]}`}>
            <header className="cr__head">
              <span className="cr__path">{shortPath(current[0], root) || current[0]}</span>
              <span className="cr__count">{current[1].length} {current[1].length === 1 ? "finding" : "findings"}</span>
            </header>
            <div className="cr__body">{rows}</div>
          </section>
        ) : (
          <p className="review__none">No source came back with this scan, so these findings are listed without their file.</p>
        )}

        {outside.length > 0 && (
          <section className="review__outside" aria-label="Findings outside your source files">
            <h3>Not tied to a line</h3>
            <p>Dependency advisories and other findings about packages rather than code.</p>
            {outside.map((f) => (
              <Note
                key={f.id}
                f={f}
                rank={rankOf.get(f.id) ?? 0}
                line={null}
                open={!!open[f.id]}
                handled={handled.has(f.id)}
                onToggle={() => setOpen((o) => ({ ...o, [f.id]: !o[f.id] }))}
                onHandled={() => onHandled(f.id)}
                onAsk={onAsk && (() => onAsk(f))}
              />
            ))}
          </section>
        )}
      </div>
    </div>
  );
}
