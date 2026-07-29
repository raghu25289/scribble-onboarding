"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import CaptureForm from "./CaptureForm";
import ProgressPanel from "./ProgressPanel";
import ResultsScreen from "./ResultsScreen";
import ArpuCard from "./ArpuCard";
import CostCard from "./CostCard";
import CitationScoreSection from "./CitationScoreSection";
import CtaCard from "./CtaCard";
import ShareReportButton from "./ShareReportButton";
import { topCompetitor } from "@/lib/costEstimate";
import { aggregateQuery, computeHeadlineScore, isQueryFullyChecked } from "@/lib/engineVisibility";
import type {
  AnalyzeEvent,
  AnalyzeStep,
  ArpuVerdict,
  BrandUnderstanding,
  Lead,
  PillarScores,
  QueryVisibility,
  QueryWithDemand,
} from "@/lib/types";

type Phase = "capture" | "analyzing" | "done" | "error";

export default function OnboardingFlow() {
  const [phase, setPhase] = useState<Phase>("capture");
  const [domain, setDomain] = useState("");
  const [activeStep, setActiveStep] = useState<AnalyzeStep | null>(null);
  const [completedSteps, setCompletedSteps] = useState<Set<AnalyzeStep>>(new Set());
  const [latestMessage, setLatestMessage] = useState<string | null>(null);

  const [brand, setBrand] = useState<BrandUnderstanding | null>(null);
  const [queries, setQueries] = useState<QueryWithDemand[]>([]);
  const [visibility, setVisibility] = useState<QueryVisibility[]>([]);
  const [arpu, setArpu] = useState<ArpuVerdict | null>(null);
  const [pillars, setPillars] = useState<PillarScores | null>(null);
  const [reportToken, setReportToken] = useState<string | null>(null);
  const [fatalError, setFatalError] = useState<string | null>(null);

  const startedRef = useRef(false);

  const markStepComplete = useCallback((step: AnalyzeStep) => {
    setCompletedSteps((prev) => {
      const next = new Set(prev);
      next.add(step);
      return next;
    });
  }, []);

  const handleEvent = useCallback(
    (ev: AnalyzeEvent) => {
      switch (ev.type) {
        case "status":
          setActiveStep(ev.step);
          setLatestMessage(ev.message);
          break;
        case "brand":
          markStepComplete("fetch_site");
          markStepComplete("understand_brand");
          setBrand(ev.data);
          break;
        case "queries":
          markStepComplete("generate_queries");
          setQueries(ev.data);
          setVisibility(ev.data.map((q) => ({ query: q.text, engines: {} })));
          setActiveStep("check_visibility");
          break;
        case "engine_result":
          setVisibility((prev) => {
            const next = prev.map((qv, i) =>
              i === ev.queryIndex
                ? { ...qv, engines: { ...qv.engines, [ev.engine]: ev.data } }
                : qv
            );
            if (next.length > 0 && next.every(isQueryFullyChecked)) {
              markStepComplete("check_visibility");
            }
            return next;
          });
          break;
        case "arpu":
          markStepComplete("classify_arpu");
          setArpu(ev.data);
          break;
        case "pillars":
          markStepComplete("assess_pillars");
          setPillars(ev.data);
          break;
        case "done":
          setPhase("done");
          setActiveStep(null);
          setReportToken(ev.reportToken);
          break;
        case "error":
          if (ev.fatal) {
            setFatalError(ev.message);
            setPhase("error");
          } else {
            // Non-fatal: surface as a status line and keep going.
            setLatestMessage(ev.message);
          }
          break;
      }
    },
    [markStepComplete]
  );

  const start = useCallback(
    async (email: string, url: string) => {
      if (startedRef.current) return;
      startedRef.current = true;

      const host = url.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
      setDomain(host);
      setPhase("analyzing");

      // Step 1: store the lead.
      let lead: Lead | null = null;
      try {
        const res = await fetch("/api/lead", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, url }),
        });
        if (res.ok) {
          lead = (await res.json()).lead;
        }
      } catch {
        /* If lead creation fails, analyze can still create it inline. */
      }

      // Steps 2–4: stream the analysis.
      try {
        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            lead ? { leadId: lead.id } : { email, url }
          ),
        });
        if (!res.ok || !res.body) {
          throw new Error("Analysis could not be started.");
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        // Read the NDJSON stream line by line.
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            try {
              handleEvent(JSON.parse(trimmed) as AnalyzeEvent);
            } catch {
              /* ignore a partial/garbled line */
            }
          }
        }
        // Flush any trailing buffered line.
        const rest = buffer.trim();
        if (rest) {
          try {
            handleEvent(JSON.parse(rest) as AnalyzeEvent);
          } catch {
            /* ignore */
          }
        }
      } catch (e) {
        setFatalError((e as Error).message);
        setPhase("error");
      }
    },
    [handleEvent]
  );

  // ── render ────────────────────────────────────────────────────────────────
  const showResults = queries.length > 0;
  const allDone = queries.length > 0 && visibility.length > 0 && visibility.every(isQueryFullyChecked);
  const { visible: visibleChecks, total: totalChecks } = computeHeadlineScore(visibility);

  // Hooks must run unconditionally on every render, so this stays above the
  // capture-phase early return below.
  const topInvisibleCompetitor = useMemo(() => {
    const invisibleAggregates = visibility
      .map(aggregateQuery)
      .filter((agg) => agg.invisible);
    return topCompetitor(invisibleAggregates);
  }, [visibility]);

  if (phase === "capture") {
    return (
      <div className="flex flex-1 items-center py-14">
        <CaptureForm onSubmit={start} />
      </div>
    );
  }

  return (
    <div className="mt-10 space-y-6 pb-10">
      <ProgressPanel
        activeStep={activeStep}
        completedSteps={completedSteps}
        latestMessage={latestMessage}
        done={phase === "done"}
      />

      {fatalError && (
        <div
          className="rounded-xl border px-4 py-3 text-sm"
          style={{ borderColor: "rgba(255,107,107,0.35)", background: "rgba(255,107,107,0.08)" }}
        >
          {fatalError}{" "}
          <button
            className="ml-1 underline"
            onClick={() => window.location.reload()}
          >
            Start over
          </button>
        </div>
      )}

      {showResults && (
        <>
          {reportToken && (
            <div className="flex justify-end">
              <ShareReportButton reportToken={reportToken} />
            </div>
          )}
          <ResultsScreen
            domain={domain}
            brand={brand}
            queries={queries}
            visibility={visibility}
          />
        </>
      )}

      {arpu && <ArpuCard arpu={arpu} />}

      {arpu && allDone && (
        <CostCard
          brand={domain}
          arpu={arpu}
          queries={queries}
          visibility={visibility}
        />
      )}

      {pillars && <CitationScoreSection pillars={pillars} />}

      {phase === "done" && arpu && (
        <CtaCard
          domain={domain}
          visibleCount={visibleChecks}
          total={totalChecks}
          topInvisibleCompetitor={topInvisibleCompetitor}
        />
      )}
    </div>
  );
}
