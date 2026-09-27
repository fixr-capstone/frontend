import type { Finding } from "@/lib/findings";

const SECRET_RULES = new Set(["B105", "B106", "B107"]);

const block = (code: string) => "```python\n" + code + "\n```";

/** A Markdown brief the user hands to the AI tool that wrote their code, so it can fix the findings safely. */
export function buildFixPrompt(findings: Finding[], notes: Finding[]): string {
  const hasSecret = findings.some((f) => f.rule && SECRET_RULES.has(f.rule));
  const out = [
    "# Security fixes for this project",
    "",
    "You are helping someone fix security problems that Fixr, an automated scanner, found in their Python code. They may not be a developer and may not be able to review code changes, so work carefully and explain in plain words.",
    "",
    "## How to work",
    "",
    "1. Fix the issues below one at a time, in the order listed. The most serious come first.",
    "2. Change only what each fix needs. Do not refactor, rename or reformat unrelated code.",
    "3. Keep the program doing what it does today, apart from closing the security hole.",
    "4. If a fix needs a new setting, secret or package, tell the person exactly what to do, step by step.",
    "5. If an issue looks like a false alarm in this code, say why and leave the code alone.",
    "6. After each fix, explain in one or two plain sentences what changed and why it matters.",
    "7. If the project has tests, run them after the changes.",
    "",
  ];
  if (hasSecret) {
    out.push(
      "> **A secret is written in the code.** Moving it out of the code is not enough: anyone who saw the code may already have it. Tell the person to create a new key or password with the service that issued it and delete the old one.",
      "",
    );
  }
  out.push(`## Issues to fix (${findings.length})`, "");
  findings.forEach((f, i) => {
    out.push(`### ${i + 1}. ${f.title}`, "", `- Severity: ${f.severity}`, `- Where: \`${f.file}\`${f.line ? `, line ${f.line}` : ""}`);
    if (f.rule) out.push(`- Scanner rule: ${f.rule}`);
    out.push("");
    if (f.snippet) out.push("Flagged code:", "", block(f.snippet), "");
    out.push("What is wrong:", "", f.description, "");
    if (f.suggestedFix) out.push("Suggested fix (a starting point, adapt it to the surrounding code):", "", block(f.suggestedFix), "");
  });
  if (notes.length) {
    out.push("## Optional style clean-up", "", "These are not security problems. Only fix them if the person asks.", "");
    notes.forEach((n) => out.push(`- \`${n.file}:${n.line}\` ${n.description}`));
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
