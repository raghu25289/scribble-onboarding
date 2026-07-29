// A serializable stand-in for "how do I format this number" — plain data,
// not a function, so it can cross the server -> client boundary as a prop
// (Next.js forbids passing function props from a Server Component into a
// Client Component). Both the animated (live) and plain (static/download)
// number renderers call formatNum with the same value, so the two paths can
// never drift out of sync with each other.

import { formatMoney } from "./costEstimate";

export type NumFormat = { kind: "percent" | "perMo" | "money" | "leadsPerMo" | "moneyPerMo" | "plain" };

export function formatNum(n: number, format: NumFormat): string {
  switch (format.kind) {
    case "percent":
      return `${n}%`;
    case "perMo":
      return `${n.toLocaleString("en-US")}/mo`;
    case "money":
      return formatMoney(n);
    case "leadsPerMo":
      return `${n.toLocaleString("en-US")} leads/mo`;
    case "moneyPerMo":
      return `${formatMoney(n)}/mo`;
    case "plain":
      return n.toLocaleString("en-US");
  }
}
