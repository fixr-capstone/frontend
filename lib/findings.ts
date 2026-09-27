import samples from "@/lib/samples.json";
import { toFinding, type ApiFinding } from "@/lib/api";

export type Severity = "critical" | "high" | "medium" | "low";

export type Finding = {
  id: string;
  severity: Severity;
  title: string;
  description: string;
  file: string;
  line: number;
  snippet: string;
  suggestedFix: string;
  style?: boolean;
};

export type ExampleKey = "messy" | "minor" | "clean";

export const SEVERITY_COLOR: Record<Severity, string> = {
  critical: "#FF5C5C",
  high: "#FF9F45",
  medium: "#F5C84C",
  low: "#8B7CFF",
};

export const EXAMPLES: Record<ExampleKey, { label: string; code: string }> = {
  messy: {
    label: "Messy example",
    code: `import hashlib
import os
import random
import requests

API_TOKEN = "sk-live-4f9a2b8c1d3e4f5a6b7c8d9e0f1a2b3c"

def cache_key(payload):
    return hashlib.md5(payload.encode()).hexdigest()

def retry_delay(attempt):
    return 2 ** attempt + random.random()

def get_user(user_id):
    query = "SELECT * FROM users WHERE id = '" + user_id + "'"
    result = db.execute(query)
    return result

def delete_account(user_id):
    db.execute("DELETE FROM users WHERE id = " + user_id)
    return {"status": "deleted"}

def fetch_external_data(url):
    try:
        return requests.get(url, headers={"Authorization": API_TOKEN}).json()
    except:
        pass
`,
  },
  minor: {
    label: "Minor issue",
    code: `import requests

def fetch_profile(user_id):
    resp = requests.get("https://api.internal/users/" + str(user_id))
    resp.raise_for_status()
    return resp.json()
`,
  },
  clean: {
    label: "Clean file",
    code: `import sqlite3

def get_user(conn, user_id, current_user):
    if current_user.id != user_id and not current_user.is_admin:
        raise PermissionError("not allowed")
    cur = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,))
    return cur.fetchone()
`,
  },
};

/** Prepared results: the real backend output for each sample, snapshotted to lib/samples.json. */
export async function getResults(example: ExampleKey | null): Promise<{ raw: number; findings: Finding[] }> {
  if (!example) return { raw: 0, findings: [] };
  const { raw, findings } = samples[example];
  return { raw, findings: (findings as unknown as ApiFinding[]).map(toFinding) };
}
