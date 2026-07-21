// Optional Ahrefs keyword-volume lookup for the cost-of-invisibility estimate
// on the results page. Not wired to a live Ahrefs endpoint yet — Ahrefs'
// Keywords Explorer API needs account-specific credentials and an endpoint
// contract we don't have configured. Once AHREFS_API_KEY is set and the real
// call is filled in below, callers automatically prefer it over the
// model-estimated demand range in analyze.ts.

export function hasAhrefsKey(): boolean {
  return !!process.env.AHREFS_API_KEY;
}

export interface AhrefsVolume {
  low: number;
  high: number;
}

export async function getAhrefsVolume(_query: string): Promise<AhrefsVolume | null> {
  if (!hasAhrefsKey()) return null;
  // TODO: call the Ahrefs Keywords Explorer API here, matching `_query` to its
  // closest keyword and returning its monthly search volume as { low, high }.
  return null;
}
