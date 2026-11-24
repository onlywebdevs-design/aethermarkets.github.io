export type Asset = "USDT" | "BTC";

const SCALE: Record<Asset, number> = { USDT: 6, BTC: 8 };

export function assetLabel(asset: Asset): string {
  return asset === "USDT" ? "USD₮" : "BTC";
}

export function toMinor(value: string, asset: Asset): bigint {
  const t = value.trim();
  if (!/^\d+(\.\d+)?$/.test(t)) throw new Error("Enter a valid amount.");
  const [whole, frac = ""] = t.split(".");
  const scale = SCALE[asset];
  if (frac.length > scale) throw new Error("Too many decimal places.");
  return BigInt(whole) * 10n ** BigInt(scale) + BigInt(frac.padEnd(scale, "0"));
}

export function fromMinor(minor: bigint, asset: Asset): string {
  const scale = SCALE[asset];
  const base = 10n ** BigInt(scale);
  const neg = minor < 0n;
  const v = neg ? -minor : minor;
  const whole = v / base;
  const frac = (v % base).toString().padStart(scale, "0").replace(/0+$/, "");
  const body = frac ? `${whole.toString()}.${frac}` : whole.toString();
  return neg ? `-${body}` : body;
}

export function parseAmount(input: string, asset: Asset): string {
  const minor = toMinor(input, asset);
  if (minor <= 0n) throw new Error("Amount must be greater than zero.");
  return fromMinor(minor, asset);
}

export function formatAmount(value: string, asset: Asset): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  if (asset === "USDT") {
    return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return n.toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 8 });
}

export function bookUsd(
  wallets: { asset: Asset; available: string; held: string; allocated: string }[],
  btcUsd: number,
  extra = 0,
): number {
  let n = extra;
  for (const wallet of wallets) {
    const total = Number(wallet.available) + Number(wallet.held) + Number(wallet.allocated);
    n += wallet.asset === "BTC" ? total * btcUsd : total;
  }
  return n;
}

export function formatUsd(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return value.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return (
    new Intl.DateTimeFormat("en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "UTC",
    }).format(d) + " UTC"
  );
}

export function kindLabel(kind: string): string {
  switch (kind) {
    case "deposit":
      return "Inbound deposit";
    case "transfer_out":
      return "Internal transfer out";
    case "transfer_in":
      return "Internal transfer in";
    case "withdrawal":
      return "Outbound withdrawal";
    case "ledger_credit":
      return "Ledger credit";
    case "ledger_debit":
      return "Ledger debit";
    case "allocation":
      return "Mandate allocation";
    case "realization":
      return "Session close";
    case "ai_fill":
      return "AI fill";
    case "spot":
      return "Spot trade";
    default:
      return "Ledger entry";
  }
}

export function errText(error: unknown): string {
  if (error && typeof error === "object") {
    const rec = error as { message?: unknown };
    if (typeof rec.message === "string" && rec.message.trim()) return rec.message;
  }
  if (typeof error === "string" && error.trim()) return error;
  return "The desk could not complete that request.";
}
