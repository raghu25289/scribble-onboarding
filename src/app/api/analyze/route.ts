// Steps 2–4 as a streaming endpoint. Emits newline-delimited JSON (NDJSON):
// one AnalyzeEvent per line, flushed as each phase completes so the UI fills in
// live. Accepts either a leadId (preferred) or an inline email+domain.

import { NextRequest } from "next/server";
import { runAnalysis } from "@/lib/analyze";
import { store } from "@/lib/store";
import { isValidEmail, normalizeDomain } from "@/lib/validate";
import type { AnalyzeEvent, Lead } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  let body: { leadId?: string; email?: string; url?: string };
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid body", { status: 400 });
  }

  // Resolve the lead: by id, or create/normalize from inline fields.
  let lead: Lead | null = null;
  if (body.leadId) {
    lead = await store.getLead(body.leadId);
  }
  if (!lead) {
    const email = (body.email || "").trim();
    const dom = normalizeDomain(body.url || "");
    if (!isValidEmail(email) || !dom.ok || !dom.domain) {
      return new Response("Missing or invalid lead.", { status: 400 });
    }
    lead = await store.createLead({ email, domain: dom.domain });
  }

  const resolvedLead = lead;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: AnalyzeEvent) => {
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      };
      try {
        await runAnalysis(resolvedLead, emit);
      } catch (e) {
        emit({
          type: "error",
          step: "log",
          message: `Unexpected error: ${(e as Error).message}`,
          fatal: true,
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
