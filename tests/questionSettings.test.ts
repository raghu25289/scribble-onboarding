import assert from "node:assert/strict";
import test from "node:test";
import { normalizeQuestionSettings, questionMixMatches, requestedQuestionMix } from "../src/lib/questionSettings";
import type { QuestionSettings } from "../src/lib/types";

test("question settings default to Both and Balanced and normalize custom questions", () => {
  assert.deepEqual(normalizeQuestionSettings(), { intent: "both", depth: "balanced", customQuestions: [] });
  assert.deepEqual(normalizeQuestionSettings({ customQuestions: ["  What fits? ", "what fits?", ""] }).customQuestions, ["What fits?"]);
});

test("balanced both deliberately distributes intent and all depth tiers", () => {
  assert.deepEqual(requestedQuestionMix({ intent: "both", depth: "balanced", customQuestions: [] }, 5), {
    buying: 3, brand: 2, basic: 2, intermediate: 2, advanced: 1,
  });
  assert.deepEqual(requestedQuestionMix({ intent: "brand", depth: "advanced", customQuestions: [] }, 5), {
    buying: 0, brand: 5, basic: 0, intermediate: 0, advanced: 5,
  });
});

test("generated selection is rejected unless it matches the requested distribution", () => {
  const settings: QuestionSettings = { intent: "both", depth: "balanced", customQuestions: [] };
  assert.equal(questionMixMatches([
    { intent: "buying", depth: "basic" },
    { intent: "buying", depth: "intermediate" },
    { intent: "buying", depth: "advanced" },
    { intent: "brand", depth: "basic" },
    { intent: "brand", depth: "intermediate" },
  ], settings, 5), true);
  assert.equal(questionMixMatches(Array.from({ length: 5 }, () => ({ intent: "buying" as const, depth: "basic" as const })), settings, 5), false);
});
