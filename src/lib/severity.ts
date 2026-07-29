// Shared severity banding for any 0-100 score across the app (pillar meters,
// the visibility gauge) — one place to keep the thresholds and the design
// tokens in sync: danger below 40, ink 40-70, lime-deep above.

export function bandColor(score: number): string {
  if (score < 40) return "var(--danger)";
  if (score <= 70) return "var(--ink)";
  return "var(--lime-deep)";
}
