// Pure helpers that turn invisibility into a dollar estimate, using the query
// demand tier and product-price mapping analyze.ts already computed. No
// external keyword APIs, no LLM-guessed volumes — the tier bands and capture
// rates below are fixed constants; the only judgment call the model makes is
// which tier a query belongs to and which product it prices against.

import type { ArpuVerdict, DemandTier, QueryWithDemand, Winner } from "./types";

export const CURRENCY_SYMBOL = "$";

// Fixed monthly AI-ask bands per tier. Conservative volume = band low;
// aggressive volume = band midpoint (deliberately not band high).
const DEMAND_BANDS: Record<DemandTier, { low: number; high: number }> = {
  niche: { low: 50, high: 300 },
  moderate: { low: 300, high: 1500 },
  high: { low: 1500, high: 6000 },
  mass: { low: 6000, high: 20000 },
};

function tierMidpoint(tier: DemandTier): number {
  const band = DEMAND_BANDS[tier];
  return (band.low + band.high) / 2;
}

// Capture rate keyed to the band's midpoint, not a flat global rate — the
// more mainstream the demand, the smaller a slice of it any one brand can
// realistically capture by showing up in AI answers.
function captureRate(mid: number): { low: number; high: number } {
  if (mid < 1000) return { low: 0.02, high: 0.05 };
  if (mid <= 10000) return { low: 0.01, high: 0.02 };
  return { low: 0.005, high: 0.01 };
}

const TIER_LABELS: Record<DemandTier, string> = {
  niche: "Niche demand",
  moderate: "Moderate demand",
  high: "High demand",
  mass: "Mass demand",
};

export function tierLabel(tier: DemandTier): string {
  return TIER_LABELS[tier];
}

// Guardrail caps: the %-of-revenue cap alone is toothless for a large brand
// (5% of $50M+ is millions), so a hard dollar ceiling backstops it — the
// smaller of the two always wins. The aggressive ("could reach") figure gets
// its own, more generous, independent cap so it can't balloon to a multiple
// of a conservative number that's already at its ceiling.
const CONSERVATIVE_CAP_REVENUE_SHARE = 0.05;
const CONSERVATIVE_HARD_CAP_USD = 40_000;
const AGGRESSIVE_CAP_REVENUE_SHARE = 0.15;
const AGGRESSIVE_HARD_CAP_USD = 120_000;

// Rounds to 2 significant digits: 12,345 -> 12,000; 87 -> 87; 8.7 -> 8.7.
export function round2SigFigs(n: number): number {
  if (!Number.isFinite(n) || n === 0) return 0;
  const sign = n < 0 ? -1 : 1;
  const abs = Math.abs(n);
  const magnitude = Math.pow(10, Math.floor(Math.log10(abs)) - 1);
  return sign * Math.round(abs / magnitude) * magnitude;
}

export function formatMoney(n: number): string {
  return `${CURRENCY_SYMBOL}${Math.round(n).toLocaleString("en-US")}`;
}

// "$99" — the normalized monthly anchor price the classification was based on.
// "—" when pricing is unknown (classification "unknown_pricing") — callers
// showing dollar figures should generally branch on classification before
// reaching here at all; this is a defensive fallback, not the primary guard.
export function formatAnchorPrice(arpu: ArpuVerdict): string {
  if (arpu.anchorPriceMonthlyUsd == null) return "—";
  return formatMoney(arpu.anchorPriceMonthlyUsd);
}

interface RawEstimate {
  lowUsd: number;
  highUsd: number;
  lowLeads: number;
  highLeads: number;
}

function estimateQueryRaw(demand: QueryWithDemand, arpu: ArpuVerdict): RawEstimate {
  const band = DEMAND_BANDS[demand.demandTier];
  const mid = tierMidpoint(demand.demandTier);
  const capture = captureRate(mid);
  // Falls back to 0, not null, when neither a per-product price nor an
  // anchor price is available (unknown_pricing) — keeps the $ math at a
  // harmless zero instead of NaN. Lead counts below don't depend on price,
  // so they stay meaningful even when this is 0; callers must not render the
  // $ figures in that case (see CostCard's pricingUnknown branch).
  const price = demand.mappedPriceMonthlyUsd ?? arpu.anchorPriceMonthlyUsd ?? 0;

  const lowLeads = band.low * capture.low;
  const highLeads = mid * capture.high;

  return {
    lowUsd: lowLeads * price,
    highUsd: highLeads * price,
    lowLeads,
    highLeads,
  };
}

export interface CostRow {
  lowUsd: number;
  highUsd: number;
  lowLeads: number;
  highLeads: number;
  tier: DemandTier;
}

export interface CostBreakdown<T> {
  rows: (T & CostRow)[];
  totalLowUsd: number;
  totalHighUsd: number;
  totalLowLeads: number;
  totalHighLeads: number;
  capped: boolean;
}

// Single pass over every invisible query's rows: computes each row's raw
// estimate, sums them, applies the revenue-based guardrail caps as ONE
// proportional scale factor across every row (dollars and leads alike) so the
// headline, the secondary line, and the bars all stay mutually consistent.
export function computeCostBreakdown<T extends { demand: QueryWithDemand }>(
  rows: T[],
  arpu: ArpuVerdict
): CostBreakdown<T> {
  const raw = rows.map((r) => estimateQueryRaw(r.demand, arpu));
  const rawTotalLow = raw.reduce((sum, r) => sum + r.lowUsd, 0);
  const rawTotalHigh = raw.reduce((sum, r) => sum + r.highUsd, 0);

  const conservativeCap = Math.min(
    CONSERVATIVE_CAP_REVENUE_SHARE * arpu.plausibleMonthlyRevenueUsd,
    CONSERVATIVE_HARD_CAP_USD
  );
  const aggressiveCap = Math.min(
    AGGRESSIVE_CAP_REVENUE_SHARE * arpu.plausibleMonthlyRevenueUsd,
    AGGRESSIVE_HARD_CAP_USD
  );

  let factor = 1;
  if (rawTotalLow > 0) factor = Math.min(factor, conservativeCap / rawTotalLow);
  if (rawTotalHigh > 0) factor = Math.min(factor, aggressiveCap / rawTotalHigh);
  factor = Math.max(0, factor);
  const capped = factor < 1;

  const scaledRows = rows.map((r, i) => {
    const lowUsd = round2SigFigs(raw[i].lowUsd * factor);
    const highUsd = round2SigFigs(Math.max(raw[i].highUsd * factor, lowUsd));
    const lowLeads = round2SigFigs(raw[i].lowLeads * factor);
    const highLeads = round2SigFigs(Math.max(raw[i].highLeads * factor, lowLeads));
    return { ...r, lowUsd, highUsd, lowLeads, highLeads, tier: r.demand.demandTier };
  });

  const totalLowUsd = scaledRows.reduce((sum, r) => sum + r.lowUsd, 0);
  const totalHighUsd = Math.max(
    scaledRows.reduce((sum, r) => sum + r.highUsd, 0),
    totalLowUsd
  );
  const totalLowLeads = scaledRows.reduce((sum, r) => sum + r.lowLeads, 0);
  const totalHighLeads = Math.max(
    scaledRows.reduce((sum, r) => sum + r.highLeads, 0),
    totalLowLeads
  );

  return {
    rows: scaledRows,
    totalLowUsd: round2SigFigs(totalLowUsd),
    totalHighUsd: round2SigFigs(totalHighUsd),
    totalLowLeads: round2SigFigs(totalLowLeads),
    totalHighLeads: round2SigFigs(totalHighLeads),
    capped,
  };
}

// Conservative (band-low) total monthly AI-ask volume across every generated
// query, regardless of visibility — the report hero's "{n} buyers a month are
// asking" line. Same fixed DEMAND_BANDS used everywhere else in this file, no
// separate volume model.
export function estimateMonthlyAskVolume(queries: { demandTier: DemandTier }[]): number {
  const total = queries.reduce((sum, q) => sum + DEMAND_BANDS[q.demandTier].low, 0);
  return round2SigFigs(total);
}

// Shortens a query for the infographic's per-bar label.
export function truncateLabel(text: string, max = 48): string {
  return text.length > max ? text.slice(0, max - 1).trimEnd() + "…" : text;
}

// Picks the competitor that shows up most often across the invisible
// queries' winners, so the CTA can name a single rival. Ties break by first
// appearance. Returns null when no winners were found at all.
export function topCompetitor(invisible: { winners: Winner[] }[]): string | null {
  const counts = new Map<string, number>();
  const order: string[] = [];
  for (const r of invisible) {
    for (const w of r.winners) {
      if (!counts.has(w.name)) {
        counts.set(w.name, 0);
        order.push(w.name);
      }
      counts.set(w.name, (counts.get(w.name) ?? 0) + 1);
    }
  }
  if (order.length === 0) return null;
  return order.reduce((best, name) =>
    (counts.get(name) ?? 0) > (counts.get(best) ?? 0) ? name : best
  );
}

// "A", "A and B", or "A, B, and C" — formats up to 3 winner names for the
// per-query cost-card line item copy.
export function formatCompetitorList(winners: Winner[]): string {
  const names = winners.slice(0, 3).map((w) => w.name);
  if (names.length === 0) return "other providers";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names[0]}, ${names[1]}, and ${names[2]}`;
}
