# Scribble — AI-Visibility Onboarding

A standalone onboarding flow for Scribble. A brand enters their email + website and
watches, live, whether AI assistants recommend them when buyers ask — then gets a
tailored recommendation and CTA. No dashboard; the flow ends at the CTA.

Stack: **Next.js (App Router) + TypeScript + Tailwind v4**, API routes calling the
**Anthropic API** (`claude-opus-4-8`) plus a **web-search tool** (Tavily by default,
Serper optional). Deployable to Vercel.

---

## The flow

1. **Capture** — email + website, both validated. The lead (email, domain, timestamp)
   is stored immediately via a swappable store.
2. **Brand understanding** — fetches the homepage (and `/pricing` if present),
   extracts what the product does, who it's for, category, and pricing signals, then
   generates **exactly 5 high-intent buyer questions** the brand should show up in.
3. **Visibility check** — for each query, runs a real web search and an LLM judge:
   *visible yes/no*, a snippet of what the answer actually says, and **who wins that
   query today**. This is the centerpiece screen.
4. **ARPU classification** — estimates whether ARPU exceeds ~$150 (reasoning exposed)
   and branches the recommendation:
   - **> $150 → lead-gen channel** ("rank in these 5 queries to capture buyers").
   - **≤ $150 → brand channel** ("be mentioned accurately and recommended right").
5. **CTA** — a single CTA tied to the branch (book a call / join waitlist).

Steps 2–4 run in **one streaming endpoint** (`/api/analyze`) that emits newline-delimited
JSON so the UI fills in live — site fetched → brand → 5 queries → each visibility row as
it resolves → ARPU verdict.

---

## Setup

```bash
npm install
cp .env.example .env.local   # fill in your keys
npm run dev                  # http://localhost:3000
```

Required env vars (see `.env.example`):

| Var | Purpose |
| --- | --- |
| `OPENROUTER_API_KEY` | LLM calls (brand, queries, visibility, ARPU) |
| `TAVILY_API_KEY` *or* `SERPER_API_KEY` | Web search. Set `SEARCH_PROVIDER=serper` to use Serper. |

Optional: `LLM_MODEL`, `ARPU_THRESHOLD_USD`, `SEARCH_PROVIDER`, `LEAD_STORE_PATH`.

The app **degrades gracefully** if a step fails (site unreachable, no pricing page,
search error, missing key): failures surface as honest status/error events and the flow
continues where it can.

## Index leads

Every completed audit also creates a separate, private Index access link. Index uses the
audit to pre-fill an ICP, searches the public web for matching LinkedIn and X profiles,
qualifies candidates against sourced fit signals, and looks for public professional
email addresses. The owner can edit each proposed message before approving it.

Email delivery uses Resend's REST API. Set `RESEND_API_KEY` and
`OUTREACH_FROM_EMAIL` (on a verified sending domain) to enable **Approve & send**.
Without both values, approved messages stay in a ready state and are never represented
as sent. The public report token does not grant access to the Index workspace.

### ICP selection and allocator leads

Index proposes broad lead categories from the stored product/category/question context,
but does not generate opportunities until the owner selects at least one category. Crypto
products get allocator-aware options such as liquid funds, market makers, liquid-strategy
VCs, and institutional/family-office allocators. Matching never treats anonymous retail
consumers as usable opportunities.

The allocator pipeline is a separate, persistent candidate graph. Enable it with
`ALLOCATOR_PIPELINE_ENABLED=true`; `/api/cron/allocators` runs weekly on Vercel and is
protected by `CRON_SECRET`. Source adapters consume customer-controlled ETL feeds for:

- public/official sources first: SEC Form ADV/IAPD and official fund sites;
- public crypto/on-chain enrichment: DefiLlama, Dune, explorers, and labeled wallets;
- optional licensed feeds: Crunchbase, PitchBook, RootData, Nansen, and Arkham, each
  gated by both a feed URL and its credential.

Adapters must emit source URLs, observation dates, and `public`/`licensed` provenance.
The graph normalizes and deduplicates organizations by domain, keeps fund mandates,
people and public contact routes, tracks freshness, and re-matches saved workspaces.
The owner-triggered feed performs a final source reachability check before adding leads.
No connector or scheduled job sends outreach; existing per-message approval remains the
only send path.

`data/allocator-fixtures.sample.json` is intentionally fictional, labeled demo data and
is never loaded automatically.

### Question intent and depth

New audits explicitly choose Buying, Brand, or Both and Basic, Intermediate, Advanced,
or Balanced mix. Both + Balanced is the default. Optional custom questions are preserved
verbatim alongside generated questions. The selected settings and per-question intent,
depth, and source are stored with the onboarding record and are used by generation—not
just displayed in the UI.

All schema evolution is additive. Older JSON/Redis records remain readable; missing
workspace fields are filled in memory with safe defaults, no destructive backfill runs,
and the allocator graph uses its own versioned key/file. Rollback is setting
`ALLOCATOR_PIPELINE_ENABLED=false`; existing opportunity and audit data remains intact.

#### Fast local demo (fictional data)

1. Set `ALLOCATOR_PIPELINE_ENABLED=true`, `ALLOCATOR_DEMO_MODE=true`, and a local
   `CRON_SECRET` in `.env.local`.
2. Start the app, then ingest the fixture once:
   `curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/allocators`.
3. Complete an audit for a DeFi-style product, open its private Index link, select
   **Liquid funds / crypto hedge funds**, save the ICP, and click **Get this week's
   allocator leads**.

The fixture is fictional, uses `.example.invalid`, and is marked **FICTIONAL DEMO DATA**
on every surfaced card. Disable `ALLOCATOR_DEMO_MODE` before connecting real feeds.

---

## Where to iterate

- **Prompts** — `src/lib/prompts.ts`. All four prompts (brand understanding,
  **query generation**, visibility judge, **ARPU classification**) are editable
  constants/templates. This is the main tuning surface.
- **Config** — `src/lib/config.ts`. Model, ARPU threshold, query count, search provider,
  timeouts — all env-overridable.
- **Search provider** — `src/lib/search.ts`. One `searchWeb()` behind Tavily/Serper; add
  a provider by implementing the `SearchProvider` signature.

---

## Lead review

Every completed onboarding (email, domain, 5 queries, visibility results, ARPU verdict)
is logged two ways:

- **JSON file** — `data/onboardings.json` locally (leads in `data/leads.json`).
- **`console.log`** — so on Vercel, completed onboardings show up in **function logs**
  (the project filesystem is read-only there; the store auto-falls back to `/tmp`).

### Swapping the store (SQLite/Prisma/Postgres)

`src/lib/store.ts` defines a `LeadStore` interface with a JSON-file implementation.
To swap: implement the interface and export it as `store`. Nothing else in the app
touches persistence. For Vercel-durable storage, back it with Vercel Postgres/Neon or
Prisma — the interface is designed for a drop-in replacement.

---

## Architecture

```
src/
  app/
    page.tsx                 Step 1 capture + hosts the flow
    api/lead/route.ts        validate + store the lead
    api/analyze/route.ts     stream steps 2–4 as NDJSON
  components/                capture form, live progress, results, ARPU, CTA
  lib/
    prompts.ts               ← EDITABLE prompts
    config.ts                models, thresholds, provider
    openrouter.ts            LLM client + structured-output helper
    search.ts                Tavily/Serper behind searchWeb()
    scrape.ts                homepage + /pricing fetch (graceful)
    analyze.ts               orchestration for steps 2–4
    store.ts                 LeadStore interface + JSON-file impl
    validate.ts              email + domain validation
    types.ts                 shared types + the streaming event protocol
```

All LLM calls are server-side (API routes) and go through OpenRouter; keys never reach
the client. LLM outputs are pinned with structured-output JSON schemas
(`response_format: json_schema`) so responses are always valid JSON in the expected shape.

## Deploy to Vercel

```bash
vercel
```

Set `OPENROUTER_API_KEY` and your search key in the Vercel project env. `vercel.json`
gives `/api/analyze` a 300s max duration for the multi-step agent. Review incoming leads
in the function logs (or swap the store for a database as above).
