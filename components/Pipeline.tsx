"use client";

import { useEffect, useRef, useState } from "react";
import { SEVERITY_COLOR, getResults, type Finding } from "@/lib/findings";
import { COUNTS, EXPLAINED, KIND, REAL_AT, REST, TOTAL, noiseHeight } from "@/lib/signal";

/** The order here is the real order of the Fixr pipeline. */
const STAGES = [
  {
    verb: "Scan",
    body: "Four Python scanners run over the code, each looking for a different kind of problem.",
    detail: "Bandit, pip-audit, deptry, flake8",
    count: COUNTS.raw,
    label: "raw warnings",
  },
  {
    verb: "Filter",
    body: "A classifier drops the Bandit warnings that are most likely false alarms. It reads the flagged line, not just the rule name.",
    detail: "XGBoost, trained on OWASP Benchmark for Python",
    count: COUNTS.kept,
    label: "kept",
  },
  {
    verb: "Rank",
    body: "What survives is ordered by how serious it is and how likely it is to be real. Style notes go to the bottom.",
    detail: "severity weighted by true-positive probability",
    count: COUNTS.real,
    label: "worth fixing",
  },
  {
    verb: "Explain",
    body: "The top findings get a plain explanation and a fix, written from the function they sit in.",
    detail: "LLM, top five findings only",
    count: COUNTS.explained,
    label: "explained",
  },
];

export default function Pipeline() {
  const listRef = useRef<HTMLOListElement>(null);
  const [active, setActive] = useState(0);
  // In state: React rewrites className on re-render, wiping classes added by hand.
  const [seen, setSeen] = useState<ReadonlySet<number>>(new Set());
  const [real, setReal] = useState<Finding[]>([]);

  useEffect(() => {
    getResults("messy").then((r) => setReal(r.findings.filter((f) => !f.style)));
  }, []);

  useEffect(() => {
    const items = listRef.current?.querySelectorAll<HTMLElement>(".stage");
    if (!items) return;

    // Reveal: a stage lights up once, as it comes into view.
    const reveal = new IntersectionObserver(
      (entries) => {
        const hits = entries.filter((e) => e.isIntersecting).map((e) => Number((e.target as HTMLElement).dataset.index));
        if (hits.length) setSeen((prev) => new Set([...prev, ...hits]));
      },
      { rootMargin: "0px 0px -35% 0px" },
    );
    // Focus: the stage crossing the middle of the viewport drives the funnel.
    const focus = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.index));
        }
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );
    items.forEach((el) => { reveal.observe(el); focus.observe(el); });
    return () => { reveal.disconnect(); focus.disconnect(); };
  }, []);

  const stage = STAGES[active];
  const phase = ["", "s1", "s1 s2", "s1 s2 s3"][active];

  return (
    <section className="wrap pipeline" id="how">
      <div className="pipeline__head">
        <h2 className="h2" data-reveal>From scanner noise to a short list</h2>
        <p className="pipeline__lede" data-reveal>
          Scanners are good at finding patterns. They are bad at knowing which ones matter.
        </p>

        <div data-reveal>
        <figure className={`funnel ${phase}`} style={{ ["--n" as string]: TOTAL }} aria-label={`${stage.count} ${stage.label}`}>
          <div className="funnel__count" aria-hidden="true">
            <span className="funnel__num" key={active}>{stage.count}</span>
            <span className="funnel__label" key={`l${active}`}>{stage.label}</span>
          </div>
          <div className="funnel__strip" aria-hidden="true">
            {Array.from({ length: TOTAL }, (_, i) => {
              const rank = REAL_AT.indexOf(i);
              const finding = rank >= 0 ? real[rank] : undefined;
              return (
                <span
                  key={i}
                  className={`tick tick--${KIND[i]} ${finding && !EXPLAINED[rank] ? "tick--unexplained" : ""}`}
                  style={{
                    ["--i" as string]: i,
                    ["--h" as string]: noiseHeight(i),
                    ["--rest" as string]: finding ? REST[finding.severity] : 0,
                    ["--rank" as string]: rank,
                    ["--c" as string]: finding ? SEVERITY_COLOR[finding.severity] : undefined,
                  }}
                />
              );
            })}
          </div>
          <figcaption className="funnel__caption">The messy sample, at the {stage.verb.toLowerCase()} stage</figcaption>
        </figure>
        </div>
      </div>

      <ol className="stages" ref={listRef}>
        {STAGES.map((s, i) => (
          <li className={`stage ${seen.has(i) ? "is-in" : ""} ${i === active ? "is-active" : ""}`} key={s.verb} data-index={i}>
            <h3 className="stage__verb">{s.verb}</h3>
            <p className="stage__body">{s.body}</p>
            <p className="stage__detail">{s.detail}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
