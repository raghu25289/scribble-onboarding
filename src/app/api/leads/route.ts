// Admin-only: list all captured leads (newest concerns first via the store's
// insertion order). Protected by an x-admin-key header matching ADMIN_KEY.

import { NextRequest, NextResponse } from "next/server";
import { store, usingRedis } from "@/lib/store";

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
