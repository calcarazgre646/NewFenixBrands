import { describe, it, expect } from "vitest";
import { buildPurchasePlan, summarizeByBrand, computeGapTotals } from "../purchasePlanning";
import type { ActionItemFull } from "../waterfall";
import type { RiskLevel, WaterfallLevel, ActionType } from "../types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeItem(overrides: Partial<ActionItemFull> = {}): ActionItemFull {
  return {
    id: `aq-${Math.random()}`,
    rank: 1,
    sku: "SKU001",
    skuComercial: "MACA001",
    talle: "M",
    description: "Test Item",
    brand: "Martel",
    store: "TIENDA1",
    targetStore: undefined,
    currentStock: 5,
    suggestedUnits: 10,
    idealUnits: 15,
    gapUnits: 5,
    daysOfInventory: 45,
    historicalAvg: 8,
    coverWeeks: 13,
    currentMOS: 0.6,
    risk: "critical" as RiskLevel,
    waterfallLevel: "store_to_store" as WaterfallLevel,
    actionType: "transfer" as ActionType,
    impactScore: 1_000_000,
    paretoFlag: true,
    storeCluster: "A",
    timeRestriction: "Sin restriccion",
    counterpartStores: [],
    recommendedAction: "Mover stock",
    linea: "Camiseria",
    categoria: "camisa",
    ...overrides,
  };
}

// ─── buildPurchasePlan ───────────────────────────────────────────────────────

describe("buildPurchasePlan", () => {
  it("returns empty for items with no gap", () => {
    const items = [makeItem({ gapUnits: 0 }), makeItem({ gapUnits: 0 })];
    expect(buildPurchasePlan(items)).toEqual([]);
  });

  it("returns empty for empty input", () => {
    expect(buildPurchasePlan([])).toEqual([]);
  });

  it("groups by (sku, talle) across stores", () => {
    const items = [
      makeItem({ sku: "SKU001", talle: "M", store: "T1", gapUnits: 5 }),
      makeItem({ sku: "SKU001", talle: "M", store: "T2", gapUnits: 3 }),
      makeItem({ sku: "SKU001", talle: "L", store: "T1", gapUnits: 2 }),
    ];
    const rows = buildPurchasePlan(items);
    expect(rows).toHaveLength(2); // SKU001|M and SKU001|L
    const mRow = rows.find(r => r.talle === "M")!;
    expect(mRow.totalGapUnits).toBe(8); // 5+3 across stores
    expect(mRow.storeCount).toBe(2);
    const lRow = rows.find(r => r.talle === "L")!;
    expect(lRow.totalGapUnits).toBe(2);
    expect(lRow.storeCount).toBe(1);
  });

  it("includes brand, linea, categoria for filtering", () => {
    const items = [makeItem({ brand: "Wrangler", linea: "Vaqueria", categoria: "jean", gapUnits: 5 })];
    const rows = buildPurchasePlan(items);
    expect(rows[0].brand).toBe("Wrangler");
    expect(rows[0].linea).toBe("Vaqueria");
    expect(rows[0].categoria).toBe("jean");
  });

  it("deduplicates by (store, sku, talle) — takes max gap", () => {
    const items = [
      makeItem({ store: "T1", sku: "SKU001", talle: "M", gapUnits: 5 }),
      makeItem({ store: "T1", sku: "SKU001", talle: "M", gapUnits: 3 }),
    ];
    const rows = buildPurchasePlan(items);
    expect(rows).toHaveLength(1);
    expect(rows[0].totalGapUnits).toBe(5); // max, not 5+3
  });

  it("deduplicates identical gapUnits (takes either, not sum)", () => {
    const items = [
      makeItem({ store: "T1", sku: "S1", talle: "M", gapUnits: 5 }),
      makeItem({ store: "T1", sku: "S1", talle: "M", gapUnits: 5 }),
    ];
    const rows = buildPurchasePlan(items);
    expect(rows).toHaveLength(1);
    expect(rows[0].totalGapUnits).toBe(5);
  });

  it("sorted by totalGapUnits descending", () => {
    const items = [
      makeItem({ sku: "A", gapUnits: 2 }),
      makeItem({ sku: "B", gapUnits: 10, store: "T2" }),
      makeItem({ sku: "C", gapUnits: 5, store: "T3" }),
    ];
    const rows = buildPurchasePlan(items);
    expect(rows[0].totalGapUnits).toBe(10);
    expect(rows[1].totalGapUnits).toBe(5);
    expect(rows[2].totalGapUnits).toBe(2);
  });

  it("handles items with suggestedUnits=0 without error", () => {
    const items = [makeItem({ suggestedUnits: 0, gapUnits: 5, idealUnits: 5, impactScore: 0 })];
    const rows = buildPurchasePlan(items);
    expect(rows).toHaveLength(1);
    expect(rows[0].totalGapUnits).toBe(5);
    expect(rows[0].estimatedRevenue).toBe(0);
  });

  it("handles missing linea with fallback label", () => {
    const items = [makeItem({ linea: "", gapUnits: 5 })];
    const rows = buildPurchasePlan(items);
    expect(rows[0].linea).toBe("Sin línea");
  });

  it("handles missing categoria with fallback label", () => {
    const items = [makeItem({ categoria: "", gapUnits: 5 })];
    const rows = buildPurchasePlan(items);
    expect(rows[0].categoria).toBe("Sin categoría");
  });
});

// ─── summarizeByBrand ────────────────────────────────────────────────────────

describe("summarizeByBrand", () => {
  it("returns empty for empty input", () => {
    expect(summarizeByBrand([])).toEqual([]);
  });

  it("aggregates gap by brand", () => {
    const items = [
      makeItem({ brand: "Martel", gapUnits: 5 }),
      makeItem({ brand: "Martel", gapUnits: 3, sku: "SKU002", store: "T2" }),
      makeItem({ brand: "Wrangler", gapUnits: 10, sku: "SKU003" }),
    ];
    const rows = buildPurchasePlan(items);
    const summaries = summarizeByBrand(rows);
    expect(summaries).toHaveLength(2);
    expect(summaries[0].brand).toBe("Wrangler");
    expect(summaries[0].totalGapUnits).toBe(10);
    expect(summaries[1].brand).toBe("Martel");
    expect(summaries[1].totalGapUnits).toBe(8);
  });

  it("sorted by totalGapUnits descending", () => {
    const items = [
      makeItem({ brand: "Lee", gapUnits: 2 }),
      makeItem({ brand: "Wrangler", gapUnits: 10, sku: "SKU002" }),
      makeItem({ brand: "Martel", gapUnits: 5, sku: "SKU003" }),
    ];
    const rows = buildPurchasePlan(items);
    const summaries = summarizeByBrand(rows);
    expect(summaries[0].brand).toBe("Wrangler");
    expect(summaries[1].brand).toBe("Martel");
    expect(summaries[2].brand).toBe("Lee");
  });
});

// ─── computeGapTotals ────────────────────────────────────────────────────────

describe("computeGapTotals", () => {
  it("returns zeros for empty input", () => {
    const totals = computeGapTotals([]);
    expect(totals.totalGapUnits).toBe(0);
    expect(totals.totalRevenue).toBe(0);
  });

  it("sums gap units across rows", () => {
    const items = [
      makeItem({ sku: "A", gapUnits: 5 }),
      makeItem({ sku: "B", gapUnits: 10, store: "T2" }),
    ];
    const rows = buildPurchasePlan(items);
    const totals = computeGapTotals(rows);
    expect(totals.totalGapUnits).toBe(15);
  });
});
