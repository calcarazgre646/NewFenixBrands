import { describe, it, expect } from "vitest";
import { buildSizeCurveForSku, hasCompleteCurve, curveCoverage } from "../sizeCurve";
import type { InventoryRecord } from "@/domain/actionQueue/types";

function rec(overrides: Partial<InventoryRecord> = {}): InventoryRecord {
  return {
    sku: "SKU001", skuComercial: "MACA001", talle: "M", description: "Test",
    brand: "Martel", store: "TIENDA1", storeCluster: "A", channel: "b2c",
    units: 10, price: 100, priceMay: 70, cost: 50,
    linea: "Camiseria", categoria: "camisa",
    estComercial: "", carryOver: false, productType: "basicos",
    ...overrides,
  };
}

describe("buildSizeCurveForSku", () => {
  it("returns null for empty records", () => {
    expect(buildSizeCurveForSku([])).toBeNull();
  });

  it("builds network talles from all stores", () => {
    const records = [
      rec({ store: "TIENDA1", talle: "S" }),
      rec({ store: "TIENDA1", talle: "M" }),
      rec({ store: "TIENDA2", talle: "M" }),
      rec({ store: "TIENDA2", talle: "L" }),
    ];
    const result = buildSizeCurveForSku(records)!;
    expect(result.networkTalles).toEqual(["L", "M", "S"]);
  });

  it("detects talles with gaps", () => {
    const records = [
      rec({ store: "TIENDA1", talle: "S" }),
      rec({ store: "TIENDA1", talle: "M" }),
      rec({ store: "TIENDA2", talle: "S" }),
      // TIENDA2 missing M
    ];
    const result = buildSizeCurveForSku(records)!;
    expect(result.tallesWithGaps).toEqual(["M"]);
  });

  it("maps gap sources correctly", () => {
    const records = [
      rec({ store: "TIENDA1", talle: "S" }),
      rec({ store: "TIENDA1", talle: "M" }),
      rec({ store: "TIENDA2", talle: "S" }),
      // TIENDA2 missing M → available in TIENDA1
    ];
    const result = buildSizeCurveForSku(records)!;
    const mSources = result.gapSources.get("M");
    expect(mSources).toBeDefined();
    expect(mSources!.get("TIENDA2")).toEqual(["TIENDA1"]);
  });

  it("excludes STOCK and RETAILS from analysis", () => {
    const records = [
      rec({ store: "STOCK", talle: "S" }),
      rec({ store: "RETAILS", talle: "M" }),
      rec({ store: "TIENDA1", talle: "S" }),
      rec({ store: "TIENDA1", talle: "M" }),
    ];
    const result = buildSizeCurveForSku(records)!;
    expect(result.stores).toHaveLength(1);
    expect(result.stores[0].store).toBe("TIENDA1");
  });

  it("excludes B2B records", () => {
    const records = [
      rec({ store: "MAYORISTA", talle: "S", channel: "b2b" }),
      rec({ store: "TIENDA1", talle: "S" }),
    ];
    const result = buildSizeCurveForSku(records)!;
    expect(result.stores).toHaveLength(1);
  });

  it("no gaps when all stores have all sizes", () => {
    const records = [
      rec({ store: "TIENDA1", talle: "S" }),
      rec({ store: "TIENDA1", talle: "M" }),
      rec({ store: "TIENDA2", talle: "S" }),
      rec({ store: "TIENDA2", talle: "M" }),
    ];
    const result = buildSizeCurveForSku(records)!;
    expect(result.tallesWithGaps).toEqual([]);
  });
});

describe("hasCompleteCurve", () => {
  it("true when store has all network talles", () => {
    const curve = { store: "T1", storeCluster: "A", sizes: [], presentTalles: new Set(["S", "M", "L"]), totalUnits: 30 };
    expect(hasCompleteCurve(curve, ["S", "M", "L"])).toBe(true);
  });

  it("false when store is missing a talle", () => {
    const curve = { store: "T1", storeCluster: "A", sizes: [], presentTalles: new Set(["S", "M"]), totalUnits: 20 };
    expect(hasCompleteCurve(curve, ["S", "M", "L"])).toBe(false);
  });
});

describe("curveCoverage", () => {
  it("100% when complete", () => {
    const curve = { store: "T1", storeCluster: "A", sizes: [], presentTalles: new Set(["S", "M"]), totalUnits: 20 };
    expect(curveCoverage(curve, ["S", "M"])).toBe(100);
  });

  it("66.67% when 2 of 3 sizes present", () => {
    const curve = { store: "T1", storeCluster: "A", sizes: [], presentTalles: new Set(["S", "M"]), totalUnits: 20 };
    expect(curveCoverage(curve, ["S", "M", "L"])).toBeCloseTo(66.67, 1);
  });

  it("100% for empty network talles", () => {
    const curve = { store: "T1", storeCluster: "A", sizes: [], presentTalles: new Set<string>(), totalUnits: 0 };
    expect(curveCoverage(curve, [])).toBe(100);
  });
});
