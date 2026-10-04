"use client";

import { useEffect, useRef, useState } from "react";
import samples from "@/lib/samples.json";
import { toFinding, type ApiFinding } from "@/lib/api";
import { FALSE_ALARM, firstSentence } from "@/lib/fixPrompt";
import type { Severity } from "@/lib/findings";

export const CLI_REPO = "https://github.com/fixr-capstone/cli";

const INSTALL = `git clone ${CLI_REPO}.git
cd cli
uv tool install --overrides overrides.txt .`;

const COMMANDS: [string, string][] = [
  ["fixr scan", "scan the current folder"],
  ["fixr scan path/to/project", "a folder, one .py file or a .zip"],
  ["fixr scan . --fix-prompt fix.md", "also write the fix prompt for your AI tool"],
  ["fixr scan . --format json > results.json", "JSON, for CI or scripts"],
  ["fixr chat .", "scan, then ask questions (needs GROQ_API_KEY)"],
];

type Line = { text: string; tone?: "cmd" | "head" | "dim" | Severity };

/**
 * What `fixr scan app.py` prints for the messy sample, built from the same real scan the page
 * shows and laid out like the CLI's text report (src/fixr_cli/render.py), trimmed for space.
 */
function transcript(): Line[] {
  const api = samples.messy.findings as unknown as ApiFinding[];
  const all = api.map((f, i) => ({ f: toFinding(f, i), explained: Boolean(f.metadata.explanation) }));
  const real = all.filter(({ f }) => !f.style);
  const style = all.filter(({ f }) => f.style).map(({ f }) => f);
  const alarm = real.filter(({ f, explained }) => explained && FALSE_ALARM.test(f.description));
  const counted = real.filter((r) => !alarm.includes(r));
  const explained = counted.filter((r) => r.explained);
  const other = counted.filter((r) => !r.explained);
  const n = (s: Severity) => real.filter(({ f }) => f.severity === s).length;
  const styleRules = Object.entries(
    style.reduce<Record<string, number>>((acc, f) => ({ ...acc, [f.rule ?? f.title]: (acc[f.rule ?? f.title] ?? 0) + 1 }), {}),
  ).sort((a, b) => b[1] - a[1]);

  return [
    { text: "$ fixr scan app.py", tone: "cmd" },
    { text: "Fixr scan of app.py", tone: "head" },
    { text: "# scanner timings trimmed", tone: "dim" },
    { text: `Groq explained ${real.filter((r) => r.explained).length} findings.` },
    { text: "" },
    { text: "Explained by Groq", tone: "head" },
    ...explained.flatMap(({ f }, i): Line[] => [
      { text: `${i + 1}. ${f.severity.toUpperCase()}  ${f.title}`, tone: f.severity },
      { text: `app.py:${f.line}  ${f.rule ?? ""}` },
    ]),
    { text: "# explanations and fixes trimmed", tone: "dim" },
    { text: "" },
    ...(other.length
      ? [{ text: "Other findings by rule", tone: "head" } as Line, ...other.flatMap(({ f }): Line[] => [
          { text: `${f.severity.toUpperCase()}  ${f.rule}  ${f.title} (1)`, tone: f.severity },
          { text: `  app.py:${f.line}` },
        ]), { text: "" }]
      : []),
    ...(alarm.length
      ? [{ text: "Likely false alarms (Fixr's explanation found these harmless)", tone: "head" } as Line,
         ...alarm.map(({ f }): Line => ({ text: `app.py:${f.line}  ${f.rule}  ${f.title.replace(/\.$/, "")}. ${firstSentence(f.description)}`, tone: "dim" })),
         { text: "" }]
      : []),
    { text: `${style.length} style notes from flake8 across ${styleRules.length} rules (top: ${styleRules.slice(0, 3).map(([r, c]) => `${r} ${c}`).join(", ")}). Run with --show-style to list them.`, tone: "dim" },
    { text: "" },
    { text: `${n("high")} high, ${n("medium")} medium, ${n("low")} low findings (style notes not counted).` },
    {
      text: `${counted.filter(({ f }) => f.severity === "high").length} at or above --fail-on high${alarm.length ? ` (${alarm.length} likely false ${alarm.length === 1 ? "alarm" : "alarms"} not counted)` : ""}.`,
      tone: "high",
    },
  ];
}
const LINES = transcript();

export default function CliPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const copy = (text: string) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopied(text);
    setTimeout(() => setCopied((c) => (c === text ? null : c)), 1400);
  };

  return (
    <dialog
      ref={ref}
      className="cli"
      aria-labelledby="cli-title"
      onClose={onClose}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="cli__sheet">
        <header className="cli__head">
          <h2 id="cli-title" className="cli__title"><span aria-hidden="true">›_</span> fixr CLI</h2>
          <button type="button" className="chat__close" onClick={onClose} aria-label="Close" />
        </header>

        <div className="cli__body">
          <p className="cli__lead">
            The same scan on your own machine: the four scanners, the false-alarm filter, the ranking and the
            explanations. Your code stays local; only if you set <code>GROQ_API_KEY</code> are the functions around the
            top five findings sent to Groq to be explained.
          </p>

          <section className="cli__block">
            <div className="cli__label">
              <span>Install</span>
              <button type="button" className="copy" onClick={() => copy(INSTALL)}>{copied === INSTALL ? "Copied" : "Copy"}</button>
            </div>
            <pre className="cli__code">{INSTALL.split("\n").map((l) => <span key={l}><i>$</i> {l}{"\n"}</span>)}</pre>
            <p className="cli__note">
              Needs <a href="https://docs.astral.sh/uv/" target="_blank" rel="noreferrer">uv</a> (it fetches Python 3.13 itself)
              and read access to the fixr-capstone repositories. Keep <code>--overrides overrides.txt</code>: without it the
              install tries SSH and fails unless you have a GitHub SSH key.
            </p>
          </section>

          <section className="cli__block">
            <div className="cli__label"><span>Run</span><span className="cli__hint">click a command to copy it</span></div>
            <ul className="cli__cmds">
              {COMMANDS.map(([cmd, what]) => (
                <li key={cmd}>
                  <button type="button" onClick={() => copy(cmd)} aria-label={`Copy ${cmd}`}>
                    <code><i>$</i> {cmd}</code>
                    <span>{copied === cmd ? "Copied" : what}</span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="cli__note">
              Exit code 1 when anything is at or above <code>--fail-on</code> (default <code>high</code>), so it can gate a CI job.
              Likely false alarms and style notes never count.
            </p>
          </section>

          <section className="cli__block">
            <div className="cli__label"><span>What it prints, for the messy sample</span></div>
            <pre className="cli__term" aria-label="Example output of fixr scan">
              {open && LINES.map((l, i) => (
                <span key={i} className={l.tone ? `t-${l.tone}` : undefined} style={{ ["--i" as string]: i }}>{l.text || " "}{"\n"}</span>
              ))}
            </pre>
          </section>
        </div>

        <footer className="cli__foot">
          <a className="btn btn--primary" href={CLI_REPO} target="_blank" rel="noreferrer">Open on GitHub</a>
          <span>Private repository: you need access to fixr-capstone.</span>
        </footer>
      </div>
    </dialog>
  );
}
