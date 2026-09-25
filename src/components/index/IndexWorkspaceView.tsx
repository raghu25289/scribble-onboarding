"use client";

import { useMemo, useState, useTransition } from "react";
import type { BrandUnderstanding, IndexIcp, IndexProspect, IndexWorkspace } from "@/lib/types";
import {
  approveProspectAction,
  discoverAction,
  passProspectAction,
  refreshAllocatorFeedAction,
  saveIcpAction,
} from "@/app/index/[token]/actions";

interface Props {
  accessToken: string;
  initialWorkspace: IndexWorkspace;
  brand: BrandUnderstanding | null;
  emailDeliveryConfigured: boolean;
  allocatorPipelineEnabled: boolean;
}

interface DraftMessage {
  subject: string;
  message: string;
}

const fieldClass =
  "mt-2 w-full rounded-lg border border-[var(--border)] bg-white px-3.5 py-3 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--lime-deep)] focus:ring-2 focus:ring-[var(--lime-60)]";

function statusLabel(prospect: IndexProspect): string {
  switch (prospect.status) {
    case "sent": return "Sent";
    case "sending": return "Sending";
    case "ready_for_outreach": return "Approved";
    case "failed": return "Delivery failed";
    case "passed": return "Passed";
    default: return prospect.fit === "strong" ? "Strong fit" : "Possible fit";
  }
}

function initials(name: string): string {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}

function ProspectCard({
  prospect,
  draft,
  busy,
  emailDeliveryConfigured,
  replyTo,
  onDraft,
  onApprove,
  onPass,
}: {
  prospect: IndexProspect;
  draft: DraftMessage;
  busy: boolean;
  emailDeliveryConfigured: boolean;
  replyTo: string;
  onDraft: (draft: DraftMessage) => void;
  onApprove: () => void;
  onPass: () => void;
}) {
  const complete = prospect.status === "sent" || prospect.status === "sending";
  const availableSocial = prospect.linkedinUrl || prospect.xUrl;
  const isDemoAllocator = !!prospect.allocatorMatch && prospect.evidence.some((item) => /fictional|demo/i.test(`${item.label} ${item.snippet}`));

  return (
    <article className="rounded-xl border border-[var(--border)] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] sm:p-6">
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--ink)] text-sm font-bold text-white">
          {initials(prospect.name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="font-display text-lg font-bold tracking-tight">{prospect.name}</h3>
              <p className="text-sm text-[var(--ink-70)]">
                {[prospect.role, prospect.company].filter(Boolean).join(" · ")}
              </p>
              {prospect.location && <p className="mt-0.5 text-xs text-[var(--ink-45)]">{prospect.location}</p>}
            </div>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
              prospect.status === "failed"
                ? "bg-[var(--danger-tint)] text-[var(--danger)]"
                : prospect.status === "sent"
                  ? "bg-[var(--lime-deep-tint)] text-[var(--lime-deep)]"
                  : "bg-[var(--bg-subtle)] text-[var(--ink-70)]"
            }`}>
              {statusLabel(prospect)}{prospect.status === "recommended" ? ` · ${prospect.fitScore}` : ""}
            </span>
            {isDemoAllocator && <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">FICTIONAL DEMO DATA</span>}
          </div>

          <div className="mt-3 flex flex-wrap gap-2 text-xs font-medium">
            {prospect.linkedinUrl && (
              <a className="rounded-md border border-[var(--border)] px-2.5 py-1.5 hover:border-[var(--ink-45)]" href={prospect.linkedinUrl} target="_blank" rel="noreferrer">LinkedIn ↗</a>
            )}
            {prospect.xUrl && (
              <a className="rounded-md border border-[var(--border)] px-2.5 py-1.5 hover:border-[var(--ink-45)]" href={prospect.xUrl} target="_blank" rel="noreferrer">X ↗</a>
            )}
            {prospect.email && (
              <a className="rounded-md border border-[var(--border)] px-2.5 py-1.5 hover:border-[var(--ink-45)]" href={`mailto:${prospect.email}`}>{prospect.email}</a>
            )}
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg bg-[var(--bg-subtle)] p-3.5 sm:col-span-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--ink-45)]">Why this person</p>
          <p className="mt-1.5 text-sm leading-6">{prospect.whyFit}</p>
        </div>
        <div className="rounded-lg bg-[var(--lime-wash)] p-3.5">
          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--lime-deep)]">Value for them</p>
          <p className="mt-1.5 text-sm leading-6">{prospect.valueForThem}</p>
        </div>
      </div>

      {prospect.whyNow && (
        <p className="mt-3 text-sm"><span className="font-semibold">Signal:</span> {prospect.whyNow}</p>
      )}

      {prospect.allocatorMatch && (
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-[var(--bg-subtle)] px-2.5 py-1 font-semibold">{prospect.allocatorMatch.allocatorType.replaceAll("_", " ")}</span>
          <span className="rounded-full bg-[var(--bg-subtle)] px-2.5 py-1">Mandate: {prospect.allocatorMatch.mandate}</span>
          <span className="rounded-full bg-[var(--bg-subtle)] px-2.5 py-1">Strategy: {prospect.allocatorMatch.strategyMatch}</span>
          <span className="rounded-full bg-[var(--lime-wash)] px-2.5 py-1">{prospect.allocatorMatch.freshness} · verified {new Date(prospect.allocatorMatch.lastVerifiedAt).toLocaleDateString()}</span>
        </div>
      )}

      {prospect.evidence.length > 0 && (
        <details className="mt-4 border-t border-[var(--border)] pt-4">
          <summary className="cursor-pointer text-xs font-semibold text-[var(--ink-70)]">View {prospect.evidence.length} source{prospect.evidence.length === 1 ? "" : "s"}</summary>
          <div className="mt-3 space-y-2">
            {prospect.evidence.map((item, index) => (
              <a key={`${item.url}-${index}`} className="block rounded-lg border border-[var(--border)] p-3 hover:bg-[var(--bg-subtle)]" href={item.url} target="_blank" rel="noreferrer">
                <span className="block text-xs font-semibold">{item.label} ↗</span>
                <span className="mt-1 block text-xs leading-5 text-[var(--ink-45)]">{item.snippet}</span>
              </a>
            ))}
          </div>
        </details>
      )}

      {prospect.status !== "passed" && (
        <div className="mt-5 border-t border-[var(--border)] pt-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-[var(--ink-45)]">Message Scribble will send</p>
            {!prospect.email && availableSocial && <span className="text-xs text-[var(--ink-45)]">Social handoff</span>}
          </div>
          {prospect.email && emailDeliveryConfigured && (
            <p className="mt-2 text-xs text-[var(--ink-45)]">Replies go directly to {replyTo}.</p>
          )}
          <input
            className={fieldClass}
            value={draft.subject}
            disabled={complete}
            aria-label={`Subject for ${prospect.name}`}
            onChange={(event) => onDraft({ ...draft, subject: event.target.value })}
          />
          <textarea
            className={`${fieldClass} min-h-32 resize-y leading-6`}
            value={draft.message}
            disabled={complete}
            aria-label={`Message for ${prospect.name}`}
            onChange={(event) => onDraft({ ...draft, message: event.target.value })}
          />
          {prospect.deliveryError && <p className="mt-2 text-xs text-[var(--danger)]">{prospect.deliveryError}</p>}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {!complete && (
              <button
                type="button"
                disabled={busy}
                onClick={onApprove}
                className="rounded-lg bg-[var(--ink)] px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-85 disabled:cursor-wait disabled:opacity-50"
              >
                {busy
                  ? "Working…"
                  : prospect.email && emailDeliveryConfigured
                    ? "Approve & send"
                    : "Approve outreach"}
              </button>
            )}
            {!complete && prospect.status !== "ready_for_outreach" && (
              <button type="button" disabled={busy} onClick={onPass} className="rounded-lg px-3 py-2.5 text-sm font-semibold text-[var(--ink-45)] hover:text-[var(--ink)]">Pass</button>
            )}
            {!prospect.email && availableSocial && (
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(draft.message)}
                className="rounded-lg border border-[var(--border)] px-3 py-2.5 text-sm font-semibold hover:border-[var(--ink-45)]"
              >
                Copy message
              </button>
            )}
            {prospect.status === "sent" && <span className="text-sm font-semibold text-[var(--lime-deep)]">Sent from Scribble</span>}
            {prospect.status === "ready_for_outreach" && availableSocial && (
              <a
                className="rounded-lg border border-[var(--ink)] px-4 py-2.5 text-sm font-semibold"
                href={prospect.linkedinUrl || prospect.xUrl || "#"}
                target="_blank"
                rel="noreferrer"
              >
                Open profile ↗
              </a>
            )}
          </div>
        </div>
      )}
    </article>
  );
}

export default function IndexWorkspaceView({
  accessToken,
  initialWorkspace,
  brand,
  emailDeliveryConfigured,
  allocatorPipelineEnabled,
}: Props) {
  const [workspace, setWorkspace] = useState(initialWorkspace);
  const [icp, setIcp] = useState(initialWorkspace.icp);
  const [drafts, setDrafts] = useState<Record<string, DraftMessage>>(() =>
    Object.fromEntries([...initialWorkspace.prospects, ...initialWorkspace.allocatorProspects].map((prospect) => [prospect.id, {
      subject: prospect.outreachSubject,
      message: prospect.outreachMessage,
    }]))
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const visibleProspects = useMemo(
    () => workspace.prospects.filter((prospect) => prospect.status !== "passed"),
    [workspace.prospects]
  );
  const strongCount = visibleProspects.filter((prospect) => prospect.fit === "strong").length;
  const visibleAllocators = useMemo(
    () => workspace.allocatorProspects.filter((prospect) => prospect.status !== "passed"),
    [workspace.allocatorProspects]
  );

  function updateFromResult(result: Awaited<ReturnType<typeof saveIcpAction>>) {
    if (!result.ok) {
      if (result.workspace) setWorkspace(result.workspace);
      setError(result.error);
      return;
    }
    setWorkspace(result.workspace);
    setIcp(result.workspace.icp);
    setDrafts((current) => ({
      ...Object.fromEntries([...result.workspace.prospects, ...result.workspace.allocatorProspects].map((prospect) => [prospect.id, {
        subject: prospect.outreachSubject,
        message: prospect.outreachMessage,
      }])),
      ...current,
    }));
    setError(null);
    setNotice(result.notice || null);
  }

  function saveIcp() {
    setNotice(null);
    startTransition(async () => updateFromResult(await saveIcpAction(accessToken, icp)));
  }

  function discover() {
    setNotice(null);
    setError(null);
    startTransition(async () => updateFromResult(await discoverAction(accessToken, icp)));
  }

  function refreshAllocators() {
    setNotice(null);
    setError(null);
    startTransition(async () => updateFromResult(await refreshAllocatorFeedAction(accessToken, icp)));
  }

  function actOnProspect(id: string, action: "approve" | "pass") {
    setBusyId(id);
    setNotice(null);
    startTransition(async () => {
      const draft = drafts[id];
      const result = action === "approve"
        ? await approveProspectAction(accessToken, id, draft?.subject || "", draft?.message || "")
        : await passProspectAction(accessToken, id);
      updateFromResult(result);
      setBusyId(null);
    });
  }

  return (
    <main className="min-h-screen bg-[var(--bg-subtle)] pb-20">
      <header className="border-b border-[var(--border)] bg-white">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
          <a href="/" className="flex items-center gap-2 font-display font-bold tracking-tight">
            <span className="h-3 w-3 rounded-full bg-[var(--lime-deep)]" /> Scribble
          </a>
          <span className="rounded-full bg-[var(--ink)] px-3 py-1.5 text-xs font-semibold text-white">Index · Private</span>
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
        <section className="max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--lime-deep)]">Index leads</p>
          <h1 className="mt-3 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
            Find the people worth meeting.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--ink-70)]">
            We used the AI visibility audit to understand {workspace.domain}. Confirm who you want to meet, then Index will research and qualify real people across LinkedIn, X, and the public web.
          </p>
          {brand && <p className="mt-3 text-sm text-[var(--ink-45)]">{brand.category} · {brand.audience}</p>}
        </section>

        <section className="mt-9 rounded-xl border border-[var(--border)] bg-white p-5 sm:p-7">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--ink-45)]">01 · Your ICP</p>
              <h2 className="mt-2 font-display text-2xl font-bold">Who should Index look for?</h2>
              <p className="mt-1 text-sm text-[var(--ink-45)]">Pre-filled from your audit. Edit anything that is wrong.</p>
            </div>
            {workspace.icp.confirmed && <span className="self-start rounded-full bg-[var(--lime-deep-tint)] px-2.5 py-1 text-xs font-semibold text-[var(--lime-deep)]">Confirmed</span>}
          </div>

          <div className="mt-6 grid gap-x-5 gap-y-4 sm:grid-cols-2">
            <fieldset className="sm:col-span-2">
              <legend className="text-sm font-semibold">Lead categories</legend>
              <p className="mt-1 text-xs text-[var(--ink-45)]">Proposed from your listing, product description, and tracked questions. Select one or more before generating leads.</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {icp.proposedLeadCategories.map((category) => {
                  const checked = icp.selectedLeadCategoryIds.includes(category.id);
                  return (
                    <label key={category.id} className={`cursor-pointer rounded-lg border p-3 ${checked ? "border-[var(--lime-deep)] bg-[var(--lime-wash)]" : "border-[var(--border)]"}`}>
                      <span className="flex items-start gap-2">
                        <input type="checkbox" checked={checked} onChange={() => setIcp({ ...icp, selectedLeadCategoryIds: checked ? icp.selectedLeadCategoryIds.filter((id) => id !== category.id) : [...icp.selectedLeadCategoryIds, category.id] })} />
                        <span><span className="block text-sm font-semibold">{category.label}</span><span className="mt-1 block text-xs leading-5 text-[var(--ink-45)]">{category.description}</span></span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
            <label className="text-sm font-semibold">Target roles
              <input className={fieldClass} value={icp.targetRoles} onChange={(e) => setIcp({ ...icp, targetRoles: e.target.value })} />
            </label>
            <label className="text-sm font-semibold">Industries
              <input className={fieldClass} value={icp.industries} onChange={(e) => setIcp({ ...icp, industries: e.target.value })} />
            </label>
            <label className="text-sm font-semibold">Company profile
              <input className={fieldClass} value={icp.companyProfile} onChange={(e) => setIcp({ ...icp, companyProfile: e.target.value })} />
            </label>
            <label className="text-sm font-semibold">Geographies
              <input className={fieldClass} value={icp.geographies} onChange={(e) => setIcp({ ...icp, geographies: e.target.value })} />
            </label>
            <label className="text-sm font-semibold sm:col-span-2">Fit or timing signals
              <textarea className={`${fieldClass} min-h-24 resize-y`} value={icp.fitSignals} onChange={(e) => setIcp({ ...icp, fitSignals: e.target.value })} />
            </label>
            <label className="text-sm font-semibold">What you can offer them
              <textarea className={`${fieldClass} min-h-24 resize-y`} value={icp.offer} onChange={(e) => setIcp({ ...icp, offer: e.target.value })} />
            </label>
            <label className="text-sm font-semibold">Exclude
              <textarea className={`${fieldClass} min-h-24 resize-y`} value={icp.exclusions} onChange={(e) => setIcp({ ...icp, exclusions: e.target.value })} />
            </label>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <button type="button" disabled={isPending} onClick={discover} className="rounded-lg bg-[var(--ink)] px-5 py-3 text-sm font-semibold text-white hover:opacity-85 disabled:cursor-wait disabled:opacity-50">
              {isPending && !busyId ? "Researching people…" : workspace.lastDiscoveryAt ? "Refresh leads" : "Confirm & find leads"}
            </button>
            <button type="button" disabled={isPending} onClick={saveIcp} className="rounded-lg border border-[var(--border)] px-4 py-3 text-sm font-semibold hover:border-[var(--ink-45)] disabled:opacity-50">Save ICP</button>
          </div>
          {isPending && !busyId && <p className="mt-3 text-xs text-[var(--ink-45)]">Searching profiles, checking evidence, and preparing outreach. This can take about a minute.</p>}
        </section>

        <section className="mt-10">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--lime-deep)]">Capital pipeline</p>
              <h2 className="mt-2 font-display text-2xl font-bold">Allocator opportunities</h2>
              <p className="mt-1 max-w-2xl text-sm text-[var(--ink-45)]">Drawn from the persistent allocator graph, then matched to your selected ICP categories and re-verified before display. No outreach is automatic.</p>
            </div>
            <button type="button" disabled={isPending || !allocatorPipelineEnabled} onClick={refreshAllocators} className="rounded-lg border border-[var(--ink)] px-4 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50">{!allocatorPipelineEnabled ? "Allocator pipeline disabled" : isPending && !busyId ? "Verifying sources…" : "Get this week's allocator leads"}</button>
          </div>
          {visibleAllocators.length === 0 ? (
            <div className="mt-5 rounded-xl border border-dashed border-[var(--border)] bg-white px-6 py-10 text-center">
              <p className="font-display text-lg font-bold">No verified allocator leads yet.</p>
              <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[var(--ink-45)]">{allocatorPipelineEnabled ? "Select one or more allocator categories above. The scheduled ingestion job maintains the candidate universe; this button performs the final match and source verification." : "Enable ALLOCATOR_PIPELINE_ENABLED after configuring at least one licensed or public-source feed. Existing opportunities remain unchanged while disabled."}</p>
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              {visibleAllocators.map((prospect) => (
                <ProspectCard key={prospect.id} prospect={prospect} draft={drafts[prospect.id] || { subject: prospect.outreachSubject, message: prospect.outreachMessage }} busy={busyId === prospect.id} emailDeliveryConfigured={emailDeliveryConfigured} replyTo={workspace.ownerEmail} onDraft={(draft) => setDrafts((current) => ({ ...current, [prospect.id]: draft }))} onApprove={() => actOnProspect(prospect.id, "approve")} onPass={() => actOnProspect(prospect.id, "pass")} />
              ))}
            </div>
          )}
        </section>

        {(notice || error) && (
          <div className={`mt-5 rounded-lg border px-4 py-3 text-sm ${error ? "border-[var(--danger-border)] bg-[var(--danger-tint)] text-[var(--danger)]" : "border-[var(--lime-border)] bg-[var(--lime-wash)]"}`}>
            {error || notice}
          </div>
        )}

        <section className="mt-10">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--ink-45)]">02 · Qualified leads</p>
              <h2 className="mt-2 font-display text-2xl font-bold">People Index recommends</h2>
            </div>
            {visibleProspects.length > 0 && <p className="text-sm text-[var(--ink-45)]">{visibleProspects.length} leads · {strongCount} strong fits</p>}
          </div>

          {visibleProspects.length === 0 ? (
            <div className="mt-5 rounded-xl border border-dashed border-[var(--border)] bg-white px-6 py-14 text-center">
              <p className="font-display text-xl font-bold">Your lead list starts here.</p>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--ink-45)]">Confirm the ICP above. Index will return fewer people when the evidence is weak rather than filling the list with guesses.</p>
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              {visibleProspects.map((prospect) => (
                <ProspectCard
                  key={prospect.id}
                  prospect={prospect}
                  draft={drafts[prospect.id] || { subject: prospect.outreachSubject, message: prospect.outreachMessage }}
                  busy={busyId === prospect.id}
                  emailDeliveryConfigured={emailDeliveryConfigured}
                  replyTo={workspace.ownerEmail}
                  onDraft={(draft) => setDrafts((current) => ({ ...current, [prospect.id]: draft }))}
                  onApprove={() => actOnProspect(prospect.id, "approve")}
                  onPass={() => actOnProspect(prospect.id, "pass")}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
