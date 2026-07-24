// Fetch a brand's homepage and (if present) its pricing page, and reduce the
// HTML to readable text for the LLM. Fails gracefully — the caller decides what
// to do when a page is unreachable.
//
// Pricing detection is the hard part: plain fetch+strip-tags returns an empty
// shell for client-rendered (JS) apps, so a page that "loaded fine" can still
// carry zero pricing signal. The pipeline here is: (1) try several candidate
// pricing URLs found on the site itself, (2) for any that come back empty,
// retry through Tavily Extract (handles rendering), (3) if the site truly has
// nothing, fall back to a web search for the brand's pricing. If all three
// fail, the caller is expected to show an honest "pricing not detectable"
// state rather than let the model invent a number — see analyze.ts.

import { config } from "./config";
import type { CostTracker } from "./cost";
import { TAVILY_ESTIMATED_COST_USD, TAVILY_EXTRACT_ESTIMATED_COST_USD } from "./cost";
import { extractWithTavily, resultsToText, searchWeb } from "./search";

// Where the pricing evidence ultimately came from — feeds the price_confidence
// the ARPU classification exposes to the UI.
export type PricingSource = "site" | "search" | "none";

export interface SiteContent {
  homepageHtml: string | null; // raw HTML, kept for the onsite-pillar link probe
  homepageText: string;
  pricingText: string | null;
  homepageReachable: boolean;
  pricingFound: boolean;
  pricingSource: PricingSource;
  notes: string[]; // human-readable notes about what happened (for graceful UX)
}

async function fetchText(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.siteFetchTimeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        // A realistic UA — some sites 403 obvious bots.
        "User-Agent":
          "Mozilla/5.0 (compatible; ScribbleBot/1.0; +https://scribble.ai/bot)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("html") && !ct.includes("text")) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Strip scripts/styles/tags and collapse whitespace to a plain-text approximation.
function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

// Common pricing page paths to probe when it's not linked obviously.
const PRICING_PATHS = ["/pricing", "/plans", "/pricing-plans", "/subscribe", "/premium", "/compare"];

// Matches a pricing-flavored link (by href or anchor text) and, separately,
// actual pricing content once a candidate page is fetched.
const PRICING_LINK_PATTERN = /pricing|\bplans?\b|subscri|premium|\bcost\b|\bprice\b/i;
const PRICING_CONTENT_PATTERN =
  /\$|\bprice|\bplan|\bper month|\bper year|\/mo\b|free trial|contact sales/i;

// Root URL + candidate pages, hard cap regardless of how many pricing-looking
// links the nav/footer surface.
const MAX_TOTAL_PAGES = 6;

// A page is a JS-rendered "empty shell" when there's almost no extracted text
// (an SPA that serves a near-blank <div id="root">), or when the text is
// tiny relative to the HTML it came from (mostly script/boilerplate, no
// actual content the model could read).
const EMPTY_SHELL_MIN_TEXT_CHARS = 500;
const EMPTY_SHELL_MIN_TEXT_TO_HTML_RATIO = 0.02;

function isEmptyShell(text: string, html: string): boolean {
  if (text.length < EMPTY_SHELL_MIN_TEXT_CHARS) return true;
  if (html.length > 0 && text.length / html.length < EMPTY_SHELL_MIN_TEXT_TO_HTML_RATIO) return true;
  return false;
}

// Collapses a URL to origin+path (no trailing slash, no query/hash) so the
// same page linked two different ways only gets fetched once.
function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname.replace(/\/+$/, "")}`.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

// Pulls every <a href> whose containing <nav> or <footer> block we can find,
// alongside its visible text — regex-based like the rest of this module
// (no DOM parser dependency), scoped to nav/footer so we don't pick up random
// body links.
function navFooterLinks(html: string): { href: string; text: string }[] {
  const links: { href: string; text: string }[] = [];
  const blockPattern = /<(nav|footer)[^>]*>([\s\S]*?)<\/\1>/gi;
  let block: RegExpExecArray | null;
  while ((block = blockPattern.exec(html))) {
    const aPattern = /<a\s[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let a: RegExpExecArray | null;
    while ((a = aPattern.exec(block[2]))) {
      links.push({ href: a[1], text: htmlToText(a[2]) });
    }
  }
  return links;
}

// Fetches a page and, if it comes back as an empty shell, retries it through
// Tavily Extract (advanced depth handles client-rendered apps a raw fetch
// can't). Returns null only if both the raw fetch AND the Extract retry fail.
async function fetchPageWithFallback(
  url: string,
  tracker?: CostTracker
): Promise<{ html: string; text: string } | null> {
  const html = await fetchText(url);
  if (!html) return null;
  const text = htmlToText(html);
  if (!isEmptyShell(text, html)) return { html, text };

  const extracted = await extractWithTavily(url);
  if (tracker) tracker.add(TAVILY_EXTRACT_ESTIMATED_COST_USD, "tavily_extract");
  if (extracted && extracted.length > text.length) {
    return { html, text: extracted };
  }
  return { html, text };
}

// Probes a set of candidate paths (plus any homepage hrefs matching
// `linkPattern`) against `baseUrl`, returning the text of the first page
// whose content matches `contentMatch`. Shared by pricing detection here and
// by the onsite-pillar comparison/alternatives content probe.
export async function probePaths(
  baseUrl: string,
  homepageHtml: string | null,
  paths: string[],
  linkPattern: RegExp,
  contentMatch: RegExp
): Promise<{ url: string; text: string } | null> {
  const candidates = new Set<string>();
  if (homepageHtml) {
    const hrefs = [...homepageHtml.matchAll(/href=["']([^"']+)["']/gi)].map((m) => m[1]);
    for (const href of hrefs) {
      if (linkPattern.test(href)) {
        try {
          candidates.add(new URL(href, baseUrl).toString());
        } catch {
          /* ignore malformed href */
        }
      }
    }
  }
  for (const p of paths) {
    try {
      candidates.add(new URL(p, baseUrl).toString());
    } catch {
      /* ignore */
    }
  }

  for (const url of candidates) {
    const html = await fetchText(url);
    if (html) {
      const text = htmlToText(html);
      if (contentMatch.test(text)) {
        return { url, text };
      }
    }
  }
  return null;
}

export async function fetchSiteContent(
  baseUrl: string,
  tracker?: CostTracker
): Promise<SiteContent> {
  const notes: string[] = [];
  const fetchedUrls = new Set<string>();

  const home = await fetchPageWithFallback(baseUrl, tracker);
  fetchedUrls.add(normalizeUrl(baseUrl));
  const homepageHtml = home?.html ?? null;
  const homepageText = home?.text ?? "";
  const homepageReachable = !!home;

  if (!homepageReachable) {
    notes.push("Homepage could not be reached — analysis will rely on the domain name and category inference.");
  }

  // Candidate pricing pages: the fixed common paths, plus any nav/footer link
  // whose href or visible text looks pricing-related. Deduped against the
  // homepage and each other, capped so the whole fetch never exceeds
  // MAX_TOTAL_PAGES pages.
  const candidateUrls: string[] = [];
  for (const p of PRICING_PATHS) {
    try {
      candidateUrls.push(new URL(p, baseUrl).toString());
    } catch {
      /* ignore malformed path */
    }
  }
  if (homepageHtml) {
    for (const link of navFooterLinks(homepageHtml)) {
      if (PRICING_LINK_PATTERN.test(link.href) || PRICING_LINK_PATTERN.test(link.text)) {
        try {
          candidateUrls.push(new URL(link.href, baseUrl).toString());
        } catch {
          /* ignore malformed href */
        }
      }
    }
  }

  const toFetch: string[] = [];
  for (const url of candidateUrls) {
    const norm = normalizeUrl(url);
    if (fetchedUrls.has(norm)) continue;
    fetchedUrls.add(norm);
    toFetch.push(url);
    if (toFetch.length >= MAX_TOTAL_PAGES - 1) break; // homepage already counted
  }

  let pricingText: string | null = null;
  let pricingSource: PricingSource = "none";

  for (const url of toFetch) {
    const page = await fetchPageWithFallback(url, tracker);
    if (!page) continue;
    if (PRICING_CONTENT_PATTERN.test(page.text) && !isEmptyShell(page.text, page.html)) {
      pricingText = page.text;
      pricingSource = "site";
      break;
    }
  }

  // Nothing readable on the site itself — fall back to a web search for the
  // brand's own pricing rather than leaving it blank.
  if (!pricingText) {
    const brandLabel = new URL(baseUrl).hostname.replace(/^www\./, "");
    const searchResp = await searchWeb(`${brandLabel} pricing plans cost per month`);
    if (tracker) tracker.add(TAVILY_ESTIMATED_COST_USD, "tavily_pricing_search");
    const text = resultsToText(searchResp).trim();
    if (searchResp.ok && text.length > 0) {
      pricingText = text;
      pricingSource = "search";
    }
  }

  const pricingFound = !!pricingText;

  if (pricingSource === "search") {
    notes.push(
      "Your pricing wasn't readable directly from the site — used web search results as a fallback."
    );
  } else if (!pricingFound) {
    notes.push(
      "No pricing signal found on your site or the web — we won't guess a number; ARPU will be marked unknown."
    );
  }

  return {
    homepageHtml,
    homepageText,
    pricingText,
    homepageReachable,
    pricingFound,
    pricingSource,
    notes,
  };
}
