// Pure helpers that turn invisibility into a dollar estimate, using the query
// demand and ARPU ranges the LLM calls in analyze.ts already computed. No
// extra API calls here — just formatting and the capture-rate math.

import type { ArpuVerdict, QueryWithDemand, VisibilityResult } from "./types";

export const CURRENCY_SYMBOL = "$";

// Assumed share of monthly demand a brand could realistically capture by
// showing up in AI answers — deliberately conservative, deliberately a range.
const CAPTURE_RATE_LOW = 0.02;
const CAPTURE_RATE_HIGH = 0.05;

export function formatMoney(n: number): string {
  return `${CURRENCY_SYMBOL}${Math.round(n).toLocaleString("en-US")}`;
}

// "$29" for a single figure, "$2,000 to $8,000" for a range.
export function formatArpuRange(arpu: ArpuVerdict): string {
  const low = formatMoney(arpu.arpuLowUsd);
  const high = formatMoney(arpu.arpuHighUsd);
  return low === high ? low : `${low} to ${high}`;
}

// Rounds to avoid false precision: nearest 10 under $1,000, nearest 100 under
// $10,000, nearest 500 above that.
function roundEstimate(n: number): number {
  if (n < 1000) return Math.round(n / 10) * 10;
  if (n < 10000) return Math.round(n / 100) * 100;
  return Math.round(n / 500) * 500;
}

export function estimateQueryLoss(
  demand: QueryWithDemand,
  arpu: ArpuVerdict
): { lowUsd: number; highUsd: number } {
  const midpointArpu = (arpu.arpuLowUsd + arpu.arpuHighUsd) / 2;
  const lowUsd = roundEstimate(demand.demandLow * CAPTURE_RATE_LOW * midpointArpu);
  const highUsd = roundEstimate(demand.demandHigh * CAPTURE_RATE_HIGH * midpointArpu);
  return { lowUsd, highUsd: Math.max(highUsd, lowUsd) };
}

// Picks the competitor that shows up most often across the invisible
// queries' winners, so the CTA can name a single rival. Ties break by first
// appearance. Returns null when no winners were found at all.
export function topCompetitor(invisible: VisibilityResult[]): string | null {
  const counts = new Map<string, number>();
  const order: string[] = [];
  for (const r of invisible) {
    for (const w of r.winners) {
      if (!counts.has(w)) {
        counts.set(w, 0);
        order.push(w);
      }
      counts.set(w, (counts.get(w) ?? 0) + 1);
    }
  }
  if (order.length === 0) return null;
  return order.reduce((best, name) =>
    (counts.get(name) ?? 0) > (counts.get(best) ?? 0) ? name : best
  );
}

// "A", "A and B", or "A, B, and C" — formats up to 3 winner names for the
// per-query cost-card line item copy.
export function formatCompetitorList(winners: string[]): string {
  const names = winners.slice(0, 3);
  if (names.length === 0) return "other providers";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names[0]}, ${names[1]}, and ${names[2]}`;
}
