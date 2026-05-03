import { describe, it, expect } from "vitest";
import {
  calcMBP,
  calcMBM,
  isNovelty,
  NO_PROMOTION,
  MIN_VALID_PRICE,
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
  it("PVP = 0 → 0 (contract: erp-placeholder)", () => {
    expect(calcMBP(0, 50)).toBe(0);
  });

  it("PVP negativo → 0 (contract: erp-placeholder)", () => {
    expect(calcMBP(-100, 50)).toBe(0);
  });

  it("PVP = 1 (placeholder ERP) → 0 — sin esto los promedios explotan", () => {
    // Caso real reproducido en BD: SKU WRCA009862 tiene una fila con
    // pvp=1 mientras las otras 6 traen pvp=320000. Sin el guard este
    // valor produce MBP de ~-17 millones de %.
    expect(calcMBP(1, 172446)).toBe(0);
  });

  it("PVP justo bajo el threshold → 0", () => {
    expect(calcMBP(MIN_VALID_PRICE - 0.01, 100)).toBe(0);
  });

  it("PVP = MIN_VALID_PRICE → calcula normalmente (boundary inclusivo)", () => {
    // (10 − 6) / 10 × 100 = 40
    expect(calcMBP(MIN_VALID_PRICE, 6)).toBe(40);
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
      [0, 0], [0, 100], [-1, -1], [100, 100], [1e-10, 1], [1, 999999],
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

  it("PVM = 0 → 0 (contract: erp-placeholder)", () => {
    expect(calcMBM(0, 50)).toBe(0);
  });

  it("PVM negativo → 0 (contract: erp-placeholder)", () => {
    expect(calcMBM(-10, 5)).toBe(0);
  });

  it("PVM = 1 (placeholder ERP) → 0", () => {
    // En BD aparece pvm=1 en filas individuales — caso típico.
    expect(calcMBM(1, 172446)).toBe(0);
  });

  it("PVM justo bajo el threshold → 0", () => {
    expect(calcMBM(MIN_VALID_PRICE - 0.01, 100)).toBe(0);
  });

  it("PVM = MIN_VALID_PRICE → calcula normalmente (boundary inclusivo)", () => {
    expect(calcMBM(MIN_VALID_PRICE, 6)).toBe(40);
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

describe("MIN_VALID_PRICE — guard contra placeholders ERP", () => {
  it("expone el threshold como constante exportada", () => {
    expect(MIN_VALID_PRICE).toBeGreaterThan(0);
    // ERP usa 0/1 como placeholders — el threshold debe excluirlos.
    expect(MIN_VALID_PRICE).toBeGreaterThan(1);
  });

  it("threshold actual es 10 Gs. (cualquier indumentaria real cuesta >>10 Gs.)", () => {
    expect(MIN_VALID_PRICE).toBe(10);
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

describe("NO_PROMOTION — estado neutro para SKUs sin markdown", () => {
  it("active=false, markdownPct=0", () => {
    expect(NO_PROMOTION).toEqual({ active: false, markdownPct: 0 });
  });
});
