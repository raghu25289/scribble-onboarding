import type { Metadata } from "next";
import { notFound } from "next/navigation";
import IndexWorkspaceView from "@/components/index/IndexWorkspaceView";
import { loadIndexWorkspace } from "@/lib/indexWorkspace";
import { config } from "@/lib/config";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

interface Props {
  params: Promise<{ token: string }>;
}

export const metadata: Metadata = {
  title: "Index Leads · Scribble",
  description: "Find and qualify the right people for your business.",
  robots: { index: false, follow: false },
};

export default async function IndexPage({ params }: Props) {
  const { token } = await params;
  const loaded = await loadIndexWorkspace(token);
  if (!loaded) notFound();

  return (
    <IndexWorkspaceView
      accessToken={token}
      initialWorkspace={loaded.workspace}
      brand={loaded.record.brand}
      emailDeliveryConfigured={!!(process.env.RESEND_API_KEY && process.env.OUTREACH_FROM_EMAIL)}
      allocatorPipelineEnabled={config.allocatorPipelineEnabled}
    />
  );
}
