import type {
  AllocatorOrganization,
  AllocatorSourceDiagnostic,
  AllocatorType,
} from "../types";
import { classifyCryptoText } from "./taxonomy";

const IAPD_MANIFEST = "https://reports.adviserinfo.sec.gov/reports/CompilationReports/CompilationReports.manifest.json";
const IAPD_REPORTS = "https://reports.adviserinfo.sec.gov/reports/CompilationReports";
const CRYPTO_RE = /\b(crypto(?:currency)?|digital assets?|bitcoin|ethereum|blockchain|web3|token(?:s|ized)?|virtual assets?)\b/i;
const LIQUID_RE = /\b(liquid(?:ity)? (?:token|digital asset|crypto)|liquid tokens?|crypto hedge fund|digital asset hedge fund|hedge fund|market[- ]neutral|long\/?short|arbitrage|systematic trading|quantitative trading|algorithmic trading|market mak(?:er|ing)|liquidity provid(?:er|ing)|staking|defi yield|yield strateg)/i;
const VENTURE_RE = /\b(venture|early[- ]stage|seed investments?|portfolio companies)\b/i;
const FAMILY_RE = /\bfamily office\b/i;
const WEBSITE_EXCLUSIONS = /linkedin\.com|facebook\.com|instagram\.com|x\.com|twitter\.com/i;

export interface SecFirmCandidate {
  crd: string;
  secNumber: string;
  businessName: string;
  legalName: string;
  city: string;
  state: string;
  country: string;
  filingDate: string;
  firmType: string;
  websites: string[];
}

export interface ConnectorResult {
  records: AllocatorOrganization[];
  diagnostics: AllocatorSourceDiagnostic[];
}

type FetchLike = typeof fetch;

async function mapWithConcurrency<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      try { results[index] = { status: "fulfilled", value: await task(items[index]) }; }
      catch (reason) { results[index] = { status: "rejected", reason }; }
    }
  });
  await Promise.all(workers);
  return results;
}

function decodeXml(value: string): string {
  return value.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

function attr(fragment: string, name: string): string {
  const match = fragment.match(new RegExp(`\\b${name}="([^"]*)"`));
  return decodeXml(match?.[1] || "").trim();
}

export function parseSecFirmBlock(block: string): SecFirmCandidate | null {
  const info = block.match(/<Info\b[^>]*\/>/)?.[0];
  const address = block.match(/<MainAddr\b[^>]*\/>/)?.[0] || "";
  const filing = block.match(/<Filing\b[^>]*\/>/)?.[0] || "";
  const registration = block.match(/<Rgstn\b[^>]*\/>/)?.[0] || "";
  if (!info) return null;
  const websites = [...block.matchAll(/<WebAddr>([\s\S]*?)<\/WebAddr>/g)]
    .map((match) => decodeXml(match[1]).trim())
    .filter((url) => /^https?:\/\//i.test(url) && !WEBSITE_EXCLUSIONS.test(url));
  return {
    crd: attr(info, "FirmCrdNb"),
    secNumber: attr(info, "SECNb"),
    businessName: attr(info, "BusNm"),
    legalName: attr(info, "LegalNm"),
    city: attr(address, "City"),
    state: attr(address, "State"),
    country: attr(address, "Cntry"),
    filingDate: attr(filing, "Dt"),
    firmType: attr(registration, "FirmType"),
    websites,
  };
}

export async function parseSecFirmStream(
  stream: ReadableStream<Uint8Array>,
  onFirm: (firm: SecFirmCandidate) => Promise<void> | void
): Promise<number> {
  const reader = stream.getReader();
  const decoder = new TextDecoder("latin1");
  let buffer = "";
  let count = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let end = buffer.indexOf("</Firm>");
    while (end >= 0) {
      const start = buffer.indexOf("<Firm>");
      if (start < 0 || start > end) {
        buffer = buffer.slice(end + 7);
      } else {
        const firm = parseSecFirmBlock(buffer.slice(start, end + 7));
        if (firm) {
          count += 1;
          await onFirm(firm);
        }
        buffer = buffer.slice(end + 7);
      }
      end = buffer.indexOf("</Firm>");
    }
    if (buffer.length > 2_000_000) buffer = buffer.slice(-1_000_000);
  }
  return count;
}

function normalizeUrl(raw: string): string | null {
  try {
    const url = new URL(raw);
    if (!/^https?:$/.test(url.protocol)) return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function htmlText(html: string): string {
  return decodeXml(html
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#\d+;/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function relevantLinks(html: string, baseUrl: string): string[] {
  const links: string[] = [];
  for (const match of html.matchAll(/href=["']([^"'#]+)["']/gi)) {
    try {
      const url = new URL(match[1], baseUrl);
      if (url.origin !== new URL(baseUrl).origin) continue;
      if (!/(strateg|invest|fund|approach|portfolio|team|about|contact|digital|crypto|liquid)/i.test(url.pathname)) continue;
      links.push(url.toString());
    } catch { /* malformed link */ }
  }
  return [...new Set(links)].slice(0, 2);
}

async function robotsAllows(url: string, fetcher: FetchLike, userAgent: string): Promise<boolean> {
  try {
    const target = new URL(url);
    const response = await fetcher(`${target.origin}/robots.txt`, { headers: { "User-Agent": userAgent, Accept: "text/plain" }, signal: AbortSignal.timeout(5_000) });
    if (response.status === 401 || response.status === 403) return false;
    if (!response.ok) return true;
    const lines = (await response.text()).split(/\r?\n/).map((line) => line.replace(/#.*/, "").trim());
    let applies = false;
    const disallowed: string[] = [];
    for (const line of lines) {
      const [rawKey, ...rest] = line.split(":");
      const key = rawKey?.trim().toLowerCase();
      const value = rest.join(":").trim();
      if (key === "user-agent") applies = value === "*" || /scribble/i.test(value);
      else if (key === "disallow" && applies && value) disallowed.push(value);
    }
    return !disallowed.some((path) => path === "/" || target.pathname.startsWith(path));
  } catch {
    return true;
  }
}

function excerptAround(text: string): string {
  const match = text.match(CRYPTO_RE);
  const index = match?.index || 0;
  return text.slice(Math.max(0, index - 180), Math.min(text.length, index + 420)).trim();
}

function classify(text: string): { type: AllocatorType; mandate: "liquid" | "hybrid" | "venture_only"; strategies: string[] } | null {
  if (!CRYPTO_RE.test(text)) return null;
  const liquid = LIQUID_RE.test(text);
  const venture = VENTURE_RE.test(text);
  if (!liquid && !venture) return null;
  const strategies = [
    /market[- ]neutral/i.test(text) && "market neutral",
    /long\/?short/i.test(text) && "long/short",
    /arbitrage/i.test(text) && "arbitrage",
    /quantitative|systematic|algorithmic/i.test(text) && "quantitative/systematic",
    /market mak(?:er|ing)|liquidity provid/i.test(text) && "market making/liquidity provision",
    /staking/i.test(text) && "staking",
    /defi|yield strateg/i.test(text) && "DeFi/yield",
    /venture|early[- ]stage|seed investment/i.test(text) && "venture",
  ].filter((item): item is string => !!item);
  const type: AllocatorType = FAMILY_RE.test(text)
    ? "crypto_family_office"
    : /\bfund of funds\b/i.test(text)
      ? "fund_of_funds"
      : /\b(corporate venture|strategic investment|strategic capital)\b/i.test(text)
        ? "strategic_corporate"
    : /market mak(?:er|ing)|liquidity provid/i.test(text)
      ? "market_maker"
      : venture && liquid
        ? "venture_liquid_hybrid"
        : venture
          ? "venture_only"
        : /hedge fund|market[- ]neutral|long\/?short|arbitrage/i.test(text)
          ? "crypto_hedge_fund"
          : /\b(asset manager|investment manager|institutional investment)\b/i.test(text)
            ? "institutional_asset_manager"
            : "liquid_token_fund";
  return { type, mandate: venture ? (liquid ? "hybrid" : "venture_only") : "liquid", strategies: strategies.length ? strategies : [liquid ? "liquid digital assets" : "crypto venture"] };
}

async function fetchOfficialSite(
  firm: SecFirmCandidate,
  fetcher: FetchLike,
  userAgent: string
): Promise<AllocatorOrganization | null> {
  const homepage = firm.websites.map(normalizeUrl).find((url): url is string => !!url);
  if (!homepage) return null;
  if (!(await robotsAllows(homepage, fetcher, userAgent))) return null;
  const pages: { url: string; html: string; text: string }[] = [];
  const load = async (url: string) => {
    const response = await fetcher(url, { headers: { "User-Agent": userAgent, Accept: "text/html" }, redirect: "follow", signal: AbortSignal.timeout(10_000) });
    if (!response.ok || !(response.headers.get("content-type") || "").includes("text/html")) return;
    const html = (await response.text()).slice(0, 1_500_000);
    pages.push({ url: response.url || url, html, text: htmlText(html) });
  };
  try {
    await load(homepage);
    if (!pages[0]) return null;
    for (const url of relevantLinks(pages[0].html, pages[0].url)) await load(url);
  } catch {
    return null;
  }
  const combined = pages.map((page) => page.text).join(" ");
  const classification = classify(combined);
  if (!classification) return null;
  const officialPage = pages.find((page) => CRYPTO_RE.test(page.text) && LIQUID_RE.test(page.text)) || pages[0];
  const taxonomy = classifyCryptoText(officialPage.text);
  const now = new Date().toISOString();
  const officialEmail = pages.map((page) => page.html).join(" ").match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i)?.[0]?.toLowerCase() || null;
  const domain = new URL(homepage).hostname.replace(/^www\./, "");
  const secEvidenceId = `sec_adv_${firm.crd}_${firm.filingDate || "current"}`;
  const officialEvidenceId = `official_${firm.crd}_${Buffer.from(officialPage.url).toString("base64url").slice(0, 16)}`;
  return {
    id: `allocator_sec_${firm.crd}`,
    canonicalName: firm.businessName || firm.legalName,
    aliases: [firm.legalName].filter((name) => !!name && name !== firm.businessName),
    normalizedDomain: domain,
    allocatorType: classification.type,
    headquarters: [firm.city, firm.state, firm.country].filter(Boolean).join(", ") || null,
    funds: [{
      id: `fund_sec_${firm.crd}`,
      name: `${firm.businessName || firm.legalName} liquid strategy`,
      mandate: classification.mandate,
      strategies: classification.strategies,
      sectors: taxonomy.sectors,
      stages: taxonomy.stages,
      vehicles: taxonomy.vehicles,
      chains: taxonomy.chains,
      assets: [...new Set((combined.match(/\b(BTC|ETH|SOL|USDC|USDT)\b/g) || []))],
      geographies: firm.country ? [firm.country] : [],
      allocationMinUsd: null,
      allocationMaxUsd: null,
      evidenceIds: [secEvidenceId, officialEvidenceId],
    }],
    people: officialEmail ? [{ id: `contact_sec_${firm.crd}`, name: "Official contact", role: "Public contact route", linkedinUrl: null, xUrl: null, publicEmail: officialEmail, emailSourceUrl: officialPage.url, evidenceIds: [officialEvidenceId] }] : [],
    evidence: [
      { id: secEvidenceId, sourceKind: "sec_adv", sourceName: "SEC Investment Adviser Public Disclosure", url: `https://adviserinfo.sec.gov/firm/summary/${firm.crd}`, title: `Form ADV record ${firm.secNumber || firm.crd}`, excerpt: `${firm.businessName || firm.legalName} is listed as ${firm.firmType || "an investment adviser"}; filing date ${firm.filingDate || "current"}.`, observedAt: now, publishedAt: firm.filingDate || null, license: "public" },
      { id: officialEvidenceId, sourceKind: "official_site", sourceName: `${firm.businessName || firm.legalName} official website`, url: officialPage.url, title: "Official strategy and mandate evidence", excerpt: excerptAround(officialPage.text), observedAt: now, publishedAt: null, license: "public" },
    ],
    activitySignals: [{
      label: `Official site currently publishes a ${classification.mandate.replace("_", " ")} crypto investment strategy`,
      occurredAt: now,
      evidenceId: officialEvidenceId,
    }],
    sourceRecordIds: [`sec-adv:${firm.crd}:${firm.filingDate || "current"}`],
    firstSeenAt: now,
    lastSeenAt: now,
    lastEnrichedAt: now,
  };
}

export async function ingestSecPublicData(input: {
  fetcher?: FetchLike;
  previous?: AllocatorSourceDiagnostic;
  candidateLimit?: number;
  userAgent?: string;
} = {}): Promise<ConnectorResult> {
  const fetcher = input.fetcher || fetch;
  const started = Date.now();
  const userAgent = input.userAgent || process.env.ALLOCATOR_HTTP_USER_AGENT || "ScribbleAllocatorResearch/1.0";
  const candidateLimit = input.candidateLimit || Number(process.env.ALLOCATOR_SEC_CANDIDATE_LIMIT || 60);
  const base = { sourceId: "sec-adv-iapd-public", attempted: true, fetchedCount: 0, acceptedCount: 0, rejectedCount: 0, failureReason: null, lastSuccessAt: input.previous?.lastSuccessAt || null, freshnessAt: null, durationMs: 0 } satisfies AllocatorSourceDiagnostic;
  try {
    const manifestResponse = await fetcher(IAPD_MANIFEST, { headers: { "User-Agent": userAgent, Accept: "application/json" }, signal: AbortSignal.timeout(20_000) });
    if (!manifestResponse.ok) throw new Error(`IAPD manifest returned ${manifestResponse.status}`);
    const manifest = await manifestResponse.json() as { files?: { name: string; date: string }[] };
    const file = manifest.files?.find((item) => item.name.startsWith("IA_FIRM_SEC_Feed_") && item.name.endsWith(".xml.gz"));
    if (!file) throw new Error("IAPD SEC firm feed was not listed in the official manifest");
    const freshnessAt = new Date(`${file.date} 00:00:00 UTC`).toISOString();
    if (input.previous?.sourceVersion === file.name && input.previous.lastSuccessAt) {
      return { records: [], diagnostics: [{ ...base, lastSuccessAt: input.previous.lastSuccessAt, freshnessAt, sourceVersion: file.name, durationMs: Date.now() - started }] };
    }
    const feedResponse = await fetcher(`${IAPD_REPORTS}/${file.name}`, { headers: { "User-Agent": userAgent, Accept: "application/gzip" }, signal: AbortSignal.timeout(120_000) });
    if (!feedResponse.ok || !feedResponse.body) throw new Error(`IAPD SEC firm feed returned ${feedResponse.status}`);
    const decompressed = feedResponse.body.pipeThrough(new DecompressionStream("gzip"));
    const candidates: SecFirmCandidate[] = [];
    const fetchedCount = await parseSecFirmStream(decompressed, (firm) => {
      if (candidates.length >= candidateLimit || !firm.crd || !firm.websites.length) return;
      const identity = `${firm.businessName} ${firm.legalName} ${firm.websites.join(" ")}`;
      if (CRYPTO_RE.test(identity)) candidates.push(firm);
    });
    const settled = await mapWithConcurrency(candidates, 5, (firm) => fetchOfficialSite(firm, fetcher, userAgent));
    const records = settled.flatMap((result) => result.status === "fulfilled" && result.value ? [result.value] : []);
    const rejectedCount = candidates.length - records.length;
    const successAt = new Date().toISOString();
    return { records, diagnostics: [{ ...base, fetchedCount, acceptedCount: records.length, rejectedCount, lastSuccessAt: successAt, freshnessAt, sourceVersion: file.name, durationMs: Date.now() - started }] };
  } catch (error) {
    return { records: [], diagnostics: [{ ...base, failureReason: (error as Error).message, durationMs: Date.now() - started }] };
  }
}
