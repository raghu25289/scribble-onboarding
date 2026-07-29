"use client";

import { useScrollReveal, useRevealCountUp } from "@/lib/useScrollReveal";
import {
  aggregateQuery,
  competitorWinCounts,
  computeHeadlineScore,
  REAL_ENGINES,
} from "@/lib/engineVisibility";
import { bandColor } from "@/lib/severity";
import { computeCostBreakdown, estimateMonthlyAskVolume, formatMoney, round2SigFigs } from "@/lib/costEstimate";
import type { ArpuVerdict, PillarScores, QueryVisibility, QueryWithDemand } from "@/lib/types";

const RECOVERABLE_SHARE = 0.6;

interface Props {
  domain: string;
  completedAt: string;
  category: string;
  queries: QueryWithDemand[];
  visibility: QueryVisibility[];
  pillars: PillarScores | null;
  arpu: ArpuVerdict | null;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

// Scrolls to a section by id ourselves rather than relying on native
// <a href="#id"> fragment navigation, which doesn't reliably trigger a
// scroll in every environment this page renders in. Also doubles as the
// prefers-reduced-motion check for these jumps specifically.
function scrollToSection(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const headerOffset = 72;
  const top = el.getBoundingClientRect().top + window.scrollY - headerOffset;
  window.scrollTo({ top, behavior: prefersReduced ? "auto" : "smooth" });
}

function handleAnchorClick(e: React.MouseEvent<HTMLElement>) {
  const href = e.currentTarget.getAttribute("href") || "";
  if (!href.startsWith("#")) return;
  e.preventDefault();
  scrollToSection(href.slice(1));
}

// Every tile shares the same rise+fade entrance, staggered by `delayMs`.
function Tile({
  href,
  className = "",
  style,
  delayMs,
  inView,
  children,
}: {
  href?: string;
  className?: string;
  style?: React.CSSProperties;
  delayMs: number;
  inView: boolean;
  children: React.ReactNode;
}) {
  const Comp = href ? "a" : "div";
  return (
    <Comp
      {...(href ? { href, onClick: handleAnchorClick } : {})}
      className={`bento-tile flex flex-col justify-between rounded-2xl bg-[var(--panel)] p-5 sm:p-6 ${className} ${inView ? "is-visible" : ""}`}
      style={{ transitionDelay: `${delayMs}ms`, ...style }}
    >
      {children}
    </Comp>
  );
}

export default function BentoHero({ domain, completedAt, category, queries, visibility, pillars, arpu }: Props) {
  const { ref, inView, reducedMotion } = useScrollReveal<HTMLDivElement>(0.15);

  const { visible: visibleChecks, total: totalChecks } = computeHeadlineScore(visibility);
  const scorePct = totalChecks > 0 ? Math.round((visibleChecks / totalChecks) * 100) : 0;
  const scoreColor = bandColor(scorePct);

  const buyerVolume = estimateMonthlyAskVolume(queries);

  const rows = queries.map((q, i) => ({
    demand: q,
    qv: visibility[i] ?? { query: q.text, engines: {} },
    agg: aggregateQuery(visibility[i] ?? { query: q.text, engines: {} }),
  }));
  const invisibleRows = rows.filter((r) => r.agg.checkedCount > 0 && r.agg.invisible);

  const competitors = competitorWinCounts(invisibleRows.map((r) => ({ winners: r.agg.winners }))).slice(0, 5);

  const pricingUnknown = arpu?.classification === "unknown_pricing";
  const leadsFirst = arpu ? arpu.classification === "leads" || pricingUnknown : false;
  const breakdown = arpu && invisibleRows.length > 0 ? computeCostBreakdown(invisibleRows, arpu) : null;

  const conservativeLoss = breakdown ? (leadsFirst ? breakdown.totalLowLeads : breakdown.totalLowUsd) : 0;
  const aggressiveLoss = breakdown ? (leadsFirst ? breakdown.totalHighLeads : breakdown.totalHighUsd) : 0;
  const recoverable = breakdown ? round2SigFigs(conservativeLoss * RECOVERABLE_SHARE) : 0;

  const animatedScore = useRevealCountUp(scorePct, inView, reducedMotion, 600);
  const animatedBuyerVolume = useRevealCountUp(buyerVolume, inView, reducedMotion, 600);
  const animatedLoss = useRevealCountUp(conservativeLoss, inView, reducedMotion, 600);
  const animatedRecoverable = useRevealCountUp(recoverable, inView, reducedMotion, 600);

  const engineCells = rows.map((r) =>
    REAL_ENGINES.map((engine) => {
      const result = r.qv.engines[engine];
      if (!result || !result.ok) return null;
      return result.visible;
    })
  );

  const size = 148;
  const stroke = 14;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const filled = (animatedScore / 100) * circumference;

  let delayIndex = 0;
  const nextDelay = () => delayIndex++ * 60;

  return (
    <div
      ref={ref}
      className="report-section relative flex min-h-screen flex-col px-4 pb-10 pt-16 sm:px-6 sm:pt-16"
    >
      <div className="mx-auto grid w-full max-w-5xl flex-1 grid-cols-1 gap-4 sm:auto-rows-fr sm:grid-cols-4 sm:grid-flow-row-dense sm:gap-5">
        {/* 1. IDENTITY */}
        <Tile delayMs={nextDelay()} inView={inView}>
          <span className="text-xs font-semibold" style={{ color: "var(--accent)" }}>
            Scribble
          </span>
          <div>
            <p className="font-display mt-2 text-lg font-semibold leading-snug sm:text-xl">
              {domain} AI Visibility Report
            </p>
            <p className="mt-2 text-xs text-[var(--muted)]">{formatDate(completedAt)}</p>
          </div>
        </Tile>

        {/* 2. SCORE (anchor tile) */}
        <Tile
          href="#matrix"
          delayMs={nextDelay()}
          inView={inView}
          className="items-center text-center sm:col-span-2 sm:row-span-2"
        >
          <span className="text-xs font-semibold text-[var(--muted)]">Your AI visibility</span>
          <div className="relative my-2" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="-rotate-90">
              <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--ink-soft)" strokeWidth={stroke} />
              <circle
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={scoreColor}
                strokeWidth={stroke}
                strokeLinecap={animatedScore > 0 ? "round" : "butt"}
                strokeDasharray={`${filled} ${circumference}`}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="font-display text-4xl font-bold tabular-nums sm:text-5xl" style={{ color: scoreColor }}>
                {animatedScore}%
              </span>
            </div>
          </div>
          <span className="text-sm text-[var(--muted)]">
            {visibleChecks}/{totalChecks} engine checks
          </span>
        </Tile>

        {/* 3. REVENUE AT RISK */}
        {breakdown && (
          <Tile
            href="#loss-bars"
            delayMs={nextDelay()}
            inView={inView}
            className="sm:col-span-2"
            style={{ background: "rgba(255,107,107,0.08)" }}
          >
            <span className="text-xs font-semibold text-[var(--muted)]">Revenue at risk</span>
            <div>
              <div className="font-display text-4xl font-bold tabular-nums sm:text-5xl" style={{ color: "var(--miss)" }}>
                {leadsFirst ? animatedLoss.toLocaleString("en-US") : formatMoney(animatedLoss)}
              </div>
              <p className="mt-1 text-xs text-[var(--muted)]">per month, estimated</p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Could reach {leadsFirst ? `${aggressiveLoss.toLocaleString("en-US")} leads/mo` : formatMoney(aggressiveLoss)}
              </p>
            </div>
          </Tile>
        )}

        {/* 4. DEMAND */}
        {buyerVolume > 0 && (
          <Tile delayMs={nextDelay()} inView={inView}>
            <span className="text-xs font-semibold text-[var(--muted)]">Buyer demand</span>
            <div>
              <div className="font-display text-3xl font-bold tabular-nums">
                {animatedBuyerVolume.toLocaleString("en-US")}
              </div>
              <p className="mt-1 text-xs leading-snug text-[var(--muted)]">
                buyers a month are asking AI about {category}.
              </p>
            </div>
          </Tile>
        )}

        {/* 5. WHO WINS */}
        {competitors.length > 0 && (
          <Tile delayMs={nextDelay()} inView={inView} className="sm:col-span-2">
            <span className="text-xs font-semibold text-[var(--muted)]">AI sends them to</span>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {competitors.map((c, i) => (
                <span
                  key={c.name}
                  className={`chip-stagger rounded-md border border-[var(--panel-line)] bg-[var(--ink-soft)] px-2 py-1 text-xs ${inView ? "is-visible" : ""}`}
                  style={{ transitionDelay: `${300 + i * 80}ms`, animationDelay: `${300 + i * 80}ms` }}
                >
                  {c.name} <span className="text-[var(--muted)]">· {c.count}</span>
                </span>
              ))}
            </div>
          </Tile>
        )}

        {/* 6. ENGINE MATRIX (mini) */}
        <Tile delayMs={nextDelay()} inView={inView} className="items-center text-center">
          <span className="text-xs font-semibold text-[var(--muted)]">Engine matrix</span>
          <div
            className="mx-auto my-2 grid gap-1"
            style={{ gridTemplateColumns: `repeat(${REAL_ENGINES.length}, minmax(0, 1fr))` }}
          >
            {engineCells.map((cells, ri) =>
              cells.map((cell, ci) => (
                <span
                  key={`${ri}-${ci}`}
                  className="block h-3 w-3 rounded-sm"
                  style={{
                    background: cell === null ? "var(--panel-line)" : cell ? "var(--win)" : "var(--miss)",
                  }}
                />
              ))
            )}
          </div>
          <span className="text-xs text-[var(--muted)]">
            {queries.length} buyer questions × {REAL_ENGINES.length} engines.
          </span>
        </Tile>

        {/* 7. PILLARS */}
        {pillars && (
          <Tile href="#working" delayMs={nextDelay()} inView={inView}>
            <span className="text-xs font-semibold text-[var(--muted)]">Citability</span>
            <div className="mt-2 space-y-2">
              {[
                { label: "Site", score: pillars.onsite.score },
                { label: "Reviews", score: pillars.reviews.score },
                { label: "Mentions", score: pillars.thirdparty.score },
              ].map((p) => (
                <div key={p.label}>
                  <div className="flex items-center justify-between text-[11px] text-[var(--muted)]">
                    <span>{p.label}</span>
                    <span className="tabular-nums" style={{ color: bandColor(p.score) }}>
                      {p.score}
                    </span>
                  </div>
                  <div className="mt-0.5 h-1.5 w-full rounded-full bg-[var(--ink-soft)]">
                    <div
                      className="bar-fill h-full rounded-full"
                      style={{ width: inView ? `${Math.max(2, p.score)}%` : "0%", background: bandColor(p.score) }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Tile>
        )}

        {/* 8. RECOVERABLE */}
        {breakdown && (
          <Tile
            delayMs={nextDelay()}
            inView={inView}
            style={{ background: "rgba(110,231,168,0.08)" }}
          >
            <span className="text-xs font-semibold text-[var(--muted)]">Recoverable</span>
            <div>
              <div className="font-display text-2xl font-bold tabular-nums sm:text-3xl" style={{ color: "var(--win)" }}>
                {leadsFirst ? `${animatedRecoverable.toLocaleString("en-US")}/mo` : `${formatMoney(animatedRecoverable)}/mo`}
              </div>
              <p className="mt-1 text-xs text-[var(--muted)]">Illustrative, not a guarantee.</p>
            </div>
          </Tile>
        )}

        {/* 9. CTA */}
        <Tile
          delayMs={nextDelay()}
          inView={inView}
          className="border"
          style={{ borderColor: "var(--accent)" }}
        >
          <div>
            <p className="font-display text-base font-semibold leading-snug sm:text-lg">
              Fix it before competitors notice.
            </p>
            <a
              href="#book"
              onClick={handleAnchorClick}
              className="mt-3 inline-block rounded-lg px-3 py-2 text-xs font-semibold text-[var(--ink)] transition hover:brightness-105"
              style={{ background: "var(--accent)" }}
            >
              Book a call
            </a>
          </div>
          <a
            href="#moves"
            onClick={handleAnchorClick}
            className="mt-3 block text-xs text-[var(--muted)] underline underline-offset-2"
          >
            3 moves to fix this →
          </a>
        </Tile>
      </div>

      <div className="bento-scroll-indicator absolute bottom-3 left-1/2 -translate-x-1/2 text-[var(--muted)]">
        ↓
      </div>
    </div>
  );
}
