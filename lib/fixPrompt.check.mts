// Run: node lib/fixPrompt.check.mts (.mts keeps it outside tsconfig, so the .ts import needs no config change)
import assert from "node:assert/strict";
import type { Finding } from "@/lib/findings";
import { buildFixPrompt } from "./fixPrompt.ts";

const f = (id: string, over: Partial<Finding>): Finding => ({
  id, severity: "low", title: "t", description: "d", file: "app.py", line: 1, snippet: "", suggestedFix: "", ...over,
});

const findings = [
  f("sql", { severity: "high", rule: "B608", title: "SQL injection", description: "Builds SQL from input.", suggestedFix: "db.execute(q, (name,))" }),
  f("fp", { severity: "high", rule: "B105", title: "Possible hardcoded password", description: "It is an enum value. The finding is a false positive; no code change is required.", suggestedFix: "os.getenv('X')" }),
  ...Array.from({ length: 300 }, (_, i) => f(`a${i}`, { rule: "B101", title: "Use of assert detected.", file: i % 2 ? "tests/test_x.py" : "src/x.py", line: i + 1 })),
  ...["pydantic", "dotenv"].map((n, i) => f(`d${i}`, { rule: "DEP003", title: `'${n}' imported but it is a transitive dependency` })),
  ...["client", "cryptography"].map((n, i) => f(`m${i}`, { rule: "DEP001", title: `'${n}' imported but missing from the dependency definitions`, file: "proj/client/main.py" })),
];
const notes = [
  ...Array.from({ length: 40 }, (_, i) => f(`e${i}`, { rule: "E501", title: `line too long (${90 + i} > 79 characters)`, style: true, line: i + 1 })),
  f("p", { rule: "E203", title: "whitespace before ':'", style: true }),
];
const out = buildFixPrompt(findings, notes);
const section = (name: string) => out.split(`## ${name}`)[1]?.split("\n## ")[0] ?? "";

assert.match(section("Fix these"), /SQL injection/);
assert.doesNotMatch(section("Fix these"), /hardcoded password/, "a false alarm must not be listed as a fix");
assert.doesNotMatch(out, /os\.getenv\('X'\)/, "a false alarm's suggested fix must be dropped");
assert.match(section("Likely false alarms"), /enum value/);
assert.match(out, /### B101: Use of assert detected\. \(300 places\)/);
assert.match(out, /150 of these are in test files/);
assert.match(out, /### DEP003: '…' imported but it is a transitive dependency \(2 places\)\n\n- Severity: low\n- Names: `pydantic`, `dotenv`/);
assert.match(out, /`client` is a folder or module of this project, not an installed package/, "the project's own folders are not missing packages");
assert.doesNotMatch(out, /`cryptography` is a folder/);
assert.match(section("Optional style clean-up"), /- E501: line too long \(40\)/, "style is summarised, without one line's numbers");
assert.match(section("Optional style clean-up"), /whitespace before ':'/, "punctuation in a title is not a name");
assert.doesNotMatch(section("Optional style clean-up"), /app\.py/, "style notes list no locations");
assert.ok(out.length < 12_000, `prompt too long: ${out.length}`);
console.log("fixPrompt ok,", out.length, "chars");
