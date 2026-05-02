/**
 * Tests para queries/sellThrough.queries.ts
 *
 * Mockea fetchAllRows para validar la lógica de agregación por ventana
 * (30/60/90), filtro por marca vía sku→brand map, y exclusión de SKUs vacíos.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFetchAllRows = vi.fn();

vi.mock("@/queries/paginate", () => ({
  fetchAllRows: (b: unknown) => mockFetchAllRows(b),
}));

// dataClient se invoca pero su resultado se ignora — fetchAllRows está mockeado.
vi.mock("@/api/client", () => ({
  dataClient: {
    from: () => ({
      select: () => ({
        not: () => ({
          lte: () => ({
            eq: () => ({ /* terminal */ }),
          }),
        }),
      }),
    }),
  },
}));

import { fetchSellThroughByWindow } from "../sellThrough.queries";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("fetchSellThroughByWindow", () => {
  it("agrega correctamente las 3 ventanas (30/60/90) para una sola tienda", async () => {
    mockFetchAllRows.mockResolvedValueOnce([
      // Cohort 20d → cae en 30, 60, 90
      { sku: "A1", store: "MCAL", units_received: 100, units_sold: 50, cohort_age_days: 20 },
      // Cohort 50d → cae en 60 y 90
      { sku: "A2", store: "MCAL", units_received: 200, units_sold: 80, cohort_age_days: 50 },
      // Cohort 80d → cae solo en 90
      { sku: "A3", store: "MCAL", units_received: 100, units_sold: 30, cohort_age_days: 80 },
    ]);

    const r = await fetchSellThroughByWindow(null, null, null);
    const w30 = r.windows.find((w) => w.windowDays === 30)!;
    const w60 = r.windows.find((w) => w.windowDays === 60)!;
    const w90 = r.windows.find((w) => w.windowDays === 90)!;

    expect(w30).toEqual({ windowDays: 30, unitsReceived: 100, unitsSold: 50, sthPct: 50 });
    expect(w60).toEqual({ windowDays: 60, unitsReceived: 300, unitsSold: 130, sthPct: (130 / 300) * 100 });
    expect(w90).toEqual({ windowDays: 90, unitsReceived: 400, unitsSold: 160, sthPct: 40 });
    expect(r.skus90d).toBe(3);
  });

  it("filtra por marca usando skuBrandMap (excluye SKUs de otras marcas)", async () => {
    mockFetchAllRows.mockResolvedValueOnce([
      { sku: "MAR1", store: "MCAL", units_received: 100, units_sold: 60, cohort_age_days: 10 },
      { sku: "WRA1", store: "MCAL", units_received: 100, units_sold: 30, cohort_age_days: 10 },
      { sku: "LEE1", store: "MCAL", units_received: 100, units_sold: 90, cohort_age_days: 10 },
    ]);

    const skuBrandMap = new Map([
      ["MAR1", "Martel"],
      ["WRA1", "Wrangler"],
      ["LEE1", "Lee"],
    ]);

    const r = await fetchSellThroughByWindow(null, skuBrandMap, "Martel");
    const w90 = r.windows.find((w) => w.windowDays === 90)!;
    expect(w90.unitsReceived).toBe(100);
    expect(w90.unitsSold).toBe(60);
    expect(w90.sthPct).toBe(60);
    expect(r.skus90d).toBe(1);
  });

  it("retorna 0% (no NaN) cuando no hay unidades recibidas en la ventana", async () => {
    mockFetchAllRows.mockResolvedValueOnce([]);
    const r = await fetchSellThroughByWindow(null, null, null);
    for (const w of r.windows) {
      expect(w.sthPct).toBe(0);
      expect(Number.isFinite(w.sthPct)).toBe(true);
    }
    expect(r.skus90d).toBe(0);
  });

  it("clampea sthPct a 100 cuando vendidas > recibidas (stock previo a cohorte)", async () => {
    mockFetchAllRows.mockResolvedValueOnce([
      { sku: "X", store: "MCAL", units_received: 10, units_sold: 25, cohort_age_days: 5 },
    ]);
    const r = await fetchSellThroughByWindow(null, null, null);
    expect(r.windows.find((w) => w.windowDays === 30)!.sthPct).toBe(100);
  });

  it("ignora SKUs con id vacío o solo whitespace", async () => {
    mockFetchAllRows.mockResolvedValueOnce([
      { sku: "  ", store: "MCAL", units_received: 100, units_sold: 100, cohort_age_days: 10 },
      { sku: "REAL", store: "MCAL", units_received: 100, units_sold: 50, cohort_age_days: 10 },
    ]);
    const r = await fetchSellThroughByWindow(null, null, null);
    expect(r.skus90d).toBe(1);
    expect(r.windows.find((w) => w.windowDays === 30)!.unitsReceived).toBe(100);
  });

  it("brand filter sin map → no filtra (degrada graceful)", async () => {
    mockFetchAllRows.mockResolvedValueOnce([
      { sku: "A", store: "MCAL", units_received: 100, units_sold: 50, cohort_age_days: 10 },
    ]);
    const r = await fetchSellThroughByWindow(null, null, "Martel");
    expect(r.skus90d).toBe(1);
  });
});
