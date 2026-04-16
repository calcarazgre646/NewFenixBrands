import { describe, it, expect } from "vitest";
import { analyzeSizeReposition, analyzeStoreAssignment, analyzeCoverage } from "../analyses";
import type { InventoryRecord } from "@/domain/actionQueue/types";
import type { SthRecord } from "@/queries/sth.queries";

// ─── Helpers ────────────────────────────────────────────────────────────────

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

// ─── analyzeSizeReposition ──────────────────────────────────────────────────

describe("analyzeSizeReposition", () => {
  it("returns empty for empty records", () => {
    expect(analyzeSizeReposition([])).toEqual([]);
  });

  it("returns empty when store has all sizes", () => {
    const records = [
      rec({ store: "TIENDA1", talle: "S" }),
      rec({ store: "TIENDA1", talle: "M" }),
      rec({ store: "TIENDA1", talle: "L" }),
    ];
    expect(analyzeSizeReposition(records)).toEqual([]);
  });

  it("detects missing size when available elsewhere", () => {
    const records = [
      rec({ store: "TIENDA1", talle: "S" }),
      rec({ store: "TIENDA1", talle: "M" }),
      // TIENDA1 missing L
      rec({ store: "TIENDA2", talle: "S" }),
      rec({ store: "TIENDA2", talle: "M" }),
      rec({ store: "TIENDA2", talle: "L" }),
    ];
    const alerts = analyzeSizeReposition(records);
    expect(alerts.length).toBe(1);
    expect(alerts[0].store).toBe("TIENDA1");
    expect(alerts[0].availableElsewhere).toEqual(["L"]);
    expect(alerts[0].missingEverywhere).toEqual([]);
  });

  it("detects size missing everywhere (no other store has it)", () => {
    const records = [
      rec({ store: "TIENDA1", talle: "S" }),
      rec({ store: "TIENDA1", talle: "M" }),
      // TIENDA2 has S and L — L is unique to TIENDA2, M is available in TIENDA1
      rec({ store: "TIENDA2", talle: "S" }),
      rec({ store: "TIENDA2", talle: "L" }),
    ];
    const alerts = analyzeSizeReposition(records);
    // TIENDA1 is missing L (available in TIENDA2)
    const t1 = alerts.find(a => a.store === "TIENDA1");
    expect(t1).toBeDefined();
    expect(t1!.availableElsewhere).toEqual(["L"]);
    // TIENDA2 is missing M (available in TIENDA1)
    const t2 = alerts.find(a => a.store === "TIENDA2");
    expect(t2).toBeDefined();
    expect(t2!.availableElsewhere).toEqual(["M"]);
  });

  it("skips single-size SKUs", () => {
    const records = [
      rec({ store: "TIENDA1", talle: "UNICO" }),
      rec({ store: "TIENDA2", talle: "UNICO" }),
    ];
    expect(analyzeSizeReposition(records)).toEqual([]);
  });

  it("skips B2B and depot stores", () => {
    const records = [
      rec({ store: "STOCK", talle: "S", channel: "b2c" }),
      rec({ store: "MAYORISTA", talle: "S", channel: "b2b" }),
      rec({ store: "TIENDA1", talle: "S" }),
      rec({ store: "TIENDA1", talle: "M" }),
    ];
    expect(analyzeSizeReposition(records)).toEqual([]);
  });

  it("calculates coveragePct correctly", () => {
    const records = [
      rec({ store: "TIENDA1", talle: "S" }),
      // TIENDA1 has 1 of 3 sizes
      rec({ store: "TIENDA2", talle: "S" }),
      rec({ store: "TIENDA2", talle: "M" }),
      rec({ store: "TIENDA2", talle: "L" }),
    ];
    const alerts = analyzeSizeReposition(records);
    expect(alerts[0].coveragePct).toBeCloseTo(33.33, 1);
  });

  it("sorts by coverage ascending (worst first)", () => {
    const records = [
      // SKU001: TIENDA1 has S only (1/3 = 33%)
      rec({ sku: "SKU001", store: "TIENDA1", talle: "S" }),
      rec({ sku: "SKU001", store: "TIENDA2", talle: "S" }),
      rec({ sku: "SKU001", store: "TIENDA2", talle: "M" }),
      rec({ sku: "SKU001", store: "TIENDA2", talle: "L" }),
      // SKU002: TIENDA1 has S,M (2/3 = 67%)
      rec({ sku: "SKU002", store: "TIENDA1", talle: "S" }),
      rec({ sku: "SKU002", store: "TIENDA1", talle: "M" }),
      rec({ sku: "SKU002", store: "TIENDA2", talle: "S" }),
      rec({ sku: "SKU002", store: "TIENDA2", talle: "M" }),
      rec({ sku: "SKU002", store: "TIENDA2", talle: "L" }),
    ];
    const alerts = analyzeSizeReposition(records);
    expect(alerts[0].coveragePct).toBeLessThan(alerts[1].coveragePct);
  });
});

// ─── analyzeStoreAssignment ─────────────────────────────────────────────────

describe("analyzeStoreAssignment", () => {
  it("returns empty for empty data", () => {
    expect(analyzeStoreAssignment(new Map())).toEqual([]);
  });

  it("returns empty for single-store SKU", () => {
    const data = new Map<string, SthRecord>([
      ["TIENDA1|SKU001", { sth: 0.5, cohortAgeDays: 30, unitsReceived: 100, unitsSold: 50 }],
    ]);
    expect(analyzeStoreAssignment(data)).toEqual([]);
  });

  it("flags store >5pp below average", () => {
    const data = new Map<string, SthRecord>([
      ["TIENDA1|SKU001", { sth: 0.8, cohortAgeDays: 30, unitsReceived: 100, unitsSold: 80 }],
      ["TIENDA2|SKU001", { sth: 0.3, cohortAgeDays: 30, unitsReceived: 100, unitsSold: 30 }],
    ]);
    const alerts = analyzeStoreAssignment(data);
    expect(alerts.length).toBe(1);
    expect(alerts[0].store).toBe("TIENDA2");
    expect(alerts[0].isUnderperforming).toBe(true);
  });

  it("does not flag stores within 5pp of average", () => {
    const data = new Map<string, SthRecord>([
      ["TIENDA1|SKU001", { sth: 0.52, cohortAgeDays: 30, unitsReceived: 100, unitsSold: 52 }],
      ["TIENDA2|SKU001", { sth: 0.48, cohortAgeDays: 30, unitsReceived: 100, unitsSold: 48 }],
    ]);
    expect(analyzeStoreAssignment(data)).toEqual([]);
  });
});

// ─── analyzeCoverage ────────────────────────────────────────────────────────

describe("analyzeCoverage", () => {
  it("returns empty for empty data", () => {
    expect(analyzeCoverage(new Map())).toEqual([]);
  });

  it("flags SKUs with derived DOI > threshold", () => {
    const data = new Map<string, SthRecord>([
      // age=90, sth=10% → DOI = 90×0.9/0.1 = 810 >> 90
      ["TIENDA1|SKU001", { sth: 0.1, cohortAgeDays: 90, unitsReceived: 100, unitsSold: 10 }],
    ]);
    const alerts = analyzeCoverage(data, 90);
    expect(alerts.length).toBe(1);
    expect(alerts[0].derivedDoi).toBeGreaterThan(90);
    expect(alerts[0].isInsufficient).toBe(true);
  });

  it("does not flag SKUs with good STH", () => {
    const data = new Map<string, SthRecord>([
      // age=30, sth=80% → DOI = 30×0.2/0.8 = 7.5 < 90
      ["TIENDA1|SKU001", { sth: 0.8, cohortAgeDays: 30, unitsReceived: 100, unitsSold: 80 }],
    ]);
    expect(analyzeCoverage(data, 90)).toEqual([]);
  });

  it("sorts by derived DOI descending (worst first)", () => {
    const data = new Map<string, SthRecord>([
      ["TIENDA1|SKU001", { sth: 0.1, cohortAgeDays: 90, unitsReceived: 100, unitsSold: 10 }],
      ["TIENDA2|SKU002", { sth: 0.05, cohortAgeDays: 120, unitsReceived: 100, unitsSold: 5 }],
    ]);
    const alerts = analyzeCoverage(data, 90);
    expect(alerts.length).toBe(2);
    expect(alerts[0].derivedDoi).toBeGreaterThan(alerts[1].derivedDoi);
  });
});
