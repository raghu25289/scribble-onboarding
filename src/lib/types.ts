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
}

export interface VisibilityResult {
  query: string;
  visible: boolean; // is the brand mentioned/cited?
  snippet: string; // short summary of what the answer actually says
  winners: string[]; // who IS being recommended instead / who wins this query today
}

// A generated query plus its estimated monthly buyer-demand range. The demand
// range feeds the "cost of invisibility" estimate on the results page.
export interface QueryWithDemand {
  text: string;
  demandLow: number; // conservative monthly ask-volume estimate
  demandHigh: number; // aggressive monthly ask-volume estimate
}

export type RecommendationBranch = "lead-gen" | "brand";

export interface ArpuVerdict {
  arpuOver150: boolean;
  estimate: string; // human-readable estimate, e.g. "~$40/mo" or "$2k–5k/deal"
  reasoning: string; // exposed reasoning
  branch: RecommendationBranch;
  arpuLowUsd: number; // low end of the estimate, plain USD number
  arpuHighUsd: number; // high end of the estimate, plain USD number
  transactionNoun: string; // the unit revenue recurs per, e.g. "month", "deal"
}

// A completed onboarding record — this is what gets logged for lead review.
export interface OnboardingRecord {
  id: string;
  leadId: string;
  email: string;
  domain: string;
  brand: BrandUnderstanding | null;
  queries: QueryWithDemand[];
  visibility: VisibilityResult[];
  arpu: ArpuVerdict | null;
  completedAt: string;
}

// ─── Streaming event protocol (NDJSON over the analyze route) ────────────────
// Each event is one JSON object on its own line.

export type AnalyzeEvent =
  | { type: "status"; step: AnalyzeStep; message: string }
  | { type: "brand"; data: BrandUnderstanding }
  | { type: "queries"; data: QueryWithDemand[] }
  | { type: "visibility"; index: number; total: number; data: VisibilityResult }
  | { type: "arpu"; data: ArpuVerdict }
  | { type: "done"; onboardingId: string }
  | { type: "error"; step: AnalyzeStep; message: string; fatal: boolean };

export type AnalyzeStep =
  | "fetch_site"
  | "understand_brand"
  | "generate_queries"
  | "check_visibility"
  | "classify_arpu"
  | "log";
