/**
 * Tests para queries/dso.queries.ts
 *
 * Mockea fetchAllRows con dos respuestas secuenciales: c_cobrar y luego
 * mv_ventas_diarias. Valida días calendario del período, división correcta y
 * edge cases de período vacío / sin ventas.
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
  it("calcula DSO con 1 mes (abril 2026 = 30 días)", async () => {
    // c_cobrar: 5M Gs. en saldo abierto
    mockFetchAllRows.mockResolvedValueOnce([
      { pendiente_de_pago: 3_000_000 },
      { pendiente_de_pago: 2_000_000 },
    ]);
    // mv_ventas_diarias: 30M neto en abril
    mockFetchAllRows.mockResolvedValueOnce([
      { neto: 30_000_000, brand: "Martel", channel: "B2C", year: 2026, month: 4 },
    ]);

    const r = await fetchDSO({ year: 2026, months: [4], brand: null, channel: null });
    expect(r.cuentasPorCobrar).toBe(5_000_000);
    expect(r.ventasPeriodo).toBe(30_000_000);
    expect(r.diasPeriodo).toBe(30);
    expect(r.ventasDiariasPromedio).toBe(1_000_000);
    expect(r.dso).toBe(5);
  });

  it("YTD enero+febrero+marzo 2026 = 31+28+31 = 90 días", async () => {
    mockFetchAllRows.mockResolvedValueOnce([{ pendiente_de_pago: 9_000_000 }]);
    mockFetchAllRows.mockResolvedValueOnce([{ neto: 90_000_000 }]);

    const r = await fetchDSO({ year: 2026, months: [1, 2, 3], brand: null, channel: null });
    expect(r.diasPeriodo).toBe(90);
    expect(r.ventasDiariasPromedio).toBe(1_000_000);
    expect(r.dso).toBe(9);
  });

  it("retorna ceros cuando months está vacío (no llama a la BD)", async () => {
    const r = await fetchDSO({ year: 2026, months: [], brand: null, channel: null });
    expect(r).toEqual({
      cuentasPorCobrar: 0,
      ventasPeriodo: 0,
      diasPeriodo: 0,
      ventasDiariasPromedio: 0,
      dso: 0,
    });
    expect(mockFetchAllRows).not.toHaveBeenCalled();
  });

  it("división por cero: ventas = 0 → DSO = 0 (no Infinity)", async () => {
    mockFetchAllRows.mockResolvedValueOnce([{ pendiente_de_pago: 5_000_000 }]);
    mockFetchAllRows.mockResolvedValueOnce([]);

    const r = await fetchDSO({ year: 2026, months: [4], brand: null, channel: null });
    expect(r.cuentasPorCobrar).toBe(5_000_000);
    expect(r.ventasPeriodo).toBe(0);
    expect(r.dso).toBe(0);
    expect(Number.isFinite(r.dso)).toBe(true);
  });

  it("año bisiesto: febrero 2024 = 29 días", async () => {
    mockFetchAllRows.mockResolvedValueOnce([{ pendiente_de_pago: 0 }]);
    mockFetchAllRows.mockResolvedValueOnce([{ neto: 29_000_000 }]);

    const r = await fetchDSO({ year: 2024, months: [2], brand: null, channel: null });
    expect(r.diasPeriodo).toBe(29);
    expect(r.ventasDiariasPromedio).toBe(1_000_000);
  });
});
