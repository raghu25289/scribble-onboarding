// Anthropic client + a small structured-output helper. All LLM access goes
// through here so keys stay server-side and JSON parsing is centralized.

import Anthropic from "@anthropic-ai/sdk";
import { config } from "./config";

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set.");
  }
  if (!client) client = new Anthropic();
  return client;
}

// A JSON Schema (structured-outputs subset) describing the expected object.
export type JsonSchema = Record<string, unknown>;

interface GenerateJsonArgs {
  system: string;
  prompt: string;
  schema: JsonSchema;
  maxTokens?: number;
  model?: string;
}

// Calls the model and returns a validated object matching `schema`.
// Uses output_config.format (structured outputs) so the response is guaranteed
// to be valid JSON in the requested shape.
export async function generateJson<T>(args: GenerateJsonArgs): Promise<T> {
  const anthropic = getClient();

  const response = await anthropic.messages.create({
    model: args.model || config.llmModel,
    max_tokens: args.maxTokens ?? 2000,
    system: args.system,
    output_config: {
      effort: "medium",
      format: {
        type: "json_schema",
        schema: args.schema,
      },
    },
    messages: [{ role: "user", content: args.prompt }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Model returned no text content.");
  }
  try {
    return JSON.parse(textBlock.text) as T;
  } catch {
    throw new Error("Model returned malformed JSON.");
  }
}
