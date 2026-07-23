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
- pricingModel: one of "subscription", "usage-based", "one-time", "enterprise/sales-led", "freemium", "marketplace/transaction", or "unknown".
- products: every distinct product or product line you can identify (not plan tiers of the same product — separate physical/SKU-level products, e.g. a phone line and an earbuds line are two products; a SaaS with only "Basic/Pro/Enterprise" tiers is one product). For each, give:
    - name: a short recognizable name (e.g. "Phone (2a)", "Ear (earbuds)", "Pro plan").
    - priceMonthlyUsd: its price, monthly-normalized (annual÷12, single-seat for per-seat, the one-time price itself for one-time purchases — do not divide one-time purchases by 12). If the pages don't state a price for a product, NEVER return 0 — infer a realistic figure from your own knowledge of the brand/category and typical pricing for that product line (e.g. you know roughly what a Nothing Phone or an iPhone costs even without a pricing page). Every product must have a real, positive price.
  Return at least one entry. If the brand sells one product at one price, return exactly that single entry.`;
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
  brandProducts: { name: string; priceMonthlyUsd: number }[];
}): string {
  const productList = input.brandProducts
    .map((p) => `- ${p.name}: $${p.priceMonthlyUsd}`)
    .join("\n");

  return `Brand: ${input.domain}
What it does: ${input.brandProduct}
Who it's for: ${input.brandAudience}
Category: ${input.brandCategory}
Products this brand sells:
${productList}

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

For each question, also classify:

1. mappedProductName: which ONE product from the list above this specific question is actually about (e.g. an earbuds question maps to the earbuds product, not the phone). Use the exact name from the list. If the question is generic enough that no single product applies, return "" (empty string).

2. demandTier: how common the underlying need is (across AI assistants and search generally, not just for this brand) — pick exactly one:
   - "niche": specialist/B2B, narrow audience (e.g. "best contract lifecycle management for oil & gas subcontractors").
   - "moderate": a defined category with buyers actively researching it, but not mainstream (e.g. "best help desk software for a 20-person e-commerce team").
   - "high": a popular category with a broad audience (e.g. "best project management tool for startups").
   - "mass": mainstream consumer territory, the kind of question millions of people ask (e.g. "best wireless earbuds").
   Do NOT invent a volume number — just pick the tier.

3. tierJustification: one short line justifying the tier pick (e.g. "Niche - only relevant to teams running regulated supply chains.").

Return exactly ${config.queryCount} objects, each with: text (the question), mappedProductName (string), demandTier ("niche" | "moderate" | "high" | "mass"), tierJustification (one line).`;
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

// ── 4. LEADS-VS-BRAND CLASSIFICATION  (CORE PROMPT) ──────────────────────────
// Step 4: decide whether AI-assistant visibility should be sold to the user as
// a LEADS channel (citations convert into inbound pipeline) or a BRAND channel
// (visibility matters for reputation, not direct lead capture). Anchored
// strictly on the highest PAID tier price — a free/freemium tier sitting next
// to a $99/mo Pro plan is still a $99 anchor, and must have zero weight here.

export const ARPU_CLASSIFICATION_SYSTEM = `You classify how a company should think about AI-assistant visibility: as a LEADS channel (citations convert into inbound pipeline) or a BRAND channel (visibility matters for reputation, not direct lead capture).
You anchor this decision strictly on the highest PAID tier price you can find, normalized to a monthly figure — never on whether a free or freemium tier exists. A free tier sitting next to a $99/mo Pro plan is still a $99 anchor; ignore the free tier completely, it carries zero weight.
You are calibrated, not optimistic, and you show your work.`;

export function arpuClassificationPrompt(input: {
  domain: string;
  brandProduct: string;
  brandCategory: string;
  pricingSignals: string;
  pricingModel: string;
  leadsThresholdUsd: number;
}): string {
  const t = input.leadsThresholdUsd;
  return `Company: ${input.domain}
What it does: ${input.brandProduct}
Category: ${input.brandCategory}
Pricing model: ${input.pricingModel}
Pricing evidence found: ${input.pricingSignals}

Work through this in order:

1. Find the highest PAID tier price in the evidence above. Completely ignore any free or freemium tier — it has zero weight here. If pricing isn't explicit, infer a realistic figure from the category and typical deal size, and state that assumption in your reasoning.

2. Normalize that price to a monthly figure:
   - Annual-only pricing: divide by 12.
   - Per-seat pricing: use the single-seat price.
   - Usage-based pricing, or enterprise/"contact us" pricing with no visible number: these are always high-consideration purchases, so treat the anchor as at least $${t}/month — use a higher figure if the evidence points to a bigger typical deal size.
   - Non-USD prices: convert to USD at a rough current exchange rate.
   Report which basis applied: "listed" (a plain listed monthly price), "annualized", "per_seat", or "enterprise_assumed".

3. Decide isTransactionalConsumerSpend: true if this is a one-off or occasional CONSUMER purchase — a hotel/hostel booking, an e-commerce basket, a one-time consumer purchase — where the relationship isn't a recurring subscription even if a single transaction clears $${t}. False for SaaS subscriptions, per-seat tools, and enterprise/sales-led deals.

4. Assess demandLevel: would real buyers plausibly ask an AI assistant a recommendation-style question in this category — things like "best [category] tool" or "top [category] for [audience]"? Answer "high", "medium", or "near_zero". This only changes the outcome when the anchor price clears $${t} and the spend isn't transactional consumer spend.

5. Apply the rule and set classification:
   - If isTransactionalConsumerSpend is true, OR the anchor price is below $${t}/month: classification = "brand".
   - Else if demandLevel is "near_zero": classification = "leads_low_volume".
   - Else: classification = "leads".

6. Estimate plausibleMonthlyRevenueUsd: a rough, order-of-magnitude estimate of this brand's TOTAL monthly revenue across its whole business (not per customer). If you recognize the company, use your general knowledge of its scale. If not, infer from the category, pricing, and any scale signals in the evidence (funding, "trusted by X companies", team size, press mentions). This is a sanity-check figure used only to cap a downstream estimate — a defensible order of magnitude is fine, precision is not expected.

Return:
- classification: "leads" | "brand" | "leads_low_volume", per the rule above.
- anchorPriceMonthlyUsd: the normalized monthly anchor price, in USD, as a plain number (e.g. 99, not "$99" or "99/mo").
- priceBasis: "listed" | "annualized" | "per_seat" | "enterprise_assumed".
- isTransactionalConsumerSpend: boolean, per step 3.
- demandLevel: "high" | "medium" | "near_zero", per step 4.
- estimate: a short human-readable figure with its unit and what it's anchored on (e.g. "$99/mo (Pro tier)", "$12k/yr → $1k/mo (Enterprise, annualized)", "~$15/booking (assumed transactional)").
- reasoning: 2-4 sentences showing how you got there — the price you found, why you picked that basis, the transactional-spend and demand calls, and any assumptions made. This is shown directly to the user, so make it credible and specific.
- transactionNoun: the singular unit this revenue recurs per, matching the business (e.g. "month" for subscriptions, "booking" for travel/consumer transactions, "deal" for enterprise/sales-led, "purchase" for one-time).
- plausibleMonthlyRevenueUsd: the whole-company monthly revenue estimate from step 6, as a plain number in USD (e.g. 500000, not "$500k").`;
}

// ── 5. THREE-PILLAR CITATION SCORE  ("Why AI doesn't cite you") ─────────────
// AI engines cite from three sources: the brand's own site, review
// platforms, and third-party/independent content. Each pillar gets a 0-100
// score plus one sentence naming the biggest gap.

export const ONSITE_SCORING_SYSTEM = `You assess whether a brand's own website is written in a way that AI assistants can find and quote when answering buyer questions.
You are specific and skeptical: cite what's actually present or missing, not what a good site "should" have in the abstract.`;

export function onsiteScoringPrompt(input: {
  domain: string;
  homepageText: string;
  pricingText: string | null;
  extraPageText: string | null;
  extraPageUrl: string | null;
  queries: string[];
}): string {
  return `Brand: ${input.domain}

--- HOMEPAGE ---
${truncate(input.homepageText, 6000) || "(unreachable)"}

--- PRICING PAGE ${input.pricingText ? "" : "(not found)"} ---
${input.pricingText ? truncate(input.pricingText, 3000) : "Not found."}

--- COMPARISON/ALTERNATIVES/FAQ PAGE ${input.extraPageUrl ? `(${input.extraPageUrl})` : "(none found)"} ---
${input.extraPageText ? truncate(input.extraPageText, 3000) : "None found among /compare, /alternatives, /vs, /faq."}

The 5 buyer questions this brand needs to answer:
${input.queries.map((q, i) => `${i + 1}. ${q}`).join("\n")}

Score 0-100 how well this site itself would let an AI assistant answer those 5 questions and cite this brand specifically. Weigh:
- Do dedicated pages exist that target these kinds of questions (not just a generic homepage)?
- Is there comparison, "vs", or alternatives content — the kind AI engines pull from directly?
- Is the content structured so a retrieval system could quote a clean, specific passage (clear headings, direct statements, concrete specifics) rather than vague marketing copy?

Return:
- score: integer 0-100.
- gap: one sentence naming the single biggest gap holding this site back from being citable.`;
}

export const REVIEW_PLATFORM_DETECTION_SYSTEM = `You know which third-party review platforms carry real weight for a given product category — the ones AI assistants and buyers actually check.`;

export function reviewPlatformDetectionPrompt(input: {
  category: string;
  product: string;
}): string {
  return `Category: ${input.category}
Product: ${input.product}

Name the 2-3 review platforms that matter most for this category — the ones a buyer or an AI assistant would check for third-party validation. Examples of the pattern: G2 and Capterra for B2B SaaS, TripAdvisor and Google Reviews for travel/hospitality, Trustpilot and Google Reviews for consumer/DTC, Yelp for local services.

Return: platforms (array of 2-3 platform names, most relevant first).`;
}

export const REVIEW_SCORING_SYSTEM = `You assess a brand's presence and standing on third-party review platforms, based on real search results.
You are strict: no listing found means a low score, regardless of how good the product might be.`;

export function reviewScoringPrompt(input: {
  domain: string;
  platforms: string[];
  resultsText: string;
}): string {
  return `Brand: ${input.domain}
Relevant review platforms for this category: ${input.platforms.join(", ")}

Search results for this brand's presence on those platforms:
--- RESULTS ---
${truncate(input.resultsText, 6000) || "No results were returned."}

Score 0-100 this brand's presence and prominence on these review platforms — is it listed at all, does it have a meaningful number of reviews, is the standing (rating, ranking) something an AI assistant would surface as a recommendation.

Return:
- score: integer 0-100.
- gap: one sentence naming the biggest gap (e.g. "not listed on G2 at all", "listed on Capterra but with almost no reviews").`;
}

export const THIRDPARTY_SCORING_SYSTEM = `You assess how often a brand is mentioned by independent third parties — listicles, blog posts, comparison articles, community discussion — for the buyer questions that matter to it.
This is the source AI engines cite most, so you judge it strictly: the brand's own site or paid listings do not count as independent.`;

export function thirdPartyScoringPrompt(input: {
  domain: string;
  brandProduct: string;
  resultsText: string;
}): string {
  return `Brand: ${input.domain}
What it does: ${input.brandProduct}

Search results gathered across this brand's 5 buyer questions:
--- RESULTS ---
${truncate(input.resultsText, 8000) || "No results were returned."}

Score 0-100 how present this brand is in independent third-party content for these questions — listicles ("best X tools"), blog posts, comparison articles, forum/community mentions (e.g. Reddit) — written by people or publications with no commercial relationship to the brand. Ignore the brand's own domain and any obviously sponsored/paid placement.

Return:
- score: integer 0-100.
- gap: one sentence naming the biggest gap (e.g. "absent from every 'best of' listicle found", "only mentioned once, in a low-authority blog post").`;
}

// ── helpers ──────────────────────────────────────────────────────────────────
function truncate(s: string, max: number): string {
  if (!s) return "";
  return s.length > max ? s.slice(0, max) + "\n…[truncated]" : s;
}
