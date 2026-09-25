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

export type QuestionIntent = "buying" | "brand" | "both";
export type QuestionDepth = "basic" | "intermediate" | "advanced" | "balanced";
export type QuestionSource = "generated" | "custom";

export interface QuestionSettings {
  intent: QuestionIntent;
  depth: QuestionDepth;
  customQuestions: string[];
}

// A generated query plus its demand tier and which of the brand's products it
// prices against. Feeds the "cost of invisibility" estimate on the results page.
export interface QueryWithDemand {
  text: string;
  intent: Exclude<QuestionIntent, "both">;
  depth: Exclude<QuestionDepth, "balanced">;
  source: QuestionSource;
  demandTier: DemandTier;
  tierJustification: string; // one line: why this tier
  mappedProductName: string; // "" when no specific product maps
  mappedPriceMonthlyUsd: number | null; // looked up from BrandProduct in code; null falls back to arpu.anchorPriceMonthlyUsd
}

// "unknown_pricing": no pricing signal was found anywhere (site or search) —
// a deterministic, code-side fallback (see analyze.ts) that overrides
// whatever the model returned rather than letting it guess a number.
export type Classification = "leads" | "brand" | "leads_low_volume" | "unknown_pricing";

// How the anchor price was derived from the pricing evidence.
export type PriceBasis = "listed" | "annualized" | "per_seat" | "enterprise_assumed";

// Whether buyers plausibly ask an AI assistant a recommendation-style
// question ("best X for Y") in this category. Only decisive when the anchor
// price clears the leads threshold — see deriveClassification.
export type DemandLevel = "high" | "medium" | "near_zero";

// How trustworthy the anchor price is. "found_on_site" is a real number read
// off the brand's own pages (raw fetch or the JS-render Extract fallback);
// "search_derived" came from a web search instead of the site itself;
// "assumed" means the site/search evidence existed but didn't state a number,
// so the model inferred one from category/brand knowledge. Undefined when
// classification is "unknown_pricing" — there is no price to have confidence in.
export type PriceConfidence = "found_on_site" | "search_derived" | "assumed";

export interface ArpuVerdict {
  classification: Classification;
  anchorPriceMonthlyUsd: number | null; // highest paid-tier price, normalized to a monthly USD figure. Null when classification is "unknown_pricing". A free/freemium tier never affects this.
  priceBasis: PriceBasis;
  priceConfidence?: PriceConfidence; // absent when classification is "unknown_pricing"
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
  questionSettings: QuestionSettings;
  queries: QueryWithDemand[];
  visibility: QueryVisibility[];
  arpu: ArpuVerdict | null;
  pillars: PillarScores | null;
  completedAt: string;
  // Crypto-random, unguessable slug for the public /report/{token} page —
  // deliberately not the id() scheme above (timestamp + short random, fine
  // for internal ids, guessable enough to matter for a public link).
  reportToken: string;
  // Separate bearer token for the owner-only Index workspace. The public
  // report token must never grant access to lead discovery or outreach.
  indexAccessToken: string;
  reportInsights: ReportInsights | null;
}

// The category benchmark + "three moves" shown on the shareable report page.
// Generated once, at audit-completion time, and stored here so a forwarded
// report link stays static (no LLM call on every page view). Null when the
// generation call failed — the report page falls back to static copy.
export interface ReportInsights {
  benchmark: {
    leaderPct: number; // estimated visibility % for category leaders
    medianPct: number; // estimated visibility % for the category median
  };
  moves: [ReportMove, ReportMove, ReportMove];
  // Competitor names the model confirmed are real companies/publications in
  // this category (spam/parked/junk domains dropped), most-frequent first,
  // capped at 5 — the bento's "who wins" tile reads only from this list. The
  // detailed matrix further down still shows every raw winner, junk or not.
  legitimateCompetitors: { name: string; count: number }[];
}

export type ReportMoveImpact = "high_leverage" | "fast_win" | "compounding";

export interface ReportMove {
  title: string; // max 6 words
  description: string; // max 25 words
  impact: ReportMoveImpact;
  pillar: PillarId;
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
  | { type: "done"; onboardingId: string; reportToken: string; indexAccessToken: string }
  | { type: "error"; step: AnalyzeStep; message: string; fatal: boolean };

export type AnalyzeStep =
  | "fetch_site"
  | "understand_brand"
  | "generate_queries"
  | "check_visibility"
  | "assess_pillars"
  | "classify_arpu"
  | "log";

// ─── Index lead discovery ───────────────────────────────────────────────────
// A private workspace hangs off the report token. The completed audit supplies
// the starting business context; the owner confirms the ICP before discovery.

export interface IndexIcp {
  targetRoles: string;
  industries: string;
  companyProfile: string;
  geographies: string;
  fitSignals: string;
  exclusions: string;
  offer: string;
  proposedLeadCategories: LeadCategory[];
  selectedLeadCategoryIds: string[];
  confirmed: boolean;
}

export interface LeadCategory {
  id: string;
  label: string;
  description: string;
  kind: "allocator" | "company" | "partner";
}

export type ProspectFit = "strong" | "possible";
export type ProspectStatus =
  | "recommended"
  | "passed"
  | "ready_for_outreach"
  | "sending"
  | "sent"
  | "failed";

export interface ProspectEvidence {
  label: string;
  url: string;
  snippet: string;
  sourceKind?: AllocatorSourceKind;
}

export type AllocatorType =
  | "liquid_token_fund"
  | "crypto_hedge_fund"
  | "market_maker"
  | "crypto_family_office"
  | "venture_liquid_hybrid"
  | "venture_only"
  | "strategic_corporate"
  | "fund_of_funds"
  | "institutional_asset_manager";

export type AllocatorMandate = "liquid" | "hybrid" | "venture_only" | "unknown";
export type AllocatorSourceKind =
  | "sec_adv"
  | "official_site"
  | "official_publication"
  | "governance"
  | "conference"
  | "hiring"
  | "deal"
  | "defillama"
  | "dune"
  | "explorer"
  | "licensed";

export interface AllocatorEvidence {
  id: string;
  sourceKind: AllocatorSourceKind;
  sourceName: string;
  url: string;
  title: string;
  excerpt: string;
  observedAt: string;
  publishedAt: string | null;
  license: "public" | "licensed";
}

export interface AllocatorPerson {
  id: string;
  name: string;
  role: string;
  linkedinUrl: string | null;
  xUrl: string | null;
  publicEmail: string | null;
  emailSourceUrl: string | null;
  evidenceIds: string[];
}

export interface AllocatorFund {
  id: string;
  name: string;
  mandate: AllocatorMandate;
  strategies: string[];
  sectors?: string[];
  stages?: string[];
  vehicles?: ("token" | "equity" | "liquid" | "private" | "public_markets")[];
  chains: string[];
  assets: string[];
  geographies: string[];
  allocationMinUsd: number | null;
  allocationMaxUsd: number | null;
  evidenceIds: string[];
}

export interface AllocatorOrganization {
  id: string;
  canonicalName: string;
  aliases: string[];
  normalizedDomain: string;
  allocatorType: AllocatorType;
  headquarters: string | null;
  funds: AllocatorFund[];
  people: AllocatorPerson[];
  evidence: AllocatorEvidence[];
  activitySignals: { label: string; occurredAt: string; evidenceId: string }[];
  sourceRecordIds: string[];
  firstSeenAt: string;
  lastSeenAt: string;
  lastEnrichedAt: string;
}

export interface AllocatorGraph {
  version: 1;
  organizations: AllocatorOrganization[];
  updatedAt: string;
  ingestionRuns: {
    id: string;
    startedAt: string;
    completedAt: string;
    connectors: string[];
    recordsSeen: number;
    organizationsUpserted: number;
    errors: string[];
    sourceDiagnostics?: AllocatorSourceDiagnostic[];
  }[];
}

export interface AllocatorSourceDiagnostic {
  sourceId: string;
  attempted: boolean;
  fetchedCount: number;
  acceptedCount: number;
  rejectedCount: number;
  failureReason: string | null;
  lastSuccessAt: string | null;
  freshnessAt: string | null;
  sourceVersion?: string;
  durationMs: number;
}

export interface AllocatorMatch {
  organizationId: string;
  allocatorType: AllocatorType;
  mandate: AllocatorMandate;
  strategyMatch: string;
  trigger: string | null;
  fitScore: number;
  freshness: "fresh" | "aging" | "stale";
  lastVerifiedAt: string;
}

export interface IndexProspect {
  id: string;
  name: string;
  role: string;
  company: string;
  location: string;
  linkedinUrl: string | null;
  xUrl: string | null;
  email: string | null;
  emailSourceUrl: string | null;
  fit: ProspectFit;
  fitScore: number;
  whyFit: string;
  whyNow: string | null;
  valueForThem: string;
  evidence: ProspectEvidence[];
  outreachSubject: string;
  outreachMessage: string;
  status: ProspectStatus;
  providerMessageId?: string;
  deliveryError?: string;
  updatedAt: string;
  allocatorMatch?: AllocatorMatch;
}

export interface IndexWorkspace {
  accessToken: string;
  onboardingId: string;
  domain: string;
  ownerEmail: string;
  icp: IndexIcp;
  prospects: IndexProspect[];
  allocatorProspects: IndexProspect[];
  lastDiscoveryAt: string | null;
  lastAllocatorFeedAt: string | null;
  updatedAt: string;
}
