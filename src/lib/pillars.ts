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
  tracker?: CostTracker;
}): Promise<PillarScore> {
  try {
    const platforms = await detectReviewPlatforms(args.brand, args.tracker);

    const searches = await Promise.all(
      platforms.slice(0, 3).map((p) => searchWeb(`${args.domain} reviews ${p}`))
    );
    if (args.tracker) {
      for (let i = 0; i < searches.length; i++) args.tracker.add(TAVILY_ESTIMATED_COST_USD, "tavily");
    }
    const resultsText = searches
      .map((s, i) => `--- ${platforms[i]} ---\n${resultsToText(s)}`)
      .join("\n\n");

    const out = await generateJson<{ score: number; gap: string }>({
      system: REVIEW_SCORING_SYSTEM,
      prompt: reviewScoringPrompt({ domain: args.domain, platforms, resultsText }),
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

// Reuses the "web" engine's search results already gathered per query in
// Part 1 — no new search calls, which is why this pillar has to run after
// (or alongside the tail of) the query-visibility loop.
export async function assessThirdParty(args: {
  domain: string;
  brandProduct: string;
  webSearchResults: SearchResponse[];
  tracker?: CostTracker;
}): Promise<PillarScore> {
  try {
    const resultsText = args.webSearchResults.map((s) => resultsToText(s)).join("\n\n");
    const out = await generateJson<{ score: number; gap: string }>({
      system: THIRDPARTY_SCORING_SYSTEM,
      prompt: thirdPartyScoringPrompt({
        domain: args.domain,
        brandProduct: args.brandProduct,
        resultsText,
      }),
      schema: scoreSchema,
      tracker: args.tracker,
      costLabel: "pillar_thirdparty",
    });
    return { id: "thirdparty", label: "Independent mentions", score: clampScore(out.score), gap: out.gap };
  } catch (e) {
    return {
      id: "thirdparty",
      label: "Independent mentions",
      score: 0,
      gap: `Couldn't assess third-party mentions (${(e as Error).message}).`,
    };
  }
}
