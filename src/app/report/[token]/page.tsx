import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { store } from "@/lib/store";
import { computeHeadlineScore } from "@/lib/engineVisibility";
import { estimateMonthlyAskVolume } from "@/lib/costEstimate";
import { fallbackBenchmark, fallbackReportMoves } from "@/lib/reportInsights";
import type { OnboardingRecord } from "@/lib/types";
import ReportHeader from "@/components/report/ReportHeader";
import ReportHero from "@/components/report/ReportHero";
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
  const buyerVolume = estimateMonthlyAskVolume(record.queries);
  const category = record.brand?.category || "your category";

  const benchmark = record.reportInsights?.benchmark ?? fallbackBenchmark(headlineScorePct);
  const moves =
    record.reportInsights?.moves ??
    (record.pillars ? fallbackReportMoves(record.pillars) : null);

  return (
    <div className="report-page bg-stage min-h-screen">
      <ReportHeader domain={record.domain} completedAt={record.completedAt} />
      <ReportHero domain={record.domain} scorePct={headlineScorePct} buyerVolume={buyerVolume} />
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
