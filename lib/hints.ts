import type { Finding } from "@/lib/findings";

/**
 * Where to look and what to change, per scanner rule. Written by hand, so every finding gets a precise,
 * consistent instruction even when the LLM explanation is missing. It tells the user what to change; it
 * never changes their code.
 */
export type Hint = { mark?: RegExp; change: string; check?: string };

const XML: Hint = {
  mark: /\b(?:xml\.\w+(?:\.\w+)*|ElementTree|etree|minidom|pulldom|sax|expatreader)\b/,
  change: "If this XML can come from a user or the network, parse it with defusedxml instead (same API: defusedxml.ElementTree.parse). For your own config files this is safe to leave.",
};
const SECRET: Hint = {
  // the value being assigned, not a dictionary key such as config['SECRET_KEY']
  mark: /(?<=[=:(,]\s*)(["'])(?:(?!\1).)+\1/,
  change: "Move this value out of the code: read it from an environment variable (os.environ[\"API_TOKEN\"]) or a secrets manager. It is already exposed, so revoke it and issue a new one.",
  check: "Search the repository and its git history for the old value.",
};
const SHELL: Hint = {
  mark: /shell\s*=\s*True|os\.system|os\.popen|subprocess\.getoutput/,
  change: "Pass the command as a list of arguments without shell=True, so input can't smuggle in extra shell commands.",
};

const HINTS: Record<string, Hint> = {
  B105: SECRET, B106: SECRET, B107: SECRET,
  B608: {
    // from the opening quote of the SQL string to the end of the expression, closing brackets aside
    mark: /f?(["'])(?=[^"']*\b(?:SELECT|INSERT|UPDATE|DELETE|WHERE|FROM|INTO|SET)\b).*?(?=\)*\s*$)/i,
    change: "Stop building SQL with +, % or f-strings. Put a placeholder (? or %s) in the query and pass the value separately: execute(query, (value,)).",
    check: "The query string should contain no user value at all.",
  },
  B324: {
    mark: /hashlib\.(?:md5|sha1)\b|hashlib\.new\(\s*["'](?:md5|sha1)["']/i,
    change: "For passwords, use a slow salted hash: bcrypt, argon2 or hashlib.scrypt. For non-security uses such as cache keys, pass usedforsecurity=False.",
  },
  B303: { mark: /\b(?:md5|sha1|MD5|SHA1)\b/, change: "Use SHA-256 or stronger; for passwords, a slow salted hash (bcrypt, argon2)." },
  B311: {
    mark: /random\.\w+/,
    change: "If this value protects anything (tokens, passwords, IDs, reset codes), use the secrets module instead. For jitter, games or sampling, random is fine.",
  },
  B113: {
    mark: /requests\.(?:get|post|put|patch|delete|head|options|request)\(/,
    change: "Add timeout=10 (seconds) to this call, so a slow or hostile server can't hang your app.",
  },
  B110: { mark: /except[^:]*:|\bpass\b/, change: "Don't swallow the error silently: log it, or catch only the exception you expect." },
  B112: { mark: /except[^:]*:|\bcontinue\b/, change: "Don't skip errors silently: log them, or catch only the exception you expect." },
  B602: SHELL, B604: SHELL, B605: SHELL,
  B603: { mark: /subprocess\.\w+/, change: "Check that no part of the command comes from user input, and call the program by its full path." },
  B607: { mark: /subprocess\.\w+|os\.\w+/, change: "Call the program by its full path, so a planted program on PATH can't run instead." },
  B404: { mark: /subprocess/, change: "Importing subprocess is only a pointer: check how it is called further down." },
  B307: { mark: /\beval\(/, change: "Replace eval: ast.literal_eval for data, explicit parsing otherwise. Never eval text from a user or a file." },
  B102: { mark: /\bexec\(/, change: "Remove exec, or make sure it never runs text that came from a user, a file or the network." },
  B301: { mark: /\b(?:c?[Pp]ickle|dill|shelve)\.\w+/, change: "Don't unpickle data you didn't create yourself: unpickling can run code. Use JSON for anything from outside." },
  B403: { mark: /\b(?:c?[Pp]ickle|dill|shelve)\b/, change: "Check where the unpickled data comes from: only load pickles you created yourself." },
  B506: { mark: /yaml\.load\(/, change: "Use yaml.safe_load instead of yaml.load." },
  B501: { mark: /verify\s*=\s*False/, change: "Remove verify=False. Fix the certificate, or point verify at your CA bundle." },
  B104: { mark: /["']0\.0\.0\.0["']/, change: "Bind to 127.0.0.1 unless other machines really must reach this service." },
  B201: { mark: /debug\s*=\s*True/, change: "Turn debug off outside development: read it from an environment variable that defaults to off." },
  B108: { mark: /["']\/(?:tmp|var\/tmp)[^"']*["']/, change: "Create temporary files with tempfile.mkstemp or NamedTemporaryFile, not a fixed path." },
  B701: { mark: /autoescape\s*=\s*False|Environment\(/, change: "Turn on autoescaping: Environment(autoescape=True), or select_autoescape()." },
  E722: { mark: /except\s*:/, change: "Catch a specific exception (except ValueError:) instead of everything, including Ctrl+C." },
  DEP001: { change: "Add this package to requirements.txt or pyproject.toml, so a fresh install doesn't fail." },
  DEP002: { change: "Remove this unused package from your dependency file." },
  DEP003: { change: "Declare this package directly in your dependency file instead of relying on another package to pull it in." },
  DEP004: { change: "Move this package out of the development dependencies: the app imports it at run time." },
};
for (const r of ["B313", "B314", "B315", "B316", "B317", "B318", "B319", "B320", "B405", "B406", "B407", "B408", "B409", "B410"]) HINTS[r] = XML;

const DEPENDENCY: Hint = {
  change: "Upgrade this package to a version with the fix (the advisory lists it), update your requirements file and reinstall.",
  check: "Re-scan: the advisory should no longer match.",
};

/** The quoted name in messages like "'os' imported but unused" or "undefined name 'db'". */
const quotedName = (title: string) => title.match(/'([A-Za-z_][\w.]*)'/)?.[1];
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function hintFor(f: Finding): Hint | null {
  if (f.kind === "dependency" && !f.rule?.startsWith("DEP")) return DEPENDENCY;
  if (f.rule === "F401") {
    const name = quotedName(f.title);
    return { mark: name ? new RegExp(`\\b${escape(name.split(".").pop()!)}\\b`) : undefined, change: "Remove this unused import." };
  }
  if (f.rule === "F821") {
    const name = quotedName(f.title);
    return { mark: name ? new RegExp(`\\b${escape(name)}\\b`) : undefined, change: "Define or import this name: as written, the line fails when it runs." };
  }
  const hint = (f.rule && HINTS[f.rule]) || null;
  // deptry names the package: mark it in the import line
  if (hint && f.rule?.startsWith("DEP")) {
    const name = quotedName(f.title);
    return name ? { ...hint, mark: new RegExp(`\\b${escape(name)}\\b`) } : hint;
  }
  return hint;
}

/** [start, end) of the characters to mark in the flagged line: the rule's pattern, else from the reported column. */
export function markSpan(line: string, f: Finding): [number, number] | null {
  const m = hintFor(f)?.mark?.exec(line);
  if (m && m[0].trim()) return [m.index, m.index + m[0].trimEnd().length];
  const end = line.trimEnd().length;
  const start = f.column != null && f.column < end ? f.column : line.length - line.trimStart().length;
  return start < end ? [start, end] : null;
}
