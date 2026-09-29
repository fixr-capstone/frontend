import type { Finding } from "@/lib/findings";

const SECRET_RULES = new Set(["B105", "B106", "B107"]);
// Detail costs the AI tool context; past this, findings are listed by rule instead.
const DETAILED = 25;
const LOCATIONS = 12;
const SNIPPET_LINES = 15;
// Fixr's explanation already judged these harmless; listing them as fixes invites pointless edits.
const FALSE_ALARM = /\bfalse (positive|alarm)\b|no (code )?change is (required|needed)|no action is (required|needed)|\bis harmless\b/i;

const block = (code: string) => {
  const lines = code.split("\n");
  return "```python\n" + lines.slice(0, SNIPPET_LINES).join("\n") + (lines.length > SNIPPET_LINES ? "\n# ..." : "") + "\n```";
};
const where = (f: Finding) => `\`${f.file}${f.line ? `:${f.line}` : ""}\``;
const firstSentence = (s: string) => s.replace(/\s+/g, " ").trim().split(/(?<=[.!?])\s/)[0];
const isTest = (file: string) => /(^|\/)(tests?|testing)\/|(^|\/)test_[^/]*\.py$|_test\.py$/.test(file);

function byRule(items: Finding[]) {
  const groups = new Map<string, Finding[]>();
  for (const f of items) {
    const key = f.rule ?? f.title;
    groups.set(key, [...(groups.get(key) ?? []), f]);
  }
  return [...groups.entries()].sort((a, b) => b[1].length - a[1].length);
}

// Titles like "'pydantic' imported but ..." name one package; a group needs the pattern and every name.
const generic = (title: string) => title.replace(/'[^']+'/g, "'…'");
function names(items: Finding[]) {
  const all = [...new Set(items.flatMap((f) => [...f.title.matchAll(/'([^']+)'/g)].map((m) => m[1])))];
  if (all.length < 2) return "";
  return all.slice(0, 20).map((n) => `\`${n}\``).join(", ") + (all.length > 20 ? ` and ${all.length - 20} more` : "");
}

function locations(items: Finding[]) {
  const shown = items.slice(0, LOCATIONS).map(where).join(", ");
  return items.length > LOCATIONS ? `${shown} and ${items.length - LOCATIONS} more` : shown;
}

/** A Markdown brief the user hands to the AI tool that wrote their code, so it can fix the findings safely. */
export function buildFixPrompt(findings: Finding[], notes: Finding[]): string {
  const falseAlarms = findings.filter((f) => FALSE_ALARM.test(f.description));
  const real = findings.filter((f) => !falseAlarms.includes(f));
  // Findings arrive ranked, so the first worth detailing are the most serious.
  const worthDetail = real.filter((f) => f.severity !== "low" || f.suggestedFix);
  const detailed = worthDetail.slice(0, DETAILED);
  const rest = real.filter((f) => !detailed.includes(f));
  const hasSecret = detailed.some((f) => f.rule && SECRET_RULES.has(f.rule));

  const out = [
    "# Security fixes for this project",
    "",
    "You are helping someone fix security problems that Fixr, an automated scanner, found in their Python code. They may not be a developer and may not be able to review code changes, so work carefully and explain in plain words.",
    "",
    `Fixr found ${findings.length} ${findings.length === 1 ? "issue" : "issues"}: ${detailed.length} to fix, ${rest.length} lower-priority ${rest.length === 1 ? "one" : "ones"} grouped by type, and ${falseAlarms.length} likely false ${falseAlarms.length === 1 ? "alarm" : "alarms"}.`,
    "",
    "## How to work",
    "",
    "1. Fix the issues under \"Fix these\" one at a time, in the order listed. The most serious come first.",
    "2. Change only what each fix needs. Do not refactor, rename or reformat unrelated code.",
    "3. Keep the program doing what it does today, apart from closing the security hole.",
    "4. If a fix needs a new setting, secret or package, tell the person exactly what to do, step by step.",
    "5. If an issue looks like a false alarm in this code, say why and leave the code alone.",
    "6. After each fix, explain in one or two plain sentences what changed and why it matters.",
    "7. Do not touch the \"Likely false alarms\". Handle the lower-priority groups only after the main fixes, and only if the person agrees.",
    "8. If the project has tests, run them after the changes.",
    "",
  ];
  if (hasSecret) {
    out.push(
      "> **A secret may be written in the code.** If it is a real key or password, moving it out of the code is not enough: anyone who saw the code may already have it. Tell the person to create a new one with the service that issued it and delete the old one.",
      "",
    );
  }

  if (detailed.length) {
    out.push(`## Fix these (${detailed.length})`, "");
    detailed.forEach((f, i) => {
      out.push(`### ${i + 1}. ${f.title}`, "", `- Severity: ${f.severity}`, `- Where: ${where(f)}`);
      if (f.rule) out.push(`- Scanner rule: ${f.rule}`);
      out.push("");
      if (f.snippet) out.push("Flagged code:", "", block(f.snippet), "");
      out.push("What is wrong:", "", f.description, "");
      if (f.suggestedFix) out.push("Suggested fix (a starting point, adapt it to the surrounding code):", "", block(f.suggestedFix), "");
    });
  }

  if (rest.length) {
    out.push("## Lower-priority issues, grouped by type", "", "Each group is one pattern. Fix a group the same way everywhere, or explain why it is safe here.", "");
    for (const [rule, items] of byRule(rest)) {
      const tests = items.filter((f) => isTest(f.file)).length;
      const named = names(items);
      out.push(`### ${rule}: ${named ? generic(items[0].title) : items[0].title} (${items.length} ${items.length === 1 ? "place" : "places"})`, "", `- Severity: ${items[0].severity}`);
      if (named) out.push(`- Names: ${named}`);
      out.push(`- Where: ${locations(items)}`);
      if (tests === items.length) out.push("- All of these are in test files, where this is usually expected. Leave them unless the person asks.");
      else if (tests) out.push(`- ${tests} of these are in test files, where this is usually expected.`);
      out.push("");
    }
  }

  if (falseAlarms.length) {
    out.push("## Likely false alarms, leave these alone", "", "Fixr's review found these are not real problems in this code. Do not change them.", "");
    falseAlarms.forEach((f) => out.push(`- ${where(f)} ${f.rule ?? ""} ${f.title}. ${firstSentence(f.description)}`));
    out.push("");
  }

  if (notes.length) {
    out.push("## Optional style clean-up", "", "These are not security problems. Only fix them if the person asks.", "");
    for (const [rule, items] of byRule(notes)) out.push(`- ${rule}: ${names(items) ? generic(items[0].title) : items[0].title} (${items.length}): ${locations(items)}`);
    out.push("");
  }

  out.push(
    "## When you are done",
    "",
    "Give the person a short summary: which issues you fixed, which you left and why, and anything they must do themselves.",
    "",
  );
  return out.join("\n");
}
