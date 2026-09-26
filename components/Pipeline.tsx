"use client";

import { useEffect, useRef } from "react";

/** The order here is the real order of the Fixr pipeline. */
const STAGES = [
  {
    verb: "Scan",
    body: "Four Python scanners run over the code, each looking for a different kind of problem.",
    detail: "Bandit, pip-audit, deptry, flake8",
  },
  {
    verb: "Filter",
    body: "A classifier drops the Bandit warnings that are most likely false alarms. It reads the flagged line, not just the rule name.",
    detail: "XGBoost, trained on OWASP Benchmark for Python",
  },
  {
    verb: "Rank",
    body: "What survives is ordered by how serious it is and how likely it is to be real.",
    detail: "severity weighted by true-positive probability",
  },
  {
    verb: "Explain",
    body: "The top findings get a plain explanation and a fix, written from the function they sit in.",
    detail: "LLM, top five findings only",
  },
];

export default function Pipeline() {
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const items = listRef.current?.querySelectorAll<HTMLElement>(".stage");
    if (!items) return;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add("is-in")),
      { rootMargin: "0px 0px -35% 0px" },
    );
    items.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <section className="wrap pipeline" id="how">
      <div className="pipeline__head">
        <h2 className="h2">From scanner noise to a short list</h2>
        <p className="pipeline__lede">Scanners are good at finding patterns. They are bad at knowing which ones matter.</p>
      </div>

      <ol className="stages" ref={listRef}>
        {STAGES.map((s) => (
          <li className="stage" key={s.verb}>
            <h3 className="stage__verb">{s.verb}</h3>
            <p className="stage__body">{s.body}</p>
            <p className="stage__detail">{s.detail}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
