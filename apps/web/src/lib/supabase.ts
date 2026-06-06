import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Single Supabase client for the whole app. Auth + account features are OPTIONAL: if the public env
// vars aren't set, `supabase` is null and the app runs in guest mode (everything still works locally).
// The anon key is public by design — security is enforced by Row-Level Security on the database, so a
// user can only ever read/write their own rows. No service-role key ever touches the browser.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

export const isAuthEnabled = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = isAuthEnabled
  ? createClient(url!, anonKey!, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;
