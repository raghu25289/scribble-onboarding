import CountUpValue from "./CountUpValue";
import { formatNum, type NumFormat } from "@/lib/numFormat";

interface Props {
  isStatic: boolean;
  value: number;
  format: NumFormat;
  durationMs?: number;
}

// Plain dispatcher, no "use client" of its own — the static (download)
// export renders the formatted number as text (no hooks ever fire during
// static server rendering); the live page renders the animated version.
// Deliberately in its own file, separate from CountUpValue: that file is
// "use client", and putting this dispatcher there too would taint it the
// same way, making it uncallable from the server-rendered download route.
export default function Num({ isStatic, value, format, durationMs }: Props) {
  return isStatic ? <>{formatNum(value, format)}</> : <CountUpValue value={value} format={format} durationMs={durationMs} />;
}
