import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Gate } from "@/components/app-shell";
import { Panel } from "@/components/ui/field";
import { listTransactions } from "@/lib/fns";
import { assetLabel, errText, formatAmount, formatWhen, kindLabel } from "@/lib/money";
import type { LedgerEntry } from "@/lib/types";

export const Route = createFileRoute("/app/activity")({ component: Page });

function Page() {
  return (
    <Gate>
      <Body />
    </Gate>
  );
}

function Body() {
  const [rows, setRows] = useState<LedgerEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    void listTransactions()
      .then(setRows)
      .catch((err: unknown) => setError(errText(err)));
  }, []);
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-semibold">Ledger</h1>
      {error ? <p className="text-sm text-sell">{error}</p> : null}
      <Panel className="divide-y divide-line px-4">
        {rows == null ? <div className="h-24 animate-pulse" /> : null}
        {rows?.length === 0 ? <p className="py-8 text-sm text-muted">The ledger is empty.</p> : null}
        {rows?.map((row) => (
          <Link key={row.id} to="/app/receipt/$id" params={{ id: row.id }} className="flex items-center justify-between gap-3 py-4">
            <div>
              <p className="font-medium">{kindLabel(row.kind)}</p>
              <p className="text-xs text-muted">
                {row.status} · {formatWhen(row.createdAt)}
              </p>
            </div>
            <p className={`text-sm tabular-nums ${row.direction === "credit" ? "text-buy" : "text-sell"}`}>
              {row.direction === "credit" ? "+" : "−"}
              {formatAmount(row.amount, row.asset)} {assetLabel(row.asset)}
            </p>
          </Link>
        ))}
      </Panel>
    </div>
  );
}
