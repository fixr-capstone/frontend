"use client";

import { useEffect, useRef, useState } from "react";
import samples from "@/lib/samples.json";
import { toFinding, type ApiFinding } from "@/lib/api";
import { FALSE_ALARM, firstSentence } from "@/lib/fixPrompt";
import type { Severity } from "@/lib/findings";

export const CLI_REPO = "https://github.com/fixr-capstone/cli";

type Os = "windows" | "mac" | "linux";
const OS_NAMES: [Os, string][] = [["windows", "Windows"], ["mac", "macOS"], ["linux", "Linux"]];

function detectOs(): Os {
  const p = `${(navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ?? ""} ${navigator.platform} ${navigator.userAgent}`;
  return /win/i.test(p) ? "windows" : /mac|iphone|ipad/i.test(p) ? "mac" : "linux";
}

type Step = { title: string; body: Record<Os, string>; cmd?: Record<Os, string>; after?: Record<Os, string> };

const same = (v: string): Record<Os, string> => ({ windows: v, mac: v, linux: v });

// Plain-language setup for someone who has never used a terminal. Steps 1 to 3 happen once.
const STEPS: Step[] = [
  {
    title: "Open a terminal",
    body: {
      windows: "Press the Start button, type PowerShell and press Enter. A window with a blinking cursor opens: that is where you paste the commands below.",
      mac: "Press Cmd + Space, type Terminal and press Enter. A window with a blinking cursor opens: that is where you paste the commands below.",
      linux: "Press Ctrl + Alt + T, or open Terminal from your apps. That is where you paste the commands below.",
    },
  },
  {
    title: "Install uv (once)",
    body: same("uv is a small free tool that installs Fixr and the Python it needs. Copy this, paste it in the terminal (right-click or Ctrl + V) and press Enter."),
    cmd: {
      windows: 'powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"',
      mac: "curl -LsSf https://astral.sh/uv/install.sh | sh",
      linux: "curl -LsSf https://astral.sh/uv/install.sh | sh",
    },
    after: same("When it finishes, close the terminal and open a new one, so it can find uv."),
  },
  {
    title: "Get Fixr (once)",
    body: {
      windows: "This downloads Fixr and installs it. It needs Git: if the terminal says git is not recognised, install it from git-scm.com (keep the default options) and open a new terminal. GitHub may open a sign-in window: use the account that has access to fixr-capstone.",
      mac: "This downloads Fixr and installs it. If your Mac offers to install developer tools for git, accept and run the command again. GitHub may ask you to sign in: use the account that has access to fixr-capstone.",
      linux: "This downloads Fixr and installs it. It needs git (sudo apt install git on Ubuntu). GitHub may ask you to sign in: use the account that has access to fixr-capstone.",
    },
    cmd: same(`git clone ${CLI_REPO}.git
cd cli
uv tool install --overrides overrides.txt .`),
    after: same("It takes a few minutes the first time. When the terminal is ready again, Fixr is installed."),
  },
  {
    title: "Scan your project",
    body: same("Type the command below with a space at the end, then drag your project folder from your files into the terminal window. Its location appears after the command. Press Enter."),
    cmd: same("fixr scan "),
    after: same("Fixr prints what it found, most serious first. Add --fix-prompt fix.md before pressing Enter to also save a file you can give to ChatGPT, Claude or Copilot to make the fixes."),
  },
  {
    title: "Optional: plain-language explanations",
    body: same("With a free Groq key, Fixr explains the top findings and you can ask it questions with fixr chat. Paste this with your key in place of the dots, in the same terminal, before scanning."),
    cmd: {
      windows: '$env:GROQ_API_KEY="gsk_..."',
      mac: 'export GROQ_API_KEY="gsk_..."',
      linux: 'export GROQ_API_KEY="gsk_..."',
    },
    after: same("Only the functions around the top five findings are sent to Groq. Everything else stays on your computer."),
  },
];

const HELP: [string, Record<Os, string>][] = [
  ["The terminal says fixr or uv is not recognised", same("Close the terminal and open a new one. If it still happens, run uv tool update-shell, then open a new terminal again.")],
  ["It says Repository not found", same("Your GitHub account does not have access to fixr-capstone yet. Ask the team to add you, then run step 3 again.")],
  ["git is not recognised", { windows: "Install Git from git-scm.com with the default options, open a new terminal and run step 3 again.", mac: "Run xcode-select --install, accept, then run step 3 again.", linux: "Install git with your package manager (sudo apt install git on Ubuntu), then run step 3 again." }],
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
  const [os, setOs] = useState<Os>("windows");
  const [copied, setCopied] = useState<string | null>(null);
  const [done, setDone] = useState<Record<number, boolean>>({});

  useEffect(() => setOs(detectOs()), []);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  // copying a step's command is the user doing it, so the step ticks itself off
  const copy = (key: string, text: string, step: number) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopied(key);
    setDone((d) => ({ ...d, [step]: true }));
    setTimeout(() => setCopied((c) => (c === key ? null : c)), 1400);
  };
  const progress = STEPS.slice(0, 4).filter((_, i) => done[i]).length;

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
          <div>
            <h2 id="cli-title" className="cli__title"><span aria-hidden="true">›_</span> Fixr on your computer</h2>
            <p className="cli__sub">About five minutes to set up, once. After that, scanning is one command.</p>
          </div>
          <button type="button" className="chat__close" onClick={onClose} aria-label="Close" />
        </header>

        <div className="cli__body">
          <div className="cli__os" role="tablist" aria-label="Your computer">
            {OS_NAMES.map(([id, name]) => (
              <button key={id} type="button" role="tab" aria-selected={os === id} onClick={() => setOs(id)}>{name}</button>
            ))}
            <span className="cli__progress" aria-live="polite">{progress} of 4 steps done</span>
          </div>

          <ol className="steps">
            {STEPS.map((step, i) => {
              const key = `${i}:${os}`;
              return (
                <li key={i} className={`step ${done[i] ? "is-done" : ""}`}>
                  <button
                    type="button"
                    className="step__mark"
                    aria-label={done[i] ? `Step ${i + 1} done, mark it not done` : `Mark step ${i + 1} done`}
                    onClick={() => setDone((d) => ({ ...d, [i]: !d[i] }))}
                  >
                    {done[i] ? "✓" : i + 1}
                  </button>
                  <div className="step__main">
                    <h3 className="step__title">{step.title}</h3>
                    <p className="step__body">{step.body[os]}</p>
                    {step.cmd && (
                      <div className="step__cmd">
                        <pre>{step.cmd[os].split("\n").map((l) => <span key={l}><i>{os === "windows" ? ">" : "$"}</i> {l}{"\n"}</span>)}</pre>
                        <button type="button" className={`step__copy ${copied === key ? "is-copied" : ""}`} onClick={() => copy(key, step.cmd![os], i)}>
                          {copied === key ? "Copied" : "Copy"}
                        </button>
                      </div>
                    )}
                    {step.after && <p className="step__after">{step.after[os]}</p>}
                  </div>
                </li>
              );
            })}
          </ol>

          <section className="cli__next">
            <p className="cli__label"><span>Next time</span></p>
            <p>Open a terminal, type <code>fixr scan </code>, drag in your project folder and press Enter. That is all.</p>
          </section>

          <details className="cli__more">
            <summary>If something goes wrong</summary>
            <dl>
              {HELP.map(([problem, fix]) => (
                <div key={problem}><dt>{problem}</dt><dd>{fix[os]}</dd></div>
              ))}
            </dl>
          </details>

          <details className="cli__more">
            <summary>What you will see, for the messy sample</summary>
            <pre className="cli__term" aria-label="Example output of fixr scan">
              {open && LINES.map((l, i) => (
                <span key={i} className={l.tone ? `t-${l.tone}` : undefined} style={{ ["--i" as string]: i }}>{l.text || " "}{"\n"}</span>
              ))}
            </pre>
          </details>
        </div>

        <footer className="cli__foot">
          <a className="btn btn--ghost" href={CLI_REPO} target="_blank" rel="noreferrer">Source on GitHub</a>
          <span>The repository is private: you need access to fixr-capstone.</span>
        </footer>
      </div>
    </dialog>
  );
}
