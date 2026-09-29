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
];
const out = buildFixPrompt(findings, []);
const section = (name: string) => out.split(`## ${name}`)[1]?.split("\n## ")[0] ?? "";

assert.match(section("Fix these"), /SQL injection/);
assert.doesNotMatch(section("Fix these"), /hardcoded password/, "a false alarm must not be listed as a fix");
assert.doesNotMatch(out, /os\.getenv\('X'\)/, "a false alarm's suggested fix must be dropped");
assert.match(section("Likely false alarms"), /enum value/);
assert.match(out, /### B101: Use of assert detected\. \(300 places\)/);
assert.match(out, /150 of these are in test files/);
assert.match(out, /### DEP003: '…' imported but it is a transitive dependency \(2 places\)\n\n- Severity: low\n- Names: `pydantic`, `dotenv`/);
assert.ok(out.length < 12_000, `prompt too long: ${out.length}`);
console.log("fixPrompt ok,", out.length, "chars");
