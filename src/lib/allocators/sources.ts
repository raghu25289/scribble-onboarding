import type { AllocatorOrganization, AllocatorSourceDiagnostic } from "../types";
import { promises as fs } from "node:fs";
import path from "node:path";
import { ingestSecPublicData, type ConnectorResult } from "./secPublic";

export interface AllocatorConnector {
  id: string;
  enabled(): boolean;
  ingest(previous?: AllocatorSourceDiagnostic): Promise<ConnectorResult>;
}

class JsonFeedConnector implements AllocatorConnector {
  constructor(
    public id: string,
    private urlEnv: string,
    private tokenEnv?: string
  ) {}

  enabled(): boolean {
    return !!process.env[this.urlEnv] && (!this.tokenEnv || !!process.env[this.tokenEnv]);
  }

  async ingest(): Promise<ConnectorResult> {
    const started = Date.now();
    const url = process.env[this.urlEnv];
    if (!url) return { records: [], diagnostics: [] };
    const token = this.tokenEnv ? process.env[this.tokenEnv] : undefined;
    const response = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      signal: AbortSignal.timeout(25_000),
    });
    if (!response.ok) throw new Error(`${this.id} returned ${response.status}`);
    const body = await response.json() as { organizations?: AllocatorOrganization[] } | AllocatorOrganization[];
    const records = Array.isArray(body) ? body : body.organizations || [];
    return { records, diagnostics: [{ sourceId: this.id, attempted: true, fetchedCount: records.length, acceptedCount: records.length, rejectedCount: 0, failureReason: null, lastSuccessAt: new Date().toISOString(), freshnessAt: new Date().toISOString(), durationMs: Date.now() - started }] };
  }
}

class SecPublicConnector implements AllocatorConnector {
  id = "sec-adv-iapd-public";
  enabled(): boolean { return process.env.ALLOCATOR_SEC_PUBLIC_ENABLED !== "false"; }
  ingest(previous?: AllocatorSourceDiagnostic): Promise<ConnectorResult> { return ingestSecPublicData({ previous }); }
}

class DemoFixtureConnector implements AllocatorConnector {
  id = "fictional-demo-fixture";
  enabled(): boolean { return process.env.ALLOCATOR_DEMO_MODE === "true"; }
  async ingest(): Promise<ConnectorResult> {
    const started = Date.now();
    const raw = await fs.readFile(path.join(process.cwd(), "data/allocator-fixtures.sample.json"), "utf8");
    const records = (JSON.parse(raw) as { organizations: AllocatorOrganization[] }).organizations;
    const now = new Date().toISOString();
    return { records, diagnostics: [{ sourceId: this.id, attempted: true, fetchedCount: records.length, acceptedCount: records.length, rejectedCount: 0, failureReason: null, lastSuccessAt: now, freshnessAt: now, sourceVersion: "fixture-v1", durationMs: Date.now() - started }] };
  }
}

// Feed URLs point at customer-owned/licensed ETL outputs. This keeps source
// licensing, rate limits, robots handling, and credentials outside the UI app.
export function allocatorConnectors(): AllocatorConnector[] {
  return [
    new DemoFixtureConnector(),
    new SecPublicConnector(),
    new JsonFeedConnector("sec-adv-iapd-custom-feed", "ALLOCATOR_SEC_ADV_FEED_URL"),
    new JsonFeedConnector("official-sites", "ALLOCATOR_OFFICIAL_SITES_FEED_URL"),
    new JsonFeedConnector("defillama-dune-explorers", "ALLOCATOR_ONCHAIN_FEED_URL"),
    new JsonFeedConnector("crunchbase", "ALLOCATOR_CRUNCHBASE_FEED_URL", "CRUNCHBASE_API_KEY"),
    new JsonFeedConnector("pitchbook", "ALLOCATOR_PITCHBOOK_FEED_URL", "PITCHBOOK_API_KEY"),
    new JsonFeedConnector("rootdata", "ALLOCATOR_ROOTDATA_FEED_URL", "ROOTDATA_API_KEY"),
    new JsonFeedConnector("nansen", "ALLOCATOR_NANSEN_FEED_URL", "NANSEN_API_KEY"),
    new JsonFeedConnector("arkham", "ALLOCATOR_ARKHAM_FEED_URL", "ARKHAM_API_KEY"),
  ];
}
