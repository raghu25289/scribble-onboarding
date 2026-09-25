import { defaultIcp } from "./indexDiscovery";
import { store } from "./store";
import type { IndexWorkspace, OnboardingRecord } from "./types";

export function migrateIndexWorkspace(record: OnboardingRecord, stored: IndexWorkspace): IndexWorkspace {
  const defaults = defaultIcp(record);
  return {
    ...stored,
    icp: {
      ...stored.icp,
      proposedLeadCategories: stored.icp.proposedLeadCategories || defaults.proposedLeadCategories,
      selectedLeadCategoryIds: stored.icp.selectedLeadCategoryIds || [],
    },
    allocatorProspects: stored.allocatorProspects || [],
    lastAllocatorFeedAt: stored.lastAllocatorFeedAt || null,
  };
}

export async function loadIndexWorkspace(
  accessToken: string
): Promise<{ record: OnboardingRecord; workspace: IndexWorkspace } | null> {
  const record = await store.getOnboardingByIndexToken(accessToken);
  if (!record) return null;

  const stored = await store.getIndexWorkspace(accessToken);
  if (stored) {
    return { record, workspace: migrateIndexWorkspace(record, stored) };
  }

  return {
    record,
    workspace: {
      accessToken,
      onboardingId: record.id,
      domain: record.domain,
      ownerEmail: record.email,
      icp: defaultIcp(record),
      prospects: [],
      allocatorProspects: [],
      lastDiscoveryAt: null,
      lastAllocatorFeedAt: null,
      updatedAt: new Date().toISOString(),
    },
  };
}
