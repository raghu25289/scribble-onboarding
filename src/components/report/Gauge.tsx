import GaugeStatic, { type GaugeProps } from "./GaugeStatic";
import GaugeAnimated from "./GaugeAnimated";

// Plain dispatcher, no hooks of its own — picks the static (download) or
// animated (live) shape. Keeping this branch here instead of inside a single
// component with a conditional early return keeps both branches honest
// about the rules of hooks: GaugeAnimated always calls its hooks, GaugeStatic
// never does.
export default function Gauge({ isStatic, ...props }: GaugeProps & { isStatic: boolean }) {
  return isStatic ? <GaugeStatic {...props} /> : <GaugeAnimated {...props} />;
}
