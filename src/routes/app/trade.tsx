import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CandleChart } from "@/components/candle-chart";
import { DepthChart, OrderBook } from "@/components/depth-book";
import { Gate, usePortal } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Field, Input, Panel } from "@/components/ui/field";
import { executeTrade, getCandles, listTransactions } from "@/lib/fns";
import { assetLabel, errText, formatAmount, formatUsd } from "@/lib/money";
import type { Candle, LedgerEntry } from "@/lib/types";

export const Route = createFileRoute("/app/trade")({ component: Page });

function Page() {
  return (
    <Gate>
      <Body />
    </Gate>
  );
}

function Body() {
  const { home, reload } = usePortal();
  const [asset, setAsset] = useState<"BTC" | "ETH">("BTC");
  const [candles, setCandles] = useState<Candle[]>([]);
  const [view, setView] = useState<"chart" | "depth" | "book">("chart");
  const [notional, setNotional] = useState("100");
  const [busy, setBusy] = useState(false);
  const [fills, setFills] = useState<LedgerEntry[]>([]);

  useEffect(() => {
    void getCandles({ data: asset }).then(setCandles).catch(() => setCandles([]));
  }, [asset, home?.mark.asOf]);

  useEffect(() => {
    void listTransactions()
      .then((rows) => setFills(rows.filter((row) => row.kind === "spot" || row.kind === "ai_fill").slice(0, 8)))
      .catch(() => setFills([]));
  }, [home?.mark.asOf]);

  if (!home) return null;
  const price = asset === "BTC" ? home.mark.btcUsd : home.mark.btcUsd / 28.4;
  const up = home.mark.changePct >= 0;

  async function fill(side: "buy" | "sell") {
    setBusy(true);
    try {
      const result = await executeTrade({ data: { side, notional } });
      toast.success(result.message);
      reload();
    } catch (error) {
      toast.error(errText(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Panel className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs tracking-[0.18em] text-muted uppercase">{asset} / USDT</p>
            <p className="font-display text-3xl font-semibold tabular-nums">{formatUsd(price)}</p>
            <p className={`text-sm font-medium tabular-nums ${up ? "text-buy" : "text-sell"}`}>
              {up ? "+" : ""}
              {home.mark.changePct.toFixed(2)}%
            </p>
          </div>
          <div className="flex rounded-full bg-surface-2 p-1">
            {(["BTC", "ETH"] as const).map((pair) => (
              <button
                key={pair}
                type="button"
                onClick={() => setAsset(pair)}
                className={`rounded-full px-3 py-2 text-xs font-semibold ${asset === pair ? "bg-purple text-fg" : "text-muted"}`}
              >
                {pair}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          {(
            [
              ["chart", "Chart"],
              ["depth", "Depth"],
              ["book", "Book"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setView(id)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${view === id ? "bg-surface-2 text-fg" : "text-muted"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="mt-3">
          {view === "chart" ? <CandleChart candles={candles} /> : null}
          {view === "depth" ? <DepthChart price={price} /> : null}
          {view === "book" ? <OrderBook price={price} /> : null}
        </div>
      </Panel>
      <Panel className="space-y-4 p-4">
        <Field label="Notional USD₮">
          <Input inputMode="decimal" value={notional} onChange={(e) => setNotional(e.target.value)} />
        </Field>
        {!home.tradingUnlocked ? (
          <p className="text-sm text-muted">
            Buy and sell open after operations posts your first deposit. The chart stays live while you wait.
          </p>
        ) : asset === "ETH" ? (
          <p className="text-sm text-muted">Ethereum is on the watch list. Execution is BTC / USD₮.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Button variant="sell" disabled={busy} onClick={() => void fill("sell")}>
              SELL
            </Button>
            <Button variant="buy" disabled={busy} onClick={() => void fill("buy")}>
              BUY
            </Button>
          </div>
        )}
      </Panel>
      <Panel className="p-4">
        <h2 className="text-lg font-semibold">Market watch</h2>
        <ul className="mt-2 divide-y divide-line text-sm">
          {fills.length === 0 ? (
            <li className="py-4 text-muted">Fills print here the moment the desk matches them.</li>
          ) : (
            fills.map((row) => (
              <li key={row.id} className="flex justify-between py-3">
                <span>
                  {row.counterparty || row.kind} · {assetLabel(row.asset)}
                </span>
                <span className="tabular-nums">{formatAmount(row.amount, row.asset)}</span>
              </li>
            ))
          )}
        </ul>
      </Panel>
    </div>
  );
}
