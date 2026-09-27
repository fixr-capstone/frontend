"use client";

import { useEffect, useRef, useState } from "react";
import samples from "@/lib/samples.json";
import { EXAMPLES, SEVERITY_COLOR, type Severity } from "@/lib/findings";
import { toFinding, type ApiFinding } from "@/lib/api";
import { highlightLine } from "@/lib/highlight";

type Tag = { rule: string; kind: "drop" | "note" | "real"; severity?: Severity; rank?: number; explained?: boolean };

const { raw, dropped } = samples.messy;
const apiFindings = samples.messy.findings as unknown as ApiFinding[];
const kept = apiFindings.map(toFinding);
const real = kept.filter((f) => !f.style);
const explainedCount = apiFindings.filter((f) => f.metadata.explanation).length;
const lines = EXAMPLES.messy.code.replace(/\n$/, "").split("\n");

const tags = new Map<number, Tag[]>();
const add = (line: number, tag: Tag) => tags.set(line, [...(tags.get(line) ?? []), tag]);
dropped.forEach((d) => add(d.line ?? 0, { rule: d.rule_id, kind: "drop" }));
kept.forEach((f, i) => {
  add(f.line, f.style
    ? { rule: f.rule ?? "", kind: "note" }
    : { rule: f.rule ?? "", kind: "real", severity: f.severity, rank: real.indexOf(f), explained: !!apiFindings[i].metadata.explanation });
});

const top = real[0];
const topNote = top.description.split(/(?<=[.!?])\s+/)[0];

const STAGES = [
  {
    verb: "Scan",
    count: raw,
    label: "warnings",
    body: "Bandit, pip-audit, deptry and flake8 each read the file. Between them they flag every line that might be a problem, and most of it is noise.",
  },
  {
    verb: "Filter",
    count: kept.length,
    label: "left",
    body: `A classifier trained on labelled Bandit results drops the warnings most likely to be false alarms. Here it drops the md5 cache key on line ${dropped[0]?.line}.`,
  },
  {
    verb: "Rank",
    count: real.length,
    label: "worth fixing",
    body: "Style notes step aside. The rest are ordered by severity and by how sure the classifier is, so the leaked token comes first.",
  },
  {
    verb: "Explain",
    count: explainedCount,
    label: "explained",
    body: "The top findings get a plain-language explanation and a fix, written from the function each line sits in.",
  },
];

export default function Pipeline() {
  const ref = useRef<HTMLElement>(null);
  const [stage, setStage] = useState(0);

  useEffect(() => {
    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const el = ref.current;
        if (!el) return;
        const travel = el.offsetHeight - window.innerHeight;
        const p = travel > 0 ? Math.min(1, Math.max(0, -el.getBoundingClientRect().top / travel)) : 1;
        el.style.setProperty("--p", p.toFixed(4));
        setStage(p <= 0 ? -1 : Math.min(STAGES.length - 1, Math.floor(p * STAGES.length)));
      });
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("scroll", update); window.removeEventListener("resize", update); };
  }, []);

  const s = STAGES[Math.max(0, stage)];
  const phase = ["", "s0", "s0 s1", "s0 s1 s2", "s0 s1 s2 s3"][stage + 1];

  return (
    <section className={`how ${phase}`} id="how" ref={ref}>
      <div className="how__pin wrap">
        <div className="how__copy">
          <h2 className="how__title">What Fixr does to your file</h2>
          <div className="how__count" aria-live="polite">
            <span className="how__num" key={`n${stage}`}>{s.count}</span>
            <span className="how__label" key={`l${stage}`}>{s.label}</span>
          </div>
          <h3 className="how__verb" key={`v${stage}`}>{s.verb}</h3>
          <p className="how__body" key={`b${stage}`}>{s.body}</p>
          <button
            type="button"
            className="how__skip"
            onClick={() => {
              const el = document.getElementById("scanner");
              if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 88, behavior: "smooth" });
            }}
          >
            Skip to the scanner
          </button>
        </div>

        <figure className="console" aria-label={`The messy sample at the ${s.verb.toLowerCase()} stage`}>
          <div className="console__rail" aria-hidden="true">
            {STAGES.map((x, i) => (
              <span key={x.verb} className={i <= stage ? "is-on" : ""}>{x.verb}</span>
            ))}
            <i className="console__fill" />
          </div>
          <div className="console__file">app.py <span>messy sample, real scan output</span></div>
          <div className="console__code">
            {lines.map((text, i) => {
              const n = i + 1;
              const t = tags.get(n) ?? [];
              const lead = t.find((x) => x.kind === "real") ?? t.find((x) => x.kind === "note") ?? t[0];
              return (
                <div
                  key={n}
                  className={`cl ${lead ? `cl--${lead.kind}` : ""} ${lead?.explained ? "cl--explained" : ""}`}
                  style={{ ["--c" as string]: lead?.severity ? SEVERITY_COLOR[lead.severity] : undefined, ["--ln" as string]: i }}
                >
                  <span className="cl__rank">{lead?.rank !== undefined ? String(lead.rank + 1).padStart(2, "0") : ""}</span>
                  <span className="cl__n">{n}</span>
                  <span className="cl__text">{highlightLine(text)}</span>
                  <span className="cl__tags">
                    {t.map((x) => (
                      <b key={x.rule} className={`tag tag--${x.kind}`} style={{ ["--c" as string]: x.severity ? SEVERITY_COLOR[x.severity] : undefined }}>
                        {x.rule}
                      </b>
                    ))}
                  </span>
                </div>
              );
            })}
          </div>
          <figcaption className="console__note" style={{ ["--c" as string]: SEVERITY_COLOR[top.severity] }}>
            <span className="console__note-head">01 · {top.title}, line {top.line}</span>
            {topNote}
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
