/**
 * Tests para simulateAdditionalSales — what-if simulator que reusa
 * calcCommission para mantener consistencia con el motor de comisiones.
 */
import { describe, it, expect } from "vitest";
import { simulateAdditionalSales } from "../whatif";
import { VENDEDOR_TIENDA, VENDEDOR_MAYORISTA } from "../scales";
import type { SellerProjection } from "@/domain/projections/types";

function projection(overrides: Partial<SellerProjection> = {}): SellerProjection {
  return {
    vendedorCodigo: 100,
    vendedorNombre: "Test Vendedor",
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
    comisionActualGs: 0,
    comisionProyectadaGs: 115_000, // 10M × 1.15% (cumplimiento 100% cae en tramo [100,120))
    comisionProyectadaPct: 1.15,
    metaCobranza: null,
    cobranzaActual: null,
    cumplimientoCobranzaPct: null,
    comisionCobranzaActualGs: null,
    dsoDias: null,
    hasMeta: true,
    isMonthClosed: false,
    isInProgress: true,
    ...overrides,
  };
}

describe("simulateAdditionalSales", () => {
  it("agrega ventas adicionales a la proyección base", () => {
    const r = simulateAdditionalSales(
      projection(),
      VENDEDOR_TIENDA,
      { additionalGs: 1_000_000 },
    );
    expect(r.ventaProyectadaOriginal).toBe(10_000_000);
    expect(r.ventaProyectadaSimulada).toBe(11_000_000);
  });

  it("recalcula la comisión usando el motor real (calcCommission)", () => {
    // Con meta=10M y proyección=11M → cumplimiento 110% → tramo [110,120) = 1.25%
    // 11M × 1.25% = 137_500
    const r = simulateAdditionalSales(
      projection(),
      VENDEDOR_TIENDA,
      { additionalGs: 1_000_000 },
    );
    expect(r.cumplimientoSimuladoPct).toBe(110);
    expect(r.comisionSimuladaGs).toBe(137_500);
  });

  it("calcula el delta vs la comisión proyectada original", () => {
    const base = projection({ comisionProyectadaGs: 115_000 });
    const r = simulateAdditionalSales(base, VENDEDOR_TIENDA, { additionalGs: 1_000_000 });
    expect(r.comisionOriginalGs).toBe(115_000);
    expect(r.deltaComisionGs).toBe(r.comisionSimuladaGs - 115_000);
  });

  it("clampea additionalGs negativo a 0 (no permite restar ventas)", () => {
    const r = simulateAdditionalSales(
      projection(),
      VENDEDOR_TIENDA,
      { additionalGs: -500_000 },
    );
    expect(r.ventaProyectadaSimulada).toBe(r.ventaProyectadaOriginal);
    expect(r.deltaComisionGs).toBe(0);
  });

  it("marca metaPendiente=true cuando la proyección no tiene meta", () => {
    const sinMeta = projection({
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
    const r = simulateAdditionalSales(sinMeta, VENDEDOR_MAYORISTA, { additionalGs: 1_000_000 });
    expect(r.metaPendiente).toBe(true);
    expect(r.comisionSimuladaGs).toBe(0);
    expect(r.deltaComisionGs).toBe(0);
  });

  it("comisión original null cuenta como 0 en el delta (Mayorista/UTP sin meta)", () => {
    const sinComision = projection({
      comisionActualGs: null,
      comisionProyectadaGs: null,
    });
    const r = simulateAdditionalSales(sinComision, VENDEDOR_TIENDA, { additionalGs: 0 });
    expect(r.comisionOriginalGs).toBe(0);
  });

  it("additionalGs=0 reproduce la proyección original (idempotencia)", () => {
    const base = projection();
    const r = simulateAdditionalSales(base, VENDEDOR_TIENDA, { additionalGs: 0 });
    expect(r.ventaProyectadaSimulada).toBe(base.ventaProyectada);
    expect(r.cumplimientoSimuladoPct).toBe(base.cumplimientoProyectadoPct);
  });

  it("respeta el rolComision para escoger el tramo correcto", () => {
    // VENDEDOR_MAYORISTA con cumplimiento 100% (en tramo [100,110)) → 1.15%
    const mayorista = projection({
      rolComision: "vendedor_mayorista",
      canal: "mayorista",
      ventaProyectada: 9_000_000,
      metaVentas: 10_000_000,
    });
    const r = simulateAdditionalSales(mayorista, VENDEDOR_MAYORISTA, { additionalGs: 1_000_000 });
    expect(r.cumplimientoSimuladoPct).toBe(100);
    expect(r.comisionSimuladaGs).toBe(Math.round(10_000_000 * 0.0115));
  });
});
