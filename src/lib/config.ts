// Central config. Everything here is env-overridable so behavior can be tuned
// without code changes. Import from here rather than reading process.env directly.

export const config = {
  // Model used for all LLM calls (brand understanding, query generation,
  // visibility judging, ARPU classification), routed through OpenRouter.
  // Swap per-task in openrouter.ts if you want different models for different
  // steps. See https://openrouter.ai/models for available model slugs.
  llmModel: process.env.LLM_MODEL || "anthropic/claude-sonnet-4.5",

  // The ARPU branch threshold, in USD.
  arpuThresholdUsd: Number(process.env.ARPU_THRESHOLD_USD || 150),

  // Number of high-intent queries to generate + check.
  queryCount: 5,

  // Web search provider: "tavily" | "serper".
  searchProvider: (process.env.SEARCH_PROVIDER || "tavily") as "tavily" | "serper",

  // How many search results to feed the visibility judge per query.
  searchResultsPerQuery: 6,

  // Timeouts (ms).
  siteFetchTimeoutMs: 12_000,
  searchTimeoutMs: 15_000,

  // Where the JSON-file lead store writes (local dev). On Vercel the filesystem
  // is read-only except /tmp, so the store falls back there automatically.
  leadStorePath: process.env.LEAD_STORE_PATH || "./data/leads.json",
  onboardingStorePath:
    process.env.ONBOARDING_STORE_PATH || "./data/onboardings.json",
  auditRequestStorePath:
    process.env.AUDIT_REQUEST_STORE_PATH || "./data/audit-requests.json",
};

export function hasSearchKey(): boolean {
  if (config.searchProvider === "serper") return !!process.env.SERPER_API_KEY;
  return !!process.env.TAVILY_API_KEY;
}
