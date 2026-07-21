// Email + domain/URL validation and normalization. Used by the capture step and
// the lead route so client and server agree on what's valid.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}

export interface DomainResult {
  ok: boolean;
  domain?: string; // normalized bare host, e.g. "acme.com"
  url?: string; // normalized https URL, e.g. "https://acme.com"
  error?: string;
}

// Accepts "acme.com", "www.acme.com", "https://acme.com/pricing", etc. and
// returns a normalized bare host + canonical https URL.
export function normalizeDomain(raw: string): DomainResult {
  let input = (raw || "").trim();
  if (!input) return { ok: false, error: "Enter a website URL." };

  // Add a scheme so the URL parser can do the work.
  if (!/^https?:\/\//i.test(input)) input = "https://" + input;

  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    return { ok: false, error: "That doesn't look like a valid URL." };
  }

  let host = parsed.hostname.toLowerCase();
  if (host.startsWith("www.")) host = host.slice(4);

  // Must have at least one dot and a plausible TLD.
  if (!host.includes(".") || host.endsWith(".") || host.startsWith(".")) {
    return { ok: false, error: "Enter a full domain, like acme.com." };
  }
  const tld = host.split(".").pop() || "";
  if (tld.length < 2) {
    return { ok: false, error: "That domain is missing a valid extension." };
  }
  // Reject obvious localhost / IP-ish inputs.
  if (host === "localhost" || /^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    return { ok: false, error: "Enter a public website domain." };
  }

  return { ok: true, domain: host, url: `https://${host}` };
}
