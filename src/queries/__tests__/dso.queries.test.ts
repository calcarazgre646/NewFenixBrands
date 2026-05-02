/**
 * Tests para queries/dso.queries.ts
 *
 * Mockea fetchAllRows con dos respuestas secuenciales: c_cobrar y luego
 * mv_ventas_diarias. Valida fórmula correcta (saldo total abierto / ventas
 * diarias del período), edge cases y dataAvailable=false cuando no hay datos.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFetchAllRows = vi.fn();

vi.mock("@/queries/paginate", () => ({
  fetchAllRows: (b: unknown) => mockFetchAllRows(b),
}));

vi.mock("@/api/client", () => ({
  dataClient: {
    from: () => {
      const chain: Record<string, () => unknown> = {};
      const proxy: Record<string, unknown> = new Proxy(chain, {
        get: () => () => proxy,
      });
      return proxy;
    },
  },
}));

import { fetchDSO } from "../dso.queries";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("fetchDSO", () => {
  it("happy path: saldo abierto / ventas diarias promedio", async () => {
    // Llamada 1 (intento primario): c_cobrar
    mockFetchAllRows.mockResolvedValueOnce([
      { pendiente_de_pago: 60_000_000 },
      { pendiente_de_pago: 40_000_000 },
    ]);
    // Llamada 2 (intento primario): mv_ventas_diarias
    const ventas = [];
    for (let d = 1; d <= 30; d++) ventas.push({ neto: 10_000_000, year: 2026, month: 4, day: d });
    mockFetchAllRows.mockResolvedValueOnce(ventas);

    const r = await fetchDSO({ year: 2026, months: [4] });
    expect(r.cuentasPorCobrar).toBe(100_000_000);
    expect(r.ventasPeriodo).toBe(300_000_000);
    expect(r.diasConDatos).toBe(30);
    expect(r.ventasDiariasPromedio).toBe(10_000_000);
    expect(r.dso).toBe(10);
    expect(r.dataAvailable).toBe(true);
    expect(r.fallbackApplied).toBe(false);
    expect(r.actualPeriod).toEqual({ year: 2026, months: [4] });
  });

  it("auto-fallback al último mes con datos cuando el período pedido está vacío", async () => {
    // Llamada 1 (primary cxc): saldo grande
    mockFetchAllRows.mockResolvedValueOnce([{ pendiente_de_pago: 100_000_000 }]);
    // Llamada 2 (primary ventas): vacío → trigger fallback
    mockFetchAllRows.mockResolvedValueOnce([]);
    // Llamada 3 (findLastMonthWithData): retorna 2026-04
    mockFetchAllRows.mockResolvedValueOnce([{ year: 2026, month: 4 }]);
    // Llamada 4 (fallback cxc — recalcula con cutoff abril)
    mockFetchAllRows.mockResolvedValueOnce([{ pendiente_de_pago: 100_000_000 }]);
    // Llamada 5 (fallback ventas): 30 días × 10M Gs
    const ventas = [];
    for (let d = 1; d <= 30; d++) ventas.push({ neto: 10_000_000, year: 2026, month: 4, day: d });
    mockFetchAllRows.mockResolvedValueOnce(ventas);

    const r = await fetchDSO({ year: 2026, months: [5] });
    expect(r.dataAvailable).toBe(true);
    expect(r.fallbackApplied).toBe(true);
    expect(r.actualPeriod).toEqual({ year: 2026, months: [4] });
    expect(r.dso).toBe(10);
  });

  it("dataAvailable=false cuando ni el período pedido ni mv_ventas_diarias tienen datos", async () => {
    // Primary
    mockFetchAllRows.mockResolvedValueOnce([{ pendiente_de_pago: 5_000_000 }]);
    mockFetchAllRows.mockResolvedValueOnce([]);
    // findLastMonthWithData: completamente vacío
    mockFetchAllRows.mockResolvedValueOnce([]);

    const r = await fetchDSO({ year: 2026, months: [5] });
    expect(r.dataAvailable).toBe(false);
    expect(r.dso).toBe(0);
    expect(r.fallbackApplied).toBe(false);
  });

  it("retorna ceros cuando months está vacío sin tocar BD", async () => {
    const r = await fetchDSO({ year: 2026, months: [] });
    expect(r.cuentasPorCobrar).toBe(0);
    expect(r.ventasPeriodo).toBe(0);
    expect(r.diasConDatos).toBe(0);
    expect(r.ventasDiariasPromedio).toBe(0);
    expect(r.dso).toBe(0);
    expect(r.dataAvailable).toBe(false);
    expect(r.fallbackApplied).toBe(false);
    expect(mockFetchAllRows).not.toHaveBeenCalled();
  });

  it("usa días con datos REALES, no días calendario (días sin venta no inflan denominador)", async () => {
    mockFetchAllRows.mockResolvedValueOnce([{ pendiente_de_pago: 100_000_000 }]);
    // Solo 5 días con ventas (no los 30 del mes)
    mockFetchAllRows.mockResolvedValueOnce([
      { neto: 10_000_000, year: 2026, month: 4, day: 1 },
      { neto: 10_000_000, year: 2026, month: 4, day: 2 },
      { neto: 10_000_000, year: 2026, month: 4, day: 3 },
      { neto: 10_000_000, year: 2026, month: 4, day: 4 },
      { neto: 10_000_000, year: 2026, month: 4, day: 5 },
    ]);

    const r = await fetchDSO({ year: 2026, months: [4] });
    expect(r.diasConDatos).toBe(5);
    expect(r.ventasDiariasPromedio).toBe(10_000_000);
    expect(r.dso).toBe(10); // 100M / 10M
  });

  it("multi-fila por día (brand × channel) consolida en un solo día único", async () => {
    mockFetchAllRows.mockResolvedValueOnce([{ pendiente_de_pago: 100_000_000 }]);
    // Mismo día con 3 filas (3 marcas distintas)
    mockFetchAllRows.mockResolvedValueOnce([
      { neto: 4_000_000, year: 2026, month: 4, day: 15 },
      { neto: 3_000_000, year: 2026, month: 4, day: 15 },
      { neto: 3_000_000, year: 2026, month: 4, day: 15 },
    ]);

    const r = await fetchDSO({ year: 2026, months: [4] });
    expect(r.diasConDatos).toBe(1);
    expect(r.ventasPeriodo).toBe(10_000_000);
    expect(r.ventasDiariasPromedio).toBe(10_000_000);
    expect(r.dso).toBe(10);
  });

  it("filtra mes fuera del período aunque la query traiga rango más amplio", async () => {
    mockFetchAllRows.mockResolvedValueOnce([{ pendiente_de_pago: 50_000_000 }]);
    // Query trae month 1-4; pedimos solo [4]
    mockFetchAllRows.mockResolvedValueOnce([
      { neto: 999_999_999, year: 2026, month: 1, day: 15 }, // debe descartarse
      { neto: 5_000_000, year: 2026, month: 4, day: 1 },
    ]);

    const r = await fetchDSO({ year: 2026, months: [4] });
    expect(r.ventasPeriodo).toBe(5_000_000);
    expect(r.diasConDatos).toBe(1);
  });
});
