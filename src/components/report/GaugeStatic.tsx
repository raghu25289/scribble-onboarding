export interface GaugeProps {
  pct: number;
  color: string;
  caption: string;
}

const SIZE = 140;
const STROKE = 8;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// Plain, hookless markup at the final value — used directly by the
// standalone HTML download, and as the inner shape GaugeAnimated fills in
// progressively on the live page.
export default function GaugeStatic({ pct, color, caption }: GaugeProps) {
  const isZero = pct === 0;
  const filled = isZero ? CIRCUMFERENCE : (pct / 100) * CIRCUMFERENCE;

  return (
    <div className="rp-gauge-col">
      <div style={{ position: "relative", width: SIZE, height: SIZE }}>
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width={SIZE} height={SIZE} style={{ transform: "rotate(-90deg)" }}>
          <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" stroke="var(--border)" strokeWidth={STROKE} />
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke={color}
            strokeWidth={STROKE}
            strokeLinecap={pct > 0 ? "round" : "butt"}
            strokeDasharray={`${filled} ${CIRCUMFERENCE}`}
          />
        </svg>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 800,
            fontSize: "2rem",
            letterSpacing: "-0.01em",
            color,
          }}
        >
          {pct}%
        </div>
      </div>
      <p className="rp-gauge-caption">{caption}</p>
    </div>
  );
}

export { SIZE, STROKE, RADIUS, CIRCUMFERENCE };
