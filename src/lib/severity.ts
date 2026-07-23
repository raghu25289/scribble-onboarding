// Shared red/amber/green banding for any 0-100 score on the results page
// (pillar meters, the visibility gauge) — one place to keep the thresholds
// and the color tokens in sync.

export function bandColor(score: number): string {
  if (score < 40) return "var(--miss)";
  if (score <= 70) return "var(--amber)";
  return "var(--win)";
}
