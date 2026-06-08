import { beforeAll, describe, expect, it } from "vitest";
import { DEFAULT_BRAND, hexToRgb, loadBrand, saveBrand } from "./brand";

// brand.ts reads/writes localStorage; vitest runs under node, so provide a minimal in-memory stub.
beforeAll(() => {
  const store = new Map<string, string>();
  (globalThis as { localStorage?: Storage }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() { return store.size; },
  } as Storage;
});

describe("hexToRgb", () => {
  it("parses #rrggbb", () => {
    expect(hexToRgb("#3b82f6")).toEqual([59, 130, 246]);
    expect(hexToRgb("ffffff")).toEqual([255, 255, 255]);
  });
  it("falls back on garbage", () => {
    expect(hexToRgb("nope")).toEqual([59, 130, 246]);
  });
});

describe("loadBrand / saveBrand", () => {
  it("round-trips valid settings and sanitises bad ones", () => {
    saveBrand({ name: "Acme", accent: "#ff0000" });
    expect(loadBrand()).toMatchObject({ name: "Acme", accent: "#ff0000" });

    // bad accent + empty name fall back to defaults
    saveBrand({ name: "  ", accent: "red" } as never);
    const b = loadBrand();
    expect(b.name).toBe(DEFAULT_BRAND.name);
    expect(b.accent).toBe(DEFAULT_BRAND.accent);
  });

  it("rejects a non-image logo", () => {
    saveBrand({ name: "X", accent: "#123456", logoDataUrl: "javascript:alert(1)" } as never);
    expect(loadBrand().logoDataUrl).toBeUndefined();
  });
});
