"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import samples from "@/lib/samples.json";
import { EXAMPLES } from "@/lib/findings";
import { toFinding, type ApiFinding } from "@/lib/api";
import CodeReview from "@/components/CodeReview";

const findings = (samples.messy.findings as unknown as ApiFinding[]).map(toFinding).filter((f) => !f.style);
const sources = { "app.py": EXAMPLES.messy.code };

/** The real review of the messy sample, live: open notes, copy a prompt, mark findings handled. */
export default function HomeReview() {
  const [handled, setHandled] = useState<Set<string>>(new Set());
  const toggle = useCallback((id: string) => setHandled((h) => {
    const next = new Set(h);
    if (!next.delete(id)) next.add(id);
    return next;
  }), []);
  return (
    <>
      <CodeReview findings={findings} sources={sources} handled={handled} onHandled={toggle} focus={null} />
      <p className="demo__foot">
        {handled.size} of {findings.length} handled in this demo. <Link href="/scan?sample=messy">Open it in the scanner</Link> to ask about a finding or download the fix prompt.
      </p>
    </>
  );
}
