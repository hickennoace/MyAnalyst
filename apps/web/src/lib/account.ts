import type { DashboardSpec, Table } from "./types";
import { compress, decompress } from "./share";
import { supabase } from "./supabase";

// Account-bound persistence (only for signed-in users). Data is stored in Supabase with Row-Level
// Security so each row is readable/writable ONLY by its owner (user_id = auth.uid()). The dataset is
// gzip-compressed before it's stored. See supabase/schema.sql for the tables + policies.

export interface SavedAnalysisMeta {
  id: string;
  name: string;
  domain: string;
  row_count: number;
  created_at: string;
}

// ── Profile (job/role description that sharpens the AI) ──────────────────────

export async function getJobDescription(): Promise<string> {
  if (!supabase) return "";
  const { data } = await supabase.from("profiles").select("job_description").maybeSingle();
  return data?.job_description ?? "";
}

export async function saveJobDescription(text: string): Promise<{ error?: string }> {
  if (!supabase) return { error: "Not configured." };
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return { error: "Not signed in." };
  const { error } = await supabase
    .from("profiles")
    .upsert({ id: u.user.id, job_description: text, updated_at: new Date().toISOString() });
  return error ? { error: error.message } : {};
}

// ── Saved analyses ───────────────────────────────────────────────────────────

export async function listSavedAnalyses(): Promise<SavedAnalysisMeta[]> {
  if (!supabase) return [];
  const { data } = await supabase
    .from("analyses")
    .select("id,name,domain,row_count,created_at")
    .order("created_at", { ascending: false });
  return (data as SavedAnalysisMeta[]) ?? [];
}

export async function saveAnalysisToAccount(spec: DashboardSpec, table: Table): Promise<{ error?: string }> {
  if (!supabase) return { error: "Not configured." };
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return { error: "Not signed in." };
  const [payload, tablePayload] = await Promise.all([compress(spec), compress(table)]);
  const { error } = await supabase.from("analyses").insert({
    user_id: u.user.id,
    name: spec.datasetName,
    domain: spec.domain.domain,
    row_count: spec.rowCount,
    payload,
    table_payload: tablePayload,
  });
  return error ? { error: error.message } : {};
}

export async function loadSavedAnalysis(id: string): Promise<{ spec: DashboardSpec; table: Table } | null> {
  if (!supabase) return null;
  const { data } = await supabase.from("analyses").select("payload,table_payload").eq("id", id).maybeSingle();
  if (!data) return null;
  const [spec, table] = await Promise.all([
    decompress<DashboardSpec>(data.payload),
    decompress<Table>(data.table_payload),
  ]);
  return { spec, table };
}

export async function deleteSavedAnalysis(id: string): Promise<void> {
  if (!supabase) return;
  await supabase.from("analyses").delete().eq("id", id);
}
