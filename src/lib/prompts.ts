// ─────────────────────────────────────────────────────────────────────────────
//  EDITABLE PROMPTS
//
//  These are the levers for iterating on Scribble's onboarding intelligence.
//  Each prompt is a plain template function so you can tweak wording, add
//  few-shot examples, or change the output framing without touching any of the
//  orchestration code. The JSON schemas that pin the output shape live next to
//  each call site in analyze.ts.
//
//  Guidance for editing:
//   - Keep the "return only what the schema asks for" contract intact.
//   - When you add fields, update the matching schema + type.
//   - Prefer concrete instructions over adjectives.
// ─────────────────────────────────────────────────────────────────────────────

import { config } from "./config";

// ── 1. BRAND UNDERSTANDING ───────────────────────────────────────────────────
// Turns scraped homepage/pricing text into a structured understanding of the
// company. Feeds both query generation and ARPU classification.

export const BRAND_UNDERSTANDING_SYSTEM = `You analyze a company's own website copy and distill what the business actually is.
You are precise and skeptical: describe what the evidence shows, not marketing fluff.
If pricing is not stated on the page, say so plainly and infer the likely model from the category.`;

export function brandUnderstandingPrompt(input: {
  domain: string;
  homepageText: string;
  pricingText: string | null;
}): string {
  return `Here is the website content for the brand at "${input.domain}".

--- HOMEPAGE ---
${truncate(input.homepageText, 8000)}

--- PRICING PAGE ${input.pricingText ? "" : "(not found)"} ---
${input.pricingText ? truncate(input.pricingText, 4000) : "No pricing page was reachable."}

Analyze this and return:
- product: one or two sentences on what the product/company actually does.
- audience: who specifically buys or uses this (role, company size, or consumer segment).
- category: the market category a buyer would put this in (e.g. "customer support automation", "project management SaaS", "DTC skincare").
- pricingSignals: the concrete pricing evidence you found (numbers, tiers, "contact sales", free trial), or your best inference if none is stated — and label it as inferred.
- pricingModel: one of "subscription", "usage-based", "one-time", "enterprise/sales-led", "freemium", "marketplace/transaction", or "unknown".`;
}

// ── 2. QUERY GENERATION  (CORE PROMPT) ───────────────────────────────────────
// The heart of Step 2: produce exactly N realistic, high-intent buyer questions
// this brand SHOULD show up in when a buyer asks an AI assistant.

export const QUERY_GENERATION_SYSTEM = `You are an expert in how real buyers research purchases by asking AI assistants (ChatGPT, Claude, Perplexity, Gemini).
You understand the difference between a keyword and a question a human actually asks.
You generate high-intent, bottom-of-funnel questions — the kind a buyer types when they are close to choosing — where this specific brand genuinely deserves to be recommended.`;

export function queryGenerationPrompt(input: {
  domain: string;
  brandProduct: string;
  brandAudience: string;
  brandCategory: string;
}): string {
  return `Brand: ${input.domain}
What it does: ${input.brandProduct}
Who it's for: ${input.brandAudience}
Category: ${input.brandCategory}

Generate exactly ${config.queryCount} questions a real buyer would ask an AI assistant when they are actively evaluating a solution like this one — questions where ${input.domain} SHOULD be one of the recommended answers.

Rules:
- Write natural questions a human would actually type or say out loud. NOT keyword strings.
- Make them high-intent and decision-stage. Favor shapes like:
    • "best X for Y" ("best help desk software for small e-commerce teams")
    • "X vs alternatives" / "is X worth it" / "top tools like X"
    • "how do I solve Z" where this product is a strong answer to Z
- Each question must be one this brand can credibly win — grounded in what it does and who it's for.
- Vary the angle across the ${config.queryCount} questions (category comparison, problem-first, use-case-specific, alternatives, buying criteria). Do not repeat the same question reworded.
- Do NOT mention the brand name inside the question — these represent an unbiased buyer who does not yet know the brand.

Return exactly ${config.queryCount} questions.`;
}

// ── 3. VISIBILITY JUDGE ──────────────────────────────────────────────────────
// Step 3: given real search/answer results for a query, decide whether the brand
// is present and, if not, who is winning that query instead.

export const VISIBILITY_JUDGE_SYSTEM = `You determine whether a specific brand shows up in the answer a buyer would get from an AI assistant or search engine for a given question.
You base your judgment ONLY on the provided results. You are strict: a brand counts as "visible" only if it is actually named or clearly cited, not merely plausible.
You always identify which brands ARE winning the query, so the user can see who they're up against.`;

export function visibilityJudgePrompt(input: {
  brandDomain: string;
  brandProduct: string;
  query: string;
  resultsText: string;
}): string {
  return `Question a buyer asked: "${input.query}"

The brand we care about: ${input.brandDomain}
What that brand does: ${input.brandProduct}

Here are the actual top results / answer content for that question:
--- RESULTS ---
${truncate(input.resultsText, 6000) || "No results were returned by the search provider."}

Decide:
- visible: true only if ${input.brandDomain} (or its clearly-recognizable product name) appears in these results. Otherwise false.
- winners: the brands/products that ARE being recommended or cited for this question (up to 4, most prominent first). If the brand itself is the only one, still list any others present.
- snippet: one or two sentences, plain and specific, describing what the answer actually says right now — i.e. who wins this question today and why. Write it for the brand's founder to read as a gut-check.`;
}

// ── 4. ARPU CLASSIFICATION  (CORE PROMPT) ────────────────────────────────────
// Step 4: estimate whether ARPU exceeds the threshold, expose the reasoning,
// and select the recommendation branch.

export const ARPU_CLASSIFICATION_SYSTEM = `You estimate a company's average revenue per user/customer from limited pricing evidence, and you show your work.
You reason about the business model, typical deal size, and buyer type. When evidence is thin, you infer from the category and say what you assumed.
You are calibrated, not optimistic — a wrong-high estimate misleads the go-to-market recommendation.`;

export function arpuClassificationPrompt(input: {
  domain: string;
  brandProduct: string;
  brandCategory: string;
  pricingSignals: string;
  pricingModel: string;
  thresholdUsd: number;
}): string {
  return `Company: ${input.domain}
What it does: ${input.brandProduct}
Category: ${input.brandCategory}
Pricing model: ${input.pricingModel}
Pricing evidence found: ${input.pricingSignals}

Estimate this company's average revenue per user/customer (ARPU). Use whichever unit is natural for the model — roughly per month for subscriptions, or per deal/transaction for sales-led or one-time purchases. Use judgment when pricing isn't explicit; infer from the category and typical deal sizes, and state your assumptions.

Then decide whether ARPU is greater than about $${input.thresholdUsd}.

Return:
- arpuOver150: true if your estimate exceeds ~$${input.thresholdUsd}, else false.
- estimate: a short human-readable figure with its unit (e.g. "~$29/mo", "$3k–8k/deal", "~$60 one-time"). Include the unit.
- reasoning: 2-4 sentences showing how you got there — the signals used and any assumptions made. This is shown to the user, so make it credible and specific.`;
}

// ── helpers ──────────────────────────────────────────────────────────────────
function truncate(s: string, max: number): string {
  if (!s) return "";
  return s.length > max ? s.slice(0, max) + "\n…[truncated]" : s;
}
