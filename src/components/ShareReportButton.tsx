"use client";

import { useState } from "react";

export default function ShareReportButton({ reportToken }: { reportToken: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const url = `${window.location.origin}/report/${reportToken}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* Clipboard API unavailable (e.g. insecure context) — no-op. */
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--panel-line)] px-3 py-1.5 text-xs font-medium text-[var(--paper)] transition hover:border-[var(--accent)]"
    >
      {copied ? "Copied!" : "Share report"}
    </button>
  );
}
