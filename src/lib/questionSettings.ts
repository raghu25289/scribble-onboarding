import type { QuestionDepth, QuestionIntent, QuestionSettings } from "./types";

export const DEFAULT_QUESTION_SETTINGS: QuestionSettings = {
  intent: "both",
  depth: "balanced",
  customQuestions: [],
};

const INTENTS: QuestionIntent[] = ["buying", "brand", "both"];
const DEPTHS: QuestionDepth[] = ["basic", "intermediate", "advanced", "balanced"];

export function normalizeQuestionSettings(input?: Partial<QuestionSettings> | null): QuestionSettings {
  return {
    intent: INTENTS.includes(input?.intent as QuestionIntent) ? input!.intent! : "both",
    depth: DEPTHS.includes(input?.depth as QuestionDepth) ? input!.depth! : "balanced",
    customQuestions: (input?.customQuestions || [])
      .map((question) => question.replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .filter((question, index, all) => all.findIndex((item) => item.toLowerCase() === question.toLowerCase()) === index)
      .slice(0, 10),
  };
}

export function requestedQuestionMix(settings: QuestionSettings, count: number): {
  buying: number;
  brand: number;
  basic: number;
  intermediate: number;
  advanced: number;
} {
  const buying = settings.intent === "buying" ? count : settings.intent === "brand" ? 0 : Math.ceil(count / 2);
  const depths = { basic: 0, intermediate: 0, advanced: 0 };
  if (settings.depth === "balanced") {
    const order = ["basic", "intermediate", "advanced"] as const;
    for (let index = 0; index < count; index += 1) depths[order[index % order.length]] += 1;
  } else {
    depths[settings.depth] = count;
  }
  return { buying, brand: count - buying, ...depths };
}

export function questionMixMatches(
  questions: Array<{ intent: "buying" | "brand"; depth: "basic" | "intermediate" | "advanced" }>,
  settings: QuestionSettings,
  count: number
): boolean {
  if (questions.length !== count) return false;
  const expected = requestedQuestionMix(settings, count);
  const actual = questions.reduce((mix, question) => {
    mix[question.intent] += 1;
    mix[question.depth] += 1;
    return mix;
  }, { buying: 0, brand: 0, basic: 0, intermediate: 0, advanced: 0 });
  return Object.entries(expected).every(([key, value]) => actual[key as keyof typeof actual] === value);
}
