import { describe, it, expect } from "vitest";
import { filterSalesRows } from "../filters";
import type { MonthlySalesRow } from "../sales.queries";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRow(overrides: Partial<MonthlySalesRow> = {}): MonthlySalesRow {
  return {
    year: 2026,
    month: 3,
    brand: "Martel",
    store: "CERROALTO",
    channel: "B2C",
    neto: 1_000_000,
    cogs: 400_000,
    bruto: 1_200_000,
    dcto: 0,
    units: 10,
    ...overrides,
  };
}

// ─── filterSalesRows ──────────────────────────────────────────────────────────

describe("filterSalesRows", () => {
  const rows: MonthlySalesRow[] = [
    makeRow({ brand: "Martel", channel: "B2C", store: "CERROALTO" }),
    makeRow({ brand: "Martel", channel: "B2B", store: "MAYORISTA" }),
    makeRow({ brand: "Wrangler", channel: "B2C", store: "WRSSL" }),
    makeRow({ brand: "Lee", channel: "B2C", store: "SHOPPINEDO" }),
    makeRow({ brand: "Lee", channel: "B2B", store: "UTP" }),
  ];

  it("returns all rows when no filters applied", () => {
    const result = filterSalesRows(rows, "total", "total", null);
    expect(result).toHaveLength(5);
  });

  it("filters by brand (canonical match)", () => {
    const result = filterSalesRows(rows, "martel", "total", null);
    expect(result).toHaveLength(2);
    expect(result.every(r => r.brand === "Martel")).toBe(true);
  });

  it("filters by channel", () => {
    const result = filterSalesRows(rows, "total", "b2c", null);
    expect(result).toHaveLength(3);
    expect(result.every(r => r.channel === "B2C")).toBe(true);
  });

  it("filters by store", () => {
    const result = filterSalesRows(rows, "total", "total", "CERROALTO");
    expect(result).toHaveLength(1);
    expect(result[0].store).toBe("CERROALTO");
  });

  it("combines brand + channel filters", () => {
    const result = filterSalesRows(rows, "martel", "b2c", null);
    expect(result).toHaveLength(1);
    expect(result[0].brand).toBe("Martel");
    expect(result[0].channel).toBe("B2C");
  });

  it("combines brand + channel + store filters", () => {
    const result = filterSalesRows(rows, "lee", "b2b", "UTP");
    expect(result).toHaveLength(1);
    expect(result[0].brand).toBe("Lee");
  });

  it("returns empty array when no matches", () => {
    const result = filterSalesRows(rows, "wrangler", "b2b", null);
    expect(result).toHaveLength(0);
  });

  it("handles empty input", () => {
    expect(filterSalesRows([], "total", "total", null)).toEqual([]);
  });
});
