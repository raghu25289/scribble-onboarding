// Shared types across the onboarding flow. Kept in one place so the API routes,
// the store, and the UI all speak the same shapes.

export interface Lead {
  id: string;
  email: string;
  domain: string; // normalized, e.g. "acme.com"
  createdAt: string; // ISO timestamp
}

// A lead captured from the results page's "get the full audit by email"
// secondary CTA. Separate from Lead (Step 1 capture) since it carries the
// completed visibility score and is optional/company-name enriched.
export interface AuditRequest {
  id: string;
  email: string;
  domain: string; // brand URL, e.g. "acme.com"
  score: string; // e.g. "2/5"
  companyName?: string;
  createdAt: string; // ISO timestamp
}

export interface BrandUnderstanding {
  product: string; // what the product/company does
  audience: string; // who it's for
  category: string; // market category
  pricingSignals: string; // raw pricing evidence found (or inferred)
  pricingModel: string; // e.g. "subscription", "usage-based", "enterprise/sales-led", "unknown"
  products: BrandProduct[]; // distinct products/price-tiers found in the pricing evidence (at least one)
  topCompetitors: string[]; // 1-2 well-known competitors, from general knowledge, independent of site content
}

// A distinct product or price-tier the brand sells, used to price individual
// queries against the specific product they're actually about (an "earbuds
// under $100" query prices against the earbuds, not the phone).
export interface BrandProduct {
  name: string;
  priceMonthlyUsd: number; // monthly-normalized, same conventions as ArpuVerdict.anchorPriceMonthlyUsd
}

export interface VisibilityResult {
  query: string;
  visible: boolean; // is the brand mentioned/cited?
  snippet: string; // short summary of what the answer actually says
  winners: string[]; // who IS being recommended instead / who wins this query today
}

// A "winner" name the visibility judge extracted, cross-checked against the
// actual source text it was given. verified = the engine's raw answer had at
// least one citation URL backing it (an uncited claim is more likely to name
// a product that doesn't really exist).
export interface Winner {
  name: string;
  verified: boolean;
}

// ─── Multi-engine visibility (real engine attribution) ──────────────────────
// "web" is the original Tavily-backed check, relabeled "Open web baseline" —
// it's kept for context but excluded from engine chips and from all
// visible/invisible scoring. Chips and the headline score are reserved for
// the real engines: Perplexity and ChatGPT.
export type EngineId = "web" | "perplexity" | "chatgpt";

export interface EngineCheckResult {
  engine: EngineId;
  ok: boolean; // false = the call failed or timed out ("Couldn't check"); visible/snippet/winners are meaningless when false
  visible: boolean;
  snippet: string;
  winners: Winner[]; // names dropped if not literally present in the source text — see checkEngineVisibility
  citations: string[];
  error?: string;
}

export interface QueryVisibility {
  query: string;
  engines: Partial<Record<EngineId, EngineCheckResult>>; // filled in as each engine's check lands
}

// ─── Three-pillar citation score (the fix) ───────────────────────────────────
export type PillarId = "onsite" | "reviews" | "thirdparty";

export interface PillarScore {
  id: PillarId;
  label: string;
  score: number; // 0-100
  gap: string; // one sentence on the biggest gap
}

export interface PillarScores {
  onsite: PillarScore;
  reviews: PillarScore;
  thirdparty: PillarScore;
}

// Fixed monthly AI-ask demand bands (no external keyword APIs) — the LLM
// only picks the tier + justifies it; the actual volume numbers live in code
// (see DEMAND_BANDS in costEstimate.ts) so they can't be inflated.
export type DemandTier = "niche" | "moderate" | "high" | "mass";

// A generated query plus its demand tier and which of the brand's products it
// prices against. Feeds the "cost of invisibility" estimate on the results page.
export interface QueryWithDemand {
  text: string;
  demandTier: DemandTier;
  tierJustification: string; // one line: why this tier
  mappedProductName: string; // "" when no specific product maps
  mappedPriceMonthlyUsd: number | null; // looked up from BrandProduct in code; null falls back to arpu.anchorPriceMonthlyUsd
}

export type Classification = "leads" | "brand" | "leads_low_volume";

// How the anchor price was derived from the pricing evidence.
export type PriceBasis = "listed" | "annualized" | "per_seat" | "enterprise_assumed";

// Whether buyers plausibly ask an AI assistant a recommendation-style
// question ("best X for Y") in this category. Only decisive when the anchor
// price clears the leads threshold — see deriveClassification.
export type DemandLevel = "high" | "medium" | "near_zero";

export interface ArpuVerdict {
  classification: Classification;
  anchorPriceMonthlyUsd: number; // highest paid-tier price, normalized to a monthly USD figure. A free/freemium tier never affects this.
  priceBasis: PriceBasis;
  isTransactionalConsumerSpend: boolean; // one-off consumer purchase (booking, basket) vs. a recurring subscription relationship
  demandLevel: DemandLevel;
  estimate: string; // human-readable figure, e.g. "$99/mo (Pro tier)"
  reasoning: string; // exposed reasoning, shown in the "How we estimated this" card
  transactionNoun: string; // the unit revenue recurs per, e.g. "month", "booking", "deal"
  plausibleMonthlyRevenueUsd: number; // model's rough estimate of the brand's whole-company monthly revenue, used only to cap the loss estimate
}

// A completed onboarding record — this is what gets logged for lead review.
export interface OnboardingRecord {
  id: string;
  leadId: string;
  email: string;
  domain: string;
  brand: BrandUnderstanding | null;
  queries: QueryWithDemand[];
  visibility: QueryVisibility[];
  arpu: ArpuVerdict | null;
  pillars: PillarScores | null;
  completedAt: string;
}

// ─── Streaming event protocol (NDJSON over the analyze route) ────────────────
// Each event is one JSON object on its own line.

export type AnalyzeEvent =
  | { type: "status"; step: AnalyzeStep; message: string }
  | { type: "brand"; data: BrandUnderstanding }
  | { type: "queries"; data: QueryWithDemand[] }
  | { type: "engine_result"; queryIndex: number; total: number; engine: EngineId; data: EngineCheckResult }
  | { type: "arpu"; data: ArpuVerdict }
  | { type: "pillars"; data: PillarScores }
  | { type: "done"; onboardingId: string }
  | { type: "error"; step: AnalyzeStep; message: string; fatal: boolean };

export type AnalyzeStep =
  | "fetch_site"
  | "understand_brand"
  | "generate_queries"
  | "check_visibility"
  | "assess_pillars"
  | "classify_arpu"
  | "log";
