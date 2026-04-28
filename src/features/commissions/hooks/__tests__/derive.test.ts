/**
 * Tests para los helpers de derivación que `useCompensation` usa internamente.
 * Vivien fuera del hook para ser testeables sin TanStack Query / React.
 */
import { describe, it, expect } from "vitest";
import {
  projectionToResult,
  buildCompensationSummary,
  filterRowsByChannel,
  buildTopBottoms,
  type CompensationRow,
} from "../derive";
import type { SellerProjection } from "@/domain/projections/types";

function projection(overrides: Partial<SellerProjection> = {}): SellerProjection {
  return {
    vendedorCodigo: 100,
    vendedorNombre: "Test",
    rolComision: "vendedor_tienda",
    canal: "retail",
    sucursalCodigo: "ESTRELLA",
    año: 2026,
    mes: 4,
    diasTranscurridos: 15,
    diasMes: 30,
    diasRestantes: 15,
    ventaActual: 5_000_000,
    ritmoDiario: 333_333,
    ventaProyectada: 10_000_000,
    metaVentas: 10_000_000,
    cumplimientoActualPct: 50,
    cumplimientoProyectadoPct: 100,
    comisionActualGs: 50_000,
    comisionProyectadaGs: 115_000,
    comisionProyectadaPct: 1.15,
    hasMeta: true,
    isMonthClosed: false,
    isInProgress: true,
    ...overrides,
  };
}

function row(overrides: Partial<SellerProjection> = {}): CompensationRow {
  const p = projection(overrides);
  return { projection: p, result: projectionToResult(p) };
}

// ─── projectionToResult ────────────────────────────────────────────────────

describe("projectionToResult", () => {
  it("mapea campos *Actual* a CommissionResult", () => {
    const p = projection({ ventaActual: 8_000_000, comisionActualGs: 80_000, cumplimientoActualPct: 80 });
    const r = projectionToResult(p);
    expect(r.ventaReal).toBe(8_000_000);
    expect(r.comisionVentasGs).toBe(80_000);
    expect(r.comisionTotalGs).toBe(80_000);
    expect(r.cumplimientoVentasPct).toBe(80);
    expect(r.metaVentas).toBe(10_000_000);
  });

  it("convierte null a 0 cuando Mayorista/UTP no tiene meta", () => {
    const p = projection({
      rolComision: "vendedor_mayorista",
      canal: "mayorista",
      metaVentas: null,
      cumplimientoActualPct: null,
      cumplimientoProyectadoPct: null,
      comisionActualGs: null,
      comisionProyectadaGs: null,
      comisionProyectadaPct: null,
      hasMeta: false,
    });
    const r = projectionToResult(p);
    expect(r.metaVentas).toBe(0);
    expect(r.cumplimientoVentasPct).toBe(0);
    expect(r.comisionVentasGs).toBe(0);
    expect(r.comisionTotalGs).toBe(0);
  });

  it("preserva identidad del vendedor (código, nombre, rol, canal, año, mes)", () => {
    const p = projection({
      vendedorCodigo: 42,
      vendedorNombre: "Ada Lovelace",
      rolComision: "vendedor_utp",
      canal: "utp",
      año: 2025,
      mes: 12,
    });
    const r = projectionToResult(p);
    expect(r.vendedorCodigo).toBe(42);
    expect(r.vendedorNombre).toBe("Ada Lovelace");
    expect(r.rolComision).toBe("vendedor_utp");
    expect(r.canal).toBe("utp");
    expect(r.año).toBe(2025);
    expect(r.mes).toBe(12);
  });

  it("cobranza siempre en 0 (la proyección no contempla cobranza)", () => {
    const r = projectionToResult(projection());
    expect(r.metaCobranza).toBe(0);
    expect(r.cobranzaReal).toBe(0);
    expect(r.cumplimientoCobranzaPct).toBe(0);
    expect(r.comisionCobranzaGs).toBe(0);
  });
});

// ─── buildCompensationSummary ─────────────────────────────────────────────

describe("buildCompensationSummary", () => {
  it("suma totales por dimensión", () => {
    const rows = [
      row({ ventaActual: 1_000_000, ventaProyectada: 2_000_000, comisionActualGs: 10_000, comisionProyectadaGs: 20_000 }),
      row({ ventaActual: 3_000_000, ventaProyectada: 6_000_000, comisionActualGs: 30_000, comisionProyectadaGs: 60_000 }),
    ];
    const s = buildCompensationSummary(rows);
    expect(s.totalVendedores).toBe(2);
    expect(s.totalVentaActual).toBe(4_000_000);
    expect(s.totalVentaProyectada).toBe(8_000_000);
    expect(s.totalComisionActualGs).toBe(40_000);
    expect(s.totalComisionProyectadaGs).toBe(80_000);
  });

  it("trata null como 0 al sumar comisiones", () => {
    const rows = [
      row({ comisionActualGs: null, comisionProyectadaGs: null }),
      row({ comisionActualGs: 5_000, comisionProyectadaGs: 10_000 }),
    ];
    const s = buildCompensationSummary(rows);
    expect(s.totalComisionActualGs).toBe(5_000);
    expect(s.totalComisionProyectadaGs).toBe(10_000);
  });

  it("array vacío produce resumen con todos los totales en 0", () => {
    const s = buildCompensationSummary([]);
    expect(s.totalVendedores).toBe(0);
    expect(s.totalVentaActual).toBe(0);
    expect(s.totalComisionProyectadaGs).toBe(0);
  });
});

// ─── filterRowsByChannel ──────────────────────────────────────────────────

describe("filterRowsByChannel", () => {
  const mixed = [
    row({ canal: "retail", vendedorCodigo: 1 }),
    row({ canal: "mayorista", vendedorCodigo: 2 }),
    row({ canal: "utp", vendedorCodigo: 3 }),
    row({ canal: "retail", vendedorCodigo: 4 }),
  ];

  it("'todos' devuelve la lista completa", () => {
    expect(filterRowsByChannel(mixed, "todos")).toHaveLength(4);
  });

  it("filtra por canal exacto", () => {
    expect(filterRowsByChannel(mixed, "retail")).toHaveLength(2);
    expect(filterRowsByChannel(mixed, "mayorista")).toHaveLength(1);
    expect(filterRowsByChannel(mixed, "utp")).toHaveLength(1);
  });

  it("no muta el array original", () => {
    const original = [...mixed];
    filterRowsByChannel(mixed, "retail");
    expect(mixed).toEqual(original);
  });
});

// ─── buildTopBottoms ──────────────────────────────────────────────────────

describe("buildTopBottoms", () => {
  it("ordena por cumplimiento proyectado descendente", () => {
    const rows = [
      row({ vendedorCodigo: 1, cumplimientoProyectadoPct: 90 }),
      row({ vendedorCodigo: 2, cumplimientoProyectadoPct: 130 }),
      row({ vendedorCodigo: 3, cumplimientoProyectadoPct: 70 }),
      row({ vendedorCodigo: 4, cumplimientoProyectadoPct: 110 }),
    ];
    const { topAhead, topBehind } = buildTopBottoms(rows, 2);
    expect(topAhead.map((r) => r.projection.vendedorCodigo)).toEqual([2, 4]);
    expect(topBehind.map((r) => r.projection.vendedorCodigo)).toEqual([3, 1]);
  });

  it("ignora vendedores sin meta cargada", () => {
    const rows = [
      row({ vendedorCodigo: 1, metaVentas: null, cumplimientoProyectadoPct: null }),
      row({ vendedorCodigo: 2, metaVentas: 10_000_000, cumplimientoProyectadoPct: 100 }),
    ];
    const { topAhead, topBehind } = buildTopBottoms(rows);
    expect(topAhead).toHaveLength(1);
    expect(topAhead[0].projection.vendedorCodigo).toBe(2);
    expect(topBehind).toHaveLength(1);
  });

  it("respeta el parámetro N (default 5)", () => {
    const rows = Array.from({ length: 10 }, (_, i) =>
      row({ vendedorCodigo: i + 1, cumplimientoProyectadoPct: 100 + i }),
    );
    const { topAhead, topBehind } = buildTopBottoms(rows);
    expect(topAhead).toHaveLength(5);
    expect(topBehind).toHaveLength(5);
  });

  it("no muta el array original", () => {
    const rows = [
      row({ vendedorCodigo: 1, cumplimientoProyectadoPct: 90 }),
      row({ vendedorCodigo: 2, cumplimientoProyectadoPct: 130 }),
    ];
    const original = [...rows];
    buildTopBottoms(rows);
    expect(rows).toEqual(original);
  });
});
