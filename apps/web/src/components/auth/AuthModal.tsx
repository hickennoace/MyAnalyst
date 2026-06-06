"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth";

// Sign-in / sign-up modal: email+password plus one-click Google & GitHub.
export function AuthModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { signInEmail, signUpEmail, signInWithProvider } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  if (!open) return null;

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    const res = mode === "signin" ? await signInEmail(email, password) : await signUpEmail(email, password);
    setBusy(false);
    if (res.error) setError(res.error);
    else if ("needsConfirm" in res && res.needsConfirm) setInfo("Check your email to confirm your account, then sign in.");
    else onClose();
  }

  async function handleProvider(provider: "google" | "github") {
    setError(null);
    const res = await signInWithProvider(provider);
    if (res.error) setError(res.error);
    // On success the browser redirects to the provider.
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="card w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-50">{mode === "signin" ? "Welcome back" : "Create your account"}</h2>
          <button onClick={onClose} className="text-slate-500 transition hover:text-slate-300">✕</button>
        </div>

        <div className="space-y-2">
          <button onClick={() => handleProvider("google")} className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 transition hover:bg-slate-100">
            <GoogleIcon /> Continue with Google
          </button>
          <button onClick={() => handleProvider("github")} className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-medium text-slate-100 transition hover:bg-slate-800">
            <GithubIcon /> Continue with GitHub
          </button>
        </div>

        <div className="my-4 flex items-center gap-3 text-[11px] text-slate-500">
          <span className="h-px flex-1 bg-slate-800" /> or use email <span className="h-px flex-1 bg-slate-800" />
        </div>

        <form onSubmit={handleEmail} className="space-y-3">
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com"
            className="w-full rounded-xl border border-slate-700 bg-slate-900/60 px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-indigo-400 focus:outline-none" />
          <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password (min 6 chars)"
            className="w-full rounded-xl border border-slate-700 bg-slate-900/60 px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-indigo-400 focus:outline-none" />
          <button type="submit" disabled={busy} className="btn-shine w-full rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:opacity-50">
            {busy ? "…" : mode === "signin" ? "Sign in" : "Sign up"}
          </button>
        </form>

        {error && <p className="mt-3 text-xs text-rose-300">{error}</p>}
        {info && <p className="mt-3 text-xs text-emerald-300">{info}</p>}

        <p className="mt-4 text-center text-xs text-slate-400">
          {mode === "signin" ? "No account yet?" : "Already have an account?"}{" "}
          <button onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(null); setInfo(null); }} className="font-medium text-indigo-300 hover:text-indigo-200">
            {mode === "signin" ? "Create one" : "Sign in"}
          </button>
        </p>
        <p className="mt-3 text-center text-[10px] leading-relaxed text-slate-600">
          🔒 Encrypted in transit. Your saved data is protected by row-level security — only you can ever access it.
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6.1C12.2 13.3 17.6 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.5 3-2.2 5.5-4.7 7.2l7.3 5.7C43.8 38 46.5 31.8 46.5 24.5z" />
      <path fill="#FBBC05" d="M10.4 28.3c-.5-1.4-.8-2.9-.8-4.3s.3-3 .8-4.3l-7.8-6.1C.9 16.9 0 20.3 0 24s.9 7.1 2.6 10.4l7.8-6.1z" />
      <path fill="#34A853" d="M24 48c6.2 0 11.5-2 15.3-5.5l-7.3-5.7c-2 1.4-4.7 2.3-8 2.3-6.4 0-11.8-3.8-13.6-9.3l-7.8 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}
function GithubIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 .5C5.7.5.5 5.7.5 12c0 5.1 3.3 9.4 7.9 10.9.6.1.8-.3.8-.6v-2c-3.2.7-3.9-1.4-3.9-1.4-.5-1.3-1.3-1.7-1.3-1.7-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.8 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C18 4.6 19 4.9 19 4.9c.6 1.6.2 2.8.1 3.1.8.8 1.2 1.8 1.2 3.1 0 4.5-2.7 5.5-5.3 5.8.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6 4.6-1.5 7.9-5.8 7.9-10.9C23.5 5.7 18.3.5 12 .5z" />
    </svg>
  );
}
