// Fetch a brand's homepage and (if present) its pricing page, and reduce the
// HTML to readable text for the LLM. Fails gracefully — the caller decides what
// to do when a page is unreachable.

import { config } from "./config";

export interface SiteContent {
  homepageHtml: string | null; // raw HTML, kept for the onsite-pillar link probe
  homepageText: string;
  pricingText: string | null;
  homepageReachable: boolean;
  pricingFound: boolean;
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
const PRICING_PATHS = ["/pricing", "/plans", "/price", "/pricing/"];

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

export async function fetchSiteContent(baseUrl: string): Promise<SiteContent> {
  const notes: string[] = [];

  const homepageHtml = await fetchText(baseUrl);
  const homepageText = homepageHtml ? htmlToText(homepageHtml) : "";
  const homepageReachable = !!homepageText;

  if (!homepageReachable) {
    notes.push("Homepage could not be reached — analysis will rely on the domain name and category inference.");
  }

  // Try to find a pricing page. First look for a linked /pricing in the homepage
  // HTML, then fall back to common paths.
  const pricing = await probePaths(
    baseUrl,
    homepageHtml,
    PRICING_PATHS,
    /pricing|\/plans/i,
    /\$|\bprice|\bplan|\bper month|\bper year|\/mo\b|free trial|contact sales/i
  );
  const pricingText = pricing?.text ?? null;
  const pricingFound = !!pricing;

  if (!pricingFound) {
    notes.push("No pricing page found — ARPU will be inferred from the product category.");
  }

  return { homepageHtml, homepageText, pricingText, homepageReachable, pricingFound, notes };
}
