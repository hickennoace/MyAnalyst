import type { DashboardSpec, Table } from "./types";
import { compress, decompress } from "./share";

// Local dataset history, stored in IndexedDB. Past analyses are gzip-compressed and kept entirely
// on-device (nothing is ever sent anywhere). IndexedDB replaces the old localStorage backend, which
// capped out around ~5MB and silently evicted everything when a single big table didn't fit; IDB has
// far more room (typically hundreds of MB), so real-world datasets actually persist.

const DB_NAME = "myanalyst";
const DB_VERSION = 1;
const STORE = "analyses";
const MAX_ITEMS = 12;
const LEGACY_KEY = "quantia:history:v1"; // old localStorage store, migrated once

interface StoredItem {
  id: string;
  name: string;
  date: string; // ISO
  rowCount: number;
  colCount: number;
  domain: string;
  specPayload: string; // compressed DashboardSpec
  tablePayload: string; // compressed Table (enables the chart builder on reopen)
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

function hasIDB(): boolean {
  return typeof indexedDB !== "undefined";
}

let dbPromise: Promise<IDBDatabase> | null = null;
function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
  });
  return dbPromise;
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = run(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error ?? new Error("IndexedDB request failed"));
      })
  );
}

async function readAll(): Promise<StoredItem[]> {
  const items = await tx<StoredItem[]>("readonly", (s) => s.getAll() as IDBRequest<StoredItem[]>);
  // Newest first.
  return items.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

/** One-time import of any analyses left in the old localStorage store. */
async function migrateLegacy(): Promise<void> {
  if (typeof localStorage === "undefined") return;
  let raw: string | null;
  try {
    raw = localStorage.getItem(LEGACY_KEY);
  } catch {
    return;
  }
  if (!raw) return;
  try {
    const legacy = JSON.parse(raw) as StoredItem[];
    if (Array.isArray(legacy) && legacy.length) {
      await openDb().then(
        (db) =>
          new Promise<void>((resolve) => {
            const t = db.transaction(STORE, "readwrite");
            const store = t.objectStore(STORE);
            for (const it of legacy) if (it && it.id) store.put(it);
            t.oncomplete = () => resolve();
            t.onerror = () => resolve(); // best-effort
          })
      );
    }
  } catch {
    /* corrupt legacy data — ignore */
  }
  try {
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    /* ignore */
  }
}

let migrated = false;
async function ensureMigrated(): Promise<void> {
  if (migrated) return;
  migrated = true;
  try {
    await migrateLegacy();
  } catch {
    /* ignore */
  }
}

export async function listHistory(): Promise<HistoryEntry[]> {
  if (!hasIDB()) return [];
  try {
    await ensureMigrated();
    const items = await readAll();
    return items.map(({ specPayload, tablePayload, ...meta }) => {
      void specPayload;
      void tablePayload;
      return meta;
    });
  } catch {
    return [];
  }
}

/** Save an analysis. Newest first; evicts the oldest beyond MAX_ITEMS. Returns the entry id. */
export async function saveAnalysis(spec: DashboardSpec, table: Table): Promise<string> {
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  if (!hasIDB()) return id;
  await ensureMigrated();
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
  await tx("readwrite", (s) => s.put(item));

  // Trim to the cap, dropping the oldest entries.
  const all = await readAll();
  if (all.length > MAX_ITEMS) {
    const toDrop = all.slice(MAX_ITEMS);
    await Promise.all(toDrop.map((it) => tx("readwrite", (s) => s.delete(it.id))));
  }
  return id;
}

export async function getAnalysis(id: string): Promise<{ spec: DashboardSpec; table: Table } | null> {
  if (!hasIDB()) return null;
  await ensureMigrated();
  const item = await tx<StoredItem | undefined>("readonly", (s) => s.get(id) as IDBRequest<StoredItem | undefined>);
  if (!item) return null;
  const [spec, table] = await Promise.all([
    decompress<DashboardSpec>(item.specPayload),
    decompress<Table>(item.tablePayload),
  ]);
  return { spec, table };
}

export async function deleteAnalysis(id: string): Promise<void> {
  if (!hasIDB()) return;
  try {
    await tx("readwrite", (s) => s.delete(id));
  } catch {
    /* ignore */
  }
}

export async function clearHistory(): Promise<void> {
  if (!hasIDB()) return;
  try {
    await tx("readwrite", (s) => s.clear());
  } catch {
    /* ignore */
  }
}
