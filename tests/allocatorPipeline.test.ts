import assert from "node:assert/strict";
import test from "node:test";
import { emptyAllocatorGraph, normalizeAllocatorIdentity, upsertAllocatorOrganizations } from "../src/lib/allocators/graph";
import { allocatorMatches, freshnessFor } from "../src/lib/allocators/matching";
import type { AllocatorOrganization, IndexWorkspace, OnboardingRecord } from "../src/lib/types";

function organization(overrides: Partial<AllocatorOrganization> = {}): AllocatorOrganization {
  return {
    id: "org_atlas", canonicalName: "Atlas Capital", aliases: [], normalizedDomain: "atlas.test",
    allocatorType: "liquid_token_fund", headquarters: "New York",
    funds: [{ id: "fund_liquid", name: "Liquid Opportunities", mandate: "liquid", strategies: ["DeFi yield", "liquid staking"], chains: ["Ethereum"], assets: ["ETH"], geographies: ["Global"], allocationMinUsd: 100000, allocationMaxUsd: 1000000, evidenceIds: ["ev1"] }],
    people: [{ id: "person_1", name: "Alex Example", role: "Portfolio Manager", linkedinUrl: "https://linkedin.com/in/alex-example", xUrl: null, publicEmail: null, emailSourceUrl: null, evidenceIds: ["ev1"] }],
    evidence: [{ id: "ev1", sourceKind: "official_site", sourceName: "Official site", url: "https://atlas.test/strategy", title: "Liquid strategy", excerpt: "Liquid DeFi mandate", observedAt: "2026-09-20T00:00:00.000Z", publishedAt: "2026-09-19T00:00:00.000Z", license: "public" }],
    activitySignals: [{ label: "Published a new liquid staking thesis", occurredAt: "2026-09-20T00:00:00.000Z", evidenceId: "ev1" }],
    sourceRecordIds: ["official:atlas"], firstSeenAt: "2026-08-01T00:00:00.000Z", lastSeenAt: "2026-09-20T00:00:00.000Z", lastEnrichedAt: "2026-09-20T00:00:00.000Z",
    ...overrides,
  };
}

function context(): { record: OnboardingRecord; workspace: IndexWorkspace } {
  const record = {
    id: "onb", leadId: "lead", email: "owner@spiral.test", domain: "spiral.test",
    brand: { product: "Liquid staking vaults on Ethereum", audience: "DAOs and institutions", category: "DeFi", pricingSignals: "fee", pricingModel: "usage-based", products: [{ name: "Vault", priceMonthlyUsd: 1000 }], topCompetitors: [] },
    questionSettings: { intent: "both", depth: "balanced", customQuestions: [] }, queries: [], visibility: [], arpu: null, pillars: null, completedAt: "", reportToken: "report", indexAccessToken: "index", reportInsights: null,
  } satisfies OnboardingRecord;
  const workspace = {
    accessToken: "index", onboardingId: "onb", domain: "spiral.test", ownerEmail: "owner@spiral.test",
    icp: { targetRoles: "Portfolio managers", industries: "Crypto", companyProfile: "Institutional allocators", geographies: "Any", fitSignals: "Liquid staking", exclusions: "Retail", offer: "Ethereum liquid staking vaults", proposedLeadCategories: [{ id: "liquid-funds", label: "Liquid funds", description: "", kind: "allocator" }], selectedLeadCategoryIds: ["liquid-funds"], confirmed: true },
    prospects: [], allocatorProspects: [], lastDiscoveryAt: null, lastAllocatorFeedAt: null, updatedAt: "",
  } satisfies IndexWorkspace;
  return { record, workspace };
}

test("normalization and upsert deduplicate the same allocator while preserving provenance", () => {
  assert.equal(normalizeAllocatorIdentity("Atlas Capital", "https://www.ATLAS.test/about"), "domain:atlas.test");
  const first = organization();
  const second = organization({ id: "other_id", aliases: ["Atlas"], sourceRecordIds: ["sec:123"] });
  const graph = upsertAllocatorOrganizations(upsertAllocatorOrganizations(emptyAllocatorGraph(), [first]), [second]);
  assert.equal(graph.organizations.length, 1);
  assert.deepEqual(new Set(graph.organizations[0].sourceRecordIds), new Set(["official:atlas", "sec:123"]));
  assert.equal(graph.organizations[0].evidence[0].sourceKind, "official_site");
});

test("matching requires a selected allocator category and liquid mandate, deduplicates feed, and exposes evidence", () => {
  const { record, workspace } = context();
  const leads = allocatorMatches([organization()], record, workspace, 10, new Date("2026-09-25T00:00:00.000Z"));
  assert.equal(leads.length, 1);
  assert.equal(leads[0].allocatorMatch?.freshness, "fresh");
  assert.equal(leads[0].evidence[0].url, "https://atlas.test/strategy");
  workspace.allocatorProspects = leads;
  assert.equal(allocatorMatches([organization()], record, workspace).length, 0);
  workspace.icp.selectedLeadCategoryIds = [];
  workspace.allocatorProspects = [];
  assert.equal(allocatorMatches([organization()], record, workspace).length, 0);
  workspace.icp.selectedLeadCategoryIds = ["liquid-funds"];
  assert.equal(allocatorMatches([organization({ funds: [{ ...organization().funds[0], mandate: "venture_only" }] })], record, workspace).length, 0);
});

test("freshness uses explicit 30 and 120 day bands", () => {
  const now = new Date("2026-09-25T00:00:00.000Z");
  assert.equal(freshnessFor("2026-09-20T00:00:00.000Z", now), "fresh");
  assert.equal(freshnessFor("2026-07-01T00:00:00.000Z", now), "aging");
  assert.equal(freshnessFor("2026-01-01T00:00:00.000Z", now), "stale");
});
