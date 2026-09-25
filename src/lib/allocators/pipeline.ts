import { config } from "../config";
import { store, makeId } from "../store";
import type { AllocatorGraph, IndexProspect, IndexWorkspace, OnboardingRecord } from "../types";
import { allocatorConnectors } from "./sources";
import { allocatorMatches, hasAllocatorSelection } from "./matching";
import { upsertAllocatorOrganizations } from "./graph";

export async function ingestAllocatorGraph(): Promise<AllocatorGraph> {
  const startedAt = new Date().toISOString();
  const currentGraph = await store.getAllocatorGraph();
  const connectors = allocatorConnectors().filter((connector) => connector.enabled());
  const previousDiagnostics = new Map(currentGraph.ingestionRuns.flatMap((run) => run.sourceDiagnostics || []).map((item) => [item.sourceId, item]));
  const settled = await Promise.allSettled(connectors.map((connector) => connector.ingest(previousDiagnostics.get(connector.id))));
  const records = settled.flatMap((result) => result.status === "fulfilled" ? result.value.records : []);
  const sourceDiagnostics = settled.flatMap((result, index) => result.status === "fulfilled" ? result.value.diagnostics : [{ sourceId: connectors[index].id, attempted: true, fetchedCount: 0, acceptedCount: 0, rejectedCount: 0, failureReason: (result.reason as Error).message, lastSuccessAt: previousDiagnostics.get(connectors[index].id)?.lastSuccessAt || null, freshnessAt: previousDiagnostics.get(connectors[index].id)?.freshnessAt || null, durationMs: 0 }]);
  const errors = settled.flatMap((result, index) => result.status === "rejected" ? [`${connectors[index].id}: ${(result.reason as Error).message}`] : []);
  errors.push(...sourceDiagnostics.filter((item) => item.failureReason).map((item) => `${item.sourceId}: ${item.failureReason}`));
  let graph = upsertAllocatorOrganizations(currentGraph, records);
  graph = {
    ...graph,
    ingestionRuns: [...graph.ingestionRuns, {
      id: makeId("allocator_run"),
      startedAt,
      completedAt: new Date().toISOString(),
      connectors: connectors.map((connector) => connector.id),
      recordsSeen: records.length,
      organizationsUpserted: records.length,
      errors,
      sourceDiagnostics,
    }].slice(-100),
  };
  await store.saveAllocatorGraph(graph);
  return graph;
}

async function sourceIsReachable(url: string): Promise<boolean> {
  try {
    const parsed = new URL(url);
    if (config.allocatorDemoMode && parsed.hostname.endsWith(".example.invalid")) return true;
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
    const response = await fetch(url, {
      method: "GET",
      headers: { Range: "bytes=0-2048", "User-Agent": "ScribbleAllocatorVerifier/1.0" },
      signal: AbortSignal.timeout(5_000),
      redirect: "follow",
    });
    return response.ok || response.status === 206 || response.status === 403 || response.status === 429;
  } catch {
    return false;
  }
}

export async function verifyAllocatorProspects(prospects: IndexProspect[]): Promise<IndexProspect[]> {
  const checked: Array<IndexProspect | null> = await Promise.all(prospects.map(async (prospect): Promise<IndexProspect | null> => {
    const officialEvidence = prospect.evidence.filter((item) => item.sourceKind === "official_site");
    if (!officialEvidence.length) return null;
    const results = await Promise.all(officialEvidence.slice(0, 2).map((item) => sourceIsReachable(item.url)));
    if (!results.some(Boolean)) return null;
    return {
      ...prospect,
      allocatorMatch: prospect.allocatorMatch ? { ...prospect.allocatorMatch, lastVerifiedAt: new Date().toISOString() } : undefined,
    };
  }));
  return checked.filter((item): item is IndexProspect => item !== null);
}

export async function buildAllocatorFeed(record: OnboardingRecord, workspace: IndexWorkspace) {
  if (!hasAllocatorSelection(workspace)) return [];
  const graph = await store.getAllocatorGraph();
  const candidates = allocatorMatches(graph.organizations, record, workspace, config.allocatorFeedSize);
  return verifyAllocatorProspects(candidates);
}

export async function rematchAllocatorWorkspaces(graph: AllocatorGraph): Promise<number> {
  const workspaces = await store.listIndexWorkspaces();
  let matched = 0;
  for (const workspace of workspaces) {
    if (!hasAllocatorSelection(workspace)) continue;
    const record = await store.getOnboarding(workspace.onboardingId);
    if (!record) continue;
    const additions = await verifyAllocatorProspects(allocatorMatches(graph.organizations, record, workspace, config.allocatorFeedSize));
    if (!additions.length) continue;
    workspace.allocatorProspects = [...(workspace.allocatorProspects || []), ...additions];
    workspace.lastAllocatorFeedAt = new Date().toISOString();
    workspace.updatedAt = workspace.lastAllocatorFeedAt;
    await store.saveIndexWorkspace(workspace);
    matched += additions.length;
  }
  return matched;
}
