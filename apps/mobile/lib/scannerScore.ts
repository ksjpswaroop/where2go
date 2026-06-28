/**
 * Pure helpers for the Hotel Safety Scanner score display.
 *
 * Safety scores come from the backend on a 0-100 scale (see
 * `artifacts/api-server/src/lib/hotelScanner.ts`, which clamps every score to
 * 0-100). The UI must render and interpret them on that same 0-100 scale — a
 * past regression rendered them as "/10", which understated risk to travelers.
 * These helpers centralize that contract so it can be unit-tested.
 */

export type ScoreBand = "success" | "warning" | "destructive";

/** Lowest score (inclusive) that still counts as "safe" / success. */
export const SAFE_THRESHOLD = 70;
/** Lowest score (inclusive) that counts as "caution" / warning. */
export const CAUTION_THRESHOLD = 40;

/**
 * Map a 0-100 safety score to a semantic colour band.
 * Thresholds: >= 70 success, >= 40 warning, otherwise destructive.
 */
export function scoreBand(score: number): ScoreBand {
  if (score >= SAFE_THRESHOLD) return "success";
  if (score >= CAUTION_THRESHOLD) return "warning";
  return "destructive";
}

/** Render a score as the user-facing "N/100" label. */
export function formatScore(value: number): string {
  return `${value}/100`;
}

/** Clamp a raw score into the 0-100 percentage used for the progress bar. */
export function scoreBarWidth(value: number): number {
  return Math.max(0, Math.min(100, value));
}
