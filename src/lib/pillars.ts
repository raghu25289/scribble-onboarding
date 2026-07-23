// The three-pillar citation score ("Why AI doesn't cite you"): onsite,
// review platforms, and third-party mentions. Each pillar is scored
// independently and degrades to a low score + honest gap sentence rather
// than failing the whole section.

import type { CostTracker } from "./cost";
import { TAVILY_ESTIMATED_COST_USD } from "./cost";
import { generateJson } from "./openrouter";
import {
  ONSITE_SCORING_SYSTEM,
  onsiteScoringPrompt,
  REVIEW_PLATFORM_DETECTION_SYSTEM,
  reviewPlatformDetectionPrompt,
  REVIEW_SCORING_SYSTEM,
  reviewScoringPrompt,
  THIRDPARTY_SCORING_SYSTEM,
  thirdPartyScoringPrompt,
} from "./prompts";
import { probePaths } from "./scrape";
import { resultsToText, searchWeb, type SearchResponse } from "./search";
import type { BrandUnderstanding, PillarScore } from "./types";

const scoreSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    score: { type: "integer" },
    gap: { type: "string" },
  },
  required: ["score", "gap"],
};

function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

// Category → fallback review platforms, used only if the LLM detection call
// fails. Matched loosely against the brand's category text.
const REVIEW_PLATFORM_FALLBACKS: { match: RegExp; platforms: string[] }[] = [
  { match: /saas|software|b2b|tool/i, platforms: ["G2", "Capterra"] },
  { match: /travel|hostel|hotel|hospitality/i, platforms: ["TripAdvisor", "Google Reviews"] },
  { match: /consumer|dtc|retail|ecommerce/i, platforms: ["Trustpilot", "Google Reviews"] },
  { match: /local|service/i, platforms: ["Yelp", "Google Reviews"] },
];
const DEFAULT_REVIEW_PLATFORMS = ["Trustpilot", "Google Reviews"];

// ─── Shared brand-anchored search corpus ────────────────────────────────────
// Both "review platforms" and "independent mentions" used to be graded on
// search results for the raw buyer questions (or, for reviews, a narrower
// per-platform search) — the wrong signal, since a buyer question like "what
// are the best budget Android phones" often returns generic listicles that
// never mention the brand at all. Both pillars now share ONE brand-anchored
// search pass instead.

type AnchoredQuery = { query: string; kind: "brand" | "competitor" | "category" | "product" | "reddit" };

function buildAnchoredQueries(domain: string, brand: BrandUnderstanding): AnchoredQuery[] {
  const competitor = brand.topCompetitors?.[0];
  const primaryProduct = brand.products?.[0]?.name;
  const queries: AnchoredQuery[] = [
    { query: `${domain} review`, kind: "brand" },
    { query: `best ${brand.category} brands`, kind: "category" },
    { query: `${domain} reddit`, kind: "reddit" },
  ];
  if (competitor) queries.push({ query: `${domain} vs ${competitor}`, kind: "competitor" });
  if (primaryProduct) queries.push({ query: `${domain} ${primaryProduct} review`, kind: "product" });
  return queries;
}

// Distinct external (non-brand-domain) hostnames found in a set of search
// responses — a deterministic signal for "real third-party coverage exists"
// that doesn't depend on the LLM scoring it correctly.
function countExternalHostnames(domain: string, responses: SearchResponse[]): number {
  const brandHost = domain.replace(/^www\./, "").toLowerCase();
  const seen = new Set<string>();
  for (const r of responses) {
    for (const result of r.results) {
      try {
        const host = new URL(result.url).hostname.replace(/^www\./, "").toLowerCase();
        if (host && !host.endsWith(brandHost)) seen.add(host);
      } catch {
        /* skip malformed URLs */
      }
    }
  }
  return seen.size;
}

export interface AnchoredSearchResult {
  resultsText: string;
  brandNameExternalCount: number; // external coverage from the "brand" + "reddit" queries specifically
}

export async function runAnchoredPillarSearches(
  domain: string,
  brand: BrandUnderstanding,
  tracker?: CostTracker
): Promise<AnchoredSearchResult> {
  const queries = buildAnchoredQueries(domain, brand);
  const responses = await Promise.all(queries.map((q) => searchWeb(q.query)));
  if (tracker) {
    for (let i = 0; i < responses.length; i++) tracker.add(TAVILY_ESTIMATED_COST_USD, "tavily");
  }

  const resultsText = queries
    .map((q, i) => `--- "${q.query}" ---\n${resultsToText(responses[i])}`)
    .join("\n\n");

  const brandNameResponses = queries
    .map((q, i) => ({ q, r: responses[i] }))
    .filter(({ q }) => q.kind === "brand" || q.kind === "reddit")
    .map(({ r }) => r);
  const brandNameExternalCount = countExternalHostnames(domain, brandNameResponses);

  return { resultsText, brandNameExternalCount };
}

export async function assessOnsite(args: {
  domain: string;
  baseUrl: string;
  homepageHtml: string | null;
  homepageText: string;
  pricingText: string | null;
  queries: string[];
  tracker?: CostTracker;
}): Promise<PillarScore> {
  try {
    const extra = await probePaths(
      args.baseUrl,
      args.homepageHtml,
      ["/compare", "/alternatives", "/vs", "/faq"],
      /compar|alternative|\bvs\b|faq/i,
      /./
    );
    const out = await generateJson<{ score: number; gap: string }>({
      system: ONSITE_SCORING_SYSTEM,
      prompt: onsiteScoringPrompt({
        domain: args.domain,
        homepageText: args.homepageText,
        pricingText: args.pricingText,
        extraPageText: extra?.text ?? null,
        extraPageUrl: extra?.url ?? null,
        queries: args.queries,
      }),
      schema: scoreSchema,
      tracker: args.tracker,
      costLabel: "pillar_onsite",
    });
    return { id: "onsite", label: "Your site", score: clampScore(out.score), gap: out.gap };
  } catch (e) {
    return {
      id: "onsite",
      label: "Your site",
      score: 0,
      gap: `Couldn't assess your site (${(e as Error).message}).`,
    };
  }
}

async function detectReviewPlatforms(brand: BrandUnderstanding, tracker?: CostTracker): Promise<string[]> {
  try {
    const out = await generateJson<{ platforms: string[] }>({
      system: REVIEW_PLATFORM_DETECTION_SYSTEM,
      prompt: reviewPlatformDetectionPrompt({ category: brand.category, product: brand.product }),
      schema: {
        type: "object",
        additionalProperties: false,
        properties: { platforms: { type: "array", items: { type: "string" } } },
        required: ["platforms"],
      },
      maxTokens: 300,
      tracker,
      costLabel: "pillar_reviews_detect",
    });
    if (out.platforms?.length) return out.platforms.slice(0, 3);
  } catch {
    /* fall through to the static fallback */
  }
  const fallback = REVIEW_PLATFORM_FALLBACKS.find((f) => f.match.test(brand.category));
  return fallback?.platforms ?? DEFAULT_REVIEW_PLATFORMS;
}

export async function assessReviewSites(args: {
  domain: string;
  brand: BrandUnderstanding;
  anchored: AnchoredSearchResult;
  tracker?: CostTracker;
}): Promise<PillarScore> {
  try {
    const platforms = await detectReviewPlatforms(args.brand, args.tracker);

    const out = await generateJson<{ score: number; gap: string }>({
      system: REVIEW_SCORING_SYSTEM,
      prompt: reviewScoringPrompt({
        domain: args.domain,
        platforms,
        resultsText: args.anchored.resultsText,
      }),
      schema: scoreSchema,
      tracker: args.tracker,
      costLabel: "pillar_reviews_score",
    });
    return { id: "reviews", label: "Review platforms", score: clampScore(out.score), gap: out.gap };
  } catch (e) {
    return {
      id: "reviews",
      label: "Review platforms",
      score: 0,
      gap: `Couldn't assess review platforms (${(e as Error).message}).`,
    };
  }
}

// Independent Mentions is only ever as good as the search results it's
// scored against. A brand-anchored floor here matters: a globally-reviewed
// brand scoring 0 means the check is broken, not the brand.
const THIRDPARTY_SCORE_FLOOR = 30;
const THIRDPARTY_FLOOR_EXTERNAL_THRESHOLD = 3;

export async function assessThirdParty(args: {
  domain: string;
  brandProduct: string;
  anchored: AnchoredSearchResult;
  tracker?: CostTracker;
}): Promise<PillarScore> {
  try {
    const out = await generateJson<{ score: number; gap: string }>({
      system: THIRDPARTY_SCORING_SYSTEM,
      prompt: thirdPartyScoringPrompt({
        domain: args.domain,
        brandProduct: args.brandProduct,
        resultsText: args.anchored.resultsText,
      }),
      schema: scoreSchema,
      tracker: args.tracker,
      costLabel: "pillar_thirdparty",
    });
    let score = clampScore(out.score);
    if (args.anchored.brandNameExternalCount >= THIRDPARTY_FLOOR_EXTERNAL_THRESHOLD) {
      score = Math.max(score, THIRDPARTY_SCORE_FLOOR);
    }
    return { id: "thirdparty", label: "Independent mentions", score, gap: out.gap };
  } catch (e) {
    return {
      id: "thirdparty",
      label: "Independent mentions",
      score: 0,
      gap: `Couldn't assess third-party mentions (${(e as Error).message}).`,
    };
  }
}
