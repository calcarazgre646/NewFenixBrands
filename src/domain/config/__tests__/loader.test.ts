/**
 * Tests del loader de configuración.
 * Verifica: fallback cuando falta, warn cuando inválido, pass-through cuando válido.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolveParam, resolveStoreConfig, resolveCommissionScales } from "../loader";
import { validateNumericParam } from "../schemas";
import { DEFAULT_STORE_CONFIG } from "../defaults";
import { SCALE_BY_ROLE } from "@/domain/commissions/scales";

beforeEach(() => {
  vi.restoreAllMocks();
});

// ─── resolveParam ──────────────────────────────────────────────────────────

describe("resolveParam", () => {
  const validator = (v: unknown) => validateNumericParam(v, 0, 100);

  it("returns fallback when key is missing", () => {
    const params = new Map<string, unknown>();
    const result = resolveParam(params, "test.key", validator, 42);
    expect(result).toBe(42);
  });

  it("returns remote value when valid", () => {
    const params = new Map<string, unknown>([["test.key", 75]]);
    const result = resolveParam(params, "test.key", validator, 42);
    expect(result).toBe(75);
  });

  it("returns fallback and warns when invalid", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const params = new Map<string, unknown>([["test.key", -5]]);
    const result = resolveParam(params, "test.key", validator, 42);
    expect(result).toBe(42);
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy.mock.calls[0][0]).toContain("[config]");
  });

  it("returns fallback when value is non-numeric", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const params = new Map<string, unknown>([["test.key", "not a number"]]);
    const result = resolveParam(params, "test.key", validator, 42);
    expect(result).toBe(42);
    expect(warnSpy).toHaveBeenCalledOnce();
  });

  it("does not warn when key is simply absent", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const params = new Map<string, unknown>();
    resolveParam(params, "missing.key", validator, 42);
    expect(warnSpy).not.toHaveBeenCalled();
  });
});

// ─── resolveStoreConfig ────────────────────────────────────────────────────

describe("resolveStoreConfig", () => {
  it("returns fallback when rows is null", () => {
    const result = resolveStoreConfig(null, DEFAULT_STORE_CONFIG);
    expect(result).toBe(DEFAULT_STORE_CONFIG);
  });

  it("returns fallback when rows is empty array", () => {
    const result = resolveStoreConfig([], DEFAULT_STORE_CONFIG);
    expect(result).toBe(DEFAULT_STORE_CONFIG);
  });

  it("builds config from valid rows", () => {
    const rows = [
      { storeCode: "STORE_A", cluster: "A", assortment: 5000, timeRestriction: "Antes 10am", isExcluded: false, isB2b: false },
      { storeCode: "STORE_B", cluster: "B", assortment: null, timeRestriction: null, isExcluded: false, isB2b: false },
      { storeCode: "STOCK",   cluster: "A", assortment: null, timeRestriction: null, isExcluded: true,  isB2b: false },
      { storeCode: "UTP",     cluster: "B", assortment: null, timeRestriction: null, isExcluded: false, isB2b: true },
    ];
    const result = resolveStoreConfig(rows, DEFAULT_STORE_CONFIG);

    expect(result.clusters.STORE_A).toBe("A");
    expect(result.clusters.STORE_B).toBe("B");
    expect(result.assortments.STORE_A).toBe(5000);
    expect(result.assortments.STORE_B).toBeUndefined();
    expect(result.timeRestrictions.STORE_A).toBe("Antes 10am");
    expect(result.excludedStores.has("STOCK")).toBe(true);
    expect(result.b2bStores.has("UTP")).toBe(true);
  });

  it("skips invalid rows with warning", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const rows = [
      { storeCode: "VALID", cluster: "A", assortment: null, timeRestriction: null, isExcluded: false, isB2b: false },
      { storeCode: "INVALID", cluster: "X", assortment: null, timeRestriction: null, isExcluded: false, isB2b: false },
    ];
    const result = resolveStoreConfig(rows, DEFAULT_STORE_CONFIG);

    expect(result.clusters.VALID).toBe("A");
    expect(result.clusters.INVALID).toBeUndefined();
    expect(warnSpy).toHaveBeenCalledOnce();
  });

  it("returns fallback when all rows are invalid", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const rows = [
      { storeCode: "", cluster: "Z", assortment: null, timeRestriction: null, isExcluded: false, isB2b: false },
    ];
    const result = resolveStoreConfig(rows, DEFAULT_STORE_CONFIG);
    expect(result).toBe(DEFAULT_STORE_CONFIG);
    expect(warnSpy).toHaveBeenCalled();
  });
});

// ─── resolveCommissionScales ───────────────────────────────────────────────

describe("resolveCommissionScales", () => {
  it("returns fallback when rows is null", () => {
    const result = resolveCommissionScales(null, SCALE_BY_ROLE);
    expect(result).toBe(SCALE_BY_ROLE);
  });

  it("returns fallback when rows is empty", () => {
    const result = resolveCommissionScales([], SCALE_BY_ROLE);
    expect(result).toBe(SCALE_BY_ROLE);
  });

  it("builds scales from valid rows", () => {
    const rows = [
      {
        role: "vendedor_tienda",
        channel: "retail",
        type: "percentage",
        label: "Vendedor Tienda",
        tiers: [
          { minPct: 0, maxPct: 70, value: 0 },
          { minPct: 70, maxPct: null, value: 1.00 },
        ],
      },
    ];
    const result = resolveCommissionScales(rows, SCALE_BY_ROLE);
    expect(result.vendedor_tienda.tiers).toHaveLength(2);
    expect(result.vendedor_tienda.tiers[1].maxPct).toBe(Infinity);
    expect(result.vendedor_tienda.tiers[1].value).toBe(1.00);
  });

  it("skips invalid scales with warning", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const rows = [
      { role: "bad_role", channel: "invalid", type: "unknown", label: "", tiers: [] },
    ];
    const result = resolveCommissionScales(rows, SCALE_BY_ROLE);
    expect(result).toBe(SCALE_BY_ROLE);
    expect(warnSpy).toHaveBeenCalled();
  });
});
