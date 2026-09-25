import type { AllocatorGraph, AllocatorOrganization } from "../types";

export function emptyAllocatorGraph(): AllocatorGraph {
  return { version: 1, organizations: [], updatedAt: new Date(0).toISOString(), ingestionRuns: [] };
}

export function normalizeAllocatorIdentity(name: string, domain: string): string {
  const normalizedDomain = domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");
  if (normalizedDomain) return `domain:${normalizedDomain}`;
  return `name:${name.toLowerCase().replace(/\b(the|capital|management|partners|fund|funds|ventures)\b/g, "").replace(/[^a-z0-9]/g, "")}`;
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

export function mergeAllocatorOrganization(
  current: AllocatorOrganization | undefined,
  incoming: AllocatorOrganization
): AllocatorOrganization {
  if (!current) return incoming;
  const evidence = [...current.evidence];
  for (const item of incoming.evidence) {
    const existing = evidence.findIndex((candidate) => candidate.url === item.url && candidate.title === item.title);
    if (existing === -1) evidence.push(item);
    else if (item.observedAt > evidence[existing].observedAt) evidence[existing] = item;
  }
  const mergeById = <T extends { id: string }>(left: T[], right: T[]) => {
    const merged = new Map(left.map((item) => [item.id, item]));
    right.forEach((item) => merged.set(item.id, item));
    return [...merged.values()];
  };
  return {
    ...current,
    ...incoming,
    canonicalName: incoming.canonicalName.length >= current.canonicalName.length ? incoming.canonicalName : current.canonicalName,
    aliases: unique([...current.aliases, ...incoming.aliases, current.canonicalName, incoming.canonicalName]),
    funds: mergeById(current.funds, incoming.funds),
    people: mergeById(current.people, incoming.people),
    evidence,
    activitySignals: mergeById(current.activitySignals.map((item) => ({ ...item, id: item.evidenceId })), incoming.activitySignals.map((item) => ({ ...item, id: item.evidenceId }))).map(({ id: _id, ...item }) => item),
    sourceRecordIds: unique([...current.sourceRecordIds, ...incoming.sourceRecordIds]),
    firstSeenAt: current.firstSeenAt < incoming.firstSeenAt ? current.firstSeenAt : incoming.firstSeenAt,
    lastSeenAt: current.lastSeenAt > incoming.lastSeenAt ? current.lastSeenAt : incoming.lastSeenAt,
    lastEnrichedAt: current.lastEnrichedAt > incoming.lastEnrichedAt ? current.lastEnrichedAt : incoming.lastEnrichedAt,
  };
}

export function upsertAllocatorOrganizations(graph: AllocatorGraph, records: AllocatorOrganization[]): AllocatorGraph {
  const organizations = [...graph.organizations];
  for (const incoming of records) {
    const key = normalizeAllocatorIdentity(incoming.canonicalName, incoming.normalizedDomain);
    const index = organizations.findIndex((item) => normalizeAllocatorIdentity(item.canonicalName, item.normalizedDomain) === key);
    if (index === -1) organizations.push(incoming);
    else organizations[index] = mergeAllocatorOrganization(organizations[index], incoming);
  }
  return { ...graph, organizations, updatedAt: new Date().toISOString() };
}
