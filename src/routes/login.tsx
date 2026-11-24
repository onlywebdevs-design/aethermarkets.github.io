import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { GROK_PROVIDERS, signIn } from "@/lib/auth/client";
import { signInWithEmail, signUpWithEmail } from "@/lib/credential";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("up");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      if (mode === "up") {
        if (name.trim().length < 2) throw new Error("Enter the name on the account.");
        if (password.length < 8) throw new Error("Use at least 8 characters.");
        await signUpWithEmail({ name, email, password });
        await navigate({ to: "/welcome" });
      } else {
        await signInWithEmail(email, password);
        await navigate({ to: "/app" });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "The desk could not open that session.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto grid min-h-screen w-full max-w-md place-items-center px-4 py-10">
      <div className="w-full space-y-6">
        <Link to="/" className="font-display text-lg font-semibold">
          Aether <span className="text-gold">Markets</span>
        </Link>
        <div>
          <h1 className="text-4xl font-semibold">{mode === "up" ? "Open your account" : "Welcome back"}</h1>
          <p className="mt-2 text-sm text-muted">
            {mode === "up"
              ? "A named ledger for USD₮ and bitcoin. The AI session opens after your first posted deposit."
              : "Sign in to the ledger, the wallets, and the session."}
          </p>
        </div>
        <form
          className="glass space-y-4 rounded-3xl p-5"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          {mode === "up" ? (
            <Field label="Full name">
              <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            </Field>
          ) : null}
          <Field label="Email">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
          </Field>
          <Field label="Password">
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "up" ? "new-password" : "current-password"}
              required
            />
          </Field>
          {error ? <p className="text-sm text-sell">{error}</p> : null}
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? "Working" : mode === "up" ? "Create account" : "Sign in"}
          </Button>
          <button
            type="button"
            className="w-full text-center text-sm text-muted"
            onClick={() => setMode(mode === "up" ? "in" : "up")}
          >
            {mode === "up" ? "Already on the desk? Sign in" : "New here? Open an account"}
          </button>
        </form>
        <div className="space-y-2">
          {GROK_PROVIDERS.map((provider) => (
            <Button
              key={provider.providerId}
              variant="ghost"
              className="w-full"
              onClick={() => void signIn(provider.providerId, { callbackURL: "/app" })}
            >
              Continue with {provider.label}
            </Button>
          ))}
        </div>
      </div>
    </main>
  );
}
