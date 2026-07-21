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
