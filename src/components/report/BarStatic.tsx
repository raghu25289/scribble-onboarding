export interface BarProps {
  pct: number;
  className: string;
  background?: string;
}

// Plain, hookless markup at the final width — used directly by the
// standalone HTML download.
export default function BarStatic({ pct, className, background }: BarProps) {
  return <div className={className} style={{ width: `${pct}%`, background }} />;
}
