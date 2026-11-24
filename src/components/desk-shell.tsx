import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getDeskOverview } from "@/lib/fns";
import { errText, formatUsd } from "@/lib/money";
import type { DeskOverview } from "@/lib/types";
import { cn } from "@/lib/cn";

const links = [
  { to: "/desk", label: "Overview", exact: true },
  { to: "/desk/clients", label: "Clients", exact: false },
  { to: "/desk/queue", label: "Queue", exact: false },
  { to: "/desk/ledger", label: "Post", exact: false },
  { to: "/desk/notices", label: "Notices", exact: false },
] as const;

export function DeskShell() {
  const { user, isPending } = useCurrentUserState();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [overview, setOverview] = useState<DeskOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    void getDeskOverview()
      .then((data) => {
        setOverview(data);
        setError(null);
      })
      .catch((err: unknown) => setError(errText(err)));
  }, [user]);

  if (isPending) return <div className="grid min-h-screen place-items-center text-sm text-muted">Opening the desk…</div>;
  if (!user) return <RedirectToSignIn />;
  if (error) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16">
        <h1 className="text-3xl font-semibold">Desk closed</h1>
        <p className="mt-2 text-sm text-muted">{error}</p>
        <Link to="/app" className="mt-6 inline-block text-sm text-gold">
          Return to your account
        </Link>
      </main>
    );
  }

  return (
    <div className="mx-auto min-h-screen w-full max-w-6xl px-4 py-5">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs tracking-[0.22em] text-gold uppercase">Operations</p>
          <h1 className="font-display text-2xl font-semibold">Aether desk</h1>
        </div>
        <div className="flex items-center gap-4 text-sm">
          {overview ? (
            <p className="tabular-nums text-muted">
              BTC {formatUsd(overview.mark.btcUsd)} · {overview.pendingDeposits} deposits waiting
            </p>
          ) : null}
          <Link to="/app" className="text-gold">
            Client view
          </Link>
        </div>
      </header>
      <nav className="mb-5 flex gap-2 overflow-x-auto">
        {links.map((link) => {
          const active = link.exact ? pathname === link.to : pathname.startsWith(link.to);
          return (
            <Link
              key={link.to}
              to={link.to}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-semibold whitespace-nowrap",
                active ? "bg-purple text-fg" : "text-muted",
              )}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
      <Outlet />
    </div>
  );
}
