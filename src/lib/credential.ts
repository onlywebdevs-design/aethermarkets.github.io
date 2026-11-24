import { authClient } from "@/lib/auth/client";

const BEARER_KEY = "grok-auth.bearer-token";

function storeBearer(res: Response) {
  const token = res.headers.get("set-auth-token");
  if (token && typeof window !== "undefined") {
    window.sessionStorage.setItem(BEARER_KEY, token);
  }
}

async function failMessage(res: Response, fallback: string) {
  try {
    const body = (await res.json()) as { message?: string; error?: { message?: string } };
    return body.message || body.error?.message || fallback;
  } catch {
    return fallback;
  }
}

export async function signInWithEmail(email: string, password: string) {
  const res = await fetch("/api/auth/sign-in/email", {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email: email.trim(), password }),
  });
  storeBearer(res);
  if (!res.ok) throw new Error(await failMessage(res, "Those credentials were not accepted."));
  await authClient.getSession();
}

export async function signUpWithEmail(input: { name: string; email: string; password: string }) {
  const res = await fetch("/api/auth/sign-up/email", {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      name: input.name.trim(),
      email: input.email.trim(),
      password: input.password,
    }),
  });
  storeBearer(res);
  if (!res.ok) throw new Error(await failMessage(res, "The account could not be opened."));
  await authClient.getSession();
}
