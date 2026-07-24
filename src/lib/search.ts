// Web search behind a single searchWeb() function. Default provider is Tavily;
// Serper is supported as an alternative. Swap providers via SEARCH_PROVIDER, or
// add a new one by implementing the SearchProvider signature.

import { config, hasSearchKey } from "./config";

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface SearchResponse {
  ok: boolean;
  results: SearchResult[];
  answer?: string; // some providers return a synthesized answer
  error?: string;
}

type SearchProvider = (query: string) => Promise<SearchResponse>;

// ── Tavily ───────────────────────────────────────────────────────────────────
const tavily: SearchProvider = async (query) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.searchTimeoutMs);
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY,
        query,
        search_depth: "basic",
        include_answer: true,
        max_results: config.searchResultsPerQuery,
      }),
    });
    if (!res.ok) {
      return { ok: false, results: [], error: `Tavily error ${res.status}` };
    }
    const data = (await res.json()) as {
      answer?: string;
      results?: { title?: string; url?: string; content?: string }[];
    };
    return {
      ok: true,
      answer: data.answer,
      results: (data.results || []).map((r) => ({
        title: r.title || "",
        url: r.url || "",
        snippet: r.content || "",
      })),
    };
  } catch (e) {
    return { ok: false, results: [], error: `Tavily request failed: ${(e as Error).message}` };
  } finally {
    clearTimeout(timer);
  }
};

// ── Serper (Google) ──────────────────────────────────────────────────────────
const serper: SearchProvider = async (query) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.searchTimeoutMs);
  try {
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "X-API-KEY": process.env.SERPER_API_KEY || "",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ q: query, num: config.searchResultsPerQuery }),
    });
    if (!res.ok) {
      return { ok: false, results: [], error: `Serper error ${res.status}` };
    }
    const data = (await res.json()) as {
      answerBox?: { answer?: string; snippet?: string };
      organic?: { title?: string; link?: string; snippet?: string }[];
    };
    return {
      ok: true,
      answer: data.answerBox?.answer || data.answerBox?.snippet,
      results: (data.organic || []).map((r) => ({
        title: r.title || "",
        url: r.link || "",
        snippet: r.snippet || "",
      })),
    };
  } catch (e) {
    return { ok: false, results: [], error: `Serper request failed: ${(e as Error).message}` };
  } finally {
    clearTimeout(timer);
  }
};

const PROVIDERS: Record<string, SearchProvider> = { tavily, serper };

// ── Tavily Extract ──────────────────────────────────────────────────────────
// Reads one specific URL's actual rendered content — unlike a raw fetch, it
// handles client-rendered (JS) pages. Used as a fallback when a raw fetch of
// a page comes back as an empty shell. Tavily-specific (no serper
// equivalent), so this bypasses the searchProvider config and checks the
// Tavily key directly.
export async function extractWithTavily(url: string): Promise<string | null> {
  if (!process.env.TAVILY_API_KEY) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.siteFetchTimeoutMs);
  try {
    const res = await fetch("https://api.tavily.com/extract", {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY,
        urls: [url],
        extract_depth: "advanced",
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      results?: { url?: string; raw_content?: string }[];
    };
    const raw = data.results?.[0]?.raw_content;
    if (!raw) return null;
    return raw.replace(/\s+/g, " ").trim();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function searchWeb(query: string): Promise<SearchResponse> {
  if (!hasSearchKey()) {
    return {
      ok: false,
      results: [],
      error: `No API key configured for search provider "${config.searchProvider}".`,
    };
  }
  const provider = PROVIDERS[config.searchProvider] || tavily;
  return provider(query);
}

// Flatten a search response into the text the visibility judge reads.
export function resultsToText(resp: SearchResponse): string {
  const parts: string[] = [];
  if (resp.answer) parts.push(`AI answer summary: ${resp.answer}`);
  resp.results.forEach((r, i) => {
    parts.push(`[${i + 1}] ${r.title} (${r.url})\n${r.snippet}`);
  });
  return parts.join("\n\n");
}
