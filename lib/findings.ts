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
};

export type ExampleKey = "messy" | "minor" | "clean";

export const SEVERITY_COLOR: Record<Severity, string> = {
  critical: "#FF5C5C",
  high: "#FF9F45",
  medium: "#F5C84C",
  low: "#8B7CFF",
};

const RANK: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 };

export const EXAMPLES: Record<ExampleKey, { label: string; code: string }> = {
  messy: {
    label: "Messy example",
    code: `import os
import requests

API_KEY = "sk-live-4f9a2b8c1d3e4f5a6b7c8d9e0f1a2b3c"

def get_user(user_id):
    query = "SELECT * FROM users WHERE id = '" + user_id + "'"
    result = db.execute(query)
    return result

def delete_account(user_id):
    db.execute("DELETE FROM users WHERE id = " + user_id)
    return {"status": "deleted"}

def fetch_external_data(url):
    try:
        return requests.get(url, headers={"Authorization": API_KEY}).json()
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

const FINDINGS: Record<ExampleKey, Finding[]> = {
  messy: [
    {
      id: "m1",
      severity: "critical",
      title: "Live API key committed in source",
      description:
        "API_KEY holds what looks like a real production secret. Anyone with read access to this repo, including anyone who forks a public project, already has your key. Rotate it, then load it from the environment.",
      file: "app.py",
      line: 4,
      snippet: 'API_KEY = "sk-live-4f9a2b8c1d3e4f5a6b7c8d9e0f1a2b3c"',
      suggestedFix: 'import os\n\nAPI_KEY = os.environ["API_KEY"]',
    },
    {
      id: "m2",
      severity: "critical",
      title: "SQL injection in get_user",
      description:
        'user_id is concatenated straight into the query string. A value like " OR 1=1 -- returns every user row, and a stacked statement can drop the table.',
      file: "app.py",
      line: 7,
      snippet: 'query = "SELECT * FROM users WHERE id = \'" + user_id + "\'"\nresult = db.execute(query)',
      suggestedFix: 'result = db.execute(\n    "SELECT * FROM users WHERE id = ?",\n    (user_id,),\n)',
    },
    {
      id: "m3",
      severity: "critical",
      title: "delete_account runs with no authorization check",
      description:
        "Nothing verifies who is calling this. Any request that reaches the handler can delete any account by id. Check the caller against the target before the delete runs.",
      file: "app.py",
      line: 11,
      snippet: 'def delete_account(user_id):\n    db.execute("DELETE FROM users WHERE id = " + user_id)',
      suggestedFix:
        'def delete_account(user_id, current_user):\n    if current_user.id != user_id and not current_user.is_admin:\n        raise PermissionError("not allowed")\n    db.execute("DELETE FROM users WHERE id = ?", (user_id,))',
    },
    {
      id: "m4",
      severity: "high",
      title: "SQL injection in delete_account",
      description:
        "Same concatenation pattern as get_user, but on a destructive statement. An injected value here deletes rows you did not intend to touch.",
      file: "app.py",
      line: 12,
      snippet: 'db.execute("DELETE FROM users WHERE id = " + user_id)',
      suggestedFix: 'db.execute("DELETE FROM users WHERE id = ?", (user_id,))',
    },
    {
      id: "m5",
      severity: "high",
      title: "Credentials forwarded to a caller-supplied URL",
      description:
        "fetch_external_data sends API_KEY in the Authorization header to whatever url it is given. A caller can point it at their own server and collect your key. Allow-list the hosts you actually call.",
      file: "app.py",
      line: 17,
      snippet: 'return requests.get(url, headers={"Authorization": API_KEY}).json()',
      suggestedFix:
        'ALLOWED = {"api.internal", "api.stripe.com"}\n\nhost = urlparse(url).hostname\nif host not in ALLOWED:\n    raise ValueError("host not allowed")\nreturn requests.get(url, headers={"Authorization": API_KEY}, timeout=10).json()',
    },
    {
      id: "m6",
      severity: "medium",
      title: "Bare except swallows every error",
      description:
        "except: pass hides network failures, auth errors, and bugs alike. Callers get None with no signal that anything failed, which is how silent data loss starts.",
      file: "app.py",
      line: 18,
      snippet: "except:\n    pass",
      suggestedFix: 'except requests.RequestException as exc:\n    logger.warning("external fetch failed: %s", exc)\n    raise',
    },
  ],
  minor: [
    {
      id: "n1",
      severity: "low",
      title: "HTTP request has no timeout",
      description:
        "Without a timeout this call can hang until the socket dies, tying up a worker. Nothing is exposed here, it is a resilience issue rather than a security hole.",
      file: "profile.py",
      line: 4,
      snippet: 'resp = requests.get("https://api.internal/users/" + str(user_id))',
      suggestedFix: 'resp = requests.get(\n    "https://api.internal/users/" + str(user_id),\n    timeout=10,\n)',
    },
  ],
  clean: [],
};

const RAW_COUNT: Record<ExampleKey, number> = { messy: 41, minor: 12, clean: 0 };

/**
 * The single seam between the UI and the scan backend.
 * Swap the body for a fetch when the API exists; the shape stays the same.
 */
export async function getResults(example: ExampleKey | null): Promise<{ raw: number; findings: Finding[] }> {
  if (!example) return { raw: 0, findings: [] };
  const findings = [...FINDINGS[example]].sort((a, b) => RANK[a.severity] - RANK[b.severity]);
  return { raw: RAW_COUNT[example], findings };
}
