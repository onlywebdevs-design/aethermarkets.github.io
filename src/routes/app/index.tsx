import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { equityOf, Gate, usePortal } from "@/components/app-shell";
import { Sparkline } from "@/components/sparkline";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/field";
import { assetLabel, formatAmount, formatUsd, kindLabel } from "@/lib/money";

export const Route = createFileRoute("/app/")({ component: HomePage });

function HomePage() {
  return (
    <Gate>
      <HomeBody />
    </Gate>
  );
}

function HomeBody() {
  const { home } = usePortal();
  if (!home) return null;
  const equity = equityOf(home);
  const up = home.mark.changePct >= 0;
  const first = home.profile.fullName.split(" ")[0];
  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs tracking-[0.22em] text-muted uppercase">{home.profile.accountNumber}</p>
        <h1 className="mt-1 text-3xl font-semibold">Good session, {first}.</h1>
      </div>
      <div className="gold-box rounded-3xl p-6 shadow-[0_24px_70px_rgba(245,158,11,0.18)]">
        <p className="text-xs font-semibold tracking-[0.18em] uppercase opacity-70">Total balance</p>
        <p className="mt-2 font-display text-5xl font-semibold tabular-nums">{formatUsd(equity)}</p>
        <p className="mt-2 text-sm font-semibold tabular-nums">
          BTC {up ? "+" : ""}
          {home.mark.changePct.toFixed(2)}% today
          {home.mark.source === "live" ? " · live" : ""}
        </p>
      </div>
      {home.tradingUnlocked ? (
        <Panel className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs tracking-[0.18em] text-gold uppercase">Cleared</p>
            <h2 className="mt-1 text-2xl font-semibold">Launch AI Trading Session</h2>
            <p className="mt-1 max-w-md text-sm text-muted">
              Your ledger is live. The desk engine fills against the bitcoin mark and posts P&L as it prints.
            </p>
          </div>
          <Button asChild>
            <Link to="/app/ai">Launch AI Trading Session</Link>
          </Button>
        </Panel>
      ) : (
        <Panel className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs tracking-[0.18em] text-purple-2 uppercase">Next</p>
            <h2 className="mt-1 text-2xl font-semibold">Fund the desk</h2>
            <p className="mt-1 max-w-md text-sm text-muted">
              Send USD₮ or BTC, then confirm. Available balance updates when operations posts the item. Minimum 50 USD.
            </p>
          </div>
          <Button asChild>
            <Link to="/app/wallets">Deposit</Link>
          </Button>
        </Panel>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {home.wallets.map((wallet) => {
          const total = Number(wallet.available) + Number(wallet.held) + Number(wallet.allocated);
          const usd = wallet.asset === "BTC" ? total * home.mark.btcUsd : total;
          return (
            <Panel key={wallet.asset} className="flex items-center justify-between p-4">
              <div>
                <p className="text-xs tracking-widest text-muted uppercase">{assetLabel(wallet.asset)}</p>
                <p className="mt-1 text-xl font-semibold tabular-nums">{formatAmount(String(total), wallet.asset)}</p>
                <p className="text-sm text-muted tabular-nums">{formatUsd(usd)}</p>
              </div>
              <Sparkline seed={wallet.asset === "BTC" ? home.mark.btcUsd : Math.max(usd, 1)} up={up} />
            </Panel>
          );
        })}
      </div>
      <Panel className="p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent</h2>
          <Link to="/app/activity" className="inline-flex items-center gap-1 text-sm text-gold">
            Ledger <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
        {home.recent.length === 0 ? (
          <p className="py-6 text-sm text-muted">No movements yet. Your first deposit will appear here as pending.</p>
        ) : (
          <ul className="divide-y divide-line">
            {home.recent.map((entry) => (
              <li key={entry.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                <div>
                  <p className="font-medium">{kindLabel(entry.kind)}</p>
                  <p className="text-xs text-muted">{entry.status}</p>
                </div>
                <p className={entry.direction === "credit" ? "text-buy tabular-nums" : "text-sell tabular-nums"}>
                  {entry.direction === "credit" ? "+" : "−"}
                  {formatAmount(entry.amount, entry.asset)} {assetLabel(entry.asset)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
