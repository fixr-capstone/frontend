import type { Finding, Severity } from "@/lib/findings";
import { FALSE_ALARM, byRule, firstSentence } from "@/lib/fixPrompt";

// Points lost per kind of issue; repeats of one kind add only a little, so 50 copies of one warning is not 50 problems.
const WEIGHT: Record<Severity, number> = { critical: 35, high: 20, medium: 8, low: 2 };
const SEVERITIES: Severity[] = ["critical", "high", "medium", "low"];
const DETAILED = 25;

export type Grade = { letter: "A" | "B" | "C" | "D" | "F"; score: number; real: Finding[]; falseAlarms: number; counts: Record<Severity, number> };

/** A letter grade from the real findings, ignoring those Fixr's review judged false alarms. */
export function grade(findings: Finding[]): Grade {
  const real = findings.filter((f) => !FALSE_ALARM.test(f.description));
  let penalty = 0;
  for (const [, items] of byRule(real)) {
    const worst = SEVERITIES.find((s) => items.some((f) => f.severity === s)) ?? "low";
    penalty += WEIGHT[worst] * (1 + Math.log10(items.length));
  }
  const score = Math.max(0, Math.round(100 - penalty));
  const letter = score >= 90 ? "A" : score >= 75 ? "B" : score >= 60 ? "C" : score >= 40 ? "D" : "F";
  const counts = Object.fromEntries(SEVERITIES.map((s) => [s, real.filter((f) => f.severity === s).length])) as Record<Severity, number>;
  return { letter, score, real, falseAlarms: findings.length - real.length, counts };
}

/** One line under the grade: how much there is, and what to fix first. */
export function verdict({ real, counts, falseAlarms }: Grade): string {
  if (!real.length) return "No real security issues found.";
  const serious = counts.critical + counts.high;
  const alarms = falseAlarms ? `, plus ${falseAlarms} likely false ${falseAlarms === 1 ? "alarm" : "alarms"}` : "";
  const lead = serious
    ? `${serious} serious ${serious === 1 ? "issue" : "issues"} among ${real.length} worth fixing${alarms}.`
    : `${real.length} ${real.length === 1 ? "issue" : "issues"} worth fixing, none serious${alarms}.`;
  const top = real[0];
  return `${lead} Fix first: ${top.title} in ${top.file}${top.line ? `:${top.line}` : ""}.`;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const where = (f: Finding) => esc(`${f.file}${f.line ? `:${f.line}` : ""}`);

/** A printable HTML report of the scan, for saving as PDF from the browser's print dialog. */
export function buildReport(findings: Finding[], notes: Finding[], project: string): string {
  const g = grade(findings);
  const detailed = g.real.filter((f) => f.severity !== "low" || f.suggestedFix).slice(0, DETAILED);
  const rest = g.real.filter((f) => !detailed.includes(f));
  const date = new Date().toLocaleString(undefined, { dateStyle: "long", timeStyle: "short" });

  const items = detailed.map((f, i) => `
    <article class="f">
      <h3><span class="n">${i + 1}</span>${esc(f.title)} <span class="sev sev--${f.severity}">${f.severity}</span></h3>
      <p class="meta">${where(f)}${f.rule ? ` · ${esc(f.rule)}` : ""}</p>
      ${f.snippet ? `<pre>${esc(f.snippet)}</pre>` : ""}
      <p>${esc(f.description)}</p>
      ${f.suggestedFix ? `<p class="label">Suggested fix</p><pre class="fix">${esc(f.suggestedFix)}</pre>` : ""}
    </article>`).join("");

  const groups = byRule(rest).map(([rule, list]) => `
    <tr><td>${esc(rule)}</td><td>${esc(list[0].title)}</td><td>${list[0].severity}</td><td class="num">${list.length}</td>
    <td>${list.slice(0, 4).map(where).join(", ")}${list.length > 4 ? ` +${list.length - 4} more` : ""}</td></tr>`).join("");

  const falseAlarms = findings.filter((f) => !g.real.includes(f)).map((f) =>
    `<li><b>${where(f)}</b> ${esc(f.title.replace(/\.$/, ""))}. ${esc(firstSentence(f.description))}</li>`).join("");

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Fixr report: ${esc(project)}</title>
<style>
  @page { margin: 16mm; }
  * { box-sizing: border-box; }
  body { margin: 0 auto; max-width: 820px; padding: 32px; font: 14px/1.55 system-ui, sans-serif; color: #15181c; background: #fff; }
  h1 { margin: 0; font-size: 26px; } h2 { margin: 32px 0 12px; font-size: 18px; border-bottom: 2px solid #15181c; padding-bottom: 6px; }
  h3 { margin: 0; font-size: 15px; display: flex; gap: 8px; align-items: baseline; flex-wrap: wrap; }
  .sub { margin: 4px 0 0; color: #5b636e; }
  .grade { display: flex; gap: 18px; align-items: center; margin-top: 24px; padding: 18px 20px; border: 1px solid #d5dae0; border-radius: 4px; }
  .grade__letter { font-size: 64px; font-weight: 800; line-height: 1; width: 72px; text-align: center; }
  .grade p { margin: 0; }
  .A, .B { color: #128a5a; } .C { color: #b7791f; } .D, .F { color: #c53030; }
  .counts { display: flex; gap: 16px; margin-top: 8px !important; color: #5b636e; flex-wrap: wrap; }
  .f { padding: 16px 0; border-bottom: 1px solid #e4e7eb; break-inside: avoid; }
  .n { display: inline-grid; place-items: center; min-width: 22px; height: 22px; border-radius: 50%; background: #15181c; color: #fff; font-size: 12px; }
  .meta { margin: 4px 0 8px; font: 12px ui-monospace, monospace; color: #5b636e; }
  .label { margin: 10px 0 4px; font-weight: 600; }
  pre { margin: 8px 0; padding: 10px 12px; background: #f4f6f8; border-radius: 4px; font: 12px/1.5 ui-monospace, monospace; white-space: pre-wrap; word-break: break-word; }
  pre.fix { background: #ebf8f1; }
  .sev { font: 600 11px ui-monospace, monospace; text-transform: uppercase; padding: 2px 6px; border-radius: 3px; background: #edf0f3; }
  .sev--critical, .sev--high { background: #fde8e8; color: #c53030; } .sev--medium { background: #fdf3e1; color: #b7791f; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; } th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #e4e7eb; vertical-align: top; }
  td:last-child { font: 12px ui-monospace, monospace; word-break: break-all; } .num { text-align: right; }
  ul { padding-left: 18px; } li { margin: 4px 0; }
  .foot { margin-top: 32px; color: #5b636e; font-size: 12px; }
  @media print { body { padding: 0; } }
</style></head><body>
<h1>Fixr security report</h1><p class="sub">${esc(project)} · ${esc(date)}</p>
<div class="grade">
  <div class="grade__letter ${g.letter}">${g.letter}</div>
  <div>
    <p><b>Security score ${g.score}/100.</b> ${esc(verdict(g))}</p>
    <p class="counts">${SEVERITIES.filter((s) => g.counts[s]).map((s) => `<span>${g.counts[s]} ${s}</span>`).join("")}<span>${g.falseAlarms} likely false ${g.falseAlarms === 1 ? "alarm" : "alarms"}</span><span>${notes.length} style ${notes.length === 1 ? "note" : "notes"}</span></p>
  </div>
</div>
${detailed.length ? `<h2>Fix these first (${detailed.length})</h2>${items}` : ""}
${rest.length ? `<h2>Lower-priority issues (${rest.length})</h2><table><thead><tr><th>Rule</th><th>Issue</th><th>Severity</th><th class="num">Count</th><th>Where</th></tr></thead><tbody>${groups}</tbody></table>` : ""}
${falseAlarms ? `<h2>Likely false alarms</h2><p>Fixr's review judged these harmless in this code.</p><ul>${falseAlarms}</ul>` : ""}
<p class="foot">Scanned by Fixr: Bandit, pip-audit, deptry and flake8, filtered by an XGBoost false-alarm classifier, explained by an LLM. Results are guidance, not a security audit.</p>
</body></html>`;
}
