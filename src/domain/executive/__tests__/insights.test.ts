import { describe, it, expect } from "vitest";
import {
  generateBrandInsights,
  generateChannelInsights,
  aggregateSalesByBrand,
  aggregateSalesByChannel,
  aggregateBudgetByBrand,
  aggregateBudgetByChannel,
} from "../insights";

// ─── aggregateSalesByBrand ─────────────────────────────────────────────────

describe("aggregateSalesByBrand", () => {
  it("returns empty array for empty rows", () => {
    expect(aggregateSalesByBrand([], [1, 2, 3])).toEqual([]);
  });

  it("filters rows outside activeMonths", () => {
    const rows = [
      { brand: "Martel", month: 1, neto: 100 },
      { brand: "Martel", month: 5, neto: 999 },
    ];
    const result = aggregateSalesByBrand(rows, [1]);
    expect(result).toHaveLength(1);
    expect(result[0].neto).toBe(100);
  });

  it("aggregates neto for same brand across months", () => {
    const rows = [
      { brand: "Martel", month: 1, neto: 100 },
      { brand: "Martel", month: 2, neto: 200 },
    ];
    const result = aggregateSalesByBrand(rows, [1, 2]);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ brand: "Martel", neto: 300 });
  });

  it("keeps brands separate", () => {
    const rows = [
      { brand: "Martel", month: 1, neto: 100 },
      { brand: "Wrangler", month: 1, neto: 200 },
    ];
    const result = aggregateSalesByBrand(rows, [1]);
    expect(result).toHaveLength(2);
  });
});

// ─── aggregateSalesByChannel ───────────────────────────────────────────────

describe("aggregateSalesByChannel", () => {
  it("returns empty array for empty rows", () => {
    expect(aggregateSalesByChannel([], [1])).toEqual([]);
  });

  it("preserves null channel in output", () => {
    const rows = [{ channel: null, month: 1, neto: 50 }];
    const result = aggregateSalesByChannel(rows, [1]);
    expect(result).toHaveLength(1);
    expect(result[0].channel).toBeNull();
    expect(result[0].neto).toBe(50);
  });

  it("filters by activeMonths", () => {
    const rows = [
      { channel: "B2C", month: 1, neto: 100 },
      { channel: "B2C", month: 3, neto: 999 },
    ];
    const result = aggregateSalesByChannel(rows, [1]);
    expect(result).toHaveLength(1);
    expect(result[0].neto).toBe(100);
  });

  it("aggregates neto for same channel across months", () => {
    const rows = [
      { channel: "B2C", month: 1, neto: 100 },
      { channel: "B2C", month: 2, neto: 200 },
      { channel: "B2B", month: 1, neto: 50 },
    ];
    const result = aggregateSalesByChannel(rows, [1, 2]);
    expect(result).toHaveLength(2);
    const b2c = result.find(r => r.channel === "B2C");
    expect(b2c!.neto).toBe(300);
  });
});

// ─── aggregateBudgetByBrand ────────────────────────────────────────────────

describe("aggregateBudgetByBrand", () => {
  const row = (brand: string, month: number, area: string, revenue: number) =>
    ({ brand, month, area, revenue });

  it("returns empty array for empty rows", () => {
    expect(aggregateBudgetByBrand([], [1])).toEqual([]);
  });

  it("filters by activeMonths", () => {
    const rows = [row("Martel", 1, "B2C", 100), row("Martel", 5, "B2C", 999)];
    const result = aggregateBudgetByBrand(rows, [1]);
    expect(result).toHaveLength(1);
    expect(result[0].revenue).toBe(100);
  });

  it("aggregates revenue by brand", () => {
    const rows = [
      row("Martel", 1, "B2C", 100),
      row("Martel", 2, "B2C", 200),
      row("Wrangler", 1, "B2C", 50),
    ];
    const result = aggregateBudgetByBrand(rows, [1, 2]);
    const martel = result.find(r => r.brand === "Martel");
    expect(martel!.revenue).toBe(300);
  });

  it("channelFilter 'total' is treated as no filter", () => {
    const rows = [
      row("Martel", 1, "B2C", 100),
      row("Martel", 1, "B2B", 200),
    ];
    const result = aggregateBudgetByBrand(rows, [1], "total");
    expect(result).toHaveLength(1);
    expect(result[0].revenue).toBe(300);
  });

  it("channelFilter filters by area (uppercased)", () => {
    const rows = [
      row("Martel", 1, "B2C", 100),
      row("Martel", 1, "B2B", 200),
    ];
    const result = aggregateBudgetByBrand(rows, [1], "b2c");
    expect(result).toHaveLength(1);
    expect(result[0].revenue).toBe(100);
  });

  it("partialProrata applies factor to matching month only", () => {
    const rows = [
      row("Martel", 1, "B2C", 100),
      row("Martel", 2, "B2C", 200),
    ];
    const result = aggregateBudgetByBrand(rows, [1, 2], undefined, { month: 2, factor: 0.5 });
    expect(result).toHaveLength(1);
    expect(result[0].revenue).toBe(200); // 100 + 200*0.5
  });
});

// ─── aggregateBudgetByChannel ──────────────────────────────────────────────

describe("aggregateBudgetByChannel", () => {
  const row = (brand: string, month: number, area: string, revenue: number) =>
    ({ brand, month, area, revenue });

  it("returns empty array for empty rows", () => {
    expect(aggregateBudgetByChannel([], [1])).toEqual([]);
  });

  it("filters by activeMonths", () => {
    const rows = [row("Martel", 1, "B2C", 100), row("Martel", 5, "B2C", 999)];
    const result = aggregateBudgetByChannel(rows, [1]);
    expect(result).toHaveLength(1);
    expect(result[0].revenue).toBe(100);
  });

  it("aggregates revenue by area", () => {
    const rows = [
      row("Martel", 1, "B2C", 100),
      row("Wrangler", 1, "B2C", 200),
      row("Martel", 1, "B2B", 50),
    ];
    const result = aggregateBudgetByChannel(rows, [1]);
    const b2c = result.find(r => r.area === "B2C");
    expect(b2c!.revenue).toBe(300);
    const b2b = result.find(r => r.area === "B2B");
    expect(b2b!.revenue).toBe(50);
  });

  it("brandFilter restricts to matching brand", () => {
    const rows = [
      row("Martel", 1, "B2C", 100),
      row("Wrangler", 1, "B2C", 200),
    ];
    const result = aggregateBudgetByChannel(rows, [1], "Martel");
    expect(result).toHaveLength(1);
    expect(result[0].revenue).toBe(100);
  });

  it("partialProrata applies factor to matching month only", () => {
    const rows = [
      row("Martel", 1, "B2C", 100),
      row("Martel", 2, "B2C", 200),
    ];
    const result = aggregateBudgetByChannel(rows, [1, 2], undefined, { month: 2, factor: 0.5 });
    const b2c = result.find(r => r.area === "B2C");
    expect(b2c!.revenue).toBe(200); // 100 + 200*0.5
  });
});

// ─── generateBrandInsights ─────────────────────────────────────────────────

describe("generateBrandInsights", () => {
  it("returns empty for empty inputs", () => {
    expect(generateBrandInsights([], [])).toEqual([]);
  });

  it("filters out 'Otras' brand", () => {
    const sales = [{ brand: "Otras", neto: 1000 }];
    const budget = [{ brand: "Otras", revenue: 500 }];
    expect(generateBrandInsights(sales, budget)).toEqual([]);
  });

  it("classifies outperforming when pace > 103%", () => {
    const sales = [{ brand: "Martel", neto: 110 }];
    const budget = [{ brand: "Martel", revenue: 100 }];
    const result = generateBrandInsights(sales, budget);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("outperforming");
    expect(result[0].pacePercent).toBeCloseTo(110, 5);
    expect(result[0].impact).toBe(10);
  });

  it("classifies underperforming when pace < 97%", () => {
    const sales = [{ brand: "Martel", neto: 90 }];
    const budget = [{ brand: "Martel", revenue: 100 }];
    const result = generateBrandInsights(sales, budget);
    expect(result[0].type).toBe("underperforming");
    expect(result[0].impact).toBe(-10);
  });

  it("classifies stable when pace is within +/-3%", () => {
    const sales = [{ brand: "Martel", neto: 101 }];
    const budget = [{ brand: "Martel", revenue: 100 }];
    const result = generateBrandInsights(sales, budget);
    expect(result[0].type).toBe("stable");
  });

  it("skips rows where both target and actual are <= 0", () => {
    const sales = [{ brand: "Martel", neto: 0 }];
    const budget = [{ brand: "Martel", revenue: 0 }];
    expect(generateBrandInsights(sales, budget)).toEqual([]);
  });

  it("handles zero target with positive actual: pacePercent = 0", () => {
    const sales = [{ brand: "Martel", neto: 500 }];
    const budget: Array<{ brand: string; revenue: number }> = [];
    const result = generateBrandInsights(sales, budget);
    expect(result).toHaveLength(1);
    expect(result[0].pacePercent).toBe(0);
    // deviation = 0 - 100 = -100 → underperforming
    expect(result[0].type).toBe("underperforming");
  });

  it("respects limit parameter", () => {
    const sales = [
      { brand: "Martel", neto: 200 },
      { brand: "Wrangler", neto: 300 },
      { brand: "Lee", neto: 400 },
    ];
    const budget = [
      { brand: "Martel", revenue: 100 },
      { brand: "Wrangler", revenue: 100 },
      { brand: "Lee", revenue: 100 },
    ];
    const result = generateBrandInsights(sales, budget, 2);
    expect(result).toHaveLength(2);
    // sorted by absolute impact descending: Lee (300), Wrangler (200)
    expect(result[0].label).toBe("Lee");
    expect(result[1].label).toBe("Wrangler");
  });
});

// ─── generateChannelInsights ───────────────────────────────────────────────

describe("generateChannelInsights", () => {
  it("returns empty for empty inputs", () => {
    expect(generateChannelInsights([], [])).toEqual([]);
  });

  it("only considers B2C and B2B channels", () => {
    const sales = [
      { channel: "B2C", neto: 110 },
      { channel: null, neto: 999 },
    ];
    const budget = [
      { area: "B2C", revenue: 100 },
      { area: "Otro", revenue: 500 },
    ];
    const result = generateChannelInsights(sales, budget);
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe("B2C");
  });

  it("classifies B2C outperforming and B2B underperforming", () => {
    const sales = [
      { channel: "B2C", neto: 150 },
      { channel: "B2B", neto: 50 },
    ];
    const budget = [
      { area: "B2C", revenue: 100 },
      { area: "B2B", revenue: 100 },
    ];
    const result = generateChannelInsights(sales, budget);
    expect(result).toHaveLength(2);
    const b2c = result.find(r => r.label === "B2C")!;
    const b2b = result.find(r => r.label === "B2B")!;
    expect(b2c.type).toBe("outperforming");
    expect(b2b.type).toBe("underperforming");
  });

  it("skips channels with zero actual and zero target", () => {
    const sales: Array<{ channel: string | null; neto: number }> = [];
    const budget = [{ area: "B2C", revenue: 100 }];
    const result = generateChannelInsights(sales, budget);
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe("B2C");
    // actual=0, target=100, not both zero so it passes
  });

  it("respects limit=1", () => {
    const sales = [
      { channel: "B2C", neto: 200 },
      { channel: "B2B", neto: 300 },
    ];
    const budget = [
      { area: "B2C", revenue: 100 },
      { area: "B2B", revenue: 100 },
    ];
    const result = generateChannelInsights(sales, budget, 1);
    expect(result).toHaveLength(1);
    // B2B has higher absolute impact (200 > 100)
    expect(result[0].label).toBe("B2B");
  });
});
