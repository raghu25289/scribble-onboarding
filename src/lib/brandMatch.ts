// Fuzzy match to tell whether a "winner" chip is actually the brand itself
// (or one of its own products) rather than a competitor — used to tint chips
// and pick the right label ("you and N others" vs "winning instead of you").

import type { BrandProduct } from "./types";

function stem(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function isBrandChip(name: string, domain: string, products: BrandProduct[]): boolean {
  const nameStem = stem(name);
  if (!nameStem) return false;

  const domainStem = stem(domain.replace(/\.[a-z]+$/i, ""));
  if (domainStem && (nameStem.includes(domainStem) || domainStem.includes(nameStem))) return true;

  return products.some((p) => {
    const productStem = stem(p.name);
    return productStem.length > 0 && (nameStem.includes(productStem) || productStem.includes(nameStem));
  });
}
