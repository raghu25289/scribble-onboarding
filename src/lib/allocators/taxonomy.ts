export interface CryptoClassification {
  sectors: string[];
  stages: string[];
  chains: string[];
  vehicles: ("token" | "equity" | "liquid" | "private" | "public_markets")[];
}

const SECTORS: Array<[string, RegExp]> = [
  ["l1-l2-interoperability", /\b(layer ?1|layer ?2|l1|l2|rollup|interoperab|cross[- ]chain|appchain|modular blockchain)\b/i],
  ["defi", /\b(defi|decentralized finance|dex|lending protocol|staking|yield|derivatives protocol)\b/i],
  ["stablecoins", /\b(stablecoin|stable coin|usdc|usdt|digital dollar)\b/i],
  ["payments", /\b(payment|remittance|settlement|merchant|checkout|card issuing|payment rails)\b/i],
  ["exchanges", /\b(exchange|trading venue|order book|brokerage)\b/i],
  ["custody-wallets", /\b(custod|wallet|key management|mpc|account abstraction)\b/i],
  ["institutional-infrastructure", /\b(institutional|prime broker|capital markets|fund administration|compliance infrastructure)\b/i],
  ["developer-tooling", /\b(developer tool|sdk|api|rpc|node infrastructure|smart contract platform|devtool)\b/i],
  ["data-analytics", /\b(data|analytics|indexing|oracle|market intelligence|block explorer)\b/i],
  ["security", /\b(security|audit|formal verification|risk monitoring|fraud|forensics)\b/i],
  ["privacy", /\b(privacy|zero[- ]knowledge|zkp|confidential|encryption)\b/i],
  ["rwa-tokenization", /\b(real[- ]world asset|rwa|tokeniz|onchain credit|private credit)\b/i],
  ["gaming", /\b(gaming|gamefi|game studio|in[- ]game)\b/i],
  ["nft-consumer", /\b(nft|collectible|creator|socialfi|consumer crypto)\b/i],
  ["depin", /\b(depin|decentralized physical infrastructure|wireless network|compute network|storage network)\b/i],
  ["ai-crypto", /\b(ai agents?|artificial intelligence|machine learning|decentralized ai|compute marketplace)\b/i],
  ["identity", /\b(identity|credentials?|proof of personhood|kyc|reputation)\b/i],
  ["governance-dao", /\b(governance|dao|treasury management|voting|coordination tool)\b/i],
  ["market-making-liquidity", /\b(market mak(?:er|ing)|liquidity provid|liquidity infrastructure)\b/i],
];

const STAGES: Array<[string, RegExp]> = [
  ["pre-seed-seed", /\b(pre[- ]seed|seed|earliest stage)\b/i],
  ["early-stage", /\b(early[- ]stage|series a|series b)\b/i],
  ["growth", /\b(growth|series c|late[- ]stage)\b/i],
  ["public-liquid", /\b(public markets?|listed|liquid tokens?|secondary market|trading)\b/i],
];

export function classifyCryptoText(text: string): CryptoClassification {
  const sectors = SECTORS.filter(([, pattern]) => pattern.test(text)).map(([sector]) => sector);
  const stages = STAGES.filter(([, pattern]) => pattern.test(text)).map(([stage]) => stage);
  const chains = [...new Set((text.match(/\b(Ethereum|Solana|Bitcoin|Avalanche|Arbitrum|Base|Polygon|Cosmos|Polkadot|Near|Sui|Aptos|BNB Chain|Optimism)\b/gi) || []).map((item) => item.toLowerCase()))];
  const vehicles: CryptoClassification["vehicles"] = [];
  if (/\b(token|digital asset|crypto asset)\b/i.test(text)) vehicles.push("token");
  if (/\b(equity|venture|private compan)/i.test(text)) vehicles.push("equity", "private");
  if (/\b(liquid|trading|market mak|hedge fund|public market)/i.test(text)) vehicles.push("liquid");
  if (/\b(public market|listed securit|13f)\b/i.test(text)) vehicles.push("public_markets");
  return {
    sectors: sectors.length ? [...new Set(sectors)] : ["emerging-other"],
    stages: [...new Set(stages)],
    chains,
    vehicles: [...new Set(vehicles)],
  };
}
