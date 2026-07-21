// OpenRouter client + a small structured-output helper. All LLM access goes
// through here so keys stay server-side and JSON parsing is centralized.

import { config } from "./config";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

function getApiKey(): string {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY is not set.");
  }
  return process.env.OPENROUTER_API_KEY;
}

// A JSON Schema describing the expected object.
export type JsonSchema = Record<string, unknown>;

interface GenerateJsonArgs {
  system: string;
  prompt: string;
  schema: JsonSchema;
  maxTokens?: number;
  model?: string;
}

// Calls the model and returns a validated object matching `schema`.
// Uses response_format: json_schema so the response is guaranteed to be
// valid JSON in the requested shape (on models that support strict
// structured outputs; OpenRouter forwards the parameter to the provider).
export async function generateJson<T>(args: GenerateJsonArgs): Promise<T> {
  const apiKey = getApiKey();

  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
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
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenRouter request failed (${response.status}): ${body}`);
  }

  const data = await response.json();
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
