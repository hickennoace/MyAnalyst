import type { DashboardSpec, Table } from "./types";
import { compress, decompress } from "./share";

// Local dataset history. Past analyses are compressed and stored in localStorage so the user can
// reopen them without re-uploading. Entirely local — nothing is sent anywhere. Capped, with
// quota-aware eviction of the oldest entries.

const KEY = "quantia:history:v1";
const MAX_ITEMS = 8;

interface StoredItem {
  id: string;
  name: string;
  date: string; // ISO
  rowCount: number;
  colCount: number;
  domain: string;
  specPayload: string; // compressed DashboardSpec
  tablePayload: string; // compressed raw Table (enables the chart builder on reopen)
}

/** Lightweight metadata for the history list (no heavy payloads). */
export interface HistoryEntry {
  id: string;
  name: string;
  date: string;
  rowCount: number;
  colCount: number;
  domain: string;
}

function read(): StoredItem[] {
  if (typeof localStorage === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as StoredItem[];
  } catch {
    return [];
  }
}

function write(items: StoredItem[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
    return true;
  } catch {
    return false; // quota exceeded
  }
}

export function listHistory(): HistoryEntry[] {
  return read().map(({ specPayload, tablePayload, ...meta }) => {
    void specPayload;
    void tablePayload;
    return meta;
  });
}

/** Save an analysis. Newest first; evicts oldest on cap or quota pressure. Returns the entry id. */
export async function saveAnalysis(spec: DashboardSpec, table: Table): Promise<string> {
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const item: StoredItem = {
    id,
    name: spec.datasetName,
    date: spec.generatedAt,
    rowCount: spec.rowCount,
    colCount: spec.profiles.length,
    domain: spec.domain.domain,
    specPayload: await compress(spec),
    tablePayload: await compress(table),
  };

  let items = [item, ...read()].slice(0, MAX_ITEMS);
  // If storage is full, drop the oldest entries until it fits (or we give up).
  while (!write(items) && items.length > 1) {
    items = items.slice(0, items.length - 1);
  }
  return id;
}

export async function getAnalysis(id: string): Promise<{ spec: DashboardSpec; table: Table } | null> {
  const item = read().find((i) => i.id === id);
  if (!item) return null;
  const [spec, table] = await Promise.all([
    decompress<DashboardSpec>(item.specPayload),
    decompress<Table>(item.tablePayload),
  ]);
  return { spec, table };
}

export function deleteAnalysis(id: string): void {
  write(read().filter((i) => i.id !== id));
}

export function clearHistory(): void {
  if (typeof localStorage !== "undefined") localStorage.removeItem(KEY);
}
