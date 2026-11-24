import { Link, createFileRoute } from "@tanstack/react-router";
import {
  BadgeCheck,
  CandlestickChart,
  Fingerprint,
  Layers3,
  Radar,
  Receipt,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react";
import { useEffect, useState } from "react";
import { HeroStage } from "@/components/hero-stage";
import { Button } from "@/components/ui/button";
import { SignedIn, SignedOut } from "@/lib/auth/gates";
import { getQuotes } from "@/lib/fns";
import { formatUsd } from "@/lib/money";
import type { Quote } from "@/lib/types";

export const Route = createFileRoute("/")({ component: Landing });

const features = [
  { icon: Sparkles, title: "AI session engine", copy: "A risk sleeve that fills against the live bitcoin mark and posts P&L to your ledger." },
  { icon: CandlestickChart, title: "Live BTC / USDT", copy: "Candles, depth, and a market watch that stay on the public mark. No delayed brochure prices." },
  { icon: Wallet, title: "Two treasury rails", copy: "USD₮ on Arbitrum and bitcoin. Copy the address, send, and file the amount with the desk." },
  { icon: ShieldCheck, title: "Officer review", copy: "Inbound items sit pending until posted. Your available balance never moves in silence." },
  { icon: Receipt, title: "Receipts you can keep", copy: "Every posted line has a reference, a value date, and a PDF you can download." },
  { icon: Fingerprint, title: "Account controls", copy: "Named accounts, restriction states, and notices that reach one client or the whole book." },
];

const steps = [
  { n: "01", title: "Open the account", copy: "A name, an email, and a password. The desk issues your account number immediately." },
  { n: "02", title: "Fund a rail", copy: "USD₮ or BTC. Minimum 50 USD. You see Successful at once. Posting follows review." },
  { n: "03", title: "Launch the session", copy: "Once the deposit is on the ledger, Launch AI Trading Session appears. The book starts printing." },
];

function Landing() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  useEffect(() => {
    const load = () => {
      void getQuotes().then(setQuotes).catch(() => setQuotes([]));
    };
    load();
    const timer = window.setInterval(load, 15000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5">
        <p className="font-display text-lg font-semibold">
          Aether <span className="text-gold">Markets</span>
        </p>
        <div className="flex items-center gap-2">
          <SignedOut>
            <Button asChild variant="ghost" size="sm">
              <Link to="/login">Sign in</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/login">Open account</Link>
            </Button>
          </SignedOut>
          <SignedIn>
            <Button asChild size="sm">
              <Link to="/app">Enter the desk</Link>
            </Button>
          </SignedIn>
        </div>
      </header>

      <section className="relative mx-4 min-h-[78vh] overflow-hidden rounded-[2rem] border border-line">
        <HeroStage />
        <div className="relative z-10 flex min-h-[78vh] flex-col justify-end p-6 sm:p-12">
          <p className="text-xs font-semibold tracking-[0.28em] text-gold uppercase">Private digital-asset desk</p>
          <h1 className="mt-3 max-w-3xl font-display text-5xl font-semibold leading-none sm:text-7xl">
            Launch AI Trading Today
          </h1>
          <p className="mt-4 max-w-xl text-base text-fg/80 sm:text-lg">
            Aether Markets holds USD₮ and bitcoin on a named ledger, then runs an AI session against the live mark once your deposit is posted.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <SignedOut>
              <Button asChild size="lg">
                <Link to="/login">Launch AI Trading Today</Link>
              </Button>
            </SignedOut>
            <SignedIn>
              <Button asChild size="lg">
                <Link to="/welcome">Launch AI Trading Today</Link>
              </Button>
            </SignedIn>
            <Button asChild variant="ghost" size="lg">
              <a href="#markets">Live markets</a>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-16">
        <h2 className="text-3xl font-semibold">Built for people who already know the book.</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((item) => (
            <article key={item.title} className="glass rounded-3xl p-5">
              <item.icon className="h-5 w-5 text-gold" />
              <h3 className="mt-4 text-xl font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm text-muted">{item.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 pb-16">
        <h2 className="text-3xl font-semibold">How it works</h2>
        <ol className="mt-8 grid gap-4 md:grid-cols-3">
          {steps.map((step) => (
            <li key={step.n} className="rounded-3xl border border-line bg-surface p-5">
              <p className="font-display text-3xl font-semibold text-gold">{step.n}</p>
              <h3 className="mt-3 text-xl font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm text-muted">{step.copy}</p>
            </li>
          ))}
        </ol>
      </section>

      <section id="markets" className="mx-auto w-full max-w-6xl px-4 pb-16">
        <div className="mb-4 flex items-end justify-between">
          <h2 className="text-3xl font-semibold">Live markets</h2>
          <p className="text-xs tracking-widest text-muted uppercase">CoinGecko</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(quotes.length ? quotes : []).map((quote) => {
            const up = quote.changePct >= 0;
            return (
              <article key={quote.id} className="glass flex items-center justify-between rounded-3xl p-4">
                <div>
                  <p className="text-xs tracking-widest text-muted uppercase">{quote.symbol} / USDT</p>
                  <p className="mt-1 font-display text-2xl font-semibold tabular-nums">{formatUsd(quote.usd)}</p>
                  <p className="text-sm text-muted">{quote.name}</p>
                </div>
                <p className={`text-sm font-semibold tabular-nums ${up ? "text-buy" : "text-sell"}`}>
                  {up ? "+" : ""}
                  {quote.changePct.toFixed(2)}%
                </p>
              </article>
            );
          })}
          {quotes.length === 0 ? <p className="text-sm text-muted">Pulling the live book…</p> : null}
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 pb-16">
        <h2 className="text-3xl font-semibold">Why Aether Markets</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {[
            { icon: BadgeCheck, title: "A name on every line", copy: "Deposits, transfers, and session fills carry a counterparty, a reference, and a status you can read." },
            { icon: Radar, title: "The mark is public", copy: "Bitcoin is taken from the live tape. The session does not invent a private price." },
            { icon: Layers3, title: "Capital stays separated", copy: "Available, held, and allocated are different numbers. A pending deposit is not spendable." },
            { icon: ShieldCheck, title: "The desk can say no", copy: "Restriction and freeze are explicit states, with a notice on the account, not a silent lock." },
          ].map((item) => (
            <article key={item.title} className="flex gap-4 rounded-3xl border border-line p-5">
              <item.icon className="mt-1 h-5 w-5 shrink-0 text-purple-2" />
              <div>
                <h3 className="text-xl font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm text-muted">{item.copy}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-4 mb-16 overflow-hidden rounded-[2rem] border border-line bg-surface px-6 py-14 text-center sm:px-12">
        <p className="text-xs tracking-[0.24em] text-gold uppercase">Ready when you are</p>
        <h2 className="mx-auto mt-3 max-w-2xl text-4xl font-semibold sm:text-5xl">Launch AI Trading Session</h2>
        <p className="mx-auto mt-3 max-w-lg text-sm text-muted">
          Open the account, fund a rail, and let the desk post you in. The session is one decision after that.
        </p>
        <Button asChild size="lg" className="mt-6">
          <Link to="/login">Launch AI Trading Session</Link>
        </Button>
      </section>

      <footer className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 pt-4 pb-10 text-xs text-muted sm:flex-row sm:justify-between">
        <p>Aether Markets · private ledger for USD₮ and bitcoin.</p>
        <p className="max-w-xl">
          Inbound transfers are reviewed before they affect available balance. AI fills are model executions against the live mark, posted to this ledger, not routed to an external exchange.
        </p>
      </footer>
    </div>
  );
}
