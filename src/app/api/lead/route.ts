// Step 1: capture the lead. Validates email + domain, stores the lead, returns
// the created lead so the client can kick off analysis.

import { NextRequest, NextResponse } from "next/server";
import { isValidEmail, normalizeDomain } from "@/lib/validate";
import { store } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: { email?: string; url?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const email = (body.email || "").trim();
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const domainResult = normalizeDomain(body.url || "");
  if (!domainResult.ok || !domainResult.domain) {
    return NextResponse.json({ error: domainResult.error || "Enter a valid website." }, { status: 400 });
  }

  const lead = await store.createLead({ email, domain: domainResult.domain });
  return NextResponse.json({ lead });
}
