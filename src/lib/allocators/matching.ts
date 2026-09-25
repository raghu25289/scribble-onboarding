import type { AllocatorOrganization, IndexProspect, IndexWorkspace, OnboardingRecord } from "../types";
import { makeId } from "../store";
import { classifyCryptoText } from "./taxonomy";

const DAY = 86_400_000;
const ALLOCATOR_CATEGORY_IDS = new Set(["liquid-funds", "market-makers", "liquid-vcs", "family-offices"]);

export function freshnessFor(date: string, now = new Date()): "fresh" | "aging" | "stale" {
  const age = now.getTime() - new Date(date).getTime();
  if (age <= 30 * DAY) return "fresh";
  if (age <= 120 * DAY) return "aging";
  return "stale";
}

function selectedCategoryFor(org: AllocatorOrganization, workspace: IndexWorkspace): string | null {
  const selected = new Set(workspace.icp.selectedLeadCategoryIds);
  const mapping: Record<string, string> = {
    liquid_token_fund: "liquid-funds",
    crypto_hedge_fund: "liquid-funds",
    market_maker: "market-makers",
    crypto_family_office: "family-offices",
    venture_liquid_hybrid: "liquid-vcs",
    venture_only: "liquid-vcs",
    strategic_corporate: "liquid-vcs",
    institutional_asset_manager: "liquid-funds",
    fund_of_funds: "family-offices",
  };
  const id = mapping[org.allocatorType];
  return selected.has(id) ? id : null;
}

export function scoreAllocator(org: AllocatorOrganization, record: OnboardingRecord, workspace: IndexWorkspace) {
  const categoryId = selectedCategoryFor(org, workspace);
  if (!categoryId) return null;
  const liquidFunds = org.funds.filter((fund) => fund.mandate === "liquid" || fund.mandate === "hybrid");
  if (liquidFunds.length === 0) return null;
  if (!org.evidence.some((item) => item.sourceKind === "official_site")) return null;
  const product = `${record.brand?.product || ""} ${record.brand?.category || ""} ${workspace.icp.offer}`.toLowerCase();
  const productTaxonomy = classifyCryptoText(product);
  const terms = product.split(/[^a-z0-9]+/).filter((term) => term.length >= 4);
  const haystack = liquidFunds.flatMap((fund) => [...fund.strategies, ...fund.chains, ...fund.assets]).join(" ").toLowerCase();
  const overlaps = [...new Set(terms.filter((term) => haystack.includes(term)))];
  const sectorMatches = [...new Set(liquidFunds.flatMap((fund) => fund.sectors || []).filter((sector) => productTaxonomy.sectors.includes(sector)))];
  const chainMatches = [...new Set(liquidFunds.flatMap((fund) => fund.chains).map((chain) => chain.toLowerCase()).filter((chain) => productTaxonomy.chains.includes(chain)))];
  const vehicleMatches = [...new Set(liquidFunds.flatMap((fund) => fund.vehicles || []).filter((vehicle) => productTaxonomy.vehicles.includes(vehicle)))];
  const latestSignal = [...org.activitySignals].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))[0];
  const fresh = freshnessFor(latestSignal?.occurredAt || org.lastEnrichedAt);
  const evidenceKinds = new Set(org.evidence.map((item) => item.sourceKind));
  let score = 50 + Math.min(20, overlaps.length * 5);
  score += Math.min(15, sectorMatches.length * 8);
  score += Math.min(8, chainMatches.length * 4);
  score += Math.min(6, vehicleMatches.length * 3);
  if (latestSignal && fresh === "fresh") score += 15;
  else if (latestSignal && fresh === "aging") score += 7;
  if (evidenceKinds.has("sec_adv") || evidenceKinds.has("official_site")) score += 10;
  if (org.people.some((person) => person.publicEmail || person.linkedinUrl || person.xUrl)) score += 5;
  return {
    score: Math.min(100, score),
    categoryId,
    liquidFunds,
    overlaps,
    sectorMatches,
    chainMatches,
    latestSignal,
    freshness: fresh,
  };
}

export function allocatorMatches(
  organizations: AllocatorOrganization[],
  record: OnboardingRecord,
  workspace: IndexWorkspace,
  limit = 10,
  now = new Date()
): IndexProspect[] {
  const existing = new Set(workspace.allocatorProspects.map((lead) => lead.allocatorMatch?.organizationId).filter(Boolean));
  return organizations.flatMap((org) => {
    const match = scoreAllocator(org, record, workspace);
    if (!match || existing.has(org.id)) return [];
    const fund = match.liquidFunds[0];
    const person = org.people.find((item) => item.publicEmail || item.linkedinUrl || item.xUrl) || org.people[0];
    const category = workspace.icp.proposedLeadCategories.find((item) => item.id === match.categoryId);
    const evidence = org.evidence.slice().sort((a, b) => b.observedAt.localeCompare(a.observedAt)).slice(0, 5);
    const prospect: IndexProspect = {
      id: makeId("allocator"),
      name: person?.name || org.canonicalName,
      role: person?.role || "Organization-level opportunity",
      company: org.canonicalName,
      location: org.headquarters || fund.geographies.join(", "),
      linkedinUrl: person?.linkedinUrl || null,
      xUrl: person?.xUrl || null,
      email: person?.publicEmail || null,
      emailSourceUrl: person?.emailSourceUrl || null,
      fit: match.score >= 75 ? "strong" : "possible",
      fitScore: match.score,
      whyFit: `${category?.label || "Allocator"}: ${fund.name} has an evidenced ${fund.mandate} mandate${match.sectorMatches.length ? ` across ${match.sectorMatches.join(", ")}` : ""}${match.chainMatches.length ? ` with ${match.chainMatches.join(", ")} ecosystem overlap` : ""}${!match.sectorMatches.length && match.overlaps.length ? ` with overlap in ${match.overlaps.slice(0, 4).join(", ")}` : ""}.`,
      whyNow: match.latestSignal?.label || null,
      valueForThem: `Evaluate ${workspace.icp.offer} against ${fund.strategies.join(", ") || "the allocator's documented liquid strategy"}.`,
      evidence: evidence.map((item) => ({ label: `${item.sourceName}: ${item.title}`, url: item.url, snippet: item.excerpt, sourceKind: item.sourceKind })),
      outreachSubject: `Potential fit with ${org.canonicalName}'s ${fund.name}`,
      outreachMessage: `Hi ${person?.name || "there"},\n\nI’m writing on behalf of ${record.domain}. We found a potential fit between ${workspace.icp.offer} and ${org.canonicalName}'s documented ${fund.mandate} strategy. Would you be open to reviewing a short introduction?\n\nNo assumptions made—happy to share the supporting public sources first.`,
      status: "recommended" as const,
      updatedAt: now.toISOString(),
      allocatorMatch: {
        organizationId: org.id,
        allocatorType: org.allocatorType,
        mandate: fund.mandate,
        strategyMatch: fund.strategies.join(", ") || "Liquid digital assets",
        trigger: match.latestSignal?.label || null,
        fitScore: match.score,
        freshness: match.freshness,
        lastVerifiedAt: now.toISOString(),
      },
    };
    return [prospect];
  }).sort((a, b) => b.fitScore - a.fitScore).slice(0, limit);
}

export function hasAllocatorSelection(workspace: IndexWorkspace): boolean {
  return workspace.icp.selectedLeadCategoryIds.some((id) => ALLOCATOR_CATEGORY_IDS.has(id));
}
