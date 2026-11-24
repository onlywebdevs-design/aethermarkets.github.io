import { createFileRoute } from "@tanstack/react-router";
import { useNavigate } from "@tanstack/react-router";
import { BadgeCheck, Camera, Check, ChevronRight, CircleUserRound, KeyRound, Palette, ShieldCheck, Upload, UserRound } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { usePortal } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Field, Input, Panel } from "@/components/ui/field";
import { authClient } from "@/lib/auth/client";
import { useCurrentUser } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/app/profile")({ component: Page });

const palettes = [
  { name: "Aether violet", value: "#6b46c1" },
  { name: "Ocean blue", value: "#2563eb" },
  { name: "Emerald", value: "#0f766e" },
  { name: "Rose", value: "#be3455" },
] as const;

function Page() {
  return <Profile />;
}

function Profile() {
  const { home } = usePortal();
  const user = useCurrentUser();
  const navigate = useNavigate();
  const avatarRef = useRef<HTMLInputElement>(null);
  const documentRef = useRef<HTMLInputElement>(null);
  const faceRef = useRef<HTMLInputElement>(null);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [theme, setTheme] = useState<string>(palettes[0].value);
  const [kycStatus, setKycStatus] = useState("not_started");
  const [hasFirstDeposit, setHasFirstDeposit] = useState(false);
  const [faceFile, setFaceFile] = useState<File | null>(null);
  const [idFile, setIdFile] = useState<File | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [showKyc, setShowKyc] = useState(false);

  const userKey = user?.id ?? "guest";
  const avatarKey = `aether.profile.avatar.${userKey}`;
  const themeKey = `aether.profile.theme.${userKey}`;
  const kycKey = `aether.kyc.status.${userKey}`;
  const firstDepositKey = `aether.first-deposit.${userKey}`;

  useEffect(() => {
    const savedAvatar = localStorage.getItem(avatarKey);
    const savedTheme = localStorage.getItem(themeKey);
    const savedKyc = localStorage.getItem(kycKey);
    const firstDeposit = localStorage.getItem(firstDepositKey);
    if (savedAvatar) setAvatar(savedAvatar);
    if (savedTheme && palettes.some((palette) => palette.value === savedTheme)) setTheme(savedTheme);
    if (savedKyc) setKycStatus(savedKyc);
    setHasFirstDeposit(Boolean(firstDeposit));
    if (firstDeposit && (!savedKyc || savedKyc === "not_started")) setShowKyc(true);
    document.documentElement.style.setProperty("--color-purple", savedTheme ?? palettes[0].value);
    document.documentElement.style.setProperty("--color-purple-2", savedTheme ?? palettes[0].value);
  }, [avatarKey, themeKey, kycKey, firstDepositKey]);

  function chooseTheme(value: string) {
    setTheme(value);
    localStorage.setItem(themeKey, value);
    document.documentElement.style.setProperty("--color-purple", value);
    document.documentElement.style.setProperty("--color-purple-2", value);
    toast.success("Theme color updated");
  }

  function saveAvatar(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("Choose an image file.");
    if (file.size > 1_500_000) return toast.error("Choose an image under 1.5 MB.");
    const reader = new FileReader();
    reader.onload = () => {
      const image = String(reader.result);
      try {
        localStorage.setItem(avatarKey, image);
        setAvatar(image);
        window.dispatchEvent(new Event("aether-profile-avatar-change"));
        toast.success("Profile image updated");
      } catch {
        toast.error("This image is too large for browser storage. Try a smaller one.");
      }
    };
    reader.readAsDataURL(file);
  }

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (newPassword.length < 8) return toast.error("Use at least 8 characters for your new password.");
    if (newPassword !== confirmPassword) return toast.error("The new passwords do not match.");
    setSavingPassword(true);
    try {
      const { error } = await authClient.changePassword({ currentPassword, newPassword, revokeOtherSessions: true });
      if (error) throw new Error(error.message ?? "Password update failed");
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
      toast.success("Password changed. Other sessions were signed out.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not change password.");
    } finally { setSavingPassword(false); }
  }

  function submitKyc() {
    if (!faceFile || !idFile) return toast.error("Add a face photo and an identity document to continue.");
    localStorage.setItem(kycKey, "submitted_demo");
    setKycStatus("submitted_demo");
    setShowKyc(false);
    toast.success("Verification details prepared");
  }

  const displayName = home?.profile.fullName || user?.displayName || "Account holder";
  const initials = displayName.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase();

  return (
    <main className="space-y-5 pb-8">
      <div className="flex items-end justify-between gap-3">
        <div><p className="text-xs tracking-[0.2em] text-gold uppercase">Account settings</p><h1 className="mt-1 text-3xl font-semibold">Profile</h1><p className="mt-1 text-sm text-muted">Your identity, security and preferences.</p></div>
        <button onClick={() => void navigate({ to: "/app" })} className="flex min-h-11 items-center gap-1 rounded-full px-3 text-sm text-muted hover:text-fg">Done <ChevronRight className="h-4 w-4" /></button>
      </div>

      <Panel className="overflow-hidden p-0">
        <div className="flex flex-wrap items-center gap-4 p-5">
          <button type="button" onClick={() => avatarRef.current?.click()} aria-label="Change profile image" className="group relative grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-full border border-line bg-surface-2 text-2xl font-semibold">
            {avatar ? <img src={avatar} alt="Your profile" className="h-full w-full object-cover" /> : <span>{initials || <CircleUserRound />}</span>}
            <span className="absolute inset-0 grid place-items-center bg-ink/60 text-fg opacity-0 transition group-hover:opacity-100"><Camera className="h-5 w-5" /></span>
          </button>
          <input ref={avatarRef} type="file" accept="image/*" className="hidden" onChange={(event) => saveAvatar(event.target.files?.[0])} />
          <div className="min-w-0 flex-1"><h2 className="text-xl font-semibold">{displayName}</h2><p className="mt-1 truncate text-sm text-muted">{home?.profile.email || user?.primaryEmail}</p><p className="mt-2 text-xs text-muted">Account · {home?.profile.accountNumber || "Setup pending"}</p></div>
          <Button variant="ghost" size="sm" onClick={() => avatarRef.current?.click()}><UserRound className="h-4 w-4" />Edit photo</Button>
        </div>
        <div className="grid gap-3 border-t border-line bg-surface/60 p-5 sm:grid-cols-2">
          <Field label="Full name"><Input value={displayName} readOnly /></Field>
          <Field label="Email address"><Input value={home?.profile.email || user?.primaryEmail || ""} readOnly /></Field>
        </div>
      </Panel>

      <section className="grid gap-4 md:grid-cols-2">
        <Panel className="space-y-4 p-5">
          <div className="flex items-start gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-purple/15 text-purple-2"><Palette className="h-5 w-5" /></span><div><h2 className="font-semibold">Theme color</h2><p className="text-sm text-muted">Choose your accent color for this device.</p></div></div>
          <div className="flex flex-wrap gap-3" role="radiogroup" aria-label="Theme color">
            {palettes.map((palette) => <button key={palette.value} type="button" role="radio" aria-checked={theme === palette.value} aria-label={palette.name} title={palette.name} onClick={() => chooseTheme(palette.value)} className="grid h-11 w-11 place-items-center rounded-full border-2 border-transparent ring-offset-2 ring-offset-surface transition hover:scale-105" style={{ backgroundColor: palette.value, outline: theme === palette.value ? "2px solid var(--color-fg)" : undefined }}>{theme === palette.value ? <Check className="h-5 w-5 text-fg" /> : null}</button>)}
          </div>
          <p className="text-xs text-muted">Saved privately in this browser.</p>
        </Panel>

        <Panel className="space-y-4 p-5">
          <div className="flex items-start gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-purple/15 text-purple-2"><KeyRound className="h-5 w-5" /></span><div><h2 className="font-semibold">Password & security</h2><p className="text-sm text-muted">Use a unique password of at least 8 characters.</p></div></div>
          <form className="space-y-3" onSubmit={(event) => void updatePassword(event)}>
            <Field label="Current password"><Input type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required /></Field>
            <Field label="New password"><Input type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength={8} required /></Field>
            <Field label="Confirm new password"><Input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={8} required /></Field>
            <Button type="submit" disabled={savingPassword || !currentPassword || !newPassword || !confirmPassword} className="w-full">{savingPassword ? "Updating…" : "Change password"}</Button>
          </form>
        </Panel>
      </section>

      <Panel className={`space-y-4 p-5 ${showKyc ? "border-gold/60" : ""}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-gold/15 text-gold"><ShieldCheck className="h-5 w-5" /></span><div><h2 className="font-semibold">Identity verification</h2><p className="mt-1 max-w-xl text-sm text-muted">Verify your identity with a face photo and a government-issued ID to protect your account.</p></div></div>
          <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${kycStatus === "verified" ? "bg-buy/15 text-buy" : kycStatus === "submitted_demo" ? "bg-gold/15 text-gold" : "bg-surface-2 text-muted"}`}>{kycStatus === "verified" ? "Verified" : kycStatus === "submitted_demo" ? "Review needed" : "Not verified"}</span>
        </div>
        {hasFirstDeposit && kycStatus === "not_started" ? <p className="rounded-xl border border-gold/30 bg-gold/10 px-4 py-3 text-sm">Your first deposit is in. Complete identity verification now to secure your account.</p> : null}
        {kycStatus === "submitted_demo" ? <p className="rounded-xl bg-surface-2 px-4 py-3 text-sm text-muted">Your verification is prepared in this demo. A secure verification provider must be connected before your documents can be transmitted or reviewed.</p> : null}
        {showKyc || kycStatus === "not_started" ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <button type="button" onClick={() => faceRef.current?.click()} className="flex min-h-24 items-center gap-3 rounded-2xl border border-dashed border-line p-4 text-left hover:border-purple-2"><span className="grid h-10 w-10 place-items-center rounded-xl bg-surface-2"><Camera className="h-5 w-5" /></span><span className="min-w-0"><span className="block text-sm font-semibold">Face photo</span><span className="block truncate text-xs text-muted">{faceFile?.name ?? "Take or upload a clear selfie"}</span></span><Upload className="ml-auto h-4 w-4 text-muted" /></button>
              <button type="button" onClick={() => documentRef.current?.click()} className="flex min-h-24 items-center gap-3 rounded-2xl border border-dashed border-line p-4 text-left hover:border-purple-2"><span className="grid h-10 w-10 place-items-center rounded-xl bg-surface-2"><BadgeCheck className="h-5 w-5" /></span><span className="min-w-0"><span className="block text-sm font-semibold">ID document</span><span className="block truncate text-xs text-muted">{idFile?.name ?? "Passport, national ID or driver's licence"}</span></span><Upload className="ml-auto h-4 w-4 text-muted" /></button>
              <input ref={faceRef} type="file" accept="image/*" capture="user" className="hidden" onChange={(event) => setFaceFile(event.target.files?.[0] ?? null)} />
              <input ref={documentRef} type="file" accept="image/*,.pdf" className="hidden" onChange={(event) => setIdFile(event.target.files?.[0] ?? null)} />
            </div>
            <p className="text-xs leading-relaxed text-muted">Use clear, unexpired documents. Your photos are not uploaded by this demo. A production KYC provider and secure, encrypted document storage are required before submitting real identity data.</p>
            <Button disabled={!faceFile || !idFile} onClick={submitKyc} className="w-full sm:w-auto">Continue verification</Button>
          </>
        ) : null}
      </Panel>
    </main>
  );
}
