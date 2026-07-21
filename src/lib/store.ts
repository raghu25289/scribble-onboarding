// Lead + onboarding persistence behind a swappable interface.
//
// Two implementations ship:
//   • RedisStore    — Upstash Redis (durable on Vercel's ephemeral filesystem).
//   • JsonFileStore — a JSON file (zero-config local dev).
//
// Selection (see `store` at the bottom): if UPSTASH_REDIS_REST_URL and
// UPSTASH_REDIS_REST_TOKEN are both set, use Redis; otherwise fall back to the
// JSON file store. Local dev needs no config; production just sets the two env
// vars. Every record is also console.log'd so completed onboardings show up in
// Vercel function logs regardless of backend.
//
// To swap to Prisma/Postgres/etc.: implement the LeadStore interface and export
// your implementation as `store`. Nothing else in the app touches persistence.

import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { Redis } from "@upstash/redis";
import { config } from "./config";
import type { AuditRequest, Lead, OnboardingRecord } from "./types";

export interface LeadStore {
  createLead(input: Omit<Lead, "id" | "createdAt">): Promise<Lead>;
  getLead(id: string): Promise<Lead | null>;
  logOnboarding(record: OnboardingRecord): Promise<void>;
  listLeads(): Promise<Lead[]>;
  listOnboardings(): Promise<OnboardingRecord[]>;
  logAuditRequest(input: Omit<AuditRequest, "id" | "createdAt">): Promise<AuditRequest>;
  listAuditRequests(): Promise<AuditRequest[]>;
}

function id(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

// ── Redis keys ───────────────────────────────────────────────────────────────
// Each lead lives at `lead:{id}` (the id embeds its creation timestamp), and its
// id is pushed onto the `leads:index` list so all leads can be read back in
// insertion order. Onboardings mirror this scheme.
const LEAD_KEY = (leadId: string) => `lead:${leadId}`;
const LEADS_INDEX = "leads:index";
const ONBOARDING_KEY = (onbId: string) => `onboarding:${onbId}`;
const ONBOARDINGS_INDEX = "onboardings:index";
const AUDIT_REQUEST_KEY = (reqId: string) => `auditRequest:${reqId}`;
const AUDIT_REQUESTS_INDEX = "auditRequests:index";

// ── Redis implementation ─────────────────────────────────────────────────────
class RedisStore implements LeadStore {
  private redis: Redis;

  constructor() {
    this.redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
  }

  async createLead(input: Omit<Lead, "id" | "createdAt">): Promise<Lead> {
    const lead: Lead = {
      id: id("lead"),
      email: input.email,
      domain: input.domain,
      createdAt: new Date().toISOString(),
    };
    try {
      // @upstash/redis auto-serializes objects to JSON.
      await this.redis.set(LEAD_KEY(lead.id), lead);
      await this.redis.rpush(LEADS_INDEX, lead.id);
    } catch (e) {
      console.error("[store:redis] failed to persist lead:", (e as Error).message);
    }
    console.log("[lead]", JSON.stringify(lead));
    return lead;
  }

  async getLead(leadId: string): Promise<Lead | null> {
    try {
      return (await this.redis.get<Lead>(LEAD_KEY(leadId))) ?? null;
    } catch (e) {
      console.error("[store:redis] failed to read lead:", (e as Error).message);
      return null;
    }
  }

  async logOnboarding(record: OnboardingRecord): Promise<void> {
    try {
      await this.redis.set(ONBOARDING_KEY(record.id), record);
      await this.redis.rpush(ONBOARDINGS_INDEX, record.id);
    } catch (e) {
      console.error("[store:redis] failed to persist onboarding:", (e as Error).message);
    }
    console.log("[onboarding]", JSON.stringify(record));
  }

  async listLeads(): Promise<Lead[]> {
    try {
      const ids = await this.redis.lrange(LEADS_INDEX, 0, -1);
      if (!ids.length) return [];
      const leads = await this.redis.mget<Lead[]>(...ids.map(LEAD_KEY));
      return leads.filter((l): l is Lead => l !== null);
    } catch (e) {
      console.error("[store:redis] failed to list leads:", (e as Error).message);
      return [];
    }
  }

  async logAuditRequest(
    input: Omit<AuditRequest, "id" | "createdAt">
  ): Promise<AuditRequest> {
    const record: AuditRequest = {
      id: id("audit"),
      email: input.email,
      domain: input.domain,
      score: input.score,
      companyName: input.companyName,
      createdAt: new Date().toISOString(),
    };
    try {
      await this.redis.set(AUDIT_REQUEST_KEY(record.id), record);
      await this.redis.rpush(AUDIT_REQUESTS_INDEX, record.id);
    } catch (e) {
      console.error("[store:redis] failed to persist audit request:", (e as Error).message);
    }
    console.log("[audit-request]", JSON.stringify(record));
    return record;
  }

  async listAuditRequests(): Promise<AuditRequest[]> {
    try {
      const ids = await this.redis.lrange(AUDIT_REQUESTS_INDEX, 0, -1);
      if (!ids.length) return [];
      const reqs = await this.redis.mget<AuditRequest[]>(...ids.map(AUDIT_REQUEST_KEY));
      return reqs.filter((r): r is AuditRequest => r !== null);
    } catch (e) {
      console.error("[store:redis] failed to list audit requests:", (e as Error).message);
      return [];
    }
  }

  async listOnboardings(): Promise<OnboardingRecord[]> {
    try {
      const ids = await this.redis.lrange(ONBOARDINGS_INDEX, 0, -1);
      if (!ids.length) return [];
      const recs = await this.redis.mget<OnboardingRecord[]>(...ids.map(ONBOARDING_KEY));
      return recs.filter((r): r is OnboardingRecord => r !== null);
    } catch (e) {
      console.error("[store:redis] failed to list onboardings:", (e as Error).message);
      return [];
    }
  }
}

// ── JSON-file implementation ─────────────────────────────────────────────────
function resolveWritablePath(preferred: string): string {
  const abs = path.isAbsolute(preferred)
    ? preferred
    : path.join(process.cwd(), preferred);
  // On Vercel (or any read-only FS), the project dir isn't writable at runtime.
  if (process.env.VERCEL) {
    return path.join(os.tmpdir(), path.basename(abs));
  }
  return abs;
}

async function readJsonArray<T>(file: string): Promise<T[]> {
  try {
    const raw = await fs.readFile(file, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

async function appendJson<T>(file: string, item: T): Promise<void> {
  const existing = await readJsonArray<T>(file);
  existing.push(item);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(existing, null, 2), "utf8");
}

class JsonFileStore implements LeadStore {
  private leadsFile = resolveWritablePath(config.leadStorePath);
  private onboardingsFile = resolveWritablePath(config.onboardingStorePath);
  private auditRequestsFile = resolveWritablePath(config.auditRequestStorePath);

  async createLead(input: Omit<Lead, "id" | "createdAt">): Promise<Lead> {
    const lead: Lead = {
      id: id("lead"),
      email: input.email,
      domain: input.domain,
      createdAt: new Date().toISOString(),
    };
    try {
      await appendJson(this.leadsFile, lead);
    } catch (e) {
      // Never fail the flow on a store write — log and continue.
      console.error("[store:file] failed to persist lead:", (e as Error).message);
    }
    console.log("[lead]", JSON.stringify(lead));
    return lead;
  }

  async getLead(idToFind: string): Promise<Lead | null> {
    const leads = await readJsonArray<Lead>(this.leadsFile);
    return leads.find((l) => l.id === idToFind) || null;
  }

  async logOnboarding(record: OnboardingRecord): Promise<void> {
    try {
      await appendJson(this.onboardingsFile, record);
    } catch (e) {
      console.error("[store:file] failed to persist onboarding:", (e as Error).message);
    }
    // Always log the full completed onboarding for lead review.
    console.log("[onboarding]", JSON.stringify(record));
  }

  async listLeads(): Promise<Lead[]> {
    return readJsonArray<Lead>(this.leadsFile);
  }

  async listOnboardings(): Promise<OnboardingRecord[]> {
    return readJsonArray<OnboardingRecord>(this.onboardingsFile);
  }

  async logAuditRequest(
    input: Omit<AuditRequest, "id" | "createdAt">
  ): Promise<AuditRequest> {
    const record: AuditRequest = {
      id: id("audit"),
      email: input.email,
      domain: input.domain,
      score: input.score,
      companyName: input.companyName,
      createdAt: new Date().toISOString(),
    };
    try {
      await appendJson(this.auditRequestsFile, record);
    } catch (e) {
      console.error("[store:file] failed to persist audit request:", (e as Error).message);
    }
    console.log("[audit-request]", JSON.stringify(record));
    return record;
  }

  async listAuditRequests(): Promise<AuditRequest[]> {
    return readJsonArray<AuditRequest>(this.auditRequestsFile);
  }
}

// ── Selection ────────────────────────────────────────────────────────────────
export function usingRedis(): boolean {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

function makeStore(): LeadStore {
  if (usingRedis()) {
    console.log("[store] using Upstash Redis");
    return new RedisStore();
  }
  console.log("[store] using JSON file store");
  return new JsonFileStore();
}

export const store: LeadStore = makeStore();

export { id as makeId };
