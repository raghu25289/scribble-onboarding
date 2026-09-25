import assert from "node:assert/strict";
import test from "node:test";
import { migrateIndexWorkspace } from "../src/lib/indexWorkspace";
import type { IndexWorkspace, OnboardingRecord, QuestionSettings } from "../src/lib/types";

const record = {
  id: "onb", leadId: "lead", email: "owner@example.test", domain: "example.test", brand: null,
  questionSettings: { intent: "both", depth: "balanced", customQuestions: [] }, queries: [], visibility: [], arpu: null, pillars: null,
  completedAt: "", reportToken: "report", indexAccessToken: "index", reportInsights: null,
} satisfies OnboardingRecord;

test("question settings survive storage serialization", () => {
  const settings: QuestionSettings = { intent: "brand", depth: "advanced", customQuestions: ["Why is this brand trusted?"] };
  const saved = JSON.parse(JSON.stringify({ ...record, questionSettings: settings })) as OnboardingRecord;
  assert.deepEqual(saved.questionSettings, settings);
});

test("legacy workspaces are hydrated additively without changing existing leads", () => {
  const legacy = {
    accessToken: "index", onboardingId: "onb", domain: "example.test", ownerEmail: "owner@example.test",
    icp: { targetRoles: "CTO", industries: "Software", companyProfile: "B2B", geographies: "Any", fitSignals: "Hiring", exclusions: "Retail", offer: "Product", confirmed: true },
    prospects: [{ id: "existing" }], lastDiscoveryAt: null, updatedAt: "",
  } as unknown as IndexWorkspace;
  const migrated = migrateIndexWorkspace(record, legacy);
  assert.equal(migrated.prospects[0].id, "existing");
  assert.deepEqual(migrated.allocatorProspects, []);
  assert.deepEqual(migrated.icp.selectedLeadCategoryIds, []);
  assert.ok(migrated.icp.proposedLeadCategories.length > 0);
});
