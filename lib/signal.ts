import type { Severity } from "@/lib/findings";

/** The messy sample, as the hero and the pipeline funnel draw it: 41 raw warnings, 6 real. */
export const TOTAL = 41;
/** Positions of the six real findings among the raw warnings, in severity order. */
export const REAL_AT = [3, 8, 13, 21, 29, 36];
/** Resting bar height per severity, as a fraction of the full height. */
export const REST: Record<Severity, number> = { critical: 1, high: 0.72, medium: 0.5, low: 0.34 };

/** Deterministic, so the server render and the first client render agree. */
export const noiseHeight = (i: number) => 0.2 + (((i * 37) % 11) / 11) * 0.45;
