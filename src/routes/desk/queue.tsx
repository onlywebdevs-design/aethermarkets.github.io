import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getPending, reviewDeposit, reviewTransfer, reviewWithdrawal } from "@/lib/fns";
import { assetLabel, errText, formatAmount, formatWhen } from "@/lib/money";
import type { PendingDeposit, PendingTransfer, PendingWithdrawal } from "@/lib/types";

export const Route = createFileRoute("/desk/queue")({ component: Queue });

function Queue() {
  const [deposits, setDeposits] = useState<PendingDeposit[]>([]);
  const [transfers, setTransfers] = useState<PendingTransfer[]>([]);
  const [withdrawals, setWithdrawals] = useState<PendingWithdrawal[]>([]);

  const load = useCallback(() => {
    void getPending()
      .then((data) => {
        setDeposits(data.deposits);
        setTransfers(data.transfers);
        setWithdrawals(data.withdrawals);
      })
      .catch((err: unknown) => toast.error(errText(err)));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function act(run: () => Promise<unknown>) {
    try {
      await run();
      toast.success("Decision posted.");
      load();
    } catch (err) {
      toast.error(errText(err));
    }
  }

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-xl font-semibold">Deposits</h2>
        {deposits.length === 0 ? <p className="mt-2 text-sm text-muted">None pending.</p> : null}
        <ul className="mt-3 space-y-3">
          {deposits.map((row) => (
            <li key={row.id} className="glass rounded-3xl p-4">
              <p className="font-medium">
                {row.fullName} · {formatAmount(row.amount, row.asset)} {assetLabel(row.asset)}
              </p>
              <p className="text-xs text-muted">
                {row.accountNumber} · {row.reference} · {row.network} · {formatWhen(row.createdAt)}
              </p>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="buy" onClick={() => void act(() => reviewDeposit({ data: { id: row.id, decision: "approved", note: "" } }))}>
                  Post
                </Button>
                <Button size="sm" variant="sell" onClick={() => void act(() => reviewDeposit({ data: { id: row.id, decision: "rejected", note: "" } }))}>
                  Decline
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="text-xl font-semibold">Transfers</h2>
        {transfers.length === 0 ? <p className="mt-2 text-sm text-muted">None pending.</p> : null}
        <ul className="mt-3 space-y-3">
          {transfers.map((row) => (
            <li key={row.id} className="glass rounded-3xl p-4 text-sm">
              <p>
                {row.fromName} → {row.toName} · {formatAmount(row.amount, row.asset)} {assetLabel(row.asset)}
              </p>
              <p className="text-xs text-muted">{row.memo}</p>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="buy" onClick={() => void act(() => reviewTransfer({ data: { id: row.id, decision: "approved" } }))}>
                  Settle
                </Button>
                <Button size="sm" variant="ghost" onClick={() => void act(() => reviewTransfer({ data: { id: row.id, decision: "rejected" } }))}>
                  Return
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="text-xl font-semibold">Withdrawals</h2>
        {withdrawals.length === 0 ? <p className="mt-2 text-sm text-muted">None pending.</p> : null}
        <ul className="mt-3 space-y-3">
          {withdrawals.map((row) => (
            <li key={row.id} className="glass rounded-3xl p-4 text-sm">
              <p>
                {row.fullName} · {formatAmount(row.amount, row.asset)} {assetLabel(row.asset)}
              </p>
              <p className="break-all text-xs text-muted">{row.destination}</p>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="buy" onClick={() => void act(() => reviewWithdrawal({ data: { id: row.id, decision: "approved", note: "" } }))}>
                  Release
                </Button>
                <Button size="sm" variant="ghost" onClick={() => void act(() => reviewWithdrawal({ data: { id: row.id, decision: "rejected", note: "" } }))}>
                  Return
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
