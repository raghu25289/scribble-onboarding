// Orchestration for Steps 2–4. Given a lead, this walks the whole agent:
//   fetch site → understand brand → generate queries → check each query's
//   visibility → classify ARPU → log the completed onboarding.
//
// It reports progress through an `emit` callback (one AnalyzeEvent at a time) so
// the API route can stream results to the UI as they complete. Every step is
// wrapped so a single failure degrades gracefully instead of killing the flow.

import { config } from "./config";
import { generateJson } from "./openrouter";
import { fetchSiteContent } from "./scrape";
import { searchWeb, resultsToText } from "./search";
import { store, makeId } from "./store";
import {
  BRAND_UNDERSTANDING_SYSTEM,
  brandUnderstandingPrompt,
  QUERY_GENERATION_SYSTEM,
  queryGenerationPrompt,
  VISIBILITY_JUDGE_SYSTEM,
  visibilityJudgePrompt,
  ARPU_CLASSIFICATION_SYSTEM,
  arpuClassificationPrompt,
} from "./prompts";
import type {
  AnalyzeEvent,
  BrandUnderstanding,
  Lead,
  OnboardingRecord,
  VisibilityResult,
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
    queries: { type: "array", items: { type: "string" } },
  },
  required: ["queries"],
};

const visibilitySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    visible: { type: "boolean" },
    winners: { type: "array", items: { type: "string" } },
    snippet: { type: "string" },
  },
  required: ["visible", "winners", "snippet"],
};

const arpuSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    arpuOver150: { type: "boolean" },
    estimate: { type: "string" },
    reasoning: { type: "string" },
  },
  required: ["arpuOver150", "estimate", "reasoning"],
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
    completedAt: "",
  };

  // ── Step 2a: fetch the site ────────────────────────────────────────────────
  emit({ type: "status", step: "fetch_site", message: `Fetching ${lead.domain}…` });
  const site = await fetchSiteContent(`https://${lead.domain}`);
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
  let queries: string[] = [];
  try {
    const out = await generateJson<{ queries: string[] }>({
      system: QUERY_GENERATION_SYSTEM,
      prompt: queryGenerationPrompt({
        domain: lead.domain,
        brandProduct: brand.product,
        brandAudience: brand.audience,
        brandCategory: brand.category,
      }),
      schema: queriesSchema,
    });
    queries = (out.queries || []).slice(0, config.queryCount);
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

  // ── Step 3: visibility check per query (streamed as each resolves) ──────────
  emit({ type: "status", step: "check_visibility", message: "Checking whether you show up in each answer…" });
  const visibility: VisibilityResult[] = [];
  for (let i = 0; i < queries.length; i++) {
    const query = queries[i];
    let result: VisibilityResult;
    try {
      const search = await searchWeb(query);
      if (!search.ok) {
        emit({
          type: "status",
          step: "check_visibility",
          message: `Search issue on query ${i + 1}: ${search.error}. Judging from limited data.`,
        });
      }
      const judged = await generateJson<{ visible: boolean; winners: string[]; snippet: string }>({
        system: VISIBILITY_JUDGE_SYSTEM,
        prompt: visibilityJudgePrompt({
          brandDomain: lead.domain,
          brandProduct: brand.product,
          query,
          resultsText: resultsToText(search),
        }),
        schema: visibilitySchema,
        maxTokens: 1200,
      });
      result = {
        query,
        visible: judged.visible,
        snippet: judged.snippet,
        winners: judged.winners || [],
      };
    } catch (e) {
      // Degrade this single row rather than the whole flow.
      result = {
        query,
        visible: false,
        snippet: `Couldn't complete the check for this query (${(e as Error).message}).`,
        winners: [],
      };
    }
    visibility.push(result);
    emit({ type: "visibility", index: i, total: queries.length, data: result });
  }
  record.visibility = visibility;

  // ── Step 4: ARPU classification + branch ───────────────────────────────────
  emit({ type: "status", step: "classify_arpu", message: "Estimating your ARPU to tailor the recommendation…" });
  try {
    const out = await generateJson<{ arpuOver150: boolean; estimate: string; reasoning: string }>({
      system: ARPU_CLASSIFICATION_SYSTEM,
      prompt: arpuClassificationPrompt({
        domain: lead.domain,
        brandProduct: brand.product,
        brandCategory: brand.category,
        pricingSignals: brand.pricingSignals,
        pricingModel: brand.pricingModel,
        thresholdUsd: config.arpuThresholdUsd,
      }),
      schema: arpuSchema,
    });
    const verdict: ArpuVerdict = {
      arpuOver150: out.arpuOver150,
      estimate: out.estimate,
      reasoning: out.reasoning,
      branch: out.arpuOver150 ? "lead-gen" : "brand",
    };
    record.arpu = verdict;
    emit({ type: "arpu", data: verdict });
  } catch (e) {
    emit({
      type: "error",
      step: "classify_arpu",
      message: `Couldn't classify ARPU (${(e as Error).message}). Showing results without the branch.`,
      fatal: false,
    });
  }

  // ── Step: log the completed onboarding ─────────────────────────────────────
  record.completedAt = new Date().toISOString();
  await store.logOnboarding(record);
  emit({ type: "done", onboardingId: record.id });
}
