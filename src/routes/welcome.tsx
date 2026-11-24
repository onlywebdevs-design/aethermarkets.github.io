import { Link, createFileRoute } from "@tanstack/react-router";
import { HeroStage } from "@/components/hero-stage";
import { Button } from "@/components/ui/button";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/welcome")({ component: Welcome });

function Welcome() {
  const { user, isPending } = useCurrentUserState();
  if (isPending) return <div className="grid min-h-screen place-items-center text-sm text-muted">Opening the desk…</div>;
  if (!user) return <RedirectToSignIn />;
  const first = user.displayName?.split(" ")[0] || "there";
  return (
    <main className="relative min-h-screen overflow-hidden">
      <HeroStage />
      <div className="relative z-10 mx-auto flex min-h-screen max-w-3xl flex-col justify-end px-6 py-16">
        <p className="text-xs tracking-[0.28em] text-gold uppercase">Account open</p>
        <h1 className="mt-3 font-display text-5xl font-semibold sm:text-7xl">Launch AI Trading Today</h1>
        <p className="mt-4 max-w-xl text-base text-fg/85">
          {first}, the ledger is in your name. Fund USD₮ or bitcoin, and the session unlocks the moment operations posts it.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link to="/app">Launch AI Trading Today</Link>
          </Button>
          <Button asChild variant="ghost" size="lg">
            <Link to="/app/wallets">Deposit now</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
