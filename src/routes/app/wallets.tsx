import { createFileRoute } from "@tanstack/react-router";
import { useNavigate } from "@tanstack/react-router";
import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Gate, usePortal } from "@/components/app-shell";
import { QrCode } from "@/components/qr-code";
import { Button } from "@/components/ui/button";
import { Field, Input, Panel } from "@/components/ui/field";
import { submitDeposit, submitTransfer, submitWithdrawal } from "@/lib/fns";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { assetLabel, errText, formatAmount } from "@/lib/money";
import { RAILS } from "@/lib/rails";
import type { Asset } from "@/lib/money";

export const Route = createFileRoute("/app/wallets")({ component: Page });

function Page() {
  return (
    <Gate>
      <Body />
    </Gate>
  );
}

function Body() {
  const { home, reload } = usePortal();
  const user = useCurrentUser();
  const navigate = useNavigate();
  const [asset, setAsset] = useState<Asset>("USDT");
  const [amount, setAmount] = useState("50");
  const [reference, setReference] = useState("");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [mode, setMode] = useState<"deposit" | "send" | "transfer">("deposit");
  const [destination, setDestination] = useState("");
  const [recipient, setRecipient] = useState("");
  const [memo, setMemo] = useState("");

  if (!home) return null;
  const rail = RAILS[asset];

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(rail.address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Copy the address manually.");
    }
  }

  async function onDeposit() {
    setBusy(true);
    try {
      const result = await submitDeposit({ data: { asset, amount, reference } });
      setDone(result.message);
      toast.success("Successful");
      reload();
      const firstDepositKey = `aether.first-deposit.${user?.id ?? "guest"}`;
      if (!localStorage.getItem(firstDepositKey)) {
        localStorage.setItem(firstDepositKey, new Date().toISOString());
        await navigate({ to: "/app/profile" });
      }
    } catch (error) {
      toast.error(errText(error));
    } finally {
      setBusy(false);
    }
  }

  async function onSend() {
    setBusy(true);
    try {
      const result = await submitWithdrawal({ data: { asset, amount, destination } });
      toast.success(result.message);
      setDestination("");
      reload();
    } catch (error) {
      toast.error(errText(error));
    } finally {
      setBusy(false);
    }
  }

  async function onTransfer() {
    setBusy(true);
    try {
      const result = await submitTransfer({ data: { asset, amount, recipient, memo } });
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
      <div>
        <h1 className="text-3xl font-semibold">Wallets</h1>
        <p className="mt-1 text-sm text-muted">Two rails. Copy the address, send, then tell the desk the amount.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {home.wallets.map((wallet) => (
          <button
            key={wallet.asset}
            type="button"
            onClick={() => {
              setAsset(wallet.asset);
              setDone(null);
            }}
            className={`rounded-3xl p-4 text-left ${asset === wallet.asset ? "gold-box" : "glass"}`}
          >
            <p className="text-xs tracking-widest uppercase opacity-70">{assetLabel(wallet.asset)}</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{formatAmount(wallet.available, wallet.asset)}</p>
            <p className="text-xs opacity-70">Available · {wallet.network}</p>
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        {(
          [
            ["deposit", "Deposit"],
            ["send", "Withdraw"],
            ["transfer", "Transfer"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setMode(id)}
            className={`rounded-full px-4 py-2 text-xs font-semibold ${mode === id ? "bg-purple text-fg" : "text-muted"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {mode === "deposit" ? (
        <Panel className="space-y-4 p-5">
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
            <QrCode value={rail.address} />
            <div className="min-w-0 flex-1">
              <p className="text-xs tracking-widest text-muted uppercase">{rail.network}</p>
              <p className="mt-2 font-display text-xl font-semibold">{assetLabel(asset)} address</p>
              <p className="mt-2 break-all text-sm text-fg">{rail.address}</p>
              <Button variant="ghost" size="sm" className="mt-3" onClick={() => void copyAddress()}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied" : "Copy address"}
              </Button>
            </div>
          </div>
          {done ? (
            <div className="rounded-2xl bg-buy/15 px-4 py-4 text-center">
              <p className="font-display text-2xl font-semibold text-buy">Successful</p>
              <p className="mt-1 text-sm text-muted">
                Deposit received and queued. Your available balance does not change until the desk posts it.
              </p>
            </div>
          ) : (
            <>
              <Field label="Amount you sent">
                <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </Field>
              <Field label="Transaction reference (optional)">
                <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Hash or bank reference" />
              </Field>
              <Button disabled={busy} onClick={() => void onDeposit()} className="w-full">
                {busy ? "Submitting" : "Submit deposit"}
              </Button>
              <p className="text-center text-xs text-muted">Minimum 50 USD. Confirmation is instant. Posting is not.</p>
            </>
          )}
        </Panel>
      ) : null}
      {mode === "send" ? (
        <Panel className="space-y-4 p-5">
          <Field label="Amount">
            <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Field label={asset === "BTC" ? "Bitcoin address" : "Arbitrum address"}>
            <Input value={destination} onChange={(e) => setDestination(e.target.value)} />
          </Field>
          <Button variant="sell" disabled={busy} onClick={() => void onSend()} className="w-full">
            Reserve withdrawal
          </Button>
        </Panel>
      ) : null}
      {mode === "transfer" ? (
        <Panel className="space-y-4 p-5">
          <Field label="Recipient account or email">
            <Input value={recipient} onChange={(e) => setRecipient(e.target.value)} />
          </Field>
          <Field label="Amount">
            <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Field label="Memo">
            <Input value={memo} onChange={(e) => setMemo(e.target.value)} />
          </Field>
          <Button disabled={busy} onClick={() => void onTransfer()} className="w-full">
            Submit transfer
          </Button>
        </Panel>
      ) : null}
    </div>
  );
}
