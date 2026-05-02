/**
 * Tests para queries/recurrence.queries.ts
 *
 * Mockea fetchAllRows secuencialmente (una llamada por mes en input.months).
 * Valida count distinct de num_transaccion por codigo_cliente, exclusión de
 * cliente=0, filtro por canal vía storeMap+classifyStore.
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

import { fetchCustomerRecurrence } from "../recurrence.queries";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("fetchCustomerRecurrence", () => {
  it("happy path: 3 clientes, 1 con ≥2 facturas → 33.3%", async () => {
    mockFetchAllRows.mockResolvedValueOnce([
      { codigo_cliente: 100, codigo_sucursal: "0001", num_transaccion: 1 },
      { codigo_cliente: 100, codigo_sucursal: "0001", num_transaccion: 2 },
      { codigo_cliente: 200, codigo_sucursal: "0002", num_transaccion: 3 },
      { codigo_cliente: 300, codigo_sucursal: "0001", num_transaccion: 4 },
    ]);

    const r = await fetchCustomerRecurrence({ year: 2025, months: [12] });
    expect(r.totalCustomers).toBe(3);
    expect(r.recurrentCustomers).toBe(1);
    expect(r.recurrencePct).toBeCloseTo(33.333, 2);
  });

  it("no double-cuenta cuando un cliente tiene la misma factura repetida", async () => {
    mockFetchAllRows.mockResolvedValueOnce([
      { codigo_cliente: 100, codigo_sucursal: "0001", num_transaccion: 1 },
      { codigo_cliente: 100, codigo_sucursal: "0001", num_transaccion: 1 }, // misma factura
      { codigo_cliente: 100, codigo_sucursal: "0001", num_transaccion: 2 },
    ]);

    const r = await fetchCustomerRecurrence({ year: 2025, months: [12] });
    expect(r.totalCustomers).toBe(1);
    expect(r.recurrentCustomers).toBe(1);
    expect(r.recurrencePct).toBe(100);
  });

  it("empty input.months → 0% sin llamadas a BD", async () => {
    const r = await fetchCustomerRecurrence({ year: 2025, months: [] });
    expect(r).toEqual({ totalCustomers: 0, recurrentCustomers: 0, recurrencePct: 0 });
    expect(mockFetchAllRows).not.toHaveBeenCalled();
  });

  it("total=0 → 0% (no NaN)", async () => {
    mockFetchAllRows.mockResolvedValueOnce([]);
    const r = await fetchCustomerRecurrence({ year: 2025, months: [12] });
    expect(r.recurrencePct).toBe(0);
    expect(Number.isFinite(r.recurrencePct)).toBe(true);
  });

  it("filtro por canal B2B: descarta tiendas B2C usando storeMap", async () => {
    // Cliente 100 compra 2 veces en B2C, cliente 200 compra 2 veces en B2B.
    // Filtro b2b debe contar solo al 200 (1/1 = 100%).
    mockFetchAllRows.mockResolvedValueOnce([
      { codigo_cliente: 100, codigo_sucursal: "S1", num_transaccion: 1 },
      { codigo_cliente: 100, codigo_sucursal: "S1", num_transaccion: 2 },
      { codigo_cliente: 200, codigo_sucursal: "U1", num_transaccion: 3 },
      { codigo_cliente: 200, codigo_sucursal: "U1", num_transaccion: 4 },
    ]);

    const storeMap = new Map([
      ["S1", "ESTRELLA"],   // B2C
      ["U1", "UTP"],        // B2B
    ]);

    const r = await fetchCustomerRecurrence({
      year: 2025,
      months: [12],
      channel: "b2b",
      storeMap,
    });
    expect(r.totalCustomers).toBe(1);
    expect(r.recurrentCustomers).toBe(1);
    expect(r.recurrencePct).toBe(100);
  });

  it("multi-mes: agrega facturas across meses para mismo cliente", async () => {
    // Mes 1: cliente 100 con 1 factura. Mes 2: cliente 100 con otra → recurrente.
    mockFetchAllRows.mockResolvedValueOnce([
      { codigo_cliente: 100, codigo_sucursal: "S1", num_transaccion: 1 },
    ]);
    mockFetchAllRows.mockResolvedValueOnce([
      { codigo_cliente: 100, codigo_sucursal: "S1", num_transaccion: 2 },
    ]);

    const r = await fetchCustomerRecurrence({ year: 2025, months: [11, 12] });
    expect(r.totalCustomers).toBe(1);
    expect(r.recurrentCustomers).toBe(1);
    expect(mockFetchAllRows).toHaveBeenCalledTimes(2);
  });
});
