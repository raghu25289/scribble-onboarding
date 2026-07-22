// Lightweight per-audit cost accounting. OpenRouter returns a real per-call
// USD cost when a request includes `usage: { include: true }` — we prefer
// that over any static estimate. Tavily doesn't return cost, so its calls are
// tracked with a flat approximation, clearly labeled as such.

export interface CostEntry {
  label: string;
  usd: number;
}

export interface CostTracker {
  add(usd: number, label: string): void;
  total(): number;
  breakdown(): CostEntry[];
}

export function createCostTracker(): CostTracker {
  const entries: CostEntry[] = [];
  return {
    add(usd, label) {
      entries.push({ label, usd });
    },
    total() {
      return entries.reduce((sum, e) => sum + e.usd, 0);
    },
    breakdown() {
      return entries;
    },
  };
}

// Tavily doesn't report per-call cost; this is a rough placeholder based on
// their published per-search pricing tiers, not a metered figure.
export const TAVILY_ESTIMATED_COST_USD = 0.008;

export function formatCostBreakdown(tracker: CostTracker): string {
  const byLabel = new Map<string, number>();
  for (const e of tracker.breakdown()) {
    byLabel.set(e.label, (byLabel.get(e.label) ?? 0) + e.usd);
  }
  const parts = [...byLabel.entries()].map(
    ([label, usd]) => `${label}=$${usd.toFixed(4)}`
  );
  return parts.join(", ");
}
