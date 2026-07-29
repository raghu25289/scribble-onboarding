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
  },
  required: ["benchmark", "moves"],
};

// Defensive backstop against the prompt's "no em dash" instruction being
// ignored: models occasionally slip one in anyway.
function stripEmDash(s: string): string {
  return s.replace(/\s*[—–]\s*/g, ", ").trim();
}

function clampPct(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

interface RawInsights {
  benchmark: { leaderPct: number; medianPct: number };
  moves: { title: string; description: string; impact: ReportMoveImpact; pillar: PillarId }[];
}

export async function generateReportInsights(input: {
  domain: string;
  category: string;
  brandProduct: string;
  headlineScorePct: number;
  pillars: PillarScores;
  invisibleQueries: { query: string; winners: string[] }[];
  topCompetitors: string[];
  tracker?: CostTracker;
}): Promise<ReportInsights> {
  const pillarList = [input.pillars.onsite, input.pillars.reviews, input.pillars.thirdparty];

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

  return {
    benchmark: { leaderPct, medianPct },
    moves,
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
