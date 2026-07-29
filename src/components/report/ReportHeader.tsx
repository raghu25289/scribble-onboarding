export default function ReportHeader({ token }: { token: string }) {
  return (
    <header className="rp-header rp-no-print">
      <span className="rp-header-wordmark">
        <span className="rp-dot" />
        Scribble
      </span>
      <a href={`/report/${token}/download`} className="rp-download-btn" download>
        Download report
      </a>
    </header>
  );
}
