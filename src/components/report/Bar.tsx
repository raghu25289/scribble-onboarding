import BarStatic, { type BarProps } from "./BarStatic";
import BarAnimated from "./BarAnimated";

// Plain dispatcher, no "use client" of its own — see Num.tsx for why this
// split (not one conditional component in one file) matters for the
// download route: a "use client" file taints every export in it, even a
// hookless one, making it uncallable from server-rendered code.
export default function Bar({ isStatic, ...props }: BarProps & { isStatic: boolean }) {
  return isStatic ? <BarStatic {...props} /> : <BarAnimated {...props} />;
}
