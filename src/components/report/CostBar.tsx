import CostBarStatic, { type CostBarProps } from "./CostBarStatic";
import CostBarAnimated from "./CostBarAnimated";

// Plain dispatcher, no "use client" of its own — see Num.tsx for the reason
// this is split into three files rather than one.
export default function CostBar({ isStatic, ...props }: CostBarProps & { isStatic: boolean }) {
  return isStatic ? <CostBarStatic {...props} /> : <CostBarAnimated {...props} />;
}
