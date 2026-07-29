// Generates the two report-only pieces of analysis that don't exist anywhere
// else in the audit pipeline: a category benchmark estimate (leader/median
// visibility %) and the "three moves" card. Both are generated ONCE, here, at
// audit-completion time, and stored on the OnboardingRecord — the public
// /report/{token} page reads the stored result back statically and never
// re-runs this call, so a forwarded report link stays fast and free to open.

import type { CostTracker } from "./cost";
import { generateJson } from "./openrouter";
import { REPORT_INSIGHTS_SYSTEM, reportInsightsPrompt } from "./prompts";
import type { PillarId, PillarScores, ReportInsights, ReportMove, ReportMoveImpact } from "./types";

const reportInsightsSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    benchmark: {
      type: "object",
      additionalProperties: false,
      properties: {
        leaderPct: { type: "integer" },
        medianPct: { type: "integer" },
      },
      required: ["leaderPct", "medianPct"],
    },
    moves: {
      // No minItems/maxItems: several OpenRouter-routed providers reject
      // array bounds other than 0 or 1 in strict json_schema mode. Exactly-3
      // is enforced in code below instead (padded from the pillar-derived
      // fallback if the model returns fewer).
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          impact: { type: "string", enum: ["high_leverage", "fast_win", "compounding"] },
          pillar: { type: "string", enum: ["onsite", "reviews", "thirdparty"] },
        },
        required: ["title", "description", "impact", "pillar"],
      },
    },
    legitimateCompetitors: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: ["benchmark", "moves", "legitimateCompetitors"],
};

// Defensive backstop against the prompt's "no em dash" instruction being
// ignored: models occasionally slip one in anyway.
function stripEmDash(s: string): string {
  return s.replace(/\s*[—–]\s*/g, ", ").trim();
}

function clampPct(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export interface CompetitorCandidate {
  name: string;
  count: number;
}

// Deterministic pre/post filter for obviously junk competitor names — random
// slugs, parked-domain-looking strings — so the hero bento's "who wins" tile
// never shows garbage even when the LLM legitimacy check fails or is wrong.
// The detailed matrix further down still shows every raw winner unfiltered.
export function looksLikeJunkName(name: string): boolean {
  const trimmed = name.trim();
  if (!trimmed) return true;
  // 3+ consecutive digits: real brand/publication names essentially never
  // have long digit runs (contrast a raw slug like "xk294plq7").
  if (/\d{3,}/.test(trimmed)) return true;
  // A short alnum blob sitting on a low-trust/free TLD — reads as a raw
  // parked or throwaway domain, not a brand.
  if (/^[a-z0-9-]{3,20}\.(xyz|top|click|info|biz|online|site|shop|click)$/i.test(trimmed)) return true;
  // No vowels across a longish token: reads as a random string, not a word.
  const letters = trimmed.replace(/[^a-z]/gi, "");
  if (letters.length >= 6 && !/[aeiou]/i.test(letters)) return true;
  return false;
}

// Pure-code fallback (no LLM) for when generateReportInsights fails
// entirely — still strips the obvious junk via the heuristic above.
export function fallbackLegitimateCompetitors(
  candidates: CompetitorCandidate[]
): CompetitorCandidate[] {
  return candidates.filter((c) => !looksLikeJunkName(c.name)).slice(0, 5);
}

interface RawInsights {
  benchmark: { leaderPct: number; medianPct: number };
  moves: { title: string; description: string; impact: ReportMoveImpact; pillar: PillarId }[];
  legitimateCompetitors: string[];
}

export async function generateReportInsights(input: {
  domain: string;
  category: string;
  brandProduct: string;
  headlineScorePct: number;
  pillars: PillarScores;
  invisibleQueries: { query: string; winners: string[] }[];
  topCompetitors: string[];
  competitorCandidates: CompetitorCandidate[];
  tracker?: CostTracker;
}): Promise<ReportInsights> {
  const pillarList = [input.pillars.onsite, input.pillars.reviews, input.pillars.thirdparty];

  // Drop obvious junk before it ever reaches the model — saves tokens and
  // means the LLM only has to judge genuinely borderline/legitimate-looking
  // names for spam/parked/irrelevant.
  const preFiltered = input.competitorCandidates.filter((c) => !looksLikeJunkName(c.name));

  const out = await generateJson<RawInsights>({
    system: REPORT_INSIGHTS_SYSTEM,
    prompt: reportInsightsPrompt({
      domain: input.domain,
      category: input.category,
      brandProduct: input.brandProduct,
      headlineScorePct: input.headlineScorePct,
      pillars: pillarList,
      invisibleQueries: input.invisibleQueries,
      topCompetitors: input.topCompetitors,
      competitorCandidates: preFiltered.map((c) => c.name),
    }),
    schema: reportInsightsSchema,
    tracker: input.tracker,
    costLabel: "report_insights",
  });

  // The benchmark's whole point is showing this brand behind the pack --
  // enforce that in code rather than trusting the model to honor the prompt.
  const leaderPct = Math.max(clampPct(out.benchmark.leaderPct), input.headlineScorePct);
  const medianPct = Math.max(
    Math.min(clampPct(out.benchmark.medianPct), leaderPct),
    input.headlineScorePct
  );

  const generated = out.moves.slice(0, 3).map(
    (m): ReportMove => ({
      title: stripEmDash(m.title),
      description: stripEmDash(m.description),
      impact: m.impact,
      pillar: m.pillar,
    })
  );

  // Pad with the deterministic pillar-derived fallback if the model returned
  // fewer than 3 (schema can't enforce an exact count in strict mode — see
  // the comment on `moves` above).
  const padding = generated.length < 3 ? fallbackReportMoves(input.pillars) : [];
  const moves = [...generated, ...padding].slice(0, 3) as [ReportMove, ReportMove, ReportMove];

  // Only trust names that were actually offered as candidates (case-
  // insensitive) — a model that hallucinates a new name gets ignored rather
  // than shown. Re-attach the real counts, which are deterministic, not
  // model-derived.
  const candidateByLower = new Map(preFiltered.map((c) => [c.name.toLowerCase(), c]));
  const legitimateFromModel = out.legitimateCompetitors
    .map((name) => candidateByLower.get(name.toLowerCase()))
    .filter((c): c is CompetitorCandidate => !!c && !looksLikeJunkName(c.name));

  const legitimateCompetitors =
    legitimateFromModel.length > 0
      ? legitimateFromModel.slice(0, 5)
      : fallbackLegitimateCompetitors(preFiltered);

  return {
    benchmark: { leaderPct, medianPct },
    moves,
    legitimateCompetitors,
  };
}

// Static, non-LLM fallback for when generateReportInsights fails — the
// report page must never show an empty benchmark/moves section.
export function fallbackBenchmark(headlineScorePct: number): { leaderPct: number; medianPct: number } {
  const leaderPct = Math.min(100, headlineScorePct + 35);
  const medianPct = Math.min(leaderPct, headlineScorePct + 15);
  return { leaderPct, medianPct };
}

export function fallbackReportMoves(pillars: PillarScores): [ReportMove, ReportMove, ReportMove] {
  const distribution = [pillars.reviews, pillars.thirdparty].sort((a, b) => a.score - b.score);

  return [
    {
      title: "Fix your onsite gap",
      description: pillars.onsite.gap,
      impact: "fast_win",
      pillar: "onsite",
    },
    {
      title: `Close the ${distribution[0].label.toLowerCase()} gap`,
      description: distribution[0].gap,
      impact: "high_leverage",
      pillar: distribution[0].id,
    },
    {
      title: `Build ${distribution[1].label.toLowerCase()} presence`,
      description: distribution[1].gap,
      impact: "compounding",
      pillar: distribution[1].id,
    },
  ];
}
