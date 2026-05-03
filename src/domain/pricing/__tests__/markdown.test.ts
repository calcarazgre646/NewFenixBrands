import { describe, it, expect } from "vitest";
import {
  applyMarkdown,
  calcMbpEffective,
  isValidMarkdownPct,
  validateMarkdownPct,
  MARKDOWN_PCT_MIN,
  MARKDOWN_PCT_MAX,
} from "../markdown";
import { calcMBP, MIN_VALID_PRICE } from "../calculations";

describe("applyMarkdown", () => {
  it("caso normal: PVP 100.000, 25% → 75.000", () => {
    expect(applyMarkdown(100_000, 25)).toBe(75_000);
  });

  it("redondea a entero (Gs. no tienen decimales)", () => {
    // 99.999 × 0.85 = 84_999.15 → 84_999
    expect(applyMarkdown(99_999, 15)).toBe(84_999);
  });

  it("markdown del máximo 90% → 10% del original", () => {
    expect(applyMarkdown(100_000, 90)).toBe(10_000);
  });

  it("PVP placeholder (< MIN_VALID_PRICE) NO aplica markdown — devuelve pvp tal cual", () => {
    expect(applyMarkdown(1, 50)).toBe(1);
    expect(applyMarkdown(0, 25)).toBe(0);
  });

  it("pct fuera de rango → no aplica (devuelve pvp original)", () => {
    expect(applyMarkdown(100_000, 0)).toBe(100_000);
    expect(applyMarkdown(100_000, -10)).toBe(100_000);
    expect(applyMarkdown(100_000, 95)).toBe(100_000);
    expect(applyMarkdown(100_000, NaN)).toBe(100_000);
  });

  it("nunca retorna NaN ni Infinity", () => {
    const cases: Array<[number, number]> = [
      [100, 50], [0, 0], [100_000, 90], [1, 1], [1e9, 1e-6],
    ];
    for (const [pvp, pct] of cases) {
      expect(Number.isFinite(applyMarkdown(pvp, pct))).toBe(true);
    }
  });
});

describe("calcMbpEffective", () => {
  it("PVP 100.000, costo 60.000, markdown 25% → MBP sobre 75.000", () => {
    // Efectivo: 75.000. Margen: (75000 − 60000) / 75000 = 20%
    expect(calcMbpEffective(100_000, 60_000, 25)).toBeCloseTo(20, 6);
  });

  it("markdown agresivo puede llevar el margen a negativo", () => {
    // PVP 100.000, costo 80.000. Sin markdown: MBP = 20%.
    // Con 50% markdown → efectivo 50.000 < costo 80.000 → margen negativo.
    expect(calcMbpEffective(100_000, 80_000, 50)).toBeLessThan(0);
  });

  it("markdown 0 (inválido) deja el margen igual al de calcMBP", () => {
    expect(calcMbpEffective(100_000, 60_000, 0)).toBe(calcMBP(100_000, 60_000));
  });

  it("PVP placeholder → 0 (delega a calcMBP)", () => {
    expect(calcMbpEffective(1, 100, 25)).toBe(0);
    expect(calcMbpEffective(MIN_VALID_PRICE - 0.01, 100, 25)).toBe(0);
  });
});

describe("isValidMarkdownPct", () => {
  it("acepta el rango (MIN, MAX]", () => {
    expect(isValidMarkdownPct(MARKDOWN_PCT_MIN)).toBe(true);
    expect(isValidMarkdownPct(25)).toBe(true);
    expect(isValidMarkdownPct(MARKDOWN_PCT_MAX)).toBe(true);
  });

  it("rechaza fuera de rango", () => {
    expect(isValidMarkdownPct(0)).toBe(false);
    expect(isValidMarkdownPct(-1)).toBe(false);
    expect(isValidMarkdownPct(MARKDOWN_PCT_MAX + 0.01)).toBe(false);
    expect(isValidMarkdownPct(100)).toBe(false);
  });

  it("rechaza no-finitos", () => {
    expect(isValidMarkdownPct(NaN)).toBe(false);
    expect(isValidMarkdownPct(Infinity)).toBe(false);
    expect(isValidMarkdownPct(-Infinity)).toBe(false);
  });
});

describe("validateMarkdownPct", () => {
  it("ok=true para valor válido", () => {
    expect(validateMarkdownPct(25)).toEqual({ ok: true });
  });

  it("ok=false con error 'out_of_range' para 0 o 100", () => {
    expect(validateMarkdownPct(0).error).toBe("out_of_range");
    expect(validateMarkdownPct(100).error).toBe("out_of_range");
  });

  it("ok=false con error 'not_a_number' para NaN", () => {
    expect(validateMarkdownPct(NaN).error).toBe("not_a_number");
  });

  it("mensaje de error es human-readable y menciona el rango", () => {
    const r = validateMarkdownPct(150);
    expect(r.message).toContain(String(MARKDOWN_PCT_MIN));
    expect(r.message).toContain(String(MARKDOWN_PCT_MAX));
  });
});
