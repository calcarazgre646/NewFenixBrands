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

  describe("b2bSubchannel", () => {
    const b2bRows: MonthlySalesRow[] = [
      makeRow({ channel: "B2B", store: "MAYORISTA", neto: 100 }),
      makeRow({ channel: "B2B", store: "UTP",       neto: 200 }),
      makeRow({ channel: "B2B", store: "UNIFORMES", neto: 50 }),
      makeRow({ channel: "B2C", store: "CERROALTO", neto: 999 }),
    ];

    it("default 'all' devuelve ambos UTP y Mayorista", () => {
      const r = filterSalesRows(b2bRows, "total", "b2b", null, "all");
      expect(r.map(x => x.store).sort()).toEqual(["MAYORISTA", "UNIFORMES", "UTP"]);
    });

    it("backward compatible: sin pasar 5to arg = 'all'", () => {
      const r = filterSalesRows(b2bRows, "total", "b2b", null);
      expect(r).toHaveLength(3);
    });

    it("'mayorista' excluye UTP y UNIFORMES", () => {
      const r = filterSalesRows(b2bRows, "total", "b2b", null, "mayorista");
      expect(r.map(x => x.store)).toEqual(["MAYORISTA"]);
    });

    it("'utp' incluye tanto UTP como UNIFORMES", () => {
      const r = filterSalesRows(b2bRows, "total", "b2b", null, "utp");
      expect(r.map(x => x.store).sort()).toEqual(["UNIFORMES", "UTP"]);
    });

    it("se ignora cuando channel != b2b (no filtra B2C)", () => {
      const r = filterSalesRows(b2bRows, "total", "b2c", null, "utp");
      expect(r).toHaveLength(1);
      expect(r[0].channel).toBe("B2C");
    });

    it("se ignora cuando channel='total'", () => {
      const r = filterSalesRows(b2bRows, "total", "total", null, "mayorista");
      expect(r).toHaveLength(4);
    });
  });
});
