import type { Asset } from "@/lib/money";

export const MIN_DEPOSIT_USD = 50;
export const MIN_ALLOCATION_USDT = "100";

export const RAILS: Record<
  Asset,
  { asset: Asset; network: string; address: string; label: string }
> = {
  BTC: {
    asset: "BTC",
    network: "Bitcoin",
    address: "bc1q95te2dmea0hq5vcncz0k0hdxsw90r6l09ms2v4",
    label: "BTC",
  },
  USDT: {
    asset: "USDT",
    network: "Arbitrum",
    address: "0x9637A0E6527E1cAf658672CDa19640C7F2C04988",
    label: "USD₮",
  },
};

export const MANDATES = [
  {
    id: "basis",
    name: "Tradrz Basis",
    exposure: 0.12,
    min: MIN_ALLOCATION_USDT,
    horizon: "Intraday to five sessions",
    summary:
      "Carry sleeve. A modest fraction of the bitcoin mark is realized against allocated USD₮, with loss limited to principal.",
  },
  {
    id: "delta",
    name: "Reserve Delta",
    exposure: 0.45,
    min: MIN_ALLOCATION_USDT,
    horizon: "Multi-session",
    summary:
      "Directional sleeve. Allocated USD₮ takes a larger share of the bitcoin mark, still capped at the amount you commit.",
  },
  {
    id: "rail",
    name: "Cross-Rail",
    exposure: 0.22,
    min: MIN_ALLOCATION_USDT,
    horizon: "Rolling",
    summary:
      "Sensitivity between bitcoin and the dollar rail. Marks post only when the reference price actually moves.",
  },
] as const;

export type MandateId = (typeof MANDATES)[number]["id"];

export function mandateById(id: string) {
  return MANDATES.find((m) => m.id === id) ?? null;
}
