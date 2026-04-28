import { describe, it, expect } from "vitest";
import { generateAllocationProposal, summarizeProposal } from "../allocation";
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

describe("generateAllocationProposal — empty cases", () => {
  it("returns [] when no event SKUs", () => {
    expect(
      generateAllocationProposal({
        eventSkus: [],
        eventStores: [{ storeCode: "T1", role: "activation" }],
        inventory: inv([]),
      }),
    ).toEqual([]);
  });

  it("returns [] when only warehouse stores in event (no activation)", () => {
    expect(
      generateAllocationProposal({
        eventSkus: [{ skuComercial: "A", brand: "Martel" }],
        eventStores: [{ storeCode: "WH", role: "warehouse" }],
        inventory: inv([{ skuComercial: "A", talle: "S", store: "WH", units: 5 }]),
      }),
    ).toEqual([]);
  });
});

describe("generateAllocationProposal — sourcing strategy", () => {
  it("generates transfer_from_store from another store with stock", () => {
    const lines = generateAllocationProposal({
      eventSkus: [{ skuComercial: "A", brand: "Martel" }],
      eventStores: [{ storeCode: "T_EVT", role: "activation" }],
      inventory: inv([
        { skuComercial: "A", sku: "X1", talle: "S", store: "T_OTHER", units: 5, price: 200_000 },
        // T_EVT no tiene stock de S
      ]),
    });
    const tline = lines.find((l) => l.talle === "S")!;
    expect(tline.fromStore).toBe("T_OTHER");
    expect(tline.toStore).toBe("T_EVT");
    expect(tline.units).toBe(1);
    expect(tline.reason).toBe("missing_size"); // T_EVT no tenía S
    expect(tline.estimatedRevenue).toBe(200_000);
  });

  it("uses transfer_from_store reason when toStore already has some units", () => {
    const lines = generateAllocationProposal({
      eventSkus: [{ skuComercial: "A", brand: "Martel" }],
      eventStores: [{ storeCode: "T_EVT", role: "activation" }],
      inventory: inv([
        // T_EVT tiene 0 — pero, con minUnitsPerTalleStore=2, igual le falta:
        { skuComercial: "A", talle: "S", store: "T_EVT", units: 1 },
        { skuComercial: "A", talle: "S", store: "T_OTHER", units: 5 },
      ]),
      minUnitsPerTalleStore: 2,
    });
    const line = lines.find((l) => l.fromStore === "T_OTHER")!;
    expect(line.reason).toBe("transfer_from_store");
    expect(line.units).toBe(1); // 2 - 1 currentInStore
  });

  it("falls back to depot when no other store has stock", () => {
    const lines = generateAllocationProposal({
      eventSkus: [{ skuComercial: "A", brand: "Martel" }],
      eventStores: [{ storeCode: "T_EVT", role: "activation" }],
      inventory: inv([
        { skuComercial: "A", talle: "S", store: "STOCK", units: 100 },
      ]),
    });
    const line = lines.find((l) => l.talle === "S")!;
    expect(line.fromStore).toBe("STOCK");
    expect(line.reason).toBe("restock_from_depot");
    expect(line.units).toBe(1);
  });

  it("emits out_of_stock line when nothing available anywhere", () => {
    const lines = generateAllocationProposal({
      eventSkus: [{ skuComercial: "A", brand: "Martel" }],
      eventStores: [{ storeCode: "T_EVT", role: "activation" }],
      inventory: inv([
        // Solo T_EVT tiene 0 y nadie más
        { skuComercial: "A", talle: "S", store: "T_OTHER", units: 0 },
      ]),
    });
    // Como no hay units > 0 en ningún lado para A, networkTalles vacío → out_of_stock global
    const line = lines.find((l) => l.toStore === "T_EVT")!;
    expect(line.reason).toBe("out_of_stock");
    expect(line.units).toBe(0);
  });

  it("does not skip toStore that already has minUnits — generates no line", () => {
    const lines = generateAllocationProposal({
      eventSkus: [{ skuComercial: "A", brand: "Martel" }],
      eventStores: [{ storeCode: "T_EVT", role: "activation" }],
      inventory: inv([
        { skuComercial: "A", talle: "S", store: "T_EVT", units: 5 }, // ya cubierto
      ]),
    });
    expect(lines).toEqual([]);
  });

  it("greedy uses biggest source first", () => {
    const lines = generateAllocationProposal({
      eventSkus: [{ skuComercial: "A", brand: "Martel" }],
      eventStores: [{ storeCode: "T_EVT", role: "activation" }],
      inventory: inv([
        { skuComercial: "A", talle: "S", store: "T_SMALL", units: 1 },
        { skuComercial: "A", talle: "S", store: "T_BIG", units: 10 },
      ]),
      minUnitsPerTalleStore: 1,
    });
    const line = lines.find((l) => l.talle === "S")!;
    expect(line.fromStore).toBe("T_BIG");
  });

  it("warehouse-role event stores act as depot sources (restock_from_depot)", () => {
    const lines = generateAllocationProposal({
      eventSkus: [{ skuComercial: "A", brand: "Martel" }],
      eventStores: [
        { storeCode: "T_EVT", role: "activation" },
        { storeCode: "T_WH", role: "warehouse" },
      ],
      inventory: inv([
        { skuComercial: "A", talle: "S", store: "T_WH", units: 5 },
      ]),
    });
    const line = lines.find((l) => l.toStore === "T_EVT" && l.talle === "S")!;
    expect(line.fromStore).toBe("T_WH");
    expect(line.reason).toBe("restock_from_depot");
    expect(line.units).toBe(1);
  });

  it("multiple talles processed independently", () => {
    const lines = generateAllocationProposal({
      eventSkus: [{ skuComercial: "A", brand: "Martel" }],
      eventStores: [{ storeCode: "T_EVT", role: "activation" }],
      inventory: inv([
        { skuComercial: "A", talle: "S", store: "T_OTHER", units: 5 },
        { skuComercial: "A", talle: "M", store: "STOCK", units: 5 },
      ]),
    });
    const sLine = lines.find((l) => l.talle === "S")!;
    const mLine = lines.find((l) => l.talle === "M")!;
    expect(sLine.fromStore).toBe("T_OTHER");
    expect(mLine.fromStore).toBe("STOCK");
  });
});

describe("summarizeProposal", () => {
  it("computes totals correctly", () => {
    const summary = summarizeProposal([
      {
        sku: "X", skuComercial: "A", talle: "S", brand: "Martel",
        fromStore: "T1", toStore: "T2", units: 3, reason: "transfer_from_store",
        estimatedRevenue: 300_000,
      },
      {
        sku: "Y", skuComercial: "A", talle: "M", brand: "Martel",
        fromStore: "STOCK", toStore: "T2", units: 2, reason: "restock_from_depot",
        estimatedRevenue: 200_000,
      },
    ]);
    expect(summary.totalLines).toBe(2);
    expect(summary.totalUnits).toBe(5);
    expect(summary.totalRevenue).toBe(500_000);
  });

  it("returns zeros for empty proposal", () => {
    const s = summarizeProposal([]);
    expect(s).toEqual({ totalLines: 0, totalUnits: 0, totalRevenue: 0 });
  });
});
