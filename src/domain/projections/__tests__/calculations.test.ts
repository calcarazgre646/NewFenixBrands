import { describe, it, expect } from "vitest";
import {
  calcDailyRunRate,
  projectMonthEnd,
  resolveMonthTime,
  buildSellerProjection,
  buildDailyProjectionSeries,
} from "../calculations";
import type { BuildProjectionInput, DailySalePoint, SellerIdentity } from "../types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SELLER_RETAIL: SellerIdentity = {
  vendedorCodigo: 101,
  vendedorNombre: "Vendedora Demo",
  rolComision: "vendedor_tienda",
  canal: "retail",
  sucursalCodigo: "TIENDA-01",
};

const SELLER_MAYORISTA: SellerIdentity = {
  vendedorCodigo: 201,
  vendedorNombre: "Vendedor Mayorista",
  rolComision: "vendedor_mayorista",
  canal: "mayorista",
  sucursalCodigo: null,
};

function evenDaily(n: number, perDay: number): DailySalePoint[] {
  const rows: DailySalePoint[] = [];
  for (let d = 1; d <= n; d++) rows.push({ day: d, ventaNeta: perDay });
  return rows;
}

// ─── calcDailyRunRate ───────────────────────────────────────────────────────

describe("calcDailyRunRate", () => {
  it("computes ventaAcumulada / días", () => {
    expect(calcDailyRunRate(10_000_000, 10)).toBe(1_000_000);
  });

  it("returns 0 when días <= 0 (no division by zero)", () => {
    expect(calcDailyRunRate(5_000_000, 0)).toBe(0);
    expect(calcDailyRunRate(5_000_000, -1)).toBe(0);
  });

  it("returns 0 when ventaAcumulada is 0", () => {
    expect(calcDailyRunRate(0, 10)).toBe(0);
  });
});

// ─── projectMonthEnd ────────────────────────────────────────────────────────

describe("projectMonthEnd", () => {
  it("projects ventaActual + ritmo × restantes", () => {
    // 10M acum, ritmo 1M/día, 20 restantes → 30M
    expect(projectMonthEnd(10_000_000, 1_000_000, 20)).toBe(30_000_000);
  });

  it("returns ventaActual when no días restantes (mes cerrado)", () => {
    expect(projectMonthEnd(50_000_000, 0, 0)).toBe(50_000_000);
    expect(projectMonthEnd(50_000_000, 1_000_000, 0)).toBe(50_000_000);
  });

  it("clamps negative días restantes to 0", () => {
    expect(projectMonthEnd(50_000_000, 1_000_000, -5)).toBe(50_000_000);
  });
});

// ─── resolveMonthTime ───────────────────────────────────────────────────────

describe("resolveMonthTime", () => {
  it("mes en curso: día calendario es transcurrido (inclusive)", () => {
    // Hoy 27/04/2026, mirando abril 2026 (30 días)
    const t = resolveMonthTime(2026, 4, 27, 4, 2026);
    expect(t.diasMes).toBe(30);
    expect(t.diasTranscurridos).toBe(27);
    expect(t.diasRestantes).toBe(3);
    expect(t.isMonthClosed).toBe(false);
    expect(t.isInProgress).toBe(true);
  });

  it("mes pasado del mismo año: cerrado, transcurridos = diasMes", () => {
    // Hoy 27/04/2026, mirando marzo 2026 (31 días)
    const t = resolveMonthTime(2026, 3, 27, 4, 2026);
    expect(t.diasMes).toBe(31);
    expect(t.diasTranscurridos).toBe(31);
    expect(t.diasRestantes).toBe(0);
    expect(t.isMonthClosed).toBe(true);
    expect(t.isInProgress).toBe(false);
  });

  it("mes futuro del mismo año: 0 transcurridos", () => {
    const t = resolveMonthTime(2026, 5, 27, 4, 2026);
    expect(t.diasTranscurridos).toBe(0);
    expect(t.diasRestantes).toBe(31);
    expect(t.isMonthClosed).toBe(false);
    expect(t.isInProgress).toBe(false);
  });

  it("año pasado: cerrado", () => {
    const t = resolveMonthTime(2025, 12, 27, 4, 2026);
    expect(t.diasTranscurridos).toBe(31);
    expect(t.isMonthClosed).toBe(true);
  });

  it("año futuro: cero transcurridos", () => {
    const t = resolveMonthTime(2027, 1, 27, 4, 2026);
    expect(t.diasTranscurridos).toBe(0);
    expect(t.isInProgress).toBe(false);
  });

  it("día 1 del mes en curso: 1 transcurrido (inclusive)", () => {
    const t = resolveMonthTime(2026, 4, 1, 4, 2026);
    expect(t.diasTranscurridos).toBe(1);
    expect(t.diasRestantes).toBe(29);
    expect(t.isInProgress).toBe(true);
  });

  it("último día del mes en curso: cerrado por clamp", () => {
    // 30 abril 2026 (último día)
    const t = resolveMonthTime(2026, 4, 30, 4, 2026);
    expect(t.diasTranscurridos).toBe(30);
    expect(t.diasRestantes).toBe(0);
    expect(t.isMonthClosed).toBe(true);
    expect(t.isInProgress).toBe(false);
  });

  it("calendarDay > diasMes (no debería pasar pero clamp seguro)", () => {
    // Febrero 2026 (28 días), pero calendar diría día 31 (improbable, defensivo)
    const t = resolveMonthTime(2026, 2, 31, 2, 2026);
    expect(t.diasTranscurridos).toBe(28);
    expect(t.diasRestantes).toBe(0);
  });

  it("año bisiesto: febrero 29 días", () => {
    const t = resolveMonthTime(2024, 2, 15, 3, 2024);
    expect(t.diasMes).toBe(29);
    expect(t.isMonthClosed).toBe(true);
  });
});

// ─── buildSellerProjection ──────────────────────────────────────────────────

describe("buildSellerProjection · mes en curso con meta", () => {
  it("Retail: proyecta linealmente y calcula comisión actual + proyectada", () => {
    // Vendedor tienda con ritmo 1M/día durante 10 días
    // Mes calendario: abril 2026 (30 días). Hoy día 10.
    // Meta 30M (ritmo lineal lo cumple exacto a fin de mes)
    const input: BuildProjectionInput = {
      seller: SELLER_RETAIL,
      daily: evenDaily(10, 1_000_000),
      año: 2026,
      mes: 4,
      metaVentas: 30_000_000,
      calendarDay: 10,
      calendarMonth: 4,
      calendarYear: 2026,
    };

    const r = buildSellerProjection(input);

    expect(r.diasTranscurridos).toBe(10);
    expect(r.diasRestantes).toBe(20);
    expect(r.ventaActual).toBe(10_000_000);
    expect(r.ritmoDiario).toBe(1_000_000);
    expect(r.ventaProyectada).toBe(30_000_000);
    expect(r.cumplimientoActualPct).toBeCloseTo(33.33, 1);
    expect(r.cumplimientoProyectadoPct).toBe(100);
    expect(r.hasMeta).toBe(true);
    expect(r.isInProgress).toBe(true);
    expect(r.isMonthClosed).toBe(false);
    // Comisión actual: cumplimiento 33% cae en tramo 0-70% (value=0) → 0
    expect(r.comisionActualGs).toBe(0);
    // Comisión proyectada: cumplimiento 100% cae en tramo 100-110% (value=1.15%)
    // ventaProyectada 30M × 1.15% = 345.000
    expect(r.comisionProyectadaGs).toBe(345_000);
    expect(r.comisionProyectadaPct).toBe(1.15);
  });

  it("ignora ventas registradas en días futuros (defensivo)", () => {
    // Hay una venta el día 20 pero hoy es día 10 → no se cuenta
    const daily: DailySalePoint[] = [
      ...evenDaily(10, 1_000_000),
      { day: 20, ventaNeta: 999_999_999 },
    ];
    const r = buildSellerProjection({
      seller: SELLER_RETAIL,
      daily,
      año: 2026,
      mes: 4,
      metaVentas: 30_000_000,
      calendarDay: 10,
      calendarMonth: 4,
      calendarYear: 2026,
    });
    expect(r.ventaActual).toBe(10_000_000);
  });
});

describe("buildSellerProjection · mes cerrado", () => {
  it("ventaProyectada = ventaActual (no hay días futuros)", () => {
    const r = buildSellerProjection({
      seller: SELLER_RETAIL,
      daily: evenDaily(31, 1_000_000), // 31M en marzo 2026 (31 días)
      año: 2026,
      mes: 3,
      metaVentas: 30_000_000,
      calendarDay: 27,
      calendarMonth: 4,
      calendarYear: 2026,
    });
    expect(r.diasRestantes).toBe(0);
    expect(r.ventaActual).toBe(31_000_000);
    expect(r.ventaProyectada).toBe(31_000_000);
    expect(r.isMonthClosed).toBe(true);
    expect(r.cumplimientoProyectadoPct).toBeCloseTo(103.33, 1);
  });
});

describe("buildSellerProjection · mes futuro", () => {
  it("todo en 0", () => {
    const r = buildSellerProjection({
      seller: SELLER_RETAIL,
      daily: [],
      año: 2026,
      mes: 5,
      metaVentas: 30_000_000,
      calendarDay: 27,
      calendarMonth: 4,
      calendarYear: 2026,
    });
    expect(r.diasTranscurridos).toBe(0);
    expect(r.ventaActual).toBe(0);
    expect(r.ritmoDiario).toBe(0);
    expect(r.ventaProyectada).toBe(0);
    expect(r.cumplimientoProyectadoPct).toBe(0);
    expect(r.isInProgress).toBe(false);
  });
});

describe("buildSellerProjection · sin meta (Mayorista/UTP pendiente)", () => {
  it("metaVentas null → cumplimientos y comisiones quedan en null", () => {
    const r = buildSellerProjection({
      seller: SELLER_MAYORISTA,
      daily: evenDaily(10, 2_000_000),
      año: 2026,
      mes: 4,
      metaVentas: null,
      calendarDay: 10,
      calendarMonth: 4,
      calendarYear: 2026,
    });
    expect(r.ventaActual).toBe(20_000_000);
    expect(r.ventaProyectada).toBe(60_000_000);
    expect(r.metaVentas).toBeNull();
    expect(r.cumplimientoActualPct).toBeNull();
    expect(r.cumplimientoProyectadoPct).toBeNull();
    expect(r.comisionActualGs).toBeNull();
    expect(r.comisionProyectadaGs).toBeNull();
    expect(r.comisionProyectadaPct).toBeNull();
    expect(r.hasMeta).toBe(false);
  });

  it("metaVentas 0 también se trata como sin meta", () => {
    const r = buildSellerProjection({
      seller: SELLER_RETAIL,
      daily: evenDaily(10, 1_000_000),
      año: 2026,
      mes: 4,
      metaVentas: 0,
      calendarDay: 10,
      calendarMonth: 4,
      calendarYear: 2026,
    });
    expect(r.hasMeta).toBe(false);
    expect(r.cumplimientoProyectadoPct).toBeNull();
  });
});

describe("buildSellerProjection · día 1 del mes", () => {
  it("ritmo = venta del día 1, proyecta 30× ese ritmo", () => {
    const r = buildSellerProjection({
      seller: SELLER_RETAIL,
      daily: [{ day: 1, ventaNeta: 1_500_000 }],
      año: 2026,
      mes: 4,
      metaVentas: 30_000_000,
      calendarDay: 1,
      calendarMonth: 4,
      calendarYear: 2026,
    });
    expect(r.diasTranscurridos).toBe(1);
    expect(r.diasRestantes).toBe(29);
    expect(r.ventaActual).toBe(1_500_000);
    expect(r.ritmoDiario).toBe(1_500_000);
    // proyección = 1.5M + 1.5M × 29 = 45M
    expect(r.ventaProyectada).toBe(45_000_000);
  });
});

// ─── buildDailyProjectionSeries ─────────────────────────────────────────────

describe("buildDailyProjectionSeries · mes en curso", () => {
  it("genera puntos para todos los días del mes", () => {
    const points = buildDailyProjectionSeries(
      evenDaily(10, 1_000_000), 2026, 4, 10, 4, 2026, 30_000_000,
    );
    expect(points).toHaveLength(30); // abril
  });

  it("días pasados/hoy traen real y acumulado real; futuros sólo proyección", () => {
    const points = buildDailyProjectionSeries(
      evenDaily(10, 1_000_000), 2026, 4, 10, 4, 2026, 30_000_000,
    );
    // Día 5 (pasado): venta real, acumulado real
    expect(points[4].ventaDia).toBe(1_000_000);
    expect(points[4].ventaAcumReal).toBe(5_000_000);
    expect(points[4].ventaAcumProyectada).toBe(5_000_000);

    // Día 10 (hoy): real
    expect(points[9].ventaDia).toBe(1_000_000);
    expect(points[9].ventaAcumReal).toBe(10_000_000);
    expect(points[9].isToday).toBe(true);

    // Día 15 (futuro): null real, proyectada lineal
    expect(points[14].ventaDia).toBeNull();
    expect(points[14].ventaAcumReal).toBeNull();
    // Día 15 = 10 transcurridos + 5 offset × 1M ritmo = 15M
    expect(points[14].ventaAcumProyectada).toBe(15_000_000);
  });

  it("acumulado meta es lineal (meta/diasMes × día)", () => {
    const points = buildDailyProjectionSeries(
      [], 2026, 4, 10, 4, 2026, 30_000_000,
    );
    // 30M / 30 días = 1M por día
    expect(points[0].ventaAcumMeta).toBe(1_000_000);
    expect(points[14].ventaAcumMeta).toBe(15_000_000);
    expect(points[29].ventaAcumMeta).toBe(30_000_000);
  });

  it("sin meta → ventaAcumMeta null en todos los puntos", () => {
    const points = buildDailyProjectionSeries(
      evenDaily(10, 1_000_000), 2026, 4, 10, 4, 2026, null,
    );
    for (const p of points) expect(p.ventaAcumMeta).toBeNull();
  });

  it("mes cerrado: todos los días son reales, ninguno es 'hoy'", () => {
    const points = buildDailyProjectionSeries(
      evenDaily(31, 1_000_000), 2026, 3, 27, 4, 2026, 30_000_000,
    );
    expect(points).toHaveLength(31);
    expect(points[30].ventaAcumReal).toBe(31_000_000);
    expect(points[30].ventaAcumProyectada).toBe(31_000_000);
    for (const p of points) expect(p.isToday).toBe(false);
  });

  it("mes futuro: todos los días son 'futuro', proyección = 0 (sin ritmo)", () => {
    const points = buildDailyProjectionSeries(
      [], 2026, 5, 27, 4, 2026, 30_000_000,
    );
    expect(points).toHaveLength(31);
    for (const p of points) {
      expect(p.ventaDia).toBeNull();
      expect(p.ventaAcumReal).toBeNull();
      expect(p.ventaAcumProyectada).toBe(0);
    }
  });

  it("día 1: solo el día 1 trae real", () => {
    const points = buildDailyProjectionSeries(
      [{ day: 1, ventaNeta: 1_500_000 }], 2026, 4, 1, 4, 2026, 30_000_000,
    );
    expect(points[0].ventaAcumReal).toBe(1_500_000);
    expect(points[0].isToday).toBe(true);
    expect(points[1].ventaAcumReal).toBeNull();
    // Día 2 proyectado = 1.5M + 1.5M × 1 = 3M
    expect(points[1].ventaAcumProyectada).toBe(3_000_000);
  });

  it("agrega múltiples ventas del mismo día", () => {
    const daily: DailySalePoint[] = [
      { day: 1, ventaNeta: 500_000 },
      { day: 1, ventaNeta: 300_000 },
      { day: 2, ventaNeta: 200_000 },
    ];
    const points = buildDailyProjectionSeries(daily, 2026, 4, 2, 4, 2026, null);
    expect(points[0].ventaAcumReal).toBe(800_000);
    expect(points[1].ventaAcumReal).toBe(1_000_000);
  });
});
