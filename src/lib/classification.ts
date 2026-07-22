// Deterministic leads-vs-brand rule, applied in code rather than trusted
// blindly from the model's own self-labeled classification field — the model
// is reliable at estimating a price and a demand level, less reliable at
// consistently applying a threshold rule to its own output. Free-tier
// existence is not one of this function's inputs, by design: it must have
// zero weight in the decision.

import type { Classification, DemandLevel } from "./types";

export function deriveClassification(input: {
  anchorPriceMonthlyUsd: number;
  isTransactionalConsumerSpend: boolean;
  demandLevel: DemandLevel;
  thresholdUsd: number;
}): Classification {
  if (input.isTransactionalConsumerSpend) return "brand";
  if (input.anchorPriceMonthlyUsd < input.thresholdUsd) return "brand";
  if (input.demandLevel === "near_zero") return "leads_low_volume";
  return "leads";
}
