// Pure helpers that turn invisibility into a dollar estimate, using the query
// demand and ARPU ranges the LLM calls in analyze.ts already computed. No
// extra API calls here — just formatting and the capture-rate math.

import type { ArpuVerdict, QueryWithDemand } from "./types";

export const CURRENCY_SYMBOL = "$";

// Assumed share of monthly demand a brand could realistically capture by
// showing up in AI answers — deliberately conservative, deliberately a range.
const CAPTURE_RATE_LOW = 0.02;
const CAPTURE_RATE_HIGH = 0.05;

export function formatMoney(n: number): string {
  return `${CURRENCY_SYMBOL}${Math.round(n).toLocaleString("en-US")}`;
}

// "$99" — the normalized monthly anchor price the classification was based on.
export function formatAnchorPrice(arpu: ArpuVerdict): string {
  return formatMoney(arpu.anchorPriceMonthlyUsd);
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
  const price = arpu.anchorPriceMonthlyUsd;
  const lowUsd = roundEstimate(demand.demandLow * CAPTURE_RATE_LOW * price);
  const highUsd = roundEstimate(demand.demandHigh * CAPTURE_RATE_HIGH * price);
  return { lowUsd, highUsd: Math.max(highUsd, lowUsd) };
}

// Leads lost per month, independent of price — the capture-rate share of
// query demand a brand could realistically win by showing up in AI answers.
export function estimateQueryLeads(
  demand: QueryWithDemand
): { lowLeads: number; highLeads: number } {
  const lowLeads = Math.round(demand.demandLow * CAPTURE_RATE_LOW);
  const highLeads = Math.round(demand.demandHigh * CAPTURE_RATE_HIGH);
  return { lowLeads, highLeads: Math.max(highLeads, lowLeads) };
}

// Sums the per-query loss/leads estimates across every invisible query, for
// the revenue-loss infographic's headline number.
export function estimateTotalLoss(
  rows: { demand: QueryWithDemand }[],
  arpu: ArpuVerdict
): { lowUsd: number; highUsd: number } {
  return rows.reduce(
    (acc, { demand }) => {
      const { lowUsd, highUsd } = estimateQueryLoss(demand, arpu);
      return { lowUsd: acc.lowUsd + lowUsd, highUsd: acc.highUsd + highUsd };
    },
    { lowUsd: 0, highUsd: 0 }
  );
}

export function estimateTotalLeads(
  rows: { demand: QueryWithDemand }[]
): { lowLeads: number; highLeads: number } {
  return rows.reduce(
    (acc, { demand }) => {
      const { lowLeads, highLeads } = estimateQueryLeads(demand);
      return { lowLeads: acc.lowLeads + lowLeads, highLeads: acc.highLeads + highLeads };
    },
    { lowLeads: 0, highLeads: 0 }
  );
}

// Shortens a query for the infographic's per-bar label.
export function truncateLabel(text: string, max = 48): string {
  return text.length > max ? text.slice(0, max - 1).trimEnd() + "…" : text;
}

// Picks the competitor that shows up most often across the invisible
// queries' winners, so the CTA can name a single rival. Ties break by first
// appearance. Returns null when no winners were found at all.
export function topCompetitor(invisible: { winners: string[] }[]): string | null {
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
