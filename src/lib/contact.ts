// Fixed contact channels for the shareable report and the onboarding CTA.
// Plain links, not an embed/env-configurable value — more robust in shared
// and downloaded (offline) contexts than a Cal.com embed ever was.
export const BOOKING_URL = "https://calendar.app.google/TsmLsGaTk2pHf3pC6";
export const CONTACT_EMAIL = "raghu@scribble.network";

export function contactMailtoHref(brand: string): string {
  return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(`AI Visibility Report: ${brand}`)}`;
}
