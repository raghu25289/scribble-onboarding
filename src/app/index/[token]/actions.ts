"use server";

import { discoverProspects } from "@/lib/indexDiscovery";
import { loadIndexWorkspace } from "@/lib/indexWorkspace";
import { sendOutreachEmail } from "@/lib/outreach";
import { store } from "@/lib/store";
import type { IndexIcp, IndexWorkspace } from "@/lib/types";
import { buildAllocatorFeed } from "@/lib/allocators/pipeline";
import { config } from "@/lib/config";

type ActionResult =
  | { ok: true; workspace: IndexWorkspace; notice?: string }
  | { ok: false; error: string; workspace?: IndexWorkspace };

function clean(value: string, max = 1200): string {
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

function validateIcp(input: IndexIcp): IndexIcp {
  const icp: IndexIcp = {
    targetRoles: clean(input.targetRoles),
    industries: clean(input.industries),
    companyProfile: clean(input.companyProfile),
    geographies: clean(input.geographies),
    fitSignals: clean(input.fitSignals),
    exclusions: clean(input.exclusions),
    offer: clean(input.offer),
    proposedLeadCategories: input.proposedLeadCategories.map((category) => ({
      ...category,
      id: clean(category.id, 80),
      label: clean(category.label, 120),
      description: clean(category.description, 300),
    })).filter((category) => category.id && category.label),
    selectedLeadCategoryIds: [...new Set(input.selectedLeadCategoryIds.map((id) => clean(id, 80)))],
    confirmed: true,
  };
  if (!icp.targetRoles || !icp.industries || !icp.offer) {
    throw new Error("Target roles, industries, and your offer are required.");
  }
  if (icp.selectedLeadCategoryIds.length === 0) {
    throw new Error("Select at least one lead category before generating opportunities.");
  }
  return icp;
}

export async function saveIcpAction(accessToken: string, input: IndexIcp): Promise<ActionResult> {
  try {
    const loaded = await loadIndexWorkspace(accessToken);
    if (!loaded) return { ok: false, error: "Index workspace not found." };
    loaded.workspace.icp = validateIcp(input);
    loaded.workspace.updatedAt = new Date().toISOString();
    await store.saveIndexWorkspace(loaded.workspace);
    return { ok: true, workspace: loaded.workspace };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}

export async function discoverAction(accessToken: string, input: IndexIcp): Promise<ActionResult> {
  try {
    const loaded = await loadIndexWorkspace(accessToken);
    if (!loaded) return { ok: false, error: "Index workspace not found." };
    const icp = validateIcp(input);
    const prospects = await discoverProspects(loaded.record, icp);
    const retained = loaded.workspace.prospects.filter((prospect) =>
      ["sent", "sending", "ready_for_outreach"].includes(prospect.status)
    );
    const retainedKeys = new Set(retained.map((prospect) => `${prospect.name}|${prospect.company}`.toLowerCase()));
    loaded.workspace.icp = icp;
    loaded.workspace.prospects = [
      ...retained,
      ...prospects.filter((prospect) => !retainedKeys.has(`${prospect.name}|${prospect.company}`.toLowerCase())),
    ];
    loaded.workspace.lastDiscoveryAt = new Date().toISOString();
    loaded.workspace.updatedAt = loaded.workspace.lastDiscoveryAt;
    await store.saveIndexWorkspace(loaded.workspace);
    return { ok: true, workspace: loaded.workspace };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}

export async function refreshAllocatorFeedAction(accessToken: string, input: IndexIcp): Promise<ActionResult> {
  try {
    if (!config.allocatorPipelineEnabled) return { ok: false, error: "The allocator pipeline feature is not enabled." };
    const loaded = await loadIndexWorkspace(accessToken);
    if (!loaded) return { ok: false, error: "Index workspace not found." };
    loaded.workspace.icp = validateIcp(input);
    const prospects = await buildAllocatorFeed(loaded.record, loaded.workspace);
    loaded.workspace.allocatorProspects = [...loaded.workspace.allocatorProspects, ...prospects];
    loaded.workspace.lastAllocatorFeedAt = new Date().toISOString();
    loaded.workspace.updatedAt = loaded.workspace.lastAllocatorFeedAt;
    await store.saveIndexWorkspace(loaded.workspace);
    return { ok: true, workspace: loaded.workspace, notice: prospects.length ? `${prospects.length} verified allocator opportunities added.` : "No new verified allocator opportunities matched the selected categories." };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}

function findWorkspaceProspect(workspace: IndexWorkspace, prospectId: string) {
  return [...workspace.prospects, ...workspace.allocatorProspects].find((item) => item.id === prospectId);
}

export async function passProspectAction(accessToken: string, prospectId: string): Promise<ActionResult> {
  const loaded = await loadIndexWorkspace(accessToken);
  if (!loaded) return { ok: false, error: "Index workspace not found." };
  const prospect = findWorkspaceProspect(loaded.workspace, prospectId);
  if (!prospect) return { ok: false, error: "Lead not found." };
  if (prospect.status === "sent" || prospect.status === "sending") {
    return { ok: false, error: "This outreach has already been sent." };
  }
  prospect.status = "passed";
  prospect.updatedAt = new Date().toISOString();
  loaded.workspace.updatedAt = prospect.updatedAt;
  await store.saveIndexWorkspace(loaded.workspace);
  return { ok: true, workspace: loaded.workspace };
}

export async function approveProspectAction(
  accessToken: string,
  prospectId: string,
  subjectInput: string,
  messageInput: string
): Promise<ActionResult> {
  const loaded = await loadIndexWorkspace(accessToken);
  if (!loaded) return { ok: false, error: "Index workspace not found." };
  const prospect = findWorkspaceProspect(loaded.workspace, prospectId);
  if (!prospect) return { ok: false, error: "Lead not found." };
  if (prospect.status === "sent" || prospect.status === "sending") {
    return { ok: false, error: "This outreach has already been sent." };
  }

  const subject = clean(subjectInput, 160);
  const message = messageInput.trim().slice(0, 2400);
  if (!subject || !message) return { ok: false, error: "Subject and message are required." };
  prospect.outreachSubject = subject;
  prospect.outreachMessage = message;

  if (!prospect.email) {
    prospect.status = "ready_for_outreach";
    prospect.updatedAt = new Date().toISOString();
    loaded.workspace.updatedAt = prospect.updatedAt;
    await store.saveIndexWorkspace(loaded.workspace);
    return {
      ok: true,
      workspace: loaded.workspace,
      notice: "Approved. Use the available social profile to contact this lead.",
    };
  }

  if (!process.env.RESEND_API_KEY || !process.env.OUTREACH_FROM_EMAIL) {
    prospect.status = "ready_for_outreach";
    prospect.updatedAt = new Date().toISOString();
    loaded.workspace.updatedAt = prospect.updatedAt;
    await store.saveIndexWorkspace(loaded.workspace);
    return {
      ok: true,
      workspace: loaded.workspace,
      notice: "Approved and ready. Configure the email provider to send it from Scribble.",
    };
  }

  prospect.status = "sending";
  prospect.deliveryError = undefined;
  prospect.updatedAt = new Date().toISOString();
  await store.saveIndexWorkspace(loaded.workspace);

  try {
    const result = await sendOutreachEmail({
      to: prospect.email,
      subject,
      text: message,
      replyTo: loaded.workspace.ownerEmail,
      idempotencyKey: `index/${loaded.workspace.onboardingId}/${prospect.id}`,
    });
    prospect.status = "sent";
    prospect.providerMessageId = result.id;
    prospect.updatedAt = new Date().toISOString();
    loaded.workspace.updatedAt = prospect.updatedAt;
    await store.saveIndexWorkspace(loaded.workspace);
    return { ok: true, workspace: loaded.workspace, notice: `Sent to ${prospect.email}.` };
  } catch (error) {
    prospect.status = "failed";
    prospect.deliveryError = (error as Error).message;
    prospect.updatedAt = new Date().toISOString();
    loaded.workspace.updatedAt = prospect.updatedAt;
    await store.saveIndexWorkspace(loaded.workspace);
    return { ok: false, error: prospect.deliveryError, workspace: loaded.workspace };
  }
}
