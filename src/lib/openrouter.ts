// OpenRouter client + a small structured-output helper. All LLM access goes
// through here so keys stay server-side and JSON parsing is centralized.

import { config } from "./config";
import type { CostTracker } from "./cost";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

function getApiKey(): string {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY is not set.");
  }
  return process.env.OPENROUTER_API_KEY;
}

// A JSON Schema describing the expected object.
export type JsonSchema = Record<string, unknown>;

// Reads the real per-call cost OpenRouter reports (requires `usage: {
// include: true }` on the request) and records it against `label`. No-ops
// when no tracker was passed or the response didn't include a cost figure.
function trackUsage(
  data: { usage?: { cost?: number } },
  tracker: CostTracker | undefined,
  label: string
) {
  if (!tracker) return;
  const cost = data.usage?.cost;
  if (typeof cost === "number") tracker.add(cost, label);
}

function withTimeout(timeoutMs: number | undefined) {
  if (!timeoutMs) return { signal: undefined, cancel: () => {} };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return { signal: controller.signal, cancel: () => clearTimeout(timer) };
}

interface GenerateJsonArgs {
  system: string;
  prompt: string;
  schema: JsonSchema;
  maxTokens?: number;
  model?: string;
  timeoutMs?: number;
  tracker?: CostTracker;
  costLabel?: string;
}

// Calls the model and returns a validated object matching `schema`.
// Uses response_format: json_schema so the response is guaranteed to be
// valid JSON in the requested shape (on models that support strict
// structured outputs; OpenRouter forwards the parameter to the provider).
export async function generateJson<T>(args: GenerateJsonArgs): Promise<T> {
  const apiKey = getApiKey();
  const { signal, cancel } = withTimeout(args.timeoutMs);

  let response: Response;
  try {
    response = await fetch(OPENROUTER_URL, {
      method: "POST",
      signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: args.model || config.llmModel,
        max_tokens: args.maxTokens ?? 2000,
        messages: [
          { role: "system", content: args.system },
          { role: "user", content: args.prompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "response",
            strict: true,
            schema: args.schema,
          },
        },
        ...(args.tracker ? { usage: { include: true } } : {}),
      }),
    });
  } finally {
    cancel();
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenRouter request failed (${response.status}): ${body}`);
  }

  const data = await response.json();
  trackUsage(data, args.tracker, args.costLabel ?? args.model ?? config.llmModel);
  const text = data.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error("Model returned no text content.");
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("Model returned malformed JSON.");
  }
}

export interface TextCompletionResult {
  text: string;
  citations: string[];
}

interface GenerateTextArgs {
  system: string;
  prompt: string;
  model: string;
  maxTokens?: number;
  timeoutMs?: number;
  tracker?: CostTracker;
  costLabel?: string;
}

// Free-form completion (no response_format) for models that answer with
// live web search — Perplexity's `citations` field and OpenAI's
// `message.annotations` url_citation entries are both normalized into a
// flat `citations` list.
export async function generateText(args: GenerateTextArgs): Promise<TextCompletionResult> {
  const apiKey = getApiKey();
  const { signal, cancel } = withTimeout(args.timeoutMs);

  let response: Response;
  try {
    response = await fetch(OPENROUTER_URL, {
      method: "POST",
      signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: args.model,
        max_tokens: args.maxTokens ?? 1200,
        messages: [
          { role: "system", content: args.system },
          { role: "user", content: args.prompt },
        ],
        ...(args.tracker ? { usage: { include: true } } : {}),
      }),
    });
  } finally {
    cancel();
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenRouter request failed (${response.status}): ${body}`);
  }

  const data = await response.json();
  trackUsage(data, args.tracker, args.costLabel ?? args.model);

  const message = data.choices?.[0]?.message;
  const text: string = message?.content || "";
  if (!text) {
    throw new Error("Model returned no text content.");
  }

  const citations = new Set<string>();
  if (Array.isArray(data.citations)) {
    for (const c of data.citations) {
      if (typeof c === "string") citations.add(c);
    }
  }
  if (Array.isArray(message?.annotations)) {
    for (const a of message.annotations) {
      const url = a?.url_citation?.url;
      if (typeof url === "string") citations.add(url);
    }
  }
  if (citations.size === 0) {
    for (const m of text.matchAll(/https?:\/\/[^\s)\]}"']+/g)) {
      citations.add(m[0]);
    }
  }

  return { text, citations: [...citations].slice(0, 8) };
}
