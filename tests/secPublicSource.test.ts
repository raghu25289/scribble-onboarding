import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { gzipSync } from "node:zlib";
import { ingestSecPublicData, parseSecFirmBlock } from "../src/lib/allocators/secPublic";
import { allocatorMatches } from "../src/lib/allocators/matching";
import type { IndexWorkspace, OnboardingRecord } from "../src/lib/types";

const officialHtml = `<!doctype html><html><body>
  <h1>Liquid Digital Asset Fund</h1>
  <p>We run a liquid token hedge fund investing across stablecoin payments,
  institutional settlement infrastructure, Bitcoin and Ethereum.</p>
  <p>Strategies include market-neutral trading and arbitrage.</p>
  <a href="mailto:investor-relations@digital-assets.test">Contact</a>
</body></html>`;

test("public SEC connector streams the official feed and only accepts an official-site verified crypto mandate", async () => {
  const xml = await readFile(path.join(process.cwd(), "tests/fixtures/sec-firms-small.xml"));
  const fetcher: typeof fetch = async (input) => {
    const url = String(input);
    if (url.endsWith("CompilationReports.manifest.json")) {
      return new Response(JSON.stringify({ files: [{ name: "IA_FIRM_SEC_Feed_09_25_2026.xml.gz", date: "09/25/2026" }] }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.endsWith(".xml.gz")) {
      return new Response(gzipSync(xml), { status: 200, headers: { "content-type": "application/gzip" } });
    }
    if (url.startsWith("https://digital-assets.test")) {
      return new Response(officialHtml, { status: 200, headers: { "content-type": "text/html" } });
    }
    return new Response("not found", { status: 404 });
  };
  const result = await ingestSecPublicData({ fetcher, candidateLimit: 10, userAgent: "test" });
  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].canonicalName, "DIGITAL ASSET PARTNERS");
  assert.ok(result.records[0].funds[0].sectors?.includes("stablecoins"));
  assert.ok(result.records[0].funds[0].sectors?.includes("payments"));
  assert.equal(result.records[0].people[0].publicEmail, "investor-relations@digital-assets.test");
  assert.equal(result.diagnostics[0].fetchedCount, 2);
  assert.equal(result.diagnostics[0].acceptedCount, 1);
  assert.equal(result.diagnostics[0].rejectedCount, 0);
  assert.equal(result.diagnostics[0].failureReason, null);
});

test("parser preserves SEC identity and official website provenance", () => {
  const firm = parseSecFirmBlock(`<Firm><Info FirmCrdNb="42" SECNb="801-42" BusNm="A &amp; B DIGITAL" LegalNm="A &amp; B DIGITAL LLC"/><MainAddr City="NYC" State="NY" Cntry="United States"/><Rgstn FirmType="ERA"/><Filing Dt="2026-09-01"/><WebAddrs><WebAddr>https://ab.test</WebAddr></WebAddrs></Firm>`);
  assert.equal(firm?.businessName, "A & B DIGITAL");
  assert.equal(firm?.websites[0], "https://ab.test");
});

test("venture-only crypto firms are classified and retained but cannot enter the liquid feed", async () => {
  const xml = await readFile(path.join(process.cwd(), "tests/fixtures/sec-firms-small.xml"));
  const ventureHtml = `<html><body><h1>Crypto venture fund</h1><p>We make seed investments in blockchain infrastructure and developer tooling companies.</p></body></html>`;
  const fetcher: typeof fetch = async (input) => String(input).endsWith("CompilationReports.manifest.json")
    ? new Response(JSON.stringify({ files: [{ name: "IA_FIRM_SEC_Feed_09_25_2026.xml.gz", date: "09/25/2026" }] }))
    : String(input).endsWith(".xml.gz")
      ? new Response(gzipSync(xml))
      : String(input).endsWith("robots.txt")
        ? new Response("User-agent: *\nAllow: /")
        : new Response(ventureHtml, { headers: { "content-type": "text/html" } });
  const [org] = (await ingestSecPublicData({ fetcher, candidateLimit: 10 })).records;
  assert.equal(org.allocatorType, "venture_only");
  assert.equal(org.funds[0].mandate, "venture_only");
});

test("a non-DeFi stablecoin payments product matches a sector-aligned liquid allocator", async () => {
  const xml = await readFile(path.join(process.cwd(), "tests/fixtures/sec-firms-small.xml"));
  const fetcher: typeof fetch = async (input) => String(input).endsWith("CompilationReports.manifest.json")
    ? new Response(JSON.stringify({ files: [{ name: "IA_FIRM_SEC_Feed_09_25_2026.xml.gz", date: "09/25/2026" }] }))
    : String(input).endsWith(".xml.gz")
      ? new Response(gzipSync(xml))
      : new Response(officialHtml, { headers: { "content-type": "text/html" } });
  const [org] = (await ingestSecPublicData({ fetcher, candidateLimit: 10 })).records;
  const record = { id: "o", leadId: "l", email: "x@y.test", domain: "pay.test", brand: { product: "Stablecoin payment and settlement rails", audience: "Fintechs", category: "Payments infrastructure", pricingSignals: "", pricingModel: "usage-based", products: [], topCompetitors: [] }, questionSettings: { intent: "both", depth: "balanced", customQuestions: [] }, queries: [], visibility: [], arpu: null, pillars: null, completedAt: "", reportToken: "r", indexAccessToken: "i", reportInsights: null } satisfies OnboardingRecord;
  const workspace = { accessToken: "i", onboardingId: "o", domain: "pay.test", ownerEmail: "x@y.test", icp: { targetRoles: "Investor", industries: "Crypto", companyProfile: "Funds", geographies: "Any", fitSignals: "", exclusions: "", offer: "Stablecoin payments infrastructure", proposedLeadCategories: [{ id: "liquid-funds", label: "Liquid funds", description: "", kind: "allocator" }], selectedLeadCategoryIds: ["liquid-funds"], confirmed: true }, prospects: [], allocatorProspects: [], lastDiscoveryAt: null, lastAllocatorFeedAt: null, updatedAt: "" } satisfies IndexWorkspace;
  const leads = allocatorMatches([org], record, workspace);
  assert.equal(leads.length, 1);
  assert.match(leads[0].whyFit, /stablecoins|payments/);
});
