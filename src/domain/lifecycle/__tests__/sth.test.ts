import { describe, it, expect } from "vitest";
import { calcSth, calcCohortAge, calcDoiFromSth, lookupSth } from "../sth";

// ─── calcSth ────────────────────────────────────────────────────────────────

describe("calcSth", () => {
  it("100 sold / 200 received = 50%", () => {
    expect(calcSth(100, 200)).toBe(50);
  });

  it("200 sold / 200 received = 100%", () => {
    expect(calcSth(200, 200)).toBe(100);
  });

  it("0 sold / 100 received = 0%", () => {
    expect(calcSth(0, 100)).toBe(0);
  });

  it("0 received → 0 (no division by zero)", () => {
    expect(calcSth(50, 0)).toBe(0);
  });

  it("negative received → 0", () => {
    expect(calcSth(50, -10)).toBe(0);
  });

  it("sold > received → capped at 100%", () => {
    expect(calcSth(300, 200)).toBe(100);
  });

  it("small numbers: 1 sold / 3 received ≈ 33.33%", () => {
    expect(calcSth(1, 3)).toBeCloseTo(33.33, 1);
  });
});

// ─── calcCohortAge ──────────────────────────────────────────────────────────

describe("calcCohortAge", () => {
  it("30 days ago → 30", () => {
    const now = new Date(2026, 3, 15); // April 15
    const entry = new Date(2026, 2, 16); // March 16
    expect(calcCohortAge(entry, now)).toBe(30);
  });

  it("same day → 0", () => {
    const now = new Date(2026, 3, 15);
    expect(calcCohortAge(now, now)).toBe(0);
  });

  it("null firstEntry → 0", () => {
    expect(calcCohortAge(null)).toBe(0);
  });

  it("future date → 0 (clamped)", () => {
    const now = new Date(2026, 3, 15);
    const future = new Date(2026, 4, 15);
    expect(calcCohortAge(future, now)).toBe(0);
  });

  it("365 days ago → 365", () => {
    const now = new Date(2026, 3, 15);
    const entry = new Date(2025, 3, 15);
    expect(calcCohortAge(entry, now)).toBe(365);
  });
});

// ─── calcDoiFromSth ─────────────────────────────────────────────────────────

describe("calcDoiFromSth", () => {
  it("age=60, sth=50% → DOI = 60 × 0.5 / 0.5 = 60", () => {
    expect(calcDoiFromSth(60, 50)).toBe(60);
  });

  it("age=90, sth=75% → DOI = 90 × 0.25 / 0.75 = 30", () => {
    expect(calcDoiFromSth(90, 75)).toBe(30);
  });

  it("age=30, sth=100% → DOI = 0 (todo vendido)", () => {
    expect(calcDoiFromSth(30, 100)).toBe(0);
  });

  it("age=90, sth=0% → DOI capped (no ventas = inventario muerto)", () => {
    const doi = calcDoiFromSth(90, 0);
    expect(doi).toBeGreaterThan(0);
    expect(doi).toBeLessThanOrEqual(9999);
  });

  it("age=0, sth=0% → 0", () => {
    expect(calcDoiFromSth(0, 0)).toBe(0);
  });

  it("age=45, sth=10% → DOI = 45 × 0.9 / 0.1 = 405", () => {
    expect(calcDoiFromSth(45, 10)).toBe(405);
  });
});

// ─── lookupSth ──────────────────────────────────────────────────────────────

describe("lookupSth", () => {
  const data = {
    exact: new Map([
      ["TIENDA1|SKU001|M", { sth: 0.6, cohortAgeDays: 45 }],
      ["TIENDA1|SKU001|L", { sth: 0.8, cohortAgeDays: 45 }],
    ]),
    byStoreSku: new Map([
      ["TIENDA1|SKU001", { sth: 0.8, cohortAgeDays: 45 }],
    ]),
  };

  it("exact match returns record", () => {
    const r = lookupSth(data, "TIENDA1", "SKU001", "M");
    expect(r).not.toBeNull();
    expect(r!.sth).toBe(0.6);
  });

  it("fallback to store+sku when talle not found", () => {
    const r = lookupSth(data, "TIENDA1", "SKU001", "XL");
    expect(r).not.toBeNull();
    expect(r!.sth).toBe(0.8); // best STH from byStoreSku
  });

  it("no data → null", () => {
    expect(lookupSth(data, "TIENDA2", "SKU001", "M")).toBeNull();
  });

  it("undefined sthData → null", () => {
    expect(lookupSth(undefined, "TIENDA1", "SKU001", "M")).toBeNull();
  });

  it("case insensitive store", () => {
    const r = lookupSth(data, "tienda1", "SKU001", "M");
    expect(r).not.toBeNull();
  });
});
