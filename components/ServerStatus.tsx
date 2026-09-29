"use client";

import { useEffect, useState } from "react";

// A free Render instance sleeps after 15 idle minutes and takes roughly this long to wake.
export const WAKE_SECONDS = 60;
const SLOW_AFTER = 4;

/** Seconds since mount while `active`; its own state, so the page around it does not re-render each tick. */
function useSeconds(active: boolean) {
  const [s, setS] = useState(0);
  useEffect(() => {
    if (!active) return;
    const start = Date.now();
    const id = setInterval(() => setS(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(id);
  }, [active]);
  return s;
}

type State = "checking" | "waking" | "online" | "offline";
const stateOf = (online: boolean | null, s: number): State =>
  online === null ? (s >= SLOW_AFTER ? "waking" : "checking") : online ? "online" : "offline";

/** Always-visible status in the header, so anyone watching can tell a cold start from a broken site. */
export function ServerPill({ online, onClick }: { online: boolean | null; onClick: () => void }) {
  const s = useSeconds(online === null);
  const state = stateOf(online, s);
  // the long part hides on phones, leaving the dot and the counter
  const label = {
    checking: <span className="srv__long">Connecting</span>,
    waking: <><span className="srv__long">Waking server · </span>{s}s</>,
    online: <span className="srv__long">Server live</span>,
    offline: <span className="srv__long">Server offline</span>,
  }[state];
  return (
    <button
      type="button"
      className={`srv srv--${state}`}
      style={{ ["--wake" as string]: `${WAKE_SECONDS}s` }}
      onClick={onClick}
      aria-label={{ checking: "Connecting to the server", waking: `Waking the server, ${s} seconds so far`, online: "Server live", offline: "Server offline" }[state]}
      title={state === "waking" ? "The free server sleeps when idle and is starting up. This usually takes under a minute." : undefined}
    >
      <span className="srv__label">{label}</span>
    </button>
  );
}

/** The scanner's own line: explains a cold start in plain words while it happens. */
export function WakeNote({ online }: { online: boolean | null }) {
  const s = useSeconds(online === null);
  const state = stateOf(online, s);
  if (state === "waking") {
    return (
      <div className="wake" role="status" style={{ ["--wake" as string]: `${WAKE_SECONDS}s` }}>
        <p className="wake__head">
          Waking the live scanner <b>{s}s</b>
        </p>
        <p className="wake__body">
          The backend runs on a free server that sleeps when nobody is using it. It is starting up now, which usually
          takes 30 to 60 seconds. The samples work right away, and live scans start as soon as it is up.
        </p>
        <i className="wake__bar" aria-hidden="true" />
      </div>
    );
  }
  return (
    <p className={`live live--${state === "checking" ? "wait" : state === "online" ? "on" : "off"}`} role="status">
      {state === "checking" ? "Checking the live scanner" : state === "online" ? "Live scanner online" : "Live scanner offline. Reload in a minute to try again; the samples still work."}
    </p>
  );
}
