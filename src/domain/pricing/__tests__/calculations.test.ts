import { describe, it, expect } from "vitest";
import {
  calcMBP,
  calcMBM,
  isNovelty,
  getPromotionStatus,
} from "../calculations";

describe("calcMBP — Margen Bruto Retail", () => {
  it("caso normal: PVP 100, costo 60 → 40%", () => {
    expect(calcMBP(100, 60)).toBe(40);
  });

  it("precisión: PVP 150.000, costo 90.000 → 40%", () => {
    expect(calcMBP(150_000, 90_000)).toBeCloseTo(40, 6);
  });

  it("costo = 0 → 100% (todo es margen)", () => {
    expect(calcMBP(100, 0)).toBe(100);
  });

  it("costo = PVP → 0%", () => {
    expect(calcMBP(100, 100)).toBe(0);
  });

  // ── Edge cases ─────────────────────────────────────────────────────────
  it("PVP = 0 → 0 (contract: division-by-zero)", () => {
    expect(calcMBP(0, 50)).toBe(0);
  });

  it("PVP negativo → 0 (contract: division-by-zero)", () => {
    expect(calcMBP(-100, 50)).toBe(0);
  });

  it("costo > PVP → margen negativo (contract: negative-margin, venta a pérdida)", () => {
    expect(calcMBP(100, 150)).toBe(-50);
  });

  it("costo mucho mayor a PVP → margen muy negativo", () => {
    expect(calcMBP(100, 300)).toBe(-200);
  });

  it("costo negativo (dato raro de ERP) → margen > 100", () => {
    // (100 − (−20)) / 100 × 100 = 120
    expect(calcMBP(100, -20)).toBe(120);
  });

  it("no retorna NaN ni Infinity bajo ningún input finito", () => {
    const cases: Array<[number, number]> = [
      [0, 0], [0, 100], [-1, -1], [100, 100], [1e-10, 1],
    ];
    for (const [pvp, costo] of cases) {
      const r = calcMBP(pvp, costo);
      expect(Number.isFinite(r)).toBe(true);
    }
  });
});

describe("calcMBM — Margen Bruto Mayorista", () => {
  it("caso normal: PVM 80, costo 60 → 25%", () => {
    expect(calcMBM(80, 60)).toBe(25);
  });

  it("PVM = 0 → 0 (contract: division-by-zero)", () => {
    expect(calcMBM(0, 50)).toBe(0);
  });

  it("PVM negativo → 0 (contract: division-by-zero)", () => {
    expect(calcMBM(-10, 5)).toBe(0);
  });

  it("costo > PVM → margen negativo", () => {
    expect(calcMBM(80, 100)).toBeCloseTo(-25, 6);
  });

  it("costo = 0 → 100%", () => {
    expect(calcMBM(80, 0)).toBe(100);
  });

  it("costo = PVM → 0%", () => {
    expect(calcMBM(80, 80)).toBe(0);
  });

  it("PVM < PVP (caso usual): MBM < MBP para mismo costo", () => {
    // Mismo costo 60, PVP 100 → MBP 40%; PVM 80 → MBM 25%
    expect(calcMBM(80, 60)).toBeLessThan(calcMBP(100, 60));
  });
});

describe("isNovelty — reutilizada de domain/depots", () => {
  it('estComercial = "lanzamiento" → true', () => {
    expect(isNovelty("lanzamiento")).toBe(true);
  });

  it('estComercial = "basico" → false', () => {
    expect(isNovelty("basico")).toBe(false);
  });

  it("estComercial vacío → false", () => {
    expect(isNovelty("")).toBe(false);
  });

  it('case-sensitive por convención existente: "LANZAMIENTO" → false', () => {
    // depots/calculations.ts usa comparación estricta (no toLowerCase).
    // Si este test falla, cambió la convención — coordinar con depots.
    expect(isNovelty("LANZAMIENTO")).toBe(false);
  });

  it("otros valores del ERP → false", () => {
    expect(isNovelty("continuidad")).toBe(false);
    expect(isNovelty("descontinuado")).toBe(false);
  });
});

describe("getPromotionStatus — placeholder hasta definición de cliente", () => {
  it("retorna estado neutro para cualquier SKU", () => {
    expect(getPromotionStatus("MACA004428")).toEqual({
      active: false,
      markdownPct: 0,
    });
  });

  it("retorna misma estructura para SKU vacío (nunca throw)", () => {
    expect(getPromotionStatus("")).toEqual({
      active: false,
      markdownPct: 0,
    });
  });

  it("es idempotente (dos llamadas devuelven igual resultado)", () => {
    expect(getPromotionStatus("SKU1")).toEqual(getPromotionStatus("SKU1"));
  });
});
