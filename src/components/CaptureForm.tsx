"use client";

import { useState } from "react";
import { isValidEmail, normalizeDomain } from "@/lib/validate";
import { DEFAULT_QUESTION_SETTINGS } from "@/lib/questionSettings";
import type { QuestionDepth, QuestionIntent, QuestionSettings } from "@/lib/types";

interface Props {
  onSubmit: (email: string, url: string, questionSettings: QuestionSettings) => void;
  disabled?: boolean;
}

export default function CaptureForm({ onSubmit, disabled }: Props) {
  const [email, setEmail] = useState("");
  const [url, setUrl] = useState("");
  const [intent, setIntent] = useState<QuestionIntent>(DEFAULT_QUESTION_SETTINGS.intent);
  const [depth, setDepth] = useState<QuestionDepth>(DEFAULT_QUESTION_SETTINGS.depth);
  const [customQuestions, setCustomQuestions] = useState("");
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
    onSubmit(email.trim(), dom.url!, {
      intent,
      depth,
      customQuestions: customQuestions.split("\n").map((item) => item.trim()).filter(Boolean),
    });
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

        <fieldset className="rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] p-4">
          <legend className="px-1 text-xs font-semibold text-[var(--ink-70)]">Question intent</legend>
          <div className="mt-1 grid gap-2 sm:grid-cols-3">
            {([
              ["buying", "Buying", "Evaluation, comparisons, alternatives and adoption criteria."],
              ["brand", "Brand", "Awareness, trust, reputation and category association."],
              ["both", "Both", "A deliberate mix of buying and brand questions."],
            ] as const).map(([value, label, help]) => (
              <label key={value} className={`cursor-pointer rounded-md border p-3 text-xs ${intent === value ? "border-[var(--lime-deep)] bg-white" : "border-[var(--border)]"}`}>
                <input className="sr-only" type="radio" name="intent" value={value} checked={intent === value} onChange={() => setIntent(value)} />
                <span className="block font-semibold">{label}{value === "both" ? " · Recommended" : ""}</span>
                <span className="mt-1 block leading-4 text-[var(--ink-45)]">{help}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] p-4">
          <legend className="px-1 text-xs font-semibold text-[var(--ink-70)]">Question depth</legend>
          <div className="mt-1 grid gap-2 sm:grid-cols-2">
            {([
              ["basic", "Basic", "Broad category questions in everyday language."],
              ["intermediate", "Intermediate", "Informed evaluation and comparison questions."],
              ["advanced", "Advanced", "Niche, technical questions from subject-matter experts."],
              ["balanced", "Balanced mix", "A deliberate spread across all three depths."],
            ] as const).map(([value, label, help]) => (
              <label key={value} className={`cursor-pointer rounded-md border p-3 text-xs ${depth === value ? "border-[var(--lime-deep)] bg-white" : "border-[var(--border)]"}`}>
                <input className="sr-only" type="radio" name="depth" value={value} checked={depth === value} onChange={() => setDepth(value)} />
                <span className="block font-semibold">{label}{value === "balanced" ? " · Recommended" : ""}</span>
                <span className="mt-1 block leading-4 text-[var(--ink-45)]">{help}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-[var(--ink-45)]">Custom questions <span className="font-normal">(optional, one per line)</span></label>
          <textarea value={customQuestions} onChange={(event) => setCustomQuestions(event.target.value)} placeholder="Which staking providers support institutional custody?" disabled={disabled} className="min-h-20 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] px-4 py-3 text-sm outline-none transition focus:border-[var(--lime-deep)] disabled:opacity-60" />
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
