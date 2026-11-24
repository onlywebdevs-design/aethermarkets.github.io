import { Bell, CandlestickChart, Home, PieChart, Sparkles, Wallet } from "lucide-react";
import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { RedirectToSignIn, UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getPortalHome } from "@/lib/fns";
import { bookUsd, errText, formatUsd } from "@/lib/money";
import type { PortalHome } from "@/lib/types";
import { cn } from "@/lib/cn";

type Ctx = {
  home: PortalHome | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
};

const PortalCtx = createContext<Ctx | null>(null);

export function usePortal(): Ctx {
  const ctx = useContext(PortalCtx);
  if (!ctx) throw new Error("Portal context missing");
  return ctx;
}

export function equityOf(home: PortalHome): number {
  return bookUsd(home.wallets, home.mark.btcUsd, Number(home.openPnl) || 0);
}

const tabs = [
  { to: "/app", label: "Home", icon: Home, exact: true },
  { to: "/app/portfolio", label: "Portfolio", icon: PieChart, exact: false },
  { to: "/app/trade", label: "Trade", icon: CandlestickChart, exact: false },
  { to: "/app/wallets", label: "Wallets", icon: Wallet, exact: false },
  { to: "/app/ai", label: "AI", icon: Sparkles, exact: false, locked: true },
] as const;

export function AppShell() {
  const { user, isPending } = useCurrentUserState();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [home, setHome] = useState<PortalHome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [signedOut, setSignedOut] = useState(false);
  const userId = user?.id;

  const reload = useCallback(() => {
    if (!userId) return;
    void getPortalHome()
      .then((data) => {
        setHome(data);
        setError(null);
      })
      .catch((err: unknown) => {
        const message = errText(err);
        if (message === "Unauthorized") setSignedOut(true);
        else setError(message);
      })
      .finally(() => setLoading(false));
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const savedTheme = localStorage.getItem(`aether.profile.theme.${userId}`);
    if (savedTheme && /^#[0-9a-f]{6}$/i.test(savedTheme)) {
      document.documentElement.style.setProperty("--color-purple", savedTheme);
      document.documentElement.style.setProperty("--color-purple-2", savedTheme);
    }
    setLoading(true);
    reload();
    const timer = window.setInterval(reload, 12000);
    return () => window.clearInterval(timer);
  }, [userId, reload]);

  if (isPending) {
    return (
      <div className="grid min-h-screen place-items-center">
        <div className="h-12 w-48 animate-pulse rounded-full bg-surface" />
      </div>
    );
  }
  if (!user || signedOut) return <RedirectToSignIn />;

  const visible = tabs.filter((tab) => !("locked" in tab && tab.locked) || home?.tradingUnlocked);
  const equity = home ? equityOf(home) : null;

  return (
    <PortalCtx.Provider value={{ home, loading, error, reload }}>
      <div className="mx-auto min-h-screen w-full max-w-6xl px-4 pt-4 pb-28">
        <header className="no-print mb-5 flex items-center justify-between gap-3">
          <Link to="/" className="font-display text-lg font-semibold tracking-tight">
            Aether <span className="text-gold">Markets</span>
          </Link>
          <div className="flex items-center gap-3">
            {equity != null ? (
              <p className="hidden text-sm font-medium text-gold tabular-nums sm:block">{formatUsd(equity)}</p>
            ) : null}
            {home?.profile.role === "admin" ? (
              <Link to="/desk" className="text-xs font-semibold tracking-wide text-purple-2 uppercase">
                Desk
              </Link>
            ) : null}
            <Link to="/app/notices" className="relative grid h-10 w-10 place-items-center rounded-full border border-line">
              <Bell className="h-4 w-4" />
              {home && home.unread > 0 ? (
                <span className="absolute -top-1 -right-1 grid h-4 min-w-4 place-items-center rounded-full bg-gold px-1 text-[10px] font-bold text-ink">
                  {home.unread}
                </span>
              ) : null}
            </Link>
            <UserButton />
          </div>
        </header>
        {home && home.profile.status !== "active" ? (
          <p className="mb-4 rounded-2xl border border-sell/40 bg-sell/10 px-4 py-3 text-sm text-fg">
            {home.profile.status === "frozen"
              ? "This account is frozen. Movements stay paused until the desk restores it."
              : "Transfers, withdrawals, and new sessions are paused. Deposits can still be submitted."}
          </p>
        ) : null}
        {error && !pathname.startsWith("/app/profile") ? <p className="mb-4 text-sm text-sell">{error}</p> : null}
        <Outlet />
      </div>
      <nav className="no-print fixed inset-x-0 bottom-0 z-30 flex justify-center px-3 pb-3">
        <div className="glass flex w-full max-w-md items-stretch justify-between rounded-full px-1 py-1">
          {visible.map((tab) => {
            const active = tab.exact ? pathname === tab.to : pathname.startsWith(tab.to);
            const Icon = tab.icon;
            return (
              <Link
                key={tab.to}
                to={tab.to}
                className={cn(
                  "flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-full text-[11px] font-medium",
                  active ? "bg-purple text-fg" : "text-muted",
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </PortalCtx.Provider>
  );
}

export function Gate({ children }: { children: ReactNode }) {
  const { home, loading } = usePortal();
  if (loading && !home) return <div className="h-56 animate-pulse rounded-3xl bg-surface" />;
  if (!home) return null;
  return children;
}
