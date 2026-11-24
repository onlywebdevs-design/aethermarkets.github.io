import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getDeskOverview } from "@/lib/fns";
import { formatAmount, formatUsd } from "@/lib/money";
import type { DeskOverview } from "@/lib/types";

export const Route = createFileRoute("/desk/")({ component: DeskHome });

function DeskHome() {
  const [data, setData] = useState<DeskOverview | null>(null);
  useEffect(() => {
    void getDeskOverview().then(setData).catch(() => setData(null));
  }, []);
  if (!data) return <div className="h-40 animate-pulse rounded-3xl bg-surface" />;
  const cards = [
    ["Clients", String(data.clients)],
    ["Restricted", String(data.restricted)],
    ["Frozen", String(data.frozen)],
    ["Pending deposits", String(data.pendingDeposits)],
    ["Pending transfers", String(data.pendingTransfers)],
    ["Pending withdrawals", String(data.pendingWithdrawals)],
    ["Pending notional", formatUsd(data.pendingUsd)],
    ["USD₮ book", formatAmount(data.usdtBook, "USDT")],
    ["BTC book", formatAmount(data.btcBook, "BTC")],
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map(([label, value]) => (
        <article key={label} className="glass rounded-3xl p-5">
          <p className="text-xs tracking-widest text-muted uppercase">{label}</p>
          <p className="mt-2 font-display text-3xl font-semibold tabular-nums">{value}</p>
        </article>
      ))}
    </div>
  );
}
