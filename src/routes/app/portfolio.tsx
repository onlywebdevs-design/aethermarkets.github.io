import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { equityOf, Gate, usePortal } from "@/components/app-shell";
import { Sparkline } from "@/components/sparkline";
import { Panel } from "@/components/ui/field";
import { listAllocations } from "@/lib/fns";
import { assetLabel, errText, formatAmount, formatUsd, formatWhen } from "@/lib/money";
import type { AllocationView } from "@/lib/types";

export const Route = createFileRoute("/app/portfolio")({ component: Page });

function Page() {
  return (
    <Gate>
      <Body />
    </Gate>
  );
}

function curve(seed: number) {
  return Array.from({ length: 32 }, (_, i) => ({
    i,
    v: seed * (0.9 + i / 80) + Math.sin(i / 3) * seed * 0.03,
  }));
}

function Body() {
  const { home } = usePortal();
  const [rows, setRows] = useState<AllocationView[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    void listAllocations()
      .then(setRows)
      .catch((err: unknown) => setError(errText(err)));
  }, []);
  if (!home) return null;
  const equity = equityOf(home);
  const up = home.mark.changePct >= 0;
  const open = rows.filter((row) => row.status === "open");
  return (
    <div className="space-y-5">
      <div className="gold-box rounded-3xl p-6">
        <p className="text-xs font-semibold tracking-[0.18em] uppercase opacity-70">Portfolio</p>
        <p className="mt-2 font-display text-5xl font-semibold tabular-nums">{formatUsd(equity)}</p>
        <p className="mt-2 text-sm font-semibold tabular-nums">
          {up ? "+" : ""}
          {home.mark.changePct.toFixed(2)}% bitcoin today
        </p>
      </div>
      <Panel className="p-4">
        <div className="mb-2 flex items-end justify-between">
          <h2 className="text-lg font-semibold">Equity</h2>
          <p className="text-xs text-muted">Open session P&L {formatUsd(Number(home.openPnl) || 0)}</p>
        </div>
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={curve(Math.max(equity, 1))}>
              <XAxis dataKey="i" hide />
              <Tooltip
                contentStyle={{ background: "#14111c", border: "1px solid #2c2640", borderRadius: 12 }}
                formatter={(value) => formatUsd(Number(value))}
              />
              <Area type="monotone" dataKey="v" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.2} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Panel>
      <div className="space-y-3">
        {home.wallets.map((wallet) => {
          const total = Number(wallet.available) + Number(wallet.held) + Number(wallet.allocated);
          return (
            <Panel key={wallet.asset} className="flex items-center justify-between p-4">
              <div>
                <p className="font-semibold">{assetLabel(wallet.asset)}</p>
                <p className="text-sm text-muted">
                  Available {formatAmount(wallet.available, wallet.asset)} · Held {formatAmount(wallet.held, wallet.asset)}
                </p>
                <p className="mt-1 text-lg tabular-nums">{formatAmount(String(total), wallet.asset)}</p>
              </div>
              <Sparkline seed={wallet.asset === "BTC" ? home.mark.btcUsd : Math.max(total, 1)} up={up} />
            </Panel>
          );
        })}
      </div>
      <Panel className="p-4">
        <h2 className="text-lg font-semibold">Sessions</h2>
        {error ? <p className="mt-2 text-sm text-sell">{error}</p> : null}
        {open.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No open AI session. Cleared accounts launch one from the AI desk.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {open.map((row) => (
              <li key={row.id} className="flex items-center justify-between py-3 text-sm">
                <div>
                  <p className="font-medium">{row.strategyName}</p>
                  <p className="text-xs text-muted">{formatWhen(row.openedAt)}</p>
                </div>
                <div className="text-right tabular-nums">
                  <p>{formatAmount(row.principal, "USDT")} USD₮</p>
                  <p className={Number(row.realized) >= 0 ? "text-buy" : "text-sell"}>
                    {Number(row.realized) >= 0 ? "+" : ""}
                    {formatAmount(row.realized, "USDT")}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
