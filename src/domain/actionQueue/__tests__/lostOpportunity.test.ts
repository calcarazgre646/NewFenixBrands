import { describe, it, expect } from "vitest";
import {
  buildOpportunityByBrand,
  buildOpportunityByStore,
  computeOpportunityTotals,
  getRevenuePerUnit,
} from "../lostOpportunity";
import type { ActionItemFull } from "../waterfall";
import type { RiskLevel, WaterfallLevel, ActionType } from "../types";

// ─── Helper ──────────────────────────────────────────────────────────────────

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
    currentStock: 0,
    suggestedUnits: 10,
    idealUnits: 15,
    gapUnits: 5,
    daysOfInventory: 30,
    historicalAvg: 8,
    coverWeeks: 13,
    currentMOS: 0,
    risk: "critical" as RiskLevel,
    waterfallLevel: "store_to_store" as WaterfallLevel,
    actionType: "transfer" as ActionType,
    impactScore: 1_000_000, // → revenuePerUnit = 100k (1M / 10 suggested)
    paretoFlag: false,
    storeCluster: "A",
    timeRestriction: "Sin restriccion",
    counterpartStores: [],
    recommendedAction: "Mover",
    linea: "Camiseria",
    categoria: "camisa",
    productType: "basicos",
    category: "movement",
    responsibleRoles: [],
    ...overrides,
  };
}

// ─── getRevenuePerUnit ───────────────────────────────────────────────────────

describe("getRevenuePerUnit", () => {
  it("derives revenue from suggestedUnits when > 0", () => {
    const item = makeItem({ impactScore: 1_000_000, suggestedUnits: 10, idealUnits: 15 });
    expect(getRevenuePerUnit(item)).toBe(100_000);
  });

  it("falls back to idealUnits when suggested = 0", () => {
    const item = makeItem({ impactScore: 1_500_000, suggestedUnits: 0, idealUnits: 15 });
    expect(getRevenuePerUnit(item)).toBe(100_000);
  });

  it("returns 0 when both suggested and ideal are 0", () => {
    const item = makeItem({ impactScore: 1_000_000, suggestedUnits: 0, idealUnits: 0 });
    expect(getRevenuePerUnit(item)).toBe(0);
  });
});

// ─── buildOpportunityByBrand ─────────────────────────────────────────────────

describe("buildOpportunityByBrand", () => {
  it("returns empty for empty input", () => {
    expect(buildOpportunityByBrand([])).toEqual([]);
  });

  it("returns empty when all items have gapUnits = 0", () => {
    const items = [makeItem({ gapUnits: 0 }), makeItem({ gapUnits: 0 })];
    expect(buildOpportunityByBrand(items)).toEqual([]);
  });

  it("aggregates gap and revenue per brand", () => {
    const items = [
      makeItem({ brand: "Martel",   sku: "S1", store: "T1", gapUnits: 4 }),
      makeItem({ brand: "Martel",   sku: "S2", store: "T2", gapUnits: 6 }),
      makeItem({ brand: "Wrangler", sku: "S3", store: "T1", gapUnits: 3 }),
    ];
    const rows = buildOpportunityByBrand(items);
    expect(rows).toHaveLength(2);
    expect(rows[0].brand).toBe("Martel");
    expect(rows[0].gapUnits).toBe(10);
    expect(rows[0].lostRevenue).toBe(1_000_000); // 10 * 100k
    expect(rows[0].skuCount).toBe(2);
    expect(rows[0].storeCount).toBe(2);
    expect(rows[1].brand).toBe("Wrangler");
    expect(rows[1].gapUnits).toBe(3);
  });

  it("sorts descending by lostRevenue", () => {
    const items = [
      makeItem({ brand: "Lee",      sku: "L1", gapUnits: 1, impactScore: 1_000_000 }),
      makeItem({ brand: "Martel",   sku: "M1", gapUnits: 10, impactScore: 1_000_000 }),
      makeItem({ brand: "Wrangler", sku: "W1", gapUnits: 5, impactScore: 1_000_000 }),
    ];
    const rows = buildOpportunityByBrand(items);
    expect(rows.map(r => r.brand)).toEqual(["Martel", "Wrangler", "Lee"]);
  });

  it("dedups (store, sku, talle) taking max gap (e.g. N1 + N2 same SKU)", () => {
    const items = [
      makeItem({ brand: "Martel", sku: "S1", talle: "M", store: "T1", gapUnits: 3, waterfallLevel: "store_to_store" }),
      makeItem({ brand: "Martel", sku: "S1", talle: "M", store: "T1", gapUnits: 7, waterfallLevel: "depot_to_store" }),
    ];
    const rows = buildOpportunityByBrand(items);
    expect(rows).toHaveLength(1);
    expect(rows[0].gapUnits).toBe(7); // max, not sum
  });

  it('groups items with empty brand under "Sin marca"', () => {
    const items = [makeItem({ brand: "", gapUnits: 4 })];
    const rows = buildOpportunityByBrand(items);
    expect(rows[0].brand).toBe("Sin marca");
  });

  it("ignores items with gapUnits <= 0", () => {
    const items = [
      makeItem({ brand: "Martel", gapUnits: 5 }),
      makeItem({ brand: "Martel", gapUnits: 0 }),
      makeItem({ brand: "Martel", gapUnits: -2 }),
    ];
    const rows = buildOpportunityByBrand(items);
    expect(rows).toHaveLength(1);
    expect(rows[0].gapUnits).toBe(5);
  });
});

// ─── buildOpportunityByStore ─────────────────────────────────────────────────

describe("buildOpportunityByStore", () => {
  it("returns empty for empty input", () => {
    expect(buildOpportunityByStore([])).toEqual([]);
  });

  it("aggregates per store with brand breakdown", () => {
    const items = [
      makeItem({ store: "PINEDO",   brand: "Martel",   sku: "S1", gapUnits: 5 }),
      makeItem({ store: "PINEDO",   brand: "Wrangler", sku: "S2", gapUnits: 3 }),
      makeItem({ store: "MARISCAL", brand: "Martel",   sku: "S3", gapUnits: 2 }),
    ];
    const rows = buildOpportunityByStore(items);
    expect(rows).toHaveLength(2);

    const pinedo = rows.find(r => r.store === "PINEDO")!;
    expect(pinedo.gapUnits).toBe(8);
    expect(pinedo.lostRevenue).toBe(800_000);
    expect(pinedo.skuCount).toBe(2);
    expect(pinedo.brandsBreakdown).toHaveLength(2);
    expect(pinedo.brandsBreakdown[0].brand).toBe("Martel"); // mayor revenue first
    expect(pinedo.brandsBreakdown[0].lostRevenue).toBe(500_000);

    const mariscal = rows.find(r => r.store === "MARISCAL")!;
    expect(mariscal.brandsBreakdown).toHaveLength(1);
  });

  it("sorts descending by lostRevenue", () => {
    const items = [
      makeItem({ store: "A", gapUnits: 1 }),
      makeItem({ store: "B", gapUnits: 10 }),
      makeItem({ store: "C", gapUnits: 5 }),
    ];
    const rows = buildOpportunityByStore(items);
    expect(rows.map(r => r.store)).toEqual(["B", "C", "A"]);
  });

  it("excludes depot stores", () => {
    const depots = new Set(["RETAILS", "STOCK"]);
    const items = [
      makeItem({ store: "PINEDO",  gapUnits: 5 }),
      makeItem({ store: "RETAILS", gapUnits: 8 }),
      makeItem({ store: "STOCK",   gapUnits: 3 }),
    ];
    const rows = buildOpportunityByStore(items, depots);
    expect(rows).toHaveLength(1);
    expect(rows[0].store).toBe("PINEDO");
  });

  it("dedups (store, sku, talle) taking max gap", () => {
    const items = [
      makeItem({ store: "T1", sku: "S1", talle: "M", gapUnits: 3 }),
      makeItem({ store: "T1", sku: "S1", talle: "M", gapUnits: 8 }),
    ];
    const rows = buildOpportunityByStore(items);
    expect(rows[0].gapUnits).toBe(8);
  });
});

// ─── computeOpportunityTotals ────────────────────────────────────────────────

describe("computeOpportunityTotals", () => {
  it("returns zero totals for empty input", () => {
    expect(computeOpportunityTotals([])).toEqual({
      totalGapUnits: 0,
      totalLostRevenue: 0,
      skuCount: 0,
      storeCount: 0,
      brandCount: 0,
    });
  });

  it("counts unique skus, stores, brands across all gap items", () => {
    const items = [
      makeItem({ brand: "Martel",   sku: "S1", store: "T1", gapUnits: 4 }),
      makeItem({ brand: "Martel",   sku: "S2", store: "T1", gapUnits: 3 }),
      makeItem({ brand: "Wrangler", sku: "S3", store: "T2", gapUnits: 2 }),
    ];
    const totals = computeOpportunityTotals(items);
    expect(totals.totalGapUnits).toBe(9);
    expect(totals.totalLostRevenue).toBe(900_000);
    expect(totals.skuCount).toBe(3);
    expect(totals.storeCount).toBe(2);
    expect(totals.brandCount).toBe(2);
  });

  it("excludes depot stores from totals and counts", () => {
    const depots = new Set(["RETAILS"]);
    const items = [
      makeItem({ brand: "Martel", store: "T1",      gapUnits: 5 }),
      makeItem({ brand: "Martel", store: "RETAILS", gapUnits: 100 }),
    ];
    const totals = computeOpportunityTotals(items, depots);
    expect(totals.totalGapUnits).toBe(5);
    expect(totals.storeCount).toBe(1);
  });
});
