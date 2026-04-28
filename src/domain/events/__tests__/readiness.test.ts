import { describe, it, expect } from "vitest";
import { computeReadiness, type ReadinessInput } from "../readiness";
import type { EventArrival, EventInventoryRow } from "../types";

const today = new Date("2026-05-01T12:00:00Z");

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

const arrival = (overrides: Partial<EventArrival>): EventArrival => ({
  skuComercial: "MARTEL01",
  brand: "Martel",
  eta: "2026-05-15",
  status: "EN TRANSITO",
  units: 50,
  description: "x",
  ...overrides,
});

const baseInput = (overrides: Partial<ReadinessInput> = {}): ReadinessInput => ({
  eventId: "ev1",
  startDate: "2026-05-15",
  today,
  eventSkus: [{ skuComercial: "A", brand: "Martel" }],
  eventStores: [{ storeCode: "T1", role: "activation" }],
  inventory: [],
  arrivals: [],
  ...overrides,
});

describe("computeReadiness — totals and date", () => {
  it("returns totals and daysToEvent correctly", () => {
    const r = computeReadiness(
      baseInput({
        eventSkus: [
          { skuComercial: "A", brand: "Martel" },
          { skuComercial: "B", brand: "Wrangler" },
        ],
        eventStores: [
          { storeCode: "T1", role: "activation" },
          { storeCode: "T2", role: "activation" },
        ],
      }),
    );
    expect(r.totalSkus).toBe(2);
    expect(r.totalStores).toBe(2);
    expect(r.daysToEvent).toBe(14);
  });

  it("daysToEvent is null for invalid date", () => {
    const r = computeReadiness(baseInput({ startDate: null }));
    expect(r.daysToEvent).toBeNull();
  });

  it("returns empty readiness when no eventSkus", () => {
    const r = computeReadiness(baseInput({ eventSkus: [] }));
    expect(r.totalSkus).toBe(0);
    expect(r.readinessPct).toBe(0);
    expect(r.exceptions).toEqual([]);
  });
});

describe("computeReadiness — counters", () => {
  it("flags out_of_stock when SKU has no units anywhere", () => {
    const r = computeReadiness(
      baseInput({
        eventSkus: [{ skuComercial: "A", brand: "Martel" }],
        eventStores: [{ storeCode: "T1", role: "activation" }],
        inventory: [],
      }),
    );
    expect(r.skusOutOfStock).toBe(1);
    expect(r.skusFullyReady).toBe(0);
    expect(r.exceptions[0].type).toBe("no_stock");
  });

  it("counts skusFullyReady when all activation stores have full curve", () => {
    const r = computeReadiness(
      baseInput({
        eventSkus: [{ skuComercial: "A", brand: "Martel" }],
        eventStores: [{ storeCode: "T1", role: "activation" }],
        inventory: inv([
          { skuComercial: "A", talle: "S", store: "T1", units: 5 },
          { skuComercial: "A", talle: "M", store: "T1", units: 5 },
          // network curve A: S, M (no other store has it)
        ]),
      }),
    );
    expect(r.skusFullyReady).toBe(1);
    expect(r.skusWithIncompleteCurve).toBe(0);
    expect(r.readinessPct).toBe(100);
    expect(r.exceptions).toEqual([]);
  });

  it("flags skusWithIncompleteCurve when one store is missing a talle", () => {
    const r = computeReadiness(
      baseInput({
        eventSkus: [{ skuComercial: "A", brand: "Martel" }],
        eventStores: [
          { storeCode: "T1", role: "activation" },
          { storeCode: "T2", role: "activation" },
        ],
        inventory: inv([
          { skuComercial: "A", talle: "S", store: "T1", units: 5 },
          { skuComercial: "A", talle: "M", store: "T1", units: 5 },
          { skuComercial: "A", talle: "S", store: "T2", units: 5 },
          // T2 missing M (which is in network)
        ]),
      }),
    );
    expect(r.skusWithIncompleteCurve).toBe(1);
    expect(r.skusFullyReady).toBe(0);
    expect(r.readinessPct).toBe(0);
    expect(r.exceptions.some((e) => e.type === "missing_size" && e.store === "T2")).toBe(true);
  });

  it("flags pending arrival but does not double-count when also out_of_stock", () => {
    const r = computeReadiness(
      baseInput({
        eventSkus: [{ skuComercial: "A", brand: "Martel" }],
        inventory: [],
        arrivals: [arrival({ skuComercial: "A", status: "EN TRANSITO" })],
      }),
    );
    expect(r.skusOutOfStock).toBe(1);
    expect(r.skusWithPendingArrival).toBe(1);
    expect(r.exceptions.filter((e) => e.skuComercial === "A").length).toBe(1);
    expect(r.exceptions[0].detail).toContain("Llegada pendiente");
  });

  it("does not flag pending when arrival is EN STOCK", () => {
    const r = computeReadiness(
      baseInput({
        arrivals: [arrival({ skuComercial: "A", status: "EN STOCK" })],
      }),
    );
    expect(r.skusWithPendingArrival).toBe(0);
  });

  it("warehouse-role stores are excluded from readiness calculation", () => {
    const r = computeReadiness(
      baseInput({
        eventStores: [
          { storeCode: "T1", role: "activation" },
          { storeCode: "WAREHOUSE", role: "warehouse" },
        ],
        inventory: inv([
          { skuComercial: "A", talle: "S", store: "T1", units: 5 },
          // network curve A = S
        ]),
      }),
    );
    expect(r.skusFullyReady).toBe(1);
  });
});

describe("computeReadiness — exceptions ordering", () => {
  it("sorts exceptions by severity (no_stock first)", () => {
    const r = computeReadiness(
      baseInput({
        eventSkus: [
          { skuComercial: "A", brand: "Martel" },
          { skuComercial: "B", brand: "Wrangler" },
        ],
        eventStores: [{ storeCode: "T1", role: "activation" }],
        inventory: inv([
          // A: tiene stock pero curva incompleta
          { skuComercial: "A", talle: "S", store: "T1", units: 5 },
          { skuComercial: "A", talle: "M", store: "T2", units: 5 },
          // network A: S, M; T1 missing M
        ]),
        // B: no stock anywhere
        arrivals: [arrival({ skuComercial: "B", status: "EN TRANSITO" })],
      }),
    );
    expect(r.exceptions[0].type).toBe("no_stock");
  });

  it("respects exceptionLimit", () => {
    const skus = Array.from({ length: 50 }, (_, i) => ({
      skuComercial: `S${i}`,
      brand: "Martel",
    }));
    const r = computeReadiness(
      baseInput({ eventSkus: skus, exceptionLimit: 5 }),
    );
    expect(r.exceptions.length).toBe(5);
  });
});
