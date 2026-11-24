import { Link, createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { getClientFile, setClientBalance, setClientStatus } from "@/lib/fns";
import { assetLabel, errText, formatAmount, formatUsd, formatWhen, kindLabel } from "@/lib/money";
import type { Asset } from "@/lib/money";
import type { AccountStatus, ClientFile } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

export const Route = createFileRoute("/desk/clients/$userId")({ component: ClientLive });

function ClientLive() {
  const { userId } = Route.useParams();
  const [file, setFile] = useState<ClientFile | null>(null);
  const [asset, setAsset] = useState<Asset>("USDT");
  const [available, setAvailable] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    void getClientFile({ data: userId })
      .then((data) => {
        setFile(data);
        setError(null);
      })
      .catch((err: unknown) => setError(errText(err)));
  }, [userId]);

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 8000);
    return () => window.clearInterval(timer);
  }, [load]);

  if (error) return <p className="text-sm text-sell">{error}</p>;
  if (!file) return <div className="h-48 animate-pulse rounded-3xl bg-surface" />;
  const usdt = file.wallets.find((w) => w.asset === "USDT");
  const btc = file.wallets.find((w) => w.asset === "BTC");
  const usdtBook = Number(usdt?.available || 0) + Number(usdt?.held || 0) + Number(usdt?.allocated || 0);

  async function status(next: AccountStatus) {
    try {
      await setClientStatus({ data: { userId, status: next } });
      toast.success(`Status set to ${next}.`);
      load();
    } catch (err) {
      toast.error(errText(err));
    }
  }

  async function adjust() {
    try {
      await setClientBalance({ data: { account: userId, asset, available } });
      toast.success("Balance adjusted.");
      setAvailable("");
      load();
    } catch (err) {
      toast.error(errText(err));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs tracking-widest text-muted uppercase">{file.profile.accountNumber}</p>
          <h2 className="text-3xl font-semibold">{file.profile.fullName}</h2>
          <p className="text-sm text-muted">
            {file.profile.email} · {file.profile.status}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(["active", "restricted", "frozen"] as const).map((next) => (
            <Button key={next} size="sm" variant={next === "active" ? "buy" : "ghost"} onClick={() => void status(next)}>
              {next === "active" ? "Unrestrict" : next}
            </Button>
          ))}
        </div>
      </div>
      <div className="gold-box rounded-3xl p-6">
        <p className="text-xs font-semibold tracking-[0.18em] uppercase opacity-70">Live balance</p>
        <p className="mt-2 font-display text-4xl font-semibold tabular-nums">
          {formatUsd(usdtBook)}
          <span className="ml-3 text-lg">+ {formatAmount(btc?.available || "0", "BTC")} BTC</span>
        </p>
        <p className="mt-2 text-xs opacity-70">Same figures the client sees, refreshed while this page is open. USD figure is USD₮ book.</p>
      </div>
      <div className="glass grid gap-3 rounded-3xl p-4 sm:grid-cols-3">
        <Field label="Asset">
          <select
            value={asset}
            onChange={(e) => setAsset(e.target.value as Asset)}
            className="w-full rounded-2xl border border-line bg-surface-2 px-4 py-3 text-sm"
          >
            <option value="USDT">USD₮</option>
            <option value="BTC">BTC</option>
          </select>
        </Field>
        <Field label="Set available to">
          <Input value={available} onChange={(e) => setAvailable(e.target.value)} placeholder="0.00" />
        </Field>
        <div className="flex items-end">
          <Button className="w-full" onClick={() => void adjust()}>
            Adjust balance
          </Button>
        </div>
      </div>
      <div className="overflow-x-auto rounded-3xl border border-line">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="text-xs tracking-widest text-muted uppercase">
            <tr>
              <th className="px-4 py-3 font-medium">Entry</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {file.entries.map((entry) => (
              <tr key={entry.id} className="border-t border-line">
                <td className="px-4 py-3">
                  <Link to="/app/receipt/$id" params={{ id: entry.id }} className="font-medium">
                    {kindLabel(entry.kind)}
                  </Link>
                  <p className="text-xs text-muted">
                    {entry.reference} · {formatWhen(entry.createdAt)}
                  </p>
                </td>
                <td className="px-4 py-3 capitalize">{entry.status}</td>
                <td className="px-4 py-3 tabular-nums">
                  {entry.direction === "credit" ? "+" : "−"}
                  {formatAmount(entry.amount, entry.asset)} {assetLabel(entry.asset)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
