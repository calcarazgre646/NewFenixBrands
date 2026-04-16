import { describe, it, expect } from "vitest";
import {
  evaluateLinealidad,
  findBracket,
  DEFAULT_LINEALIDAD_THRESHOLDS,
} from "../linealidad";
import type { ProductType, AgeBracket } from "../types";

// ─── findBracket ────────────────────────────────────────────────────────────

describe("findBracket", () => {
  it("age < 15 → null", () => expect(findBracket(10)).toBeNull());
  it("age = 15 → 15", () => expect(findBracket(15)).toBe(15));
  it("age = 29 → 15", () => expect(findBracket(29)).toBe(15));
  it("age = 30 → 30", () => expect(findBracket(30)).toBe(30));
  it("age = 47 → 45", () => expect(findBracket(47)).toBe(45));
  it("age = 90 → 90", () => expect(findBracket(90)).toBe(90));
  it("age = 200 → 90 (capped at max)", () => expect(findBracket(200)).toBe(90));
  it("age = 0 → null", () => expect(findBracket(0)).toBeNull());
});

// ─── evaluateLinealidad — threshold table ───────────────────────────────────

describe("evaluateLinealidad", () => {
  // Verify all 18 cells of Rodrigo's matrix
  const matrix: Array<[ProductType, AgeBracket, number]> = [
    ["carry_over", 15, 20], ["carry_over", 30, 40], ["carry_over", 45, 50],
    ["carry_over", 60, 65], ["carry_over", 75, 80], ["carry_over", 90, 95],
    ["basicos", 15, 15], ["basicos", 30, 30], ["basicos", 45, 40],
    ["basicos", 60, 55], ["basicos", 75, 70], ["basicos", 90, 85],
    ["temporada", 15, 10], ["temporada", 30, 20], ["temporada", 45, 30],
    ["temporada", 60, 45], ["temporada", 75, 60], ["temporada", 90, 75],
  ];

  for (const [type, bracket, threshold] of matrix) {
    it(`${type} at ${bracket}d with STH below ${threshold}% → triggers action`, () => {
      const result = evaluateLinealidad(type, bracket, threshold - 1);
      expect(result.isBelowThreshold).toBe(true);
      expect(result.action).not.toBeNull();
      expect(result.requiredSth).toBe(threshold);
      expect(result.responsibleRoles.length).toBeGreaterThan(0);
    });

    it(`${type} at ${bracket}d with STH at ${threshold}% → ${bracket === 90 ? "forced action (mandatory exit)" : "no action"}`, () => {
      const result = evaluateLinealidad(type, bracket, threshold);
      if (bracket === 90) {
        // Rodrigo's rule: at 90d+, ALL SKUs must have action — mandatory exit
        expect(result.isBelowThreshold).toBe(true);
        expect(result.action).toBe("markdown_liquidacion");
      } else {
        expect(result.isBelowThreshold).toBe(false);
        expect(result.action).toBeNull();
        expect(result.responsibleRoles).toEqual([]);
      }
    });
  }

  // Edge cases
  it("age < 15 → no bracket, no action", () => {
    const result = evaluateLinealidad("basicos", 10, 0);
    expect(result.isBelowThreshold).toBe(false);
    expect(result.action).toBeNull();
  });

  it("age = 0 → no bracket, no action", () => {
    const result = evaluateLinealidad("carry_over", 0, 0);
    expect(result.isBelowThreshold).toBe(false);
  });

  it("age = 200 (>90) → uses bracket 90", () => {
    const result = evaluateLinealidad("basicos", 200, 50);
    expect(result.bracket).toBe(90);
    expect(result.requiredSth).toBe(85);
    expect(result.isBelowThreshold).toBe(true);
    expect(result.action).toBe("markdown_liquidacion");
  });

  it("STH = 100% at bracket < 90 passes", () => {
    const result = evaluateLinealidad("carry_over", 75, 100);
    expect(result.isBelowThreshold).toBe(false);
  });

  it("STH = 100% at bracket 90 still triggers (mandatory exit)", () => {
    const result = evaluateLinealidad("carry_over", 90, 100);
    expect(result.isBelowThreshold).toBe(true);
    expect(result.action).toBe("markdown_liquidacion");
  });

  it("STH = 0% always fails when bracket exists", () => {
    const result = evaluateLinealidad("temporada", 15, 0);
    expect(result.isBelowThreshold).toBe(true);
    expect(result.action).toBe("revisar_exhibicion");
  });

  // Action mapping
  it("bracket 15 → revisar_exhibicion", () => {
    const r = evaluateLinealidad("basicos", 15, 0);
    expect(r.action).toBe("revisar_exhibicion");
  });
  it("bracket 30 → revisar_asignacion", () => {
    const r = evaluateLinealidad("basicos", 30, 0);
    expect(r.action).toBe("revisar_asignacion");
  });
  it("bracket 45 → accion_comercial", () => {
    const r = evaluateLinealidad("basicos", 45, 0);
    expect(r.action).toBe("accion_comercial");
  });
  it("bracket 60 → markdown_selectivo", () => {
    const r = evaluateLinealidad("basicos", 60, 0);
    expect(r.action).toBe("markdown_selectivo");
  });
  it("bracket 75 → transferencia_out", () => {
    const r = evaluateLinealidad("basicos", 75, 0);
    expect(r.action).toBe("transferencia_out");
  });
  it("bracket 90 → markdown_liquidacion", () => {
    const r = evaluateLinealidad("basicos", 90, 0);
    expect(r.action).toBe("markdown_liquidacion");
  });

  // Role assignment for temporada at bracket 15 (different from carry_over/basicos)
  it("temporada at 15d includes brand_manager + marketing_b2c", () => {
    const r = evaluateLinealidad("temporada", 15, 0);
    expect(r.responsibleRoles).toContain("marketing_b2c");
    expect(r.responsibleRoles).toContain("brand_manager");
  });

  it("carry_over at 15d only marketing_b2c", () => {
    const r = evaluateLinealidad("carry_over", 15, 0);
    expect(r.responsibleRoles).toEqual(["marketing_b2c"]);
  });

  // Custom thresholds
  it("respects custom thresholds", () => {
    const custom = {
      ...DEFAULT_LINEALIDAD_THRESHOLDS,
      basicos: { 15: 50, 30: 60, 45: 70, 60: 80, 75: 90, 90: 99 } as Record<AgeBracket, number>,
    };
    const r = evaluateLinealidad("basicos", 15, 40, custom);
    expect(r.requiredSth).toBe(50);
    expect(r.isBelowThreshold).toBe(true);
  });
});
