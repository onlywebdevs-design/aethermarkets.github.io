import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Gate } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/field";
import { getReceipt } from "@/lib/fns";
import { assetLabel, errText, formatAmount, formatWhen, kindLabel } from "@/lib/money";
import { downloadPdf } from "@/lib/pdf";
import type { ReceiptView } from "@/lib/types";

export const Route = createFileRoute("/app/receipt/$id")({ component: Page });

function Page() {
  const { id } = Route.useParams();
  return (
    <Gate>
      <Body id={id} />
    </Gate>
  );
}

function Body({ id }: { id: string }) {
  const [receipt, setReceipt] = useState<ReceiptView | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    void getReceipt({ data: id })
      .then(setReceipt)
      .catch((err: unknown) => setError(errText(err)));
  }, [id]);

  if (error) return <p className="text-sm text-sell">{error}</p>;
  if (!receipt) return <div className="h-64 animate-pulse rounded-3xl bg-surface" />;
  const { entry, profile } = receipt;
  const lines = [
    "AETHER MARKETS",
    "Ledger receipt",
    "",
    `Account ${profile.accountNumber}`,
    `Name ${profile.fullName}`,
    `Email ${profile.email}`,
    "",
    `Reference ${entry.reference || entry.id}`,
    `Type ${kindLabel(entry.kind)}`,
    `Asset ${assetLabel(entry.asset)}`,
    `Direction ${entry.direction}`,
    `Amount ${formatAmount(entry.amount, entry.asset)}`,
    `Status ${entry.status}`,
    `Counterparty ${entry.counterparty || "—"}`,
    `Institution ${entry.institution || "—"}`,
    `Value date ${entry.valueDate || "—"} ${entry.valueTime || ""}`,
    `Posted ${formatWhen(entry.createdAt)}`,
    entry.settledAt ? `Settled ${formatWhen(entry.settledAt)}` : "Not settled",
    "",
    "Internal ledger copy. Not an exchange fill.",
  ];

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div className="no-print flex justify-end">
        <Button
          onClick={() => downloadPdf(`aether-${entry.reference || entry.id}.pdf`, lines)}
        >
          Download PDF
        </Button>
      </div>
      <Panel className="print-sheet space-y-3 p-6">
        <p className="text-xs tracking-[0.22em] text-gold uppercase">Aether Markets</p>
        <h1 className="text-3xl font-semibold">Receipt</h1>
        {lines.slice(3).map((line) => (
          <p key={line} className="text-sm">
            {line || " "}
          </p>
        ))}
      </Panel>
    </div>
  );
}
