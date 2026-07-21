// GET: admin-only listing of all captured leads (newest concerns first via
// the store's insertion order). Protected by an x-admin-key header matching
// ADMIN_KEY.
//
// POST: public — captures an "email me the full audit" lead from the results
// page's secondary CTA. Brand URL + visibility score + email + timestamp.

import { NextRequest, NextResponse } from "next/server";
import { store, usingRedis } from "@/lib/store";
import { isValidEmail } from "@/lib/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const adminKey = process.env.ADMIN_KEY;

  // If no ADMIN_KEY is configured, refuse rather than expose leads publicly.
  if (!adminKey) {
    return NextResponse.json(
      { error: "ADMIN_KEY is not configured on the server." },
      { status: 401 }
    );
  }

  if (req.headers.get("x-admin-key") !== adminKey) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const leads = await store.listLeads();
  return NextResponse.json({
    backend: usingRedis() ? "redis" : "file",
    count: leads.length,
    leads,
  });
}

export async function POST(req: NextRequest) {
  let body: { email?: string; domain?: string; score?: string; companyName?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const email = (body.email || "").trim();
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const domain = (body.domain || "").trim();
  if (!domain) {
    return NextResponse.json({ error: "Missing brand domain." }, { status: 400 });
  }

  const score = (body.score || "").trim();
  const companyName = (body.companyName || "").trim() || undefined;

  const auditRequest = await store.logAuditRequest({ email, domain, score, companyName });
  return NextResponse.json({ auditRequest });
}
