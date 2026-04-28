import { describe, it, expect } from "vitest";
import { diffProposals } from "../proposalDiff";
import type { AllocationLine } from "../types";

const line = (overrides: Partial<AllocationLine>): AllocationLine => ({
  sku: "X1", skuComercial: "A", talle: "S", brand: "Martel",
  fromStore: "T_OTHER", toStore: "T_EVT", units: 3,
  reason: "transfer_from_store", estimatedRevenue: 0,
  ...overrides,
});

describe("diffProposals — basics", () => {
  it("everything is 'added' when prev is null", () => {
    const next = [line({}), line({ talle: "M" })];
    const d = diffProposals(null, next);
    expect(d.added).toHaveLength(2);
    expect(d.removed).toHaveLength(0);
    expect(d.changed).toHaveLength(0);
    expect(d.unchanged).toBe(0);
  });

  it("everything is 'removed' when next is empty", () => {
    const prev = [line({}), line({ talle: "M" })];
    const d = diffProposals(prev, []);
    expect(d.removed).toHaveLength(2);
    expect(d.added).toHaveLength(0);
  });

  it("identical inputs → all unchanged", () => {
    const prev = [line({}), line({ talle: "M" })];
    const next = [line({}), line({ talle: "M" })];
    const d = diffProposals(prev, next);
    expect(d.unchanged).toBe(2);
    expect(d.added).toEqual([]);
    expect(d.removed).toEqual([]);
    expect(d.changed).toEqual([]);
  });
});

describe("diffProposals — change detection", () => {
  it("detects unit changes as 'changed'", () => {
    const prev = [line({ units: 3 })];
    const next = [line({ units: 5 })];
    const d = diffProposals(prev, next);
    expect(d.changed).toHaveLength(1);
    expect(d.changed[0].prev?.units).toBe(3);
    expect(d.changed[0].next?.units).toBe(5);
  });

  it("detects reason changes as 'changed'", () => {
    const prev = [line({ reason: "transfer_from_store" })];
    const next = [line({ reason: "missing_size" })];
    const d = diffProposals(prev, next);
    expect(d.changed).toHaveLength(1);
    expect(d.changed[0].prev?.reason).toBe("transfer_from_store");
    expect(d.changed[0].next?.reason).toBe("missing_size");
  });

  it("change in fromStore is treated as remove + add (different keys)", () => {
    const prev = [line({ fromStore: "A" })];
    const next = [line({ fromStore: "B" })];
    const d = diffProposals(prev, next);
    expect(d.added).toHaveLength(1);
    expect(d.removed).toHaveLength(1);
    expect(d.changed).toHaveLength(0);
  });

  it("identifies line by (sku, talle, fromStore, toStore) — same toStore + sku in different size are independent", () => {
    const prev = [line({ talle: "S", units: 3 })];
    const next = [line({ talle: "S", units: 3 }), line({ talle: "M", units: 5 })];
    const d = diffProposals(prev, next);
    expect(d.added).toHaveLength(1);
    expect(d.added[0].talle).toBe("M");
    expect(d.unchanged).toBe(1);
  });

  it("dedupes duplicates within one set by summing units (defensive)", () => {
    const prev = [line({ units: 2 }), line({ units: 3 })]; // same key, summed = 5
    const next = [line({ units: 5 })];
    const d = diffProposals(prev, next);
    // Both indexed to units=5 → unchanged
    expect(d.unchanged).toBe(1);
    expect(d.changed).toEqual([]);
  });
});

describe("diffProposals — null fromStore (out_of_stock signals)", () => {
  it("treats null fromStore as a stable key separate from concrete stores", () => {
    const prev = [line({ fromStore: null, reason: "out_of_stock", units: 0 })];
    const next = [line({ fromStore: null, reason: "out_of_stock", units: 0 })];
    const d = diffProposals(prev, next);
    expect(d.unchanged).toBe(1);
  });

  it("change in null↔concrete fromStore counts as remove + add", () => {
    const prev = [line({ fromStore: null, reason: "out_of_stock", units: 0 })];
    const next = [line({ fromStore: "STOCK", reason: "restock_from_depot", units: 3 })];
    const d = diffProposals(prev, next);
    expect(d.added).toHaveLength(1);
    expect(d.removed).toHaveLength(1);
  });
});
