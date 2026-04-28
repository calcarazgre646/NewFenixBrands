/**
 * Tests para los helpers de pace + staircase (visualización de la curva
 * escalonada y delta al siguiente tramo).
 */
import { describe, it, expect } from "vitest";
import {
  getPaceBand,
  getNextTier,
  getDeltaToNextTier,
  buildStaircasePoints,
} from "../pace";
import { VENDEDOR_TIENDA, SUPERVISOR_TIENDA, VENDEDOR_UTP } from "../scales";

// ─── getPaceBand ────────────────────────────────────────────────────────────

describe("getPaceBand", () => {
  it("clasifica < 80% como behind", () => {
    expect(getPaceBand(0)).toBe("behind");
    expect(getPaceBand(50)).toBe("behind");
    expect(getPaceBand(79.9)).toBe("behind");
  });

  it("clasifica 80–100% como on-track", () => {
    expect(getPaceBand(80)).toBe("on-track");
    expect(getPaceBand(95)).toBe("on-track");
    expect(getPaceBand(99.9)).toBe("on-track");
  });

  it("clasifica ≥ 100% como ahead", () => {
    expect(getPaceBand(100)).toBe("ahead");
    expect(getPaceBand(150)).toBe("ahead");
    expect(getPaceBand(999)).toBe("ahead");
  });
});

// ─── getNextTier ────────────────────────────────────────────────────────────

describe("getNextTier", () => {
  it("retorna el primer tramo con minPct > cumplimiento", () => {
    // VENDEDOR_TIENDA: 0, 70, 80, 90, 100, 110, 120
    expect(getNextTier(VENDEDOR_TIENDA, 50)?.minPct).toBe(70);
    expect(getNextTier(VENDEDOR_TIENDA, 75)?.minPct).toBe(80);
    expect(getNextTier(VENDEDOR_TIENDA, 100)?.minPct).toBe(110);
  });

  it("retorna null cuando ya está en el último tramo", () => {
    // último tramo de VENDEDOR_TIENDA empieza en 120 con maxPct Infinity
    expect(getNextTier(VENDEDOR_TIENDA, 120)).toBeNull();
    expect(getNextTier(VENDEDOR_TIENDA, 999)).toBeNull();
  });
});

// ─── getDeltaToNextTier ─────────────────────────────────────────────────────

describe("getDeltaToNextTier", () => {
  it("calcula pct y ventas faltantes para llegar al siguiente tramo", () => {
    // ventaActual=7M sobre meta=10M → 70% → siguiente tramo 80% → faltan 10pts → 1M
    const r = getDeltaToNextTier(VENDEDOR_TIENDA, 7_000_000, 10_000_000);
    expect(r.nextTier?.minPct).toBe(80);
    expect(r.pctNeeded).toBeCloseTo(10, 5);
    expect(r.ventasNeeded).toBe(1_000_000);
  });

  it("retorna 0 cuando ya está en el último tramo", () => {
    const r = getDeltaToNextTier(VENDEDOR_TIENDA, 15_000_000, 10_000_000);
    expect(r.nextTier).toBeNull();
    expect(r.pctNeeded).toBe(0);
    expect(r.ventasNeeded).toBe(0);
  });

  it("retorna 0 cuando la meta es 0 (no hay base para calcular)", () => {
    const r = getDeltaToNextTier(VENDEDOR_TIENDA, 5_000_000, 0);
    expect(r.ventasNeeded).toBe(0);
  });

  it("redondea ventasNeeded hacia arriba (ceil) para no quedar corto", () => {
    // meta 10_000_001, cumpl 0% → al 70% faltan 7_000_000.7 → ceil → 7_000_001
    const r = getDeltaToNextTier(VENDEDOR_TIENDA, 0, 10_000_001);
    expect(r.ventasNeeded).toBe(7_000_001);
  });

  it("nunca retorna negativos para venta sobre el tramo actual", () => {
    // ventaActual=8M sobre meta=10M → 80% justo (mismo tramo que minPct=80)
    // siguiente tramo es 90 → faltan 10pts → 1M (no -10pts)
    const r = getDeltaToNextTier(VENDEDOR_TIENDA, 8_000_000, 10_000_000);
    expect(r.pctNeeded).toBeGreaterThanOrEqual(0);
    expect(r.ventasNeeded).toBeGreaterThanOrEqual(0);
  });
});

// ─── buildStaircasePoints ───────────────────────────────────────────────────

describe("buildStaircasePoints", () => {
  it("genera 2 puntos por tramo (start + end) para una escala percentage", () => {
    const points = buildStaircasePoints(VENDEDOR_TIENDA);
    // VENDEDOR_TIENDA tiene 7 tramos → 14 puntos
    expect(points).toHaveLength(14);
  });

  it("emite los pares (minPct, value) y (maxPct, value)", () => {
    const points = buildStaircasePoints(VENDEDOR_TIENDA);
    expect(points[0]).toEqual({ cumplimientoPct: 0, value: 0 });
    expect(points[1]).toEqual({ cumplimientoPct: 70, value: 0 });
    expect(points[2]).toEqual({ cumplimientoPct: 70, value: 0.85 });
    expect(points[3]).toEqual({ cumplimientoPct: 80, value: 0.85 });
  });

  it("cierra el último tramo (maxPct=Infinity) en xMax (default 150)", () => {
    const points = buildStaircasePoints(VENDEDOR_TIENDA);
    const last = points[points.length - 1];
    expect(last.cumplimientoPct).toBe(150);
    expect(last.value).toBe(1.35);
  });

  it("permite override de xMax", () => {
    const points = buildStaircasePoints(VENDEDOR_TIENDA, 200);
    expect(points[points.length - 1].cumplimientoPct).toBe(200);
  });

  it("funciona con escala de tipo fixed (supervisor_tienda)", () => {
    // SUPERVISOR_TIENDA tiene 4 tramos → 8 puntos. Valores son montos fijos.
    const points = buildStaircasePoints(SUPERVISOR_TIENDA);
    expect(points).toHaveLength(8);
    expect(points[2].value).toBe(600_000);
    expect(points[points.length - 1].value).toBe(800_000);
  });

  it("preserva el orden de los tramos", () => {
    const points = buildStaircasePoints(VENDEDOR_UTP);
    for (let i = 1; i < points.length; i++) {
      expect(points[i].cumplimientoPct).toBeGreaterThanOrEqual(points[i - 1].cumplimientoPct);
    }
  });
});
