// Single source of truth for "what does this report show" — computed once
// from a stored OnboardingRecord and consumed identically by the live
// Next.js page and the standalone HTML download, so the two can never drift
// out of sync with each other.

import { aggregateQuery, competitorWinCounts, computeHeadlineScore, REAL_ENGINES } from "./engineVisibility";
import { bandColor } from "./severity";
import { computeCostBreakdown, estimateMonthlyAskVolume, formatMoney, round2SigFigs, roundLeadCount } from "./costEstimate";
import { fallbackLegitimateCompetitors, fallbackReportMoves } from "./reportInsights";
import type { OnboardingRecord, PillarId, ReportMove } from "./types";

const LEADS_FLOOR = 10;
const USD_FLOOR = 500;
const RECOVERABLE_SHARE = 0.6;

const ENGINE_LABELS: Record<string, string> = {
  perplexity: "Perplexity",
  chatgpt: "ChatGPT",
};

export interface MatrixRow {
  query: string;
  cells: (boolean | null)[]; // one per REAL_ENGINES, in order; null = couldn't check
}

export interface CompetitorBar {
  name: string;
  count: number;
  pct: number; // relative to the largest count, for bar width
  isBrand: boolean;
}

export interface CostRow {
  name: string;
  lowFormatted: string;
  highFormatted: string;
  lossPct: number; // relative to the largest row, for bar width
  recoverablePct: number;
}

export interface PillarRow {
  id: PillarId;
  label: string;
  score: number;
  color: string;
  note: string;
}

export interface ReportViewModel {
  domain: string;
  completedAt: string;
  category: string;
  token: string;
  // Cover (masthead + key findings) + where-you-stand + CTA finale always
  // render; buyers-and-costs / why-AI-skips-you / three-moves each collapse
  // when their data is missing. The slide-nav dot count and the download's
  // static dot markup both read this so they never drift from what
  // page.tsx actually renders.
  slideCount: number;

  scorePct: number;
  scoreColor: string;
  visibleChecks: number;
  totalChecks: number;

  buyerVolume: number;

  engineLabels: string[];
  matrixRows: MatrixRow[];

  competitorBars: CompetitorBar[];

  isPipeline: boolean;
  belowFloor: boolean;
  hasRisk: boolean;
  riskHeader: string;
  conservativeLoss: number;
  aggressiveLossFormatted: string;
  recoverable: number;
  costRows: CostRow[];

  pillars: PillarRow[] | null;
  framingLine: string;

  moves: [ReportMove, ReportMove, ReportMove] | null;
}

export function computeReportViewModel(record: OnboardingRecord): ReportViewModel {
  const { visible: visibleChecks, total: totalChecks } = computeHeadlineScore(record.visibility);
  const scorePct = totalChecks > 0 ? Math.round((visibleChecks / totalChecks) * 100) : 0;
  const scoreColor = bandColor(scorePct);
  const category = record.brand?.category || "your category";
  const buyerVolume = estimateMonthlyAskVolume(record.queries);

  const rows = record.queries.map((q, i) => ({
    demand: q,
    qv: record.visibility[i] ?? { query: q.text, engines: {} },
    agg: aggregateQuery(record.visibility[i] ?? { query: q.text, engines: {} }),
  }));

  const matrixRows: MatrixRow[] = rows.map((r) => ({
    query: r.demand.text,
    cells: REAL_ENGINES.map((engine) => {
      const result = r.qv.engines[engine];
      if (!result || !result.ok) return null;
      return result.visible;
    }),
  }));

  const invisibleRows = rows.filter((r) => r.agg.checkedCount > 0 && r.agg.invisible);
  const candidates = competitorWinCounts(invisibleRows.map((r) => ({ winners: r.agg.winners }))).slice(0, 10);
  const legitimate = record.reportInsights?.legitimateCompetitors ?? fallbackLegitimateCompetitors(candidates);
  const maxCompetitorCount = Math.max(...legitimate.map((c) => c.count), 1);
  const competitorBars: CompetitorBar[] = legitimate.map((c) => ({
    name: c.name,
    count: c.count,
    pct: Math.max(6, Math.round((c.count / maxCompetitorCount) * 100)),
    isBrand: c.name.toLowerCase() === record.domain.toLowerCase(),
  }));

  const arpu = record.arpu;
  const isPipeline = arpu ? arpu.classification === "leads" || arpu.classification === "unknown_pricing" : false;
  const breakdown = arpu && invisibleRows.length > 0 ? computeCostBreakdown(invisibleRows, arpu) : null;
  const hasRisk = !!breakdown;
  const conservativeLoss = breakdown ? (isPipeline ? breakdown.totalLowLeads : breakdown.totalLowUsd) : 0;
  const aggressiveLoss = breakdown ? (isPipeline ? breakdown.totalHighLeads : breakdown.totalHighUsd) : 0;
  const floor = isPipeline ? LEADS_FLOOR : USD_FLOOR;
  const belowFloor = hasRisk ? conservativeLoss < floor : false;
  const recoverable = hasRisk
    ? isPipeline
      ? roundLeadCount(conservativeLoss * RECOVERABLE_SHARE)
      : round2SigFigs(conservativeLoss * RECOVERABLE_SHARE)
    : 0;
  const riskHeader = isPipeline ? "Pipeline at risk" : "Revenue at risk";
  const aggressiveLossFormatted = isPipeline ? `${aggressiveLoss.toLocaleString("en-US")} leads/mo` : formatMoney(aggressiveLoss);

  const maxRowLoss = breakdown
    ? Math.max(...breakdown.rows.map((r) => (isPipeline ? r.lowLeads : r.lowUsd)), 1)
    : 1;
  const costRows: CostRow[] = breakdown
    ? breakdown.rows.map((r) => {
        const lowVal = isPipeline ? r.lowLeads : r.lowUsd;
        const highVal = isPipeline ? r.highLeads : r.highUsd;
        const lossPct = Math.max(6, Math.round((lowVal / maxRowLoss) * 100));
        return {
          name: r.demand.text,
          lowFormatted: isPipeline ? `${lowVal.toLocaleString("en-US")} leads/mo` : `${formatMoney(lowVal)}/mo`,
          highFormatted: isPipeline
            ? `${highVal.toLocaleString("en-US")} leads/mo`
            : `${formatMoney(highVal)}/mo`,
          lossPct,
          recoverablePct: lossPct * RECOVERABLE_SHARE,
        };
      })
    : [];

  const pillars: PillarRow[] | null = record.pillars
    ? [
        { id: "onsite" as const, label: "Site", score: record.pillars.onsite.score, note: record.pillars.onsite.gap },
        { id: "reviews" as const, label: "Reviews", score: record.pillars.reviews.score, note: record.pillars.reviews.gap },
        {
          id: "thirdparty" as const,
          label: "Mentions",
          score: record.pillars.thirdparty.score,
          note: record.pillars.thirdparty.gap,
        },
      ].map((p) => ({ ...p, color: bandColor(p.score) }))
    : null;

  const moves = record.reportInsights?.moves ?? (record.pillars ? fallbackReportMoves(record.pillars) : null);

  // Cover (masthead + key findings), where-you-stand, CTA finale.
  const hasBuyersOrCosts = competitorBars.length > 0 || hasRisk;
  const slideCount = 3 + (hasBuyersOrCosts ? 1 : 0) + (pillars ? 1 : 0) + (moves ? 1 : 0);

  return {
    domain: record.domain,
    completedAt: record.completedAt,
    category,
    token: record.reportToken,
    slideCount,
    scorePct,
    scoreColor,
    visibleChecks,
    totalChecks,
    buyerVolume,
    engineLabels: REAL_ENGINES.map((e) => ENGINE_LABELS[e] ?? e),
    matrixRows,
    competitorBars,
    isPipeline,
    belowFloor,
    hasRisk,
    riskHeader,
    conservativeLoss,
    aggressiveLossFormatted,
    recoverable,
    costRows,
    pillars,
    framingLine:
      "Your site you can fix. Independent voices citing you is what Scribble's creator network does.",
    moves,
  };
}
