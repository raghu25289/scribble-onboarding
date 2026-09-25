import type { AllocatorOrganization } from "../types";
import { promises as fs } from "node:fs";
import path from "node:path";

export interface AllocatorConnector {
  id: string;
  enabled(): boolean;
  ingest(): Promise<AllocatorOrganization[]>;
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

  async ingest(): Promise<AllocatorOrganization[]> {
    const url = process.env[this.urlEnv];
    if (!url) return [];
    const token = this.tokenEnv ? process.env[this.tokenEnv] : undefined;
    const response = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      signal: AbortSignal.timeout(25_000),
    });
    if (!response.ok) throw new Error(`${this.id} returned ${response.status}`);
    const body = await response.json() as { organizations?: AllocatorOrganization[] } | AllocatorOrganization[];
    return Array.isArray(body) ? body : body.organizations || [];
  }
}

class DemoFixtureConnector implements AllocatorConnector {
  id = "fictional-demo-fixture";
  enabled(): boolean { return process.env.ALLOCATOR_DEMO_MODE === "true"; }
  async ingest(): Promise<AllocatorOrganization[]> {
    const raw = await fs.readFile(path.join(process.cwd(), "data/allocator-fixtures.sample.json"), "utf8");
    return (JSON.parse(raw) as { organizations: AllocatorOrganization[] }).organizations;
  }
}

// Feed URLs point at customer-owned/licensed ETL outputs. This keeps source
// licensing, rate limits, robots handling, and credentials outside the UI app.
export function allocatorConnectors(): AllocatorConnector[] {
  return [
    new DemoFixtureConnector(),
    new JsonFeedConnector("sec-adv-iapd", "ALLOCATOR_SEC_ADV_FEED_URL"),
    new JsonFeedConnector("official-sites", "ALLOCATOR_OFFICIAL_SITES_FEED_URL"),
    new JsonFeedConnector("defillama-dune-explorers", "ALLOCATOR_ONCHAIN_FEED_URL"),
    new JsonFeedConnector("crunchbase", "ALLOCATOR_CRUNCHBASE_FEED_URL", "CRUNCHBASE_API_KEY"),
    new JsonFeedConnector("pitchbook", "ALLOCATOR_PITCHBOOK_FEED_URL", "PITCHBOOK_API_KEY"),
    new JsonFeedConnector("rootdata", "ALLOCATOR_ROOTDATA_FEED_URL", "ROOTDATA_API_KEY"),
    new JsonFeedConnector("nansen", "ALLOCATOR_NANSEN_FEED_URL", "NANSEN_API_KEY"),
    new JsonFeedConnector("arkham", "ALLOCATOR_ARKHAM_FEED_URL", "ARKHAM_API_KEY"),
  ];
}
