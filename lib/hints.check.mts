// Run: node lib/hints.check.mts — each rule marks the characters a person has to change.
import assert from "node:assert/strict";
import { markSpan } from "./hints.ts";

const mark = (line: string, rule: string, extra: object = {}) => {
  const span = markSpan(line, { id: "x", severity: "high", title: "", description: "", file: "a.py", line: 1, snippet: "", suggestedFix: "", rule, ...extra });
  return span && line.slice(...span);
};

assert.equal(mark('API_TOKEN = "sk-live-4f9a"', "B105"), '"sk-live-4f9a"');
assert.equal(mark(`    query = "SELECT * FROM users WHERE id = '" + user_id + "'"`, "B608"), `"SELECT * FROM users WHERE id = '" + user_id + "'"`);
assert.equal(mark("    return hashlib.md5(password.encode()).hexdigest()", "B324"), "hashlib.md5");
assert.equal(mark("    return requests.get(url, headers=h).json()", "B113"), "requests.get(");
assert.equal(mark("    except:", "E722"), "except:");
assert.equal(mark("import os", "F401", { title: "'os' imported but unused" }), "os");
// no pattern: from the reported column to the end of the line
assert.equal(mark("    x = thing()", "B999", { column: 8 }), "thing()");
assert.equal(mark(`    db.execute("DELETE FROM users WHERE id = " + user_id)`, "B608"), `"DELETE FROM users WHERE id = " + user_id`);
assert.equal(mark("app.config['SECRET_KEY_HMAC'] = 'secret'", "B105"), "'secret'");
assert.equal(mark("from jwt.exceptions import DecodeError", "DEP001", { title: "'jwt' imported but missing from the dependency definitions" }), "jwt");
console.log("hints ok");
