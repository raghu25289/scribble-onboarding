import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { store } from "@/lib/store";
import { aggregateQuery, competitorWinCounts, computeHeadlineScore } from "@/lib/engineVisibility";
import { fallbackBenchmark, fallbackLegitimateCompetitors, fallbackReportMoves } from "@/lib/reportInsights";
import type { OnboardingRecord } from "@/lib/types";
import ReportHeader from "@/components/report/ReportHeader";
import BentoHero from "@/components/report/BentoHero";
import WhatsWorkingSection from "@/components/report/WhatsWorkingSection";
import WhatIsntSection from "@/components/report/WhatIsntSection";
import IndustryStandardSection from "@/components/report/IndustryStandardSection";
import ThreeMovesSection from "@/components/report/ThreeMovesSection";
import ReportCta from "@/components/report/ReportCta";

interface Props {
  params: Promise<{ token: string }>;
}

async function loadRecord(token: string): Promise<OnboardingRecord | null> {
  const record = await store.getOnboardingByToken(token);
  if (!record || !record.completedAt) return null;
  return record;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const record = await loadRecord(token);
  if (!record) return { title: "Report not found" };

  const title = `AI Visibility Report: ${record.domain}`;
  const description = `See where AI answers mention ${record.domain}, and where buyers are being sent to competitors instead.`;

  return {
    title,
    description,
    openGraph: { title, description, type: "website" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function ReportPage({ params }: Props) {
  const { token } = await params;
  const record = await loadRecord(token);
  if (!record) notFound();

  const { visible, total } = computeHeadlineScore(record.visibility);
  const headlineScorePct = total > 0 ? Math.round((visible / total) * 100) : 0;
  const category = record.brand?.category || "your category";

  const benchmark = record.reportInsights?.benchmark ?? fallbackBenchmark(headlineScorePct);
  const moves =
    record.reportInsights?.moves ??
    (record.pillars ? fallbackReportMoves(record.pillars) : null);

  const invisibleRows = record.queries
    .map((q, i) => ({ agg: aggregateQuery(record.visibility[i] ?? { query: q.text, engines: {} }) }))
    .filter((r) => r.agg.checkedCount > 0 && r.agg.invisible);
  const competitorCandidates = competitorWinCounts(invisibleRows.map((r) => ({ winners: r.agg.winners }))).slice(
    0,
    10
  );
  const legitimateCompetitors =
    record.reportInsights?.legitimateCompetitors ?? fallbackLegitimateCompetitors(competitorCandidates);

  return (
    <div className="report-page bg-stage min-h-screen">
      <ReportHeader domain={record.domain} completedAt={record.completedAt} />
      <BentoHero
        domain={record.domain}
        completedAt={record.completedAt}
        category={category}
        queries={record.queries}
        visibility={record.visibility}
        pillars={record.pillars}
        arpu={record.arpu}
        legitimateCompetitors={legitimateCompetitors}
      />
      <WhatsWorkingSection
        queries={record.queries}
        visibility={record.visibility}
        pillars={record.pillars}
      />
      <WhatIsntSection queries={record.queries} visibility={record.visibility} arpu={record.arpu} />
      <IndustryStandardSection
        category={category}
        headlineScorePct={headlineScorePct}
        benchmark={benchmark}
      />
      {moves && <ThreeMovesSection moves={moves} />}
      <ReportCta
        domain={record.domain}
        headlineScorePct={headlineScorePct}
        completedAt={record.completedAt}
      />
    </div>
  );
}
