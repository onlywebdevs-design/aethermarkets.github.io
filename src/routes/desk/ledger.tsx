import { Link, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { postLedgerEntry } from "@/lib/fns";
import { errText } from "@/lib/money";
import type { Asset } from "@/lib/money";

export const Route = createFileRoute("/desk/ledger")({ component: LedgerPost });

function LedgerPost() {
  const [account, setAccount] = useState("");
  const [asset, setAsset] = useState<Asset>("USDT");
  const [direction, setDirection] = useState<"credit" | "debit">("credit");
  const [amount, setAmount] = useState("");
  const [counterparty, setCounterparty] = useState("");
  const [institution, setInstitution] = useState("");
  const [valueDate, setValueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [valueTime, setValueTime] = useState("12:00");
  const [reference, setReference] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [posted, setPosted] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      const result = await postLedgerEntry({
        data: { account, asset, direction, amount, counterparty, institution, valueDate, valueTime, reference, internalNote },
      });
      setPosted(result.transactionId);
      toast.success("Entry is on the client ledger.");
    } catch (err) {
      toast.error(errText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h2 className="text-2xl font-semibold">Post a movement</h2>
        <p className="mt-1 text-sm text-muted">
          Credit or debit any account. The line lands in their history with your name, bank, time, amount, and reference. A PDF receipt is available immediately.
        </p>
      </div>
      <form
        className="glass space-y-4 rounded-3xl p-5"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <Field label="Account, email, or client id">
          <Input value={account} onChange={(e) => setAccount(e.target.value)} required />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
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
          <Field label="Direction">
            <select
              value={direction}
              onChange={(e) => setDirection(e.target.value as "credit" | "debit")}
              className="w-full rounded-2xl border border-line bg-surface-2 px-4 py-3 text-sm"
            >
              <option value="credit">Credit (deposit)</option>
              <option value="debit">Debit</option>
            </select>
          </Field>
        </div>
        <Field label="Amount">
          <Input value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </Field>
        <Field label="Name / counterparty">
          <Input value={counterparty} onChange={(e) => setCounterparty(e.target.value)} required />
        </Field>
        <Field label="Bank / institution">
          <Input value={institution} onChange={(e) => setInstitution(e.target.value)} required />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Date">
            <Input type="date" value={valueDate} onChange={(e) => setValueDate(e.target.value)} required />
          </Field>
          <Field label="Time">
            <Input type="time" value={valueTime} onChange={(e) => setValueTime(e.target.value)} required />
          </Field>
        </div>
        <Field label="TXN reference">
          <Input value={reference} onChange={(e) => setReference(e.target.value)} required />
        </Field>
        <Field label="Internal note">
          <Textarea value={internalNote} onChange={(e) => setInternalNote(e.target.value)} />
        </Field>
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? "Posting" : "Post to client history"}
        </Button>
      </form>
      {posted ? (
        <p className="text-sm">
          Posted.{" "}
          <Link to="/app/receipt/$id" params={{ id: posted }} className="text-gold">
            Download the PDF receipt
          </Link>
        </p>
      ) : null}
    </div>
  );
}
