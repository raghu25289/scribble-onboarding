"use client";

import { useState } from "react";
import { isValidEmail, normalizeDomain } from "@/lib/validate";

interface Props {
  onSubmit: (email: string, url: string) => void;
  disabled?: boolean;
}

export default function CaptureForm({ onSubmit, disabled }: Props) {
  const [email, setEmail] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!isValidEmail(email)) {
      setError("Enter a valid email address.");
      return;
    }
    const dom = normalizeDomain(url);
    if (!dom.ok) {
      setError(dom.error || "Enter a valid website.");
      return;
    }
    onSubmit(email.trim(), dom.url!);
  }

  return (
    <div className="mx-auto w-full max-w-xl fade-up">
      <h1 className="font-display text-4xl leading-[1.05] font-semibold sm:text-5xl">
        When a buyer asks AI for the{" "}
        <span style={{ color: "var(--lime-deep)" }}>best in your category</span>,
        does it name you?
      </h1>
      <p className="mt-4 text-[15px] leading-relaxed text-[var(--ink-45)]">
        Enter your site. Scribble finds the 5 questions your buyers ask AI
        assistants, then shows you live whether you show up, and who wins
        those answers today.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-3">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-[var(--ink-45)]">
            Work email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            autoComplete="email"
            disabled={disabled}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] px-4 py-3 text-[15px] outline-none transition focus:border-[var(--lime-deep)] disabled:opacity-60"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-[var(--ink-45)]">
            Website
          </label>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="yourbrand.com"
            autoComplete="url"
            disabled={disabled}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] px-4 py-3 text-[15px] outline-none transition focus:border-[var(--lime-deep)] disabled:opacity-60"
          />
        </div>

        {error && <p className="text-sm text-[var(--danger)]">{error}</p>}

        <button
          type="submit"
          disabled={disabled}
          className="w-full rounded-lg px-4 py-3.5 text-[15px] font-semibold text-[var(--ink)] transition hover:brightness-105 disabled:opacity-60"
          style={{ background: "var(--lime)" }}
        >
          {disabled ? "Working…" : "Check my AI visibility →"}
        </button>
        <p className="pt-1 text-center text-xs text-[var(--ink-45)]">
          Takes ~30 seconds. No account needed.
        </p>
      </form>
    </div>
  );
}
