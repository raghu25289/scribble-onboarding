import { NextRequest, NextResponse } from "next/server";
import { ingestAllocatorGraph, rematchAllocatorWorkspaces } from "@/lib/allocators/pipeline";
import { config } from "@/lib/config";

export const runtime = "nodejs";
export const maxDuration = 300;

async function run(request: NextRequest) {
  if (!config.allocatorPipelineEnabled) {
    return NextResponse.json({ error: "Allocator pipeline disabled" }, { status: 404 });
  }
  const expected = process.env.CRON_SECRET;
  if (!expected || request.headers.get("authorization") !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const graph = await ingestAllocatorGraph();
  const leadsMatched = await rematchAllocatorWorkspaces(graph);
  const latest = graph.ingestionRuns.at(-1);
  return NextResponse.json({
    ok: true,
    organizations: graph.organizations.length,
    leadsMatched,
    run: latest,
  });
}

export const GET = run;
export const POST = run;
