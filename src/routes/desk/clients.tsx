import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { listClients } from "@/lib/fns";
import { formatAmount } from "@/lib/money";
import type { ClientRow } from "@/lib/types";

export const Route = createFileRoute("/desk/clients")({ component: Clients });

function Clients() {
  const [rows, setRows] = useState<ClientRow[]>([]);
  const [query, setQuery] = useState("");
  useEffect(() => {
    void listClients().then(setRows).catch(() => setRows([]));
  }, []);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      [row.fullName, row.email, row.accountNumber, row.status].join(" ").toLowerCase().includes(q),
    );
  }, [rows, query]);
  return (
    <div className="space-y-4">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search name, email, account"
        className="w-full rounded-2xl border border-line bg-surface-2 px-4 py-3 text-sm outline-none"
      />
      <div className="overflow-x-auto rounded-3xl border border-line">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="text-xs tracking-widest text-muted uppercase">
            <tr>
              <th className="px-4 py-3 font-medium">Client</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">USD₮</th>
              <th className="px-4 py-3 font-medium">BTC</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((row) => (
              <tr key={row.userId} className="border-t border-line">
                <td className="px-4 py-3">
                  <Link to="/desk/clients/$userId" params={{ userId: row.userId }} className="font-medium text-gold">
                    {row.fullName}
                  </Link>
                  <p className="text-xs text-muted">
                    {row.accountNumber} · {row.email}
                  </p>
                </td>
                <td className="px-4 py-3 capitalize">
                  {row.role} · {row.status}
                </td>
                <td className="px-4 py-3 tabular-nums">{formatAmount(row.usdt, "USDT")}</td>
                <td className="px-4 py-3 tabular-nums">{formatAmount(row.btc, "BTC")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
