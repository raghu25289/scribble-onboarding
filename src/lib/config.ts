// Central config. Everything here is env-overridable so behavior can be tuned
// without code changes. Import from here rather than reading process.env directly.

export const config = {
  // Model used for all LLM calls (brand understanding, query generation,
  // visibility judging, ARPU classification), routed through OpenRouter.
  // Swap per-task in openrouter.ts if you want different models for different
  // steps. See https://openrouter.ai/models for available model slugs.
  llmModel: process.env.LLM_MODEL || "anthropic/claude-sonnet-4.5",

  // Anchor-price threshold (normalized monthly USD) above which AI visibility
  // is classified as a leads channel rather than a brand channel.
  leadsThresholdUsd: Number(process.env.LEADS_THRESHOLD_USD || 50),

  // Number of high-intent queries to generate + check.
  queryCount: 5,

  // Web search provider: "tavily" | "serper".
  searchProvider: (process.env.SEARCH_PROVIDER || "tavily") as "tavily" | "serper",

  // How many search results to feed the visibility judge per query.
  searchResultsPerQuery: 6,

  // Real-engine model slugs (OpenRouter), used for the per-query engine
  // attribution checks. See https://openrouter.ai/models.
  perplexityModel: process.env.PERPLEXITY_ENGINE_MODEL || "perplexity/sonar",
  chatgptModel: process.env.CHATGPT_ENGINE_MODEL || "openai/gpt-4o:online",

  // Timeouts (ms).
  siteFetchTimeoutMs: 12_000,
  searchTimeoutMs: 15_000,
  engineTimeoutMs: Number(process.env.ENGINE_TIMEOUT_MS || 20_000),

  // Where the JSON-file lead store writes (local dev). On Vercel the filesystem
  // is read-only except /tmp, so the store falls back there automatically.
  leadStorePath: process.env.LEAD_STORE_PATH || "./data/leads.json",
  onboardingStorePath:
    process.env.ONBOARDING_STORE_PATH || "./data/onboardings.json",
  auditRequestStorePath:
    process.env.AUDIT_REQUEST_STORE_PATH || "./data/audit-requests.json",
  indexWorkspaceStorePath:
    process.env.INDEX_WORKSPACE_STORE_PATH || "./data/index-workspaces.json",
  allocatorGraphStorePath:
    process.env.ALLOCATOR_GRAPH_STORE_PATH || "./data/allocator-graph.json",
  allocatorFeedSize: Math.max(1, Math.min(10, Number(process.env.ALLOCATOR_FEED_SIZE || 10))),
  allocatorPipelineEnabled: process.env.ALLOCATOR_PIPELINE_ENABLED === "true",
  allocatorDemoMode: process.env.ALLOCATOR_DEMO_MODE === "true",
};

export function hasSearchKey(): boolean {
  if (config.searchProvider === "serper") return !!process.env.SERPER_API_KEY;
  return !!process.env.TAVILY_API_KEY;
}
