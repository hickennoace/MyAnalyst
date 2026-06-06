"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { AuthModal } from "./AuthModal";

// Account control for nav bars. Hidden entirely when auth isn't configured (guest mode).
export function UserMenu() {
  const { enabled, user, loading, signOut } = useAuth();
  const [modal, setModal] = useState(false);
  const [open, setOpen] = useState(false);

  if (!enabled) return null;
  if (loading) return <div className="h-8 w-8 animate-pulse rounded-full bg-slate-800" />;

  if (!user) {
    return (
      <>
        <button onClick={() => setModal(true)} className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-indigo-400/60 hover:bg-slate-800/60">
          Sign in
        </button>
        <AuthModal open={modal} onClose={() => setModal(false)} />
      </>
    );
  }

  const initial = (user.email ?? "?")[0]?.toUpperCase();
  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)} onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-sm font-bold text-white shadow-lg shadow-indigo-500/25 transition hover:opacity-90">
        {initial}
      </button>
      {open && (
        <div className="card absolute right-0 top-11 z-50 w-56 p-2 text-sm shadow-2xl">
          <p className="truncate px-3 py-2 text-xs text-slate-400">{user.email}</p>
          <Link href="/account" className="block rounded-lg px-3 py-2 text-slate-200 transition hover:bg-slate-800/60">My account</Link>
          <Link href="/analyze" className="block rounded-lg px-3 py-2 text-slate-200 transition hover:bg-slate-800/60">Analyzer</Link>
          <button onClick={() => signOut()} className="block w-full rounded-lg px-3 py-2 text-left text-rose-300 transition hover:bg-rose-500/10">Sign out</button>
        </div>
      )}
    </div>
  );
}
