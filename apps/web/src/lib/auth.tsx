"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { isAuthEnabled, supabase } from "./supabase";

// Auth context. Wraps the app and exposes the current user + auth actions. When Supabase isn't
// configured, `enabled` is false and the UI hides all auth affordances (guest mode).

interface AuthState {
  enabled: boolean;
  user: User | null;
  loading: boolean;
  signInEmail: (email: string, password: string) => Promise<{ error?: string }>;
  signUpEmail: (email: string, password: string) => Promise<{ error?: string; needsConfirm?: boolean }>;
  signInWithProvider: (provider: "google" | "github") => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(isAuthEnabled);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const value: AuthState = {
    enabled: isAuthEnabled,
    user,
    loading,
    async signInEmail(email, password) {
      if (!supabase) return { error: "Auth is not configured." };
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return error ? { error: error.message } : {};
    },
    async signUpEmail(email, password) {
      if (!supabase) return { error: "Auth is not configured." };
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: typeof window !== "undefined" ? window.location.origin + "/analyze" : undefined },
      });
      if (error) return { error: error.message };
      // If email confirmation is on, there's a user but no session yet.
      return { needsConfirm: !data.session };
    },
    async signInWithProvider(provider) {
      if (!supabase) return { error: "Auth is not configured." };
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: typeof window !== "undefined" ? window.location.origin + "/analyze" : undefined },
      });
      return error ? { error: error.message } : {};
    },
    async signOut() {
      await supabase?.auth.signOut();
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
