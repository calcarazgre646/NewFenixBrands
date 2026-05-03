import { describe, expect, it } from "vitest";
import {
  buildHeadline,
  buildMonthlyLine,
  classifyMomentum,
  formatDateShort,
  formatDelta,
  formatPyg,
  freshnessAge,
  parsePulsePayload,
} from "../narrative";

describe("parsePulsePayload", () => {
  it("retorna payload tipado y completo desde jsonb crudo bien formado", () => {
    const raw = {
      week_start: "2026-04-27",
      week_end:   "2026-05-03",
      iso_week:   18,
      year:       2026,
      sales: {
        neto_week:      123_000_000,
        units_week:     450,
        neto_prev_week: 100_000_000,
        neto_year_ago:  90_000_000,
        wow_pct:        23.0,
        yoy_pct:        36.7,
      },
      monthly: {
        month_label:        "Mayo 2026",
        month_actual:       50_000_000,
        month_target:       70_000_000,
        month_progress_pct: 71.4,
        days_elapsed:       3,
        days_in_month:      31,
        run_rate_projection: 516_666_667,
        gap_to_target:      0,
      },
      movers: {
        brands: [{ name: "Martel",  neto: 50_000_000, neto_prev: 40_000_000, wow_pct: 25 }],
        skus:   [{ sku: "S1", description: "Camisa", brand: "Martel", units: 10, neto: 1_000_000 }],
        stores: [{ store: "ESTRELLA", channel: "B2C", neto: 20_000_000, neto_prev: 18_000_000, wow_pct: 11.1 }],
      },
      alerts: {
        novelty_undistributed: { count: 2, examples: [{ sku: "X", description: "P", brand: "Lee", units: 12 }] },
        low_sell_through_30d:  { count: 1, examples: [{ sku: "Y", description: "Q", brand: "Wrangler", units_received: 30, sth_pct: 12.0 }] },
        dso: { current_days: 42, four_weeks_ago_days: 38, cxc_current: 5_000_000_000, cxc_four_weeks_ago: 4_500_000_000 },
      },
      freshness: {
        sources: [{ source_name: "mv_ventas_diarias", refreshed_at: "2026-05-04T10:15:00Z", status: "ok" }],
        max_data_date: "2026-05-03",
      },
    };
    const p = parsePulsePayload(raw);
    expect(p.weekStart).toBe("2026-04-27");
    expect(p.sales.wowPct).toBe(23);
    expect(p.movers.skus[0].description).toBe("Camisa");
    expect(p.movers.stores[0].channel).toBe("B2C");
    expect(p.alerts.dso.currentDays).toBe(42);
    expect(p.freshness.sources[0].sourceName).toBe("mv_ventas_diarias");
  });

  it("es defensivo ante input vacío", () => {
    const p = parsePulsePayload({});
    expect(p.weekStart).toBe("");
    expect(p.sales.netoWeek).toBe(0);
    expect(p.sales.wowPct).toBeNull();
    expect(p.movers.brands).toEqual([]);
    expect(p.alerts.noveltyUndistributed.count).toBe(0);
    expect(p.alerts.dso.currentDays).toBeNull();
    expect(p.freshness.sources).toEqual([]);
    expect(p.freshness.maxDataDate).toBeNull();
  });

  it("normaliza canal de tiendas a B2C cuando viene mal", () => {
    const p = parsePulsePayload({
      movers: { stores: [{ store: "X", channel: "WEIRD", neto: 100, neto_prev: 0, wow_pct: null }] },
    });
    expect(p.movers.stores[0].channel).toBe("B2C");
  });

  it("convierte wow_pct null/inválido a null en lugar de NaN", () => {
    const p = parsePulsePayload({
      sales: { neto_week: 100, neto_prev_week: 0, wow_pct: null, yoy_pct: "not a number" },
    });
    expect(p.sales.wowPct).toBeNull();
    expect(p.sales.yoyPct).toBeNull();
  });

  it("usa sku como description fallback cuando viene vacía", () => {
    const p = parsePulsePayload({
      movers: { skus: [{ sku: "ABC123", description: "", brand: "Lee", units: 1, neto: 100 }] },
    });
    expect(p.movers.skus[0].description).toBe("ABC123");
  });
});

describe("formatPyg / formatDelta", () => {
  it("formatea guaraníes con separador paraguayo", () => {
    expect(formatPyg(1_234_567)).toBe("Gs. 1.234.567");
  });

  it("redondea decimales antes de formatear", () => {
    expect(formatPyg(1234.7)).toBe("Gs. 1.235");
  });

  it("formatea delta positivo, negativo, cero y null", () => {
    expect(formatDelta(12.5)).toBe("▲ +12.5%");
    expect(formatDelta(-3.2)).toBe("▼ -3.2%");
    expect(formatDelta(0)).toBe("= 0.0%");
    expect(formatDelta(null)).toBe("—");
  });
});

describe("formatDateShort", () => {
  it("convierte ISO date a 'DD MMM' en español", () => {
    expect(formatDateShort("2026-04-27")).toBe("27 abr");
    expect(formatDateShort("2026-05-03")).toBe("3 may");
  });

  it("retorna el input cuando no parsea", () => {
    expect(formatDateShort("invalid")).toBe("invalid");
  });
});

describe("classifyMomentum", () => {
  it.each([
    [25,   "se disparó"],
    [10,   "creció"],
    [0,    "se mantuvo"],
    [-10,  "cayó"],
    [-25,  "se desplomó"],
  ])("WoW %i%% → %s", (pct, expected) => {
    expect(classifyMomentum(pct)).toBe(expected);
  });

  it("null → 'sin base de comparación'", () => {
    expect(classifyMomentum(null)).toBe("sin base de comparación");
  });
});

describe("buildHeadline", () => {
  it("incluye semana, fechas, ventas y deltas", () => {
    const p = parsePulsePayload({
      iso_week: 18, week_start: "2026-04-27", week_end: "2026-05-03",
      sales: { neto_week: 123_000_000, neto_prev_week: 100_000_000, wow_pct: 23, yoy_pct: 12 },
    });
    expect(buildHeadline(p)).toBe(
      "Semana 18 (27 abr – 3 may): Gs. 123.000.000 · ▲ +23.0% WoW · ▲ +12.0% YoY",
    );
  });

  it("omite WoW/YoY cuando son null", () => {
    const p = parsePulsePayload({
      iso_week: 1, week_start: "2026-01-05", week_end: "2026-01-11",
      sales: { neto_week: 10_000_000 },
    });
    expect(buildHeadline(p)).toBe("Semana 1 (5 ene – 11 ene): Gs. 10.000.000");
  });
});

describe("buildMonthlyLine", () => {
  it("muestra acumulado + meta + gap cuando target>0", () => {
    const line = buildMonthlyLine({
      monthLabel: "Mayo 2026", monthActual: 50_000_000, monthTarget: 70_000_000,
      monthProgressPct: 71.4, daysElapsed: 3, daysInMonth: 31,
      runRateProjection: 516_666_667, gapToTarget: 0,
    });
    expect(line).toContain("Mayo 2026: 71% del target");
    expect(line).toContain("proyección de cierre Gs. 516.666.667");
    expect(line).toContain("proyectamos superar la meta");
  });

  it("muestra 'sin meta cargada' cuando target=0", () => {
    const line = buildMonthlyLine({
      monthLabel: "Mayo 2026", monthActual: 50_000_000, monthTarget: 0,
      monthProgressPct: null, daysElapsed: 3, daysInMonth: 31,
      runRateProjection: 0, gapToTarget: 0,
    });
    expect(line).toBe("Mayo 2026: Gs. 50.000.000 acumulado · sin meta cargada");
  });

  it("incluye gap cuando run-rate proyecta por debajo del target", () => {
    const line = buildMonthlyLine({
      monthLabel: "Mayo 2026", monthActual: 10_000_000, monthTarget: 70_000_000,
      monthProgressPct: 14.3, daysElapsed: 3, daysInMonth: 31,
      runRateProjection: 60_000_000, gapToTarget: 10_000_000,
    });
    expect(line).toContain("faltan Gs. 10.000.000 para llegar");
  });
});

describe("freshnessAge", () => {
  const NOW = new Date("2026-05-04T12:00:00Z");

  it("calcula horas desde la fuente más rezagada", () => {
    const r = freshnessAge({
      sources: [
        { sourceName: "mv_ventas_diarias", refreshedAt: "2026-05-04T11:15:00Z", status: "ok" },
        { sourceName: "mv_stock_tienda",   refreshedAt: "2026-05-04T08:15:00Z", status: "ok" },
      ],
      maxDataDate: "2026-05-03",
    }, NOW);
    expect(r.hoursAgo).toBeCloseTo(3.75, 1);
    expect(r.stale).toBe(false);
  });

  it("marca stale cuando supera 24h", () => {
    const r = freshnessAge({
      sources: [{ sourceName: "x", refreshedAt: "2026-05-02T11:00:00Z", status: "ok" }],
      maxDataDate: "2026-05-02",
    }, NOW);
    expect(r.stale).toBe(true);
  });

  it("devuelve infinity cuando no hay fuentes", () => {
    const r = freshnessAge({ sources: [], maxDataDate: null }, NOW);
    expect(r.hoursAgo).toBe(Infinity);
    expect(r.stale).toBe(true);
    expect(r.lastRefresh).toBeNull();
  });
});
