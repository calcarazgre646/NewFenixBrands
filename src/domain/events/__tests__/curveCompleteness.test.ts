import { describe, it, expect } from "vitest";
import {
  computeNetworkCurves,
  computeEventCurveCoverage,
  summarizeCoverageBySku,
} from "../curveCompleteness";
import type { EventInventoryRow } from "../types";

const inv = (rows: Partial<EventInventoryRow>[]): EventInventoryRow[] =>
  rows.map((r) => ({
    sku: "X",
    skuComercial: "MARTEL01",
    talle: "M",
    brand: "Martel",
    store: "TIENDA1",
    units: 1,
    price: 100_000,
    ...r,
  }));

describe("computeNetworkCurves", () => {
  it("returns a curve per skuComercial considering only units > 0", () => {
    const inventory = inv([
      { skuComercial: "A", talle: "S", units: 5 },
      { skuComercial: "A", talle: "M", units: 3 },
      { skuComercial: "A", talle: "L", units: 0 }, // excluded
      { skuComercial: "B", talle: "M", units: 10 },
    ]);
    const curves = computeNetworkCurves(inventory);
    expect(curves.get("A")).toEqual(["M", "S"]);
    expect(curves.get("B")).toEqual(["M"]);
  });

  it("dedupes talles across stores", () => {
    const inventory = inv([
      { skuComercial: "A", talle: "S", store: "T1", units: 2 },
      { skuComercial: "A", talle: "S", store: "T2", units: 3 },
      { skuComercial: "A", talle: "M", store: "T1", units: 1 },
    ]);
    const curves = computeNetworkCurves(inventory);
    expect(curves.get("A")).toEqual(["M", "S"]);
  });

  it("returns empty map when no rows have units", () => {
    const curves = computeNetworkCurves(inv([{ skuComercial: "A", units: 0 }]));
    expect(curves.size).toBe(0);
  });
});

describe("computeEventCurveCoverage", () => {
  it("returns one row per (sku, store) with present, missing and pct", () => {
    const inventory = inv([
      // Network curve for A: S, M, L
      { skuComercial: "A", talle: "S", store: "T1", units: 5 },
      { skuComercial: "A", talle: "M", store: "T1", units: 3 },
      { skuComercial: "A", talle: "L", store: "T2", units: 2 },
      // T1 has S and M of A
      // T2 has only L of A
    ]);
    const result = computeEventCurveCoverage(["A"], ["T1", "T2"], inventory);
    expect(result).toHaveLength(2);
    const t1 = result.find((r) => r.store === "T1")!;
    expect(t1.presentTalles).toEqual(["M", "S"]);
    expect(t1.missingTalles).toEqual(["L"]);
    expect(t1.coveragePct).toBeCloseTo(66.7, 1);
    expect(t1.isComplete).toBe(false);
    const t2 = result.find((r) => r.store === "T2")!;
    expect(t2.presentTalles).toEqual(["L"]);
    expect(t2.missingTalles).toEqual(["M", "S"]);
  });

  it("flags isComplete when all talles present in store", () => {
    const inventory = inv([
      { skuComercial: "A", talle: "S", store: "T1", units: 1 },
      { skuComercial: "A", talle: "M", store: "T1", units: 1 },
    ]);
    const result = computeEventCurveCoverage(["A"], ["T1"], inventory);
    expect(result[0].isComplete).toBe(true);
    expect(result[0].coveragePct).toBe(100);
  });

  it("returns empty when SKU does not exist in network (coverage 0, incomplete)", () => {
    const inventory = inv([{ skuComercial: "OTHER", talle: "S", units: 5 }]);
    const result = computeEventCurveCoverage(["A"], ["T1"], inventory);
    expect(result[0].coveragePct).toBe(0);
    expect(result[0].isComplete).toBe(false);
    expect(result[0].networkTalles).toEqual([]);
  });

  it("returns empty array when no eventSkus or no eventStores", () => {
    expect(computeEventCurveCoverage([], ["T1"], inv([]))).toEqual([]);
    expect(computeEventCurveCoverage(["A"], [], inv([]))).toEqual([]);
  });
});

describe("summarizeCoverageBySku", () => {
  it("computes avg coverage per sku and counts complete/incomplete stores", () => {
    const inventory = inv([
      { skuComercial: "A", talle: "S", store: "T1", units: 1 },
      { skuComercial: "A", talle: "M", store: "T1", units: 1 },
      { skuComercial: "A", talle: "S", store: "T2", units: 1 },
      // network curve A: S, M
      // T1: full (100%), T2: 50% (missing M)
    ]);
    const cov = computeEventCurveCoverage(["A"], ["T1", "T2"], inventory);
    const summary = summarizeCoverageBySku(cov);
    const a = summary.get("A")!;
    expect(a.avgCoveragePct).toBeCloseTo(75, 1);
    expect(a.storesComplete).toBe(1);
    expect(a.storesIncomplete).toBe(1);
  });

  it("returns empty map when input empty", () => {
    expect(summarizeCoverageBySku([]).size).toBe(0);
  });
});
