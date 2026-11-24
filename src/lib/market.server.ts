import type { Candle, Mark, Quote } from "@/lib/types";

type Cache<T> = { at: number; value: T };

const WATCH: { id: string; symbol: string; name: string }[] = [
  { id: "bitcoin", symbol: "BTC", name: "Bitcoin" },
  { id: "ethereum", symbol: "ETH", name: "Ethereum" },
  { id: "solana", symbol: "SOL", name: "Solana" },
  { id: "ripple", symbol: "XRP", name: "XRP" },
  { id: "binancecoin", symbol: "BNB", name: "BNB" },
  { id: "dogecoin", symbol: "DOGE", name: "Dogecoin" },
];

let markCache: Cache<Mark> | null = null;
let quoteCache: Cache<Quote[]> | null = null;
const candleCache = new Map<string, Cache<Candle[]>>();

const REF_BTC = 97240;

function finite(n: number, min: number, max: number): boolean {
  return Number.isFinite(n) && n > min && n < max;
}

export async function readMark(): Promise<Mark> {
  const now = new Date().toISOString();
  if (markCache && Date.now() - markCache.at < 12_000) return markCache.value;
  try {
    const ids = "bitcoin";
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`,
      { signal: AbortSignal.timeout(5000), headers: { accept: "application/json" } },
    );
    if (res.ok) {
      const body = (await res.json()) as { bitcoin?: { usd?: number; usd_24h_change?: number } };
      const px = Number(body.bitcoin?.usd);
      const changePct = Number(body.bitcoin?.usd_24h_change);
      if (finite(px, 1000, 10_000_000)) {
        const mark: Mark = {
          btcUsd: px,
          changePct: Number.isFinite(changePct) ? changePct : 0,
          source: "live",
          asOf: now,
        };
        markCache = { at: Date.now(), value: mark };
        return mark;
      }
    }
  } catch {
    /* next feed */
  }
  try {
    const res = await fetch("https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT", {
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) {
      const body = (await res.json()) as { lastPrice?: string; priceChangePercent?: string };
      const px = Number(body.lastPrice);
      const changePct = Number(body.priceChangePercent);
      if (finite(px, 1000, 10_000_000)) {
        const mark: Mark = {
          btcUsd: px,
          changePct: Number.isFinite(changePct) ? changePct : 0,
          source: "live",
          asOf: now,
        };
        markCache = { at: Date.now(), value: mark };
        return mark;
      }
    }
  } catch {
    /* reference */
  }
  if (markCache) return markCache.value;
  const mark: Mark = { btcUsd: REF_BTC, changePct: 0.42, source: "reference", asOf: now };
  return mark;
}

export async function readQuotes(): Promise<Quote[]> {
  if (quoteCache && Date.now() - quoteCache.at < 15_000) return quoteCache.value;
  try {
    const ids = WATCH.map((w) => w.id).join(",");
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`,
      { signal: AbortSignal.timeout(6000), headers: { accept: "application/json" } },
    );
    if (res.ok) {
      const body = (await res.json()) as Record<string, { usd?: number; usd_24h_change?: number }>;
      const quotes: Quote[] = WATCH.map((w) => {
        const row = body[w.id];
        return {
          id: w.id,
          symbol: w.symbol,
          name: w.name,
          usd: Number(row?.usd) || 0,
          changePct: Number(row?.usd_24h_change) || 0,
        };
      }).filter((q) => q.usd > 0);
      if (quotes.length >= 3) {
        quoteCache = { at: Date.now(), value: quotes };
        return quotes;
      }
    }
  } catch {
    /* fallback */
  }
  if (quoteCache) return quoteCache.value;
  const mark = await readMark();
  const seed: Quote[] = [
    { id: "bitcoin", symbol: "BTC", name: "Bitcoin", usd: mark.btcUsd, changePct: mark.changePct },
    { id: "ethereum", symbol: "ETH", name: "Ethereum", usd: mark.btcUsd / 28.4, changePct: mark.changePct * 0.8 },
    { id: "solana", symbol: "SOL", name: "Solana", usd: mark.btcUsd / 540, changePct: mark.changePct * 1.1 },
    { id: "ripple", symbol: "XRP", name: "XRP", usd: 0.62, changePct: -0.4 },
    { id: "binancecoin", symbol: "BNB", name: "BNB", usd: 610, changePct: 0.3 },
    { id: "dogecoin", symbol: "DOGE", name: "Dogecoin", usd: 0.18, changePct: 1.2 },
  ];
  return seed;
}

function mapOhlc(rows: number[][]): Candle[] {
  return rows
    .map((row) => ({
      time: Math.floor(Number(row[0]) / 1000),
      open: Number(row[1]),
      high: Number(row[2]),
      low: Number(row[3]),
      close: Number(row[4]),
    }))
    .filter((c) => c.time > 0 && c.open > 0 && c.high > 0 && c.low > 0 && c.close > 0);
}

export async function readCandles(asset: "BTC" | "ETH"): Promise<Candle[]> {
  const key = asset;
  const hit = candleCache.get(key);
  if (hit && Date.now() - hit.at < 20_000) return hit.value;
  const id = asset === "BTC" ? "bitcoin" : "ethereum";
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/coins/${id}/ohlc?vs_currency=usd&days=1`,
      { signal: AbortSignal.timeout(6000), headers: { accept: "application/json" } },
    );
    if (res.ok) {
      const body = (await res.json()) as number[][];
      const candles = mapOhlc(body);
      if (candles.length >= 8) {
        candleCache.set(key, { at: Date.now(), value: candles });
        return candles;
      }
    }
  } catch {
    /* binance */
  }
  try {
    const symbol = asset === "BTC" ? "BTCUSDT" : "ETHUSDT";
    const res = await fetch(
      `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=15m&limit=96`,
      { signal: AbortSignal.timeout(5000) },
    );
    if (res.ok) {
      const body = (await res.json()) as (string | number)[][];
      const candles: Candle[] = body.map((row) => ({
        time: Math.floor(Number(row[0]) / 1000),
        open: Number(row[1]),
        high: Number(row[2]),
        low: Number(row[3]),
        close: Number(row[4]),
      }));
      if (candles.length >= 8) {
        candleCache.set(key, { at: Date.now(), value: candles });
        return candles;
      }
    }
  } catch {
    /* synthetic */
  }
  if (hit) return hit.value;
  const mark = await readMark();
  const base = asset === "BTC" ? mark.btcUsd : mark.btcUsd / 28.4;
  const candles: Candle[] = [];
  const start = Math.floor(Date.now() / 1000) - 96 * 900;
  let px = base * 0.985;
  for (let i = 0; i < 96; i += 1) {
    const drift = Math.sin(i / 7) * base * 0.004 + (i / 96) * base * 0.012;
    const open = px;
    const close = base * 0.985 + drift;
    const high = Math.max(open, close) * 1.0015;
    const low = Math.min(open, close) * 0.9985;
    candles.push({ time: start + i * 900, open, high, low, close });
    px = close;
  }
  return candles;
}
