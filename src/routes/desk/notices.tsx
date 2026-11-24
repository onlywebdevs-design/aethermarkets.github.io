import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { bulkClientStatus, listClients, sendClientNotice } from "@/lib/fns";
import { errText } from "@/lib/money";
import type { ClientRow } from "@/lib/types";

export const Route = createFileRoute("/desk/notices")({ component: Notices });

function Notices() {
  const [rows, setRows] = useState<ClientRow[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [account, setAccount] = useState("");
  const [picked, setPicked] = useState<string[]>([]);

  useEffect(() => {
    void listClients().then(setRows).catch(() => setRows([]));
  }, []);

  const clients = rows.filter((row) => row.role === "client");

  async function sendAll() {
    try {
      const result = await sendClientNotice({ data: { audience: "all", title, body } });
      toast.success(`Sent to ${result.sent} accounts.`);
    } catch (err) {
      toast.error(errText(err));
    }
  }

  async function sendOne() {
    try {
      const result = await sendClientNotice({ data: { audience: "account", account, title, body } });
      toast.success(`Sent to ${result.sent} account.`);
    } catch (err) {
      toast.error(errText(err));
    }
  }

  async function sendPicked() {
    try {
      const result = await sendClientNotice({ data: { audience: "ids", userIds: picked, title, body } });
      toast.success(`Sent to ${result.sent} accounts.`);
    } catch (err) {
      toast.error(errText(err));
    }
  }

  async function restrictPicked(status: "restricted" | "active") {
    try {
      const result = await bulkClientStatus({ data: { userIds: picked, status } });
      toast.success(`Updated ${result.updated} accounts.`);
    } catch (err) {
      toast.error(errText(err));
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
      <form className="glass space-y-4 rounded-3xl p-5" onSubmit={(e) => e.preventDefault()}>
        <h2 className="text-xl font-semibold">Notice</h2>
        <Field label="Title">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label="Message">
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} />
        </Field>
        <Field label="Single account, email, or id">
          <Input value={account} onChange={(e) => setAccount(e.target.value)} />
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => void sendAll()}>
            Send to all clients
          </Button>
          <Button type="button" variant="ghost" onClick={() => void sendOne()}>
            Send to one
          </Button>
          <Button type="button" variant="purple" onClick={() => void sendPicked()} disabled={picked.length === 0}>
            Send to selected
          </Button>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="sell" size="sm" disabled={picked.length === 0} onClick={() => void restrictPicked("restricted")}>
            Restrict selected
          </Button>
          <Button type="button" variant="buy" size="sm" disabled={picked.length === 0} onClick={() => void restrictPicked("active")}>
            Restore selected
          </Button>
        </div>
      </form>
      <div className="max-h-[32rem] space-y-2 overflow-auto rounded-3xl border border-line p-3">
        {clients.map((row) => {
          const on = picked.includes(row.userId);
          return (
            <label key={row.userId} className="flex items-center gap-3 rounded-2xl px-2 py-2 text-sm">
              <input
                type="checkbox"
                checked={on}
                onChange={() => setPicked((curr) => (on ? curr.filter((id) => id !== row.userId) : [...curr, row.userId]))}
              />
              <span>
                {row.fullName}
                <span className="block text-xs text-muted">
                  {row.accountNumber} · {row.status}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
