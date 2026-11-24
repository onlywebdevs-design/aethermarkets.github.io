import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Gate, usePortal } from "@/components/app-shell";
import { CandleChart } from "@/components/candle-chart";
import { OrderBook } from "@/components/depth-book";
import { Button } from "@/components/ui/button";
import { Field, Input, Panel } from "@/components/ui/field";
import { closeAllocation, getCandles, listAllocations, listTransactions, pulseAi, startAiSession } from "@/lib/fns";
import { errText, formatAmount, formatUsd } from "@/lib/money";
import type { AllocationView, Candle, LedgerEntry } from "@/lib/types";

export const Route = createFileRoute("/app/ai")({ component: Page });

function Page() {
  return (
    <Gate>
      <Body />
    </Gate>
  );
}

function Body() {
  const { home, reload } = usePortal();
  const [candles, setCandles] = useState<Candle[]>([]);
  const [risk, setRisk] = useState<"low" | "medium" | "high">("medium");
  const [amount, setAmount] = useState("250");
  const [stop, setStop] = useState("40");
  const [take, setTake] = useState("80");
  const [rows, setRows] = useState<AllocationView[]>([]);
  const [fills, setFills] = useState<LedgerEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState<string | null>(null);

  const open = rows.find((row) => row.status === "open") ?? null;

  useEffect(() => {
    void getCandles({ data: "BTC" }).then(setCandles).catch(() => setCandles([]));
  }, [home?.mark.asOf]);

  useEffect(() => {
    void listAllocations().then(setRows).catch(() => setRows([]));
    void listTransactions()
      .then((all) => setFills(all.filter((row) => row.kind === "ai_fill").slice(0, 12)))
      .catch(() => setFills([]));
  }, [home?.mark.asOf, live]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setInterval(() => {
      void pulseAi({ data: open.id })
        .then((fill) => {
          setLive(`${fill.side === "buy" ? "Buy" : "Sell"} ${fill.delta} · ${formatUsd(fill.price)}`);
          const realized = Number(fill.realized);
          const sl = Number(stop);
          const tp = Number(take);
          if ((Number.isFinite(sl) && realized <= -Math.abs(sl)) || (Number.isFinite(tp) && realized >= Math.abs(tp))) {
            void closeAllocation({ data: open.id }).then(() => {
              toast.message("Session closed on your risk line.");
              reload();
            });
          } else {
            reload();
          }
        })
        .catch((error: unknown) => setLive(errText(error)));
    }, 5000);
    return () => window.clearInterval(timer);
  }, [open?.id, stop, take, reload]);

  if (!home) return null;

  if (!home.tradingUnlocked) {
    return (
      <Panel className="p-6">
        <p className="text-xs tracking-[0.2em] text-gold uppercase">Locked</p>
        <h1 className="mt-2 text-3xl font-semibold">Launch AI Trading Session</h1>
        <p className="mt-2 max-w-md text-sm text-muted">
          The session appears after operations posts your first deposit. Nothing on this screen trades before that.
        </p>
        <Button asChild className="mt-5">
          <Link to="/app/wallets">Deposit to unlock</Link>
        </Button>
      </Panel>
    );
  }

  async function launch() {
    setBusy(true);
    try {
      await startAiSession({ data: { risk, amount } });
      toast.success("Session is live.");
      reload();
    } catch (error) {
      toast.error(errText(error));
    } finally {
      setBusy(false);
    }
  }

  async function closeNow() {
    if (!open) return;
    setBusy(true);
    try {
      await closeAllocation({ data: open.id });
      toast.success("Session closed. Result returned to available balance.");
      setLive(null);
      reload();
    } catch (error) {
      toast.error(errText(error));
    } finally {
      setBusy(false);
    }
  }

  const realized = open ? Number(open.realized) : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs tracking-[0.2em] text-gold uppercase">AI desk</p>
          <h1 className="text-3xl font-semibold">Launch AI Trading Session</h1>
        </div>
        <p className={`font-display text-2xl font-semibold tabular-nums ${realized >= 0 ? "text-buy" : "text-sell"}`}>
          {realized >= 0 ? "+" : ""}
          {formatUsd(realized)}
        </p>
      </div>
      <Panel className="p-3">
        <CandleChart candles={candles} />
      </Panel>
      {open ? (
        <Panel className="space-y-4 p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted">{open.strategyName}</span>
            <span className="text-gold">{live ?? "Watching the mark"}</span>
          </div>
          <p className="text-sm text-muted">
            Principal {formatAmount(open.principal, "USDT")} USD₮ · exposure {Number(open.exposure).toFixed(2)} · wallet updates as fills print.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Stop loss USD">
              <Input value={stop} onChange={(e) => setStop(e.target.value)} />
            </Field>
            <Field label="Take profit USD">
              <Input value={take} onChange={(e) => setTake(e.target.value)} />
            </Field>
          </div>
          <Button variant="sell" disabled={busy} onClick={() => void closeNow()} className="w-full">
            Close session
          </Button>
        </Panel>
      ) : (
        <Panel className="space-y-4 p-4">
          <Field label="Risk">
            <div className="grid grid-cols-3 gap-2">
              {(["low", "medium", "high"] as const).map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setRisk(level)}
                  className={`rounded-2xl py-3 text-sm font-semibold capitalize ${risk === level ? "bg-purple text-fg" : "bg-surface-2 text-muted"}`}
                >
                  {level}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Allocation USD₮">
            <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Stop loss USD">
              <Input value={stop} onChange={(e) => setStop(e.target.value)} />
            </Field>
            <Field label="Take profit USD">
              <Input value={take} onChange={(e) => setTake(e.target.value)} />
            </Field>
          </div>
          <Button disabled={busy} onClick={() => void launch()} className="w-full">
            {busy ? "Opening" : "Launch AI Trading Session"}
          </Button>
          <p className="text-xs text-muted">
            Fills are model executions against the live bitcoin mark and post straight to your ledger. Minimum 100 USD₮.
          </p>
        </Panel>
      )}
      <div className="grid gap-3 lg:grid-cols-2">
        <Panel className="p-4">
          <h2 className="mb-2 text-lg font-semibold">Order book</h2>
          <OrderBook price={home.mark.btcUsd} />
        </Panel>
        <Panel className="p-4">
          <h2 className="text-lg font-semibold">Trade history</h2>
          <ul className="mt-2 divide-y divide-line text-sm">
            {fills.length === 0 ? (
              <li className="py-4 text-muted">The bot writes each fill here.</li>
            ) : (
              fills.map((row) => (
                <li key={row.id} className="flex justify-between py-3">
                  <span>{row.counterparty}</span>
                  <span className={row.direction === "credit" ? "text-buy tabular-nums" : "text-sell tabular-nums"}>
                    {row.direction === "credit" ? "+" : "−"}
                    {formatAmount(row.amount, "USDT")}
                  </span>
                </li>
              ))
            )}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
