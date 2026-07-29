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
import { store, makeId, makeReportToken } from "./store";
import { deriveClassification, resolvePriceConfidence } from "./classification";
import { assessOnsite, assessReviewSites, assessThirdParty, runAnchoredPillarSearches } from "./pillars";
import { aggregateQuery, computeHeadlineScore } from "./engineVisibility";
import { generateReportInsights } from "./reportInsights";
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
  BrandProduct,
  BrandUnderstanding,
  Classification,
  DemandLevel,
  DemandTier,
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
    products: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          priceMonthlyUsd: { type: "number" },
        },
        required: ["name", "priceMonthlyUsd"],
      },
    },
    topCompetitors: { type: "array", items: { type: "string" } },
  },
  required: ["product", "audience", "category", "pricingSignals", "pricingModel", "products", "topCompetitors"],
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
          mappedProductName: { type: "string" },
          demandTier: { type: "string", enum: ["niche", "moderate", "high", "mass"] },
          tierJustification: { type: "string" },
        },
        required: ["text", "mappedProductName", "demandTier", "tierJustification"],
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
    priceConfidence: {
      type: "string",
      enum: ["found_on_site", "search_derived", "assumed"],
    },
    isTransactionalConsumerSpend: { type: "boolean" },
    demandLevel: { type: "string", enum: ["high", "medium", "near_zero"] },
    estimate: { type: "string" },
    reasoning: { type: "string" },
    transactionNoun: { type: "string" },
    plausibleMonthlyRevenueUsd: { type: "number" },
  },
  required: [
    "classification",
    "anchorPriceMonthlyUsd",
    "priceBasis",
    "priceConfidence",
    "isTransactionalConsumerSpend",
    "demandLevel",
    "estimate",
    "reasoning",
    "transactionNoun",
    "plausibleMonthlyRevenueUsd",
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
    reportToken: makeReportToken(),
    reportInsights: null,
  };

  const tracker = createCostTracker();

  // ── Step 2a: fetch the site ────────────────────────────────────────────────
  emit({ type: "status", step: "fetch_site", message: `Fetching ${lead.domain}…` });
  const baseUrl = `https://${lead.domain}`;
  const site = await fetchSiteContent(baseUrl, tracker);
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
      products: [],
      topCompetitors: [],
    };
  }
  record.brand = brand;
  emit({ type: "brand", data: brand });

  // ── Step 2c: generate 5 high-intent queries ────────────────────────────────
  emit({ type: "status", step: "generate_queries", message: "Generating the 5 questions buyers ask AI about this…" });
  let queries: QueryWithDemand[] = [];
  try {
    type RawQuery = {
      text: string;
      mappedProductName: string;
      demandTier: DemandTier;
      tierJustification: string;
    };
    const out = await generateJson<{ queries: RawQuery[] }>({
      system: QUERY_GENERATION_SYSTEM,
      prompt: queryGenerationPrompt({
        domain: lead.domain,
        brandProduct: brand.product,
        brandAudience: brand.audience,
        brandCategory: brand.category,
        brandProducts: brand.products,
      }),
      schema: queriesSchema,
      tracker,
      costLabel: "query_generation",
    });

    // The model names a product; code supplies its price, so there's a
    // single source of truth for numbers (the brand's own products list)
    // instead of asking the model to restate a price it could get wrong.
    const findProductPrice = (name: string): number | null => {
      const match = brand.products.find(
        (p: BrandProduct) => p.name.trim().toLowerCase() === name.trim().toLowerCase()
      );
      // A non-positive price isn't a real price (the model failed to infer
      // one) — treat it the same as "no product mapped" and fall back to the
      // brand anchor rather than pricing the query at $0.
      return match && match.priceMonthlyUsd > 0 ? match.priceMonthlyUsd : null;
    };

    queries = (out.queries || []).slice(0, config.queryCount).map((q) => ({
      text: q.text,
      demandTier: q.demandTier,
      tierJustification: q.tierJustification,
      mappedProductName: q.mappedProductName,
      mappedPriceMonthlyUsd: q.mappedProductName ? findProductPrice(q.mappedProductName) : null,
    }));
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
      // A pricing signal actually exists (from the site, or the search
      // fallback) vs. none at all. When there's truly nothing, we still ask
      // the model for demand/revenue judgment (useful for the lost-leads
      // math below) but never trust — or show — a price it had to invent
      // from nothing. See scrape.ts's fetchSiteContent for how pricingSource
      // is determined.
      const pricingKnown = site.pricingSource !== "none";

      const out = await generateJson<{
        classification: Classification;
        anchorPriceMonthlyUsd: number;
        priceBasis: PriceBasis;
        priceConfidence: string;
        isTransactionalConsumerSpend: boolean;
        demandLevel: DemandLevel;
        estimate: string;
        reasoning: string;
        transactionNoun: string;
        plausibleMonthlyRevenueUsd: number;
      }>({
        system: ARPU_CLASSIFICATION_SYSTEM,
        prompt: arpuClassificationPrompt({
          domain: lead.domain,
          brandProduct: brand.product,
          brandCategory: brand.category,
          pricingSignals: brand.pricingSignals,
          pricingModel: brand.pricingModel,
          leadsThresholdUsd: config.leadsThresholdUsd,
          pricingSource: site.pricingSource,
        }),
        schema: arpuSchema,
        tracker,
        costLabel: "classify_arpu",
      });

      // The deterministic rule is the source of truth, not the model's own
      // self-labeled `classification` field — the model is reliable at pricing
      // and demand estimates, less reliable at consistently applying the
      // threshold rule to its own output. When no pricing signal exists at
      // all, code overrides both classification and price outright rather
      // than trusting the model not to guess — see item 3 of the site
      // ingestion fix: an honest "unknown" beats a silently invented number.
      const verdict: ArpuVerdict = pricingKnown
        ? {
            classification: deriveClassification({
              anchorPriceMonthlyUsd: out.anchorPriceMonthlyUsd,
              isTransactionalConsumerSpend: out.isTransactionalConsumerSpend,
              demandLevel: out.demandLevel,
              thresholdUsd: config.leadsThresholdUsd,
            }),
            anchorPriceMonthlyUsd: out.anchorPriceMonthlyUsd,
            priceBasis: out.priceBasis,
            priceConfidence: resolvePriceConfidence(site.pricingSource as "site" | "search", out.priceConfidence),
            isTransactionalConsumerSpend: out.isTransactionalConsumerSpend,
            demandLevel: out.demandLevel,
            estimate: out.estimate,
            reasoning: out.reasoning,
            transactionNoun: out.transactionNoun,
            plausibleMonthlyRevenueUsd: out.plausibleMonthlyRevenueUsd,
          }
        : {
            classification: "unknown_pricing",
            anchorPriceMonthlyUsd: null,
            priceBasis: out.priceBasis,
            priceConfidence: undefined,
            isTransactionalConsumerSpend: out.isTransactionalConsumerSpend,
            demandLevel: out.demandLevel,
            estimate: "Pricing not detectable",
            reasoning:
              "We checked your homepage, common pricing paths (/pricing, /plans, /subscribe, and others), pricing-related nav and footer links, and a web search for your pricing — none of it turned up a number we could anchor on. Rather than guess, we're marking this unknown.",
            transactionNoun: out.transactionNoun,
            plausibleMonthlyRevenueUsd: out.plausibleMonthlyRevenueUsd,
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

  // Branch C: all three pillars run alongside the engine loop from the start.
  // Review platforms and third-party mentions share one brand-anchored search
  // pass (see runAnchoredPillarSearches) instead of either searching the raw
  // buyer questions or waiting on the query loop's results.
  const pillarsBranch = (async (): Promise<PillarScores> => {
    const anchored = await runAnchoredPillarSearches(lead.domain, brand, tracker);
    const [onsite, reviews, thirdparty] = await Promise.all([
      assessOnsite({
        domain: lead.domain,
        baseUrl,
        homepageHtml: site.homepageHtml,
        homepageText: site.homepageText,
        pricingText: site.pricingText,
        queries: queries.map((q) => q.text),
        tracker,
      }),
      assessReviewSites({ domain: lead.domain, brand, anchored, tracker }),
      assessThirdParty({ domain: lead.domain, brandProduct: brand.product, anchored, tracker }),
    ]);

    const pillars: PillarScores = { onsite, reviews, thirdparty };
    emit({ type: "pillars", data: pillars });
    return pillars;
  })();

  const [, arpu, pillars] = await Promise.all([queryLoop, arpuBranch, pillarsBranch]);

  record.visibility = queryVisibilities;
  record.arpu = arpu;
  record.pillars = pillars;

  // ── Step: generate report-only insights (benchmark + three moves) ─────────
  // Best-effort and non-fatal: the shareable report page falls back to static
  // copy derived from `pillars` alone when this is null. Runs once, here, so
  // the report page never re-calls the model on page view.
  if (pillars) {
    try {
      const { visible, total } = computeHeadlineScore(queryVisibilities);
      const headlineScorePct = total > 0 ? Math.round((visible / total) * 100) : 0;
      const invisibleQueries = queryVisibilities
        .map((qv) => ({ query: qv.query, agg: aggregateQuery(qv) }))
        .filter((r) => r.agg.invisible)
        .map((r) => ({ query: r.query, winners: r.agg.winners.map((w) => w.name) }));

      record.reportInsights = await generateReportInsights({
        domain: lead.domain,
        category: brand.category,
        brandProduct: brand.product,
        headlineScorePct,
        pillars,
        invisibleQueries,
        topCompetitors: brand.topCompetitors,
        tracker,
      });
    } catch (e) {
      console.error("[Scribble] report insights generation failed:", (e as Error).message);
    }
  }

  // ── Step: log the completed onboarding ─────────────────────────────────────
  record.completedAt = new Date().toISOString();
  await store.logOnboarding(record);
  console.log(
    `[Scribble] audit cost estimate for ${lead.domain}: $${tracker.total().toFixed(4)} (${formatCostBreakdown(tracker)})`
  );
  emit({ type: "done", onboardingId: record.id, reportToken: record.reportToken });
}
