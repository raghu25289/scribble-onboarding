import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { store } from "@/lib/store";
import { computeReportViewModel } from "@/lib/reportView";
import ReportHeader from "@/components/report/ReportHeader";
import Masthead from "@/components/report/Masthead";
import KeyFindingsStrip from "@/components/report/KeyFindingsStrip";
import Section01WhereYouStand from "@/components/report/Section01WhereYouStand";
import Section02WhereBuyersGo from "@/components/report/Section02WhereBuyersGo";
import Section03WhatItCosts from "@/components/report/Section03WhatItCosts";
import Section04WhyAISkipsYou from "@/components/report/Section04WhyAISkipsYou";
import Section05ThreeMoves from "@/components/report/Section05ThreeMoves";
import CtaFinaleLive from "@/components/report/CtaFinaleLive";

interface Props {
  params: Promise<{ token: string }>;
}

async function loadView(token: string) {
  const record = await store.getOnboardingByToken(token);
  if (!record || !record.completedAt) return null;
  return computeReportViewModel(record);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const view = await loadView(token);
  if (!view) return { title: "Report not found" };

  const title = `AI Visibility Report: ${view.domain}`;
  const description = `See where AI answers mention ${view.domain}, and where buyers are being sent to competitors instead.`;

  return {
    title,
    description,
    openGraph: { title, description, type: "website" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function ReportPage({ params }: Props) {
  const { token } = await params;
  const view = await loadView(token);
  if (!view) notFound();

  return (
    <div className="rp-page">
      <ReportHeader token={token} />
      <Masthead domain={view.domain} completedAt={view.completedAt} category={view.category} />
      <KeyFindingsStrip view={view} isStatic={false} />
      <Section01WhereYouStand view={view} isStatic={false} />
      <Section02WhereBuyersGo view={view} isStatic={false} />
      <Section03WhatItCosts view={view} isStatic={false} />
      <Section04WhyAISkipsYou view={view} isStatic={false} />
      <Section05ThreeMoves view={view} />
      <CtaFinaleLive view={view} />
    </div>
  );
}
