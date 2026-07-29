function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export default function ReportHeader({ domain, completedAt }: { domain: string; completedAt: string }) {
  return (
    <header
      className="report-header fixed inset-x-0 top-0 z-50 flex items-center justify-between border-b px-5 py-3 text-sm backdrop-blur sm:px-8"
      style={{ borderColor: "var(--panel-line)", background: "rgba(10,10,15,0.75)" }}
    >
      <span className="font-display font-semibold" style={{ color: "var(--accent)" }}>
        Scribble
      </span>
      <span className="truncate text-[var(--muted)]">
        AI Visibility Report · {domain} · {formatDate(completedAt)}
      </span>
    </header>
  );
}
