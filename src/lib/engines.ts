// Per-engine visibility checks. "web" is the original Tavily-backed check
// (now labeled "Open web baseline" in the UI); "perplexity" and "chatgpt" are
// the real engines — each gets its own live answer from OpenRouter, then runs
// through the exact same visibility judge used for the web check, so all
// three engines are scored identically. Every engine is wrapped so a single
// failure or timeout degrades to a "Couldn't check" result, never a thrown
// error the caller has to handle specially.

import { config } from "./config";
import type { CostTracker } from "./cost";
import { TAVILY_ESTIMATED_COST_USD } from "./cost";
import { generateJson, generateText } from "./openrouter";
import { VISIBILITY_JUDGE_SYSTEM, visibilityJudgePrompt } from "./prompts";
import { searchWeb, resultsToText, type SearchResponse } from "./search";
import type { EngineCheckResult, EngineId, Winner } from "./types";

// One Tavily call per query, shared between the "web" engine check and the
// third-party-mentions pillar (which reuses these same results — see
// pillars.ts) so the audit never searches the same query twice.
export async function fetchWebSearch(
  query: string,
  tracker: CostTracker | undefined
): Promise<SearchResponse> {
  const search = await searchWeb(query);
  if (tracker) tracker.add(TAVILY_ESTIMATED_COST_USD, "tavily");
  return search;
}

const visibilitySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    visible: { type: "boolean" },
    winners: { type: "array", items: { type: "string" } },
    snippet: { type: "string" },
  },
  required: ["visible", "winners", "snippet"],
};

// System prompts for the two real engines' raw answer call — each just asks
// the model to answer the buyer question the way it normally would, so the
// judge is scoring a realistic answer rather than a search-results dump.
const ENGINE_ANSWER_SYSTEM =
  "You are answering a buyer's question directly and helpfully, exactly as you would in a normal conversation with live web access. Recommend real, specific products, tools, or companies when the question calls for a recommendation. Be concrete and name names — do not hedge with generic advice when specific answers exist.";

async function rawEngineAnswer(
  engine: "perplexity" | "chatgpt",
  query: string,
  tracker: CostTracker | undefined
): Promise<{ ok: true; text: string; citations: string[] } | { ok: false; error: string }> {
  try {
    const model = engine === "perplexity" ? config.perplexityModel : config.chatgptModel;
    const { text, citations } = await generateText({
      system: ENGINE_ANSWER_SYSTEM,
      prompt: query,
      model,
      timeoutMs: config.engineTimeoutMs,
      tracker,
      costLabel: engine,
    });
    return { ok: true, text, citations };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// Cross-checks each winner name the judge named against the actual source
// text it was given. A name that isn't a literal substring of that text was
// invented by the judge, not read from the answer — drop it. A name that IS
// present but came from an answer with zero citation URLs is an uncited
// claim, more likely to include an "apparently nonexistent" product, so it's
// kept but flagged unverified rather than dropped outright.
function validateWinners(names: string[], sourceText: string, citations: string[]): Winner[] {
  const haystack = sourceText.toLowerCase();
  const verified = citations.length > 0;
  return names
    .filter((name) => haystack.includes(name.toLowerCase()))
    .map((name) => ({ name, verified }));
}

function webAnswerFromSearch(
  search: SearchResponse
): { ok: true; text: string; citations: string[] } | { ok: false; error: string } {
  if (!search.ok) {
    return { ok: false, error: search.error || "Search failed." };
  }
  return {
    ok: true,
    text: resultsToText(search),
    citations: search.results.map((r) => r.url).filter(Boolean),
  };
}

export async function checkEngineVisibility(args: {
  engine: EngineId;
  query: string;
  brandDomain: string;
  brandProduct: string;
  tracker?: CostTracker;
  webSearchResponse?: SearchResponse; // required when engine === "web"
}): Promise<EngineCheckResult> {
  const { engine, query, brandDomain, brandProduct, tracker } = args;

  const raw =
    engine === "web"
      ? webAnswerFromSearch(args.webSearchResponse!)
      : await rawEngineAnswer(engine, query, tracker);

  if (!raw.ok) {
    return {
      engine,
      ok: false,
      visible: false,
      snippet: "",
      winners: [],
      citations: [],
      error: raw.error,
    };
  }

  try {
    const judged = await generateJson<{ visible: boolean; winners: string[]; snippet: string }>({
      system: VISIBILITY_JUDGE_SYSTEM,
      prompt: visibilityJudgePrompt({
        brandDomain,
        brandProduct,
        query,
        resultsText: raw.text,
      }),
      schema: visibilitySchema,
      maxTokens: 1200,
      timeoutMs: config.engineTimeoutMs,
      tracker,
      costLabel: `${engine}_judge`,
    });
    return {
      engine,
      ok: true,
      visible: judged.visible,
      snippet: judged.snippet,
      winners: validateWinners(judged.winners || [], raw.text, raw.citations),
      citations: raw.citations,
    };
  } catch (e) {
    return {
      engine,
      ok: false,
      visible: false,
      snippet: "",
      winners: [],
      citations: raw.citations,
      error: (e as Error).message,
    };
  }
}
