// Orchestration for Steps 2–4. Given a lead, this walks the whole agent:
//   fetch site → understand brand → generate queries → then four branches run
//   concurrently (engine visibility per query, ARPU classification, the
//   onsite/review-sites pillars, and the third-party-mentions pillar) → log
//   the completed onboarding.
//
// It reports progress through an `emit` callback (one AnalyzeEvent at a time) so
// the API route can stream results to the UI as they complete. Every step is
// wrapped so a single failure degrades gracefully instead of killing the flow.

import { config } from "./config";
import { createCostTracker, formatCostBreakdown } from "./cost";
import { generateJson } from "./openrouter";
import { fetchSiteContent } from "./scrape";
import { checkEngineVisibility, fetchWebSearch } from "./engines";
import type { SearchResponse } from "./search";
import { store, makeId } from "./store";
import { getAhrefsVolume } from "./ahrefs";
import { deriveClassification } from "./classification";
import { assessOnsite, assessReviewSites, assessThirdParty } from "./pillars";
import {
  BRAND_UNDERSTANDING_SYSTEM,
  brandUnderstandingPrompt,
  QUERY_GENERATION_SYSTEM,
  queryGenerationPrompt,
  ARPU_CLASSIFICATION_SYSTEM,
  arpuClassificationPrompt,
} from "./prompts";
import type {
  AnalyzeEvent,
  BrandUnderstanding,
  Classification,
  DemandLevel,
  EngineId,
  Lead,
  OnboardingRecord,
  PillarScores,
  PriceBasis,
  QueryVisibility,
  QueryWithDemand,
  ArpuVerdict,
} from "./types";

type Emit = (event: AnalyzeEvent) => void;

// ── JSON schemas pinning each LLM call's output ──────────────────────────────
const brandSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    product: { type: "string" },
    audience: { type: "string" },
    category: { type: "string" },
    pricingSignals: { type: "string" },
    pricingModel: { type: "string" },
  },
  required: ["product", "audience", "category", "pricingSignals", "pricingModel"],
};

const queriesSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    queries: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          text: { type: "string" },
          demandLow: { type: "integer" },
          demandHigh: { type: "integer" },
        },
        required: ["text", "demandLow", "demandHigh"],
      },
    },
  },
  required: ["queries"],
};

const arpuSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    classification: { type: "string", enum: ["leads", "brand", "leads_low_volume"] },
    anchorPriceMonthlyUsd: { type: "number" },
    priceBasis: {
      type: "string",
      enum: ["listed", "annualized", "per_seat", "enterprise_assumed"],
    },
    isTransactionalConsumerSpend: { type: "boolean" },
    demandLevel: { type: "string", enum: ["high", "medium", "near_zero"] },
    estimate: { type: "string" },
    reasoning: { type: "string" },
    transactionNoun: { type: "string" },
  },
  required: [
    "classification",
    "anchorPriceMonthlyUsd",
    "priceBasis",
    "isTransactionalConsumerSpend",
    "demandLevel",
    "estimate",
    "reasoning",
    "transactionNoun",
  ],
};

export async function runAnalysis(lead: Lead, emit: Emit): Promise<void> {
  const record: OnboardingRecord = {
    id: makeId("onb"),
    leadId: lead.id,
    email: lead.email,
    domain: lead.domain,
    brand: null,
    queries: [],
    visibility: [],
    arpu: null,
    pillars: null,
    completedAt: "",
  };

  const tracker = createCostTracker();

  // ── Step 2a: fetch the site ────────────────────────────────────────────────
  emit({ type: "status", step: "fetch_site", message: `Fetching ${lead.domain}…` });
  const baseUrl = `https://${lead.domain}`;
  const site = await fetchSiteContent(baseUrl);
  for (const note of site.notes) {
    emit({ type: "status", step: "fetch_site", message: note });
  }

  // ── Step 2b: understand the brand ──────────────────────────────────────────
  emit({ type: "status", step: "understand_brand", message: "Reading the site and figuring out what you do…" });
  let brand: BrandUnderstanding;
  try {
    brand = await generateJson<BrandUnderstanding>({
      system: BRAND_UNDERSTANDING_SYSTEM,
      prompt: brandUnderstandingPrompt({
        domain: lead.domain,
        homepageText: site.homepageText || `(homepage unavailable) domain: ${lead.domain}`,
        pricingText: site.pricingText,
      }),
      schema: brandSchema,
      tracker,
      costLabel: "brand_understanding",
    });
  } catch (e) {
    // Fatal-ish: without brand understanding, the rest is guesswork. Fall back to
    // a minimal inferred brand so the flow can still produce something.
    emit({
      type: "error",
      step: "understand_brand",
      message: `Couldn't fully analyze the site (${(e as Error).message}). Continuing with limited info.`,
      fatal: false,
    });
    brand = {
      product: `A company at ${lead.domain} (details unavailable).`,
      audience: "Unknown",
      category: "Unknown",
      pricingSignals: "No pricing evidence available.",
      pricingModel: "unknown",
    };
  }
  record.brand = brand;
  emit({ type: "brand", data: brand });

  // ── Step 2c: generate 5 high-intent queries ────────────────────────────────
  emit({ type: "status", step: "generate_queries", message: "Generating the 5 questions buyers ask AI about this…" });
  let queries: QueryWithDemand[] = [];
  try {
    const out = await generateJson<{ queries: QueryWithDemand[] }>({
      system: QUERY_GENERATION_SYSTEM,
      prompt: queryGenerationPrompt({
        domain: lead.domain,
        brandProduct: brand.product,
        brandAudience: brand.audience,
        brandCategory: brand.category,
      }),
      schema: queriesSchema,
      tracker,
      costLabel: "query_generation",
    });
    queries = (out.queries || []).slice(0, config.queryCount);

    // Prefer real Ahrefs keyword volume over the model's estimate when it's
    // available; otherwise the model's demandLow/demandHigh stand as-is.
    for (const q of queries) {
      const ahrefs = await getAhrefsVolume(q.text);
      if (ahrefs) {
        q.demandLow = ahrefs.low;
        q.demandHigh = ahrefs.high;
      }
    }
  } catch (e) {
    emit({
      type: "error",
      step: "generate_queries",
      message: `Couldn't generate queries (${(e as Error).message}).`,
      fatal: true,
    });
    return;
  }

  if (queries.length === 0) {
    emit({ type: "error", step: "generate_queries", message: "No queries were generated.", fatal: true });
    return;
  }
  record.queries = queries;
  emit({ type: "queries", data: queries });

  // ── Steps 3 + 4: four branches run concurrently from here ──────────────────
  emit({
    type: "status",
    step: "check_visibility",
    message: "Checking Perplexity, ChatGPT, and the open web for each question…",
  });
  emit({ type: "status", step: "assess_pillars", message: "Scoring why AI does or doesn't cite you…" });

  const queryVisibilities: QueryVisibility[] = queries.map((q) => ({ query: q.text, engines: {} }));
  const webSearchResults: SearchResponse[] = [];

  // Branch A: all 5 queries in parallel, each running its 3 engines in
  // parallel and emitting as each one lands (order across queries/engines
  // doesn't matter — the UI is keyed by queryIndex + engine, not arrival order).
  const queryLoop = Promise.allSettled(
    queries.map(async (q, i) => {
      const emitEngine = (engine: EngineId) => (result: Awaited<ReturnType<typeof checkEngineVisibility>>) => {
        queryVisibilities[i].engines[engine] = result;
        emit({ type: "engine_result", queryIndex: i, total: queries.length, engine, data: result });
        return result;
      };

      const webSearchPromise = fetchWebSearch(q.text, tracker);
      const webPromise = webSearchPromise.then((search) => {
        webSearchResults[i] = search;
        return checkEngineVisibility({
          engine: "web",
          query: q.text,
          brandDomain: lead.domain,
          brandProduct: brand.product,
          tracker,
          webSearchResponse: search,
        }).then(emitEngine("web"));
      });

      const perplexityPromise = checkEngineVisibility({
        engine: "perplexity",
        query: q.text,
        brandDomain: lead.domain,
        brandProduct: brand.product,
        tracker,
      }).then(emitEngine("perplexity"));

      const chatgptPromise = checkEngineVisibility({
        engine: "chatgpt",
        query: q.text,
        brandDomain: lead.domain,
        brandProduct: brand.product,
        tracker,
      }).then(emitEngine("chatgpt"));

      await Promise.allSettled([webPromise, perplexityPromise, chatgptPromise]);
    })
  );

  // Branch B: leads-vs-brand classification. Only ever depended on `brand`, so
  // it runs alongside the engine loop instead of after it.
  const arpuBranch = (async (): Promise<ArpuVerdict | null> => {
    try {
      const out = await generateJson<{
        classification: Classification;
        anchorPriceMonthlyUsd: number;
        priceBasis: PriceBasis;
        isTransactionalConsumerSpend: boolean;
        demandLevel: DemandLevel;
        estimate: string;
        reasoning: string;
        transactionNoun: string;
      }>({
        system: ARPU_CLASSIFICATION_SYSTEM,
        prompt: arpuClassificationPrompt({
          domain: lead.domain,
          brandProduct: brand.product,
          brandCategory: brand.category,
          pricingSignals: brand.pricingSignals,
          pricingModel: brand.pricingModel,
          leadsThresholdUsd: config.leadsThresholdUsd,
        }),
        schema: arpuSchema,
        tracker,
        costLabel: "classify_arpu",
      });
      // The deterministic rule is the source of truth, not the model's own
      // self-labeled `classification` field — the model is reliable at pricing
      // and demand estimates, less reliable at consistently applying the
      // threshold rule to its own output.
      const verdict: ArpuVerdict = {
        classification: deriveClassification({
          anchorPriceMonthlyUsd: out.anchorPriceMonthlyUsd,
          isTransactionalConsumerSpend: out.isTransactionalConsumerSpend,
          demandLevel: out.demandLevel,
          thresholdUsd: config.leadsThresholdUsd,
        }),
        anchorPriceMonthlyUsd: out.anchorPriceMonthlyUsd,
        priceBasis: out.priceBasis,
        isTransactionalConsumerSpend: out.isTransactionalConsumerSpend,
        demandLevel: out.demandLevel,
        estimate: out.estimate,
        reasoning: out.reasoning,
        transactionNoun: out.transactionNoun,
      };
      emit({ type: "arpu", data: verdict });
      return verdict;
    } catch (e) {
      emit({
        type: "error",
        step: "classify_arpu",
        message: `Couldn't classify ARPU (${(e as Error).message}). Showing results without the branch.`,
        fatal: false,
      });
      return null;
    }
  })();

  // Branch C: onsite + review-platform pillars run alongside the engine loop
  // (they only need brand/domain); third-party mentions reuses the web
  // engine's search results, so it waits for the query loop's web calls to
  // land before its one synthesis call.
  const pillarsBranch = (async (): Promise<PillarScores> => {
    const [onsite, reviews] = await Promise.all([
      assessOnsite({
        domain: lead.domain,
        baseUrl,
        homepageHtml: site.homepageHtml,
        homepageText: site.homepageText,
        pricingText: site.pricingText,
        queries: queries.map((q) => q.text),
        tracker,
      }),
      assessReviewSites({ domain: lead.domain, brand, tracker }),
    ]);

    await queryLoop;
    const thirdparty = await assessThirdParty({
      domain: lead.domain,
      brandProduct: brand.product,
      webSearchResults: webSearchResults.filter(Boolean),
      tracker,
    });

    const pillars: PillarScores = { onsite, reviews, thirdparty };
    emit({ type: "pillars", data: pillars });
    return pillars;
  })();

  const [, arpu, pillars] = await Promise.all([queryLoop, arpuBranch, pillarsBranch]);

  record.visibility = queryVisibilities;
  record.arpu = arpu;
  record.pillars = pillars;

  // ── Step: log the completed onboarding ─────────────────────────────────────
  record.completedAt = new Date().toISOString();
  await store.logOnboarding(record);
  console.log(
    `[Scribble] audit cost estimate for ${lead.domain}: $${tracker.total().toFixed(4)} (${formatCostBreakdown(tracker)})`
  );
  emit({ type: "done", onboardingId: record.id });
}
