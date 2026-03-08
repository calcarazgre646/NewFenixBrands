import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { LogisticsImport } from "@/queries/logistics.queries";
import { statusLabel, toArrivals, groupArrivals, computeSummary } from "../arrivals";

function makeImport(overrides: Partial<LogisticsImport> = {}): LogisticsImport {
  return {
    brand: "Martel", season: "2026", supplier: "ProvA", category: "Remera",
    description: "Remera test", color: null, quantity: 100, origin: "China",
    costUSD: 10, pvpB2C: 30, pvpB2B: 25, marginB2C: 65, marginB2B: 50,
    eta: new Date(2026, 2, 15), etaLabel: "03/15/2026",
    ...overrides,
  };
}

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 2, 7)); });
afterEach(() => { vi.useRealTimers(); });

// ─── statusLabel ─────────────────────────────────────────────────────────────

describe("statusLabel", () => {
  it('"past" → "Pasado"', () => {
    expect(statusLabel("past", 0)).toBe("Pasado");
  });

  it('"this_month" with 0 days → "Este Mes"', () => {
    expect(statusLabel("this_month", 0)).toBe("Este Mes");
  });

  it('"this_month" with 15 days → "Este Mes · 15d"', () => {
    expect(statusLabel("this_month", 15)).toBe("Este Mes · 15d");
  });

  it('"next_month" with 30 days → "Prox. Mes · 30d"', () => {
    expect(statusLabel("next_month", 30)).toBe("Prox. Mes · 30d");
  });

  it('"upcoming" with 999 → "Proximo"', () => {
    expect(statusLabel("upcoming", 999)).toBe("Proximo");
  });

  it('"upcoming" with 60 → "En 60d"', () => {
    expect(statusLabel("upcoming", 60)).toBe("En 60d");
  });
});

// ─── toArrivals ──────────────────────────────────────────────────────────────

describe("toArrivals", () => {
  it("filters out unknown brands", () => {
    const rows = [
      makeImport({ brand: "Martel" }),
      makeImport({ brand: "Nike" }),
      makeImport({ brand: "Wrangler" }),
    ];
    const result = toArrivals(rows);
    expect(result).toHaveLength(2);
    expect(result.map(r => r.brand)).toEqual(["Martel", "Wrangler"]);
  });

  it("filters out rows with no eta AND no etaLabel", () => {
    const rows = [
      makeImport({ eta: null, etaLabel: "" }),
      makeImport({ eta: null, etaLabel: "TBD" }),
      makeImport({ eta: new Date(2026, 2, 20), etaLabel: "" }),
    ];
    const result = toArrivals(rows);
    expect(result).toHaveLength(2);
  });

  it("sorts by eta ascending, nulls last", () => {
    const rows = [
      makeImport({ eta: null, etaLabel: "TBD", description: "C" }),
      makeImport({ eta: new Date(2026, 3, 1), description: "B" }),
      makeImport({ eta: new Date(2026, 2, 10), description: "A" }),
    ];
    const result = toArrivals(rows);
    expect(result.map(r => r.description)).toEqual(["A", "B", "C"]);
  });

  it("sets correct status based on date relative to faked today", () => {
    const rows = [
      makeImport({ eta: new Date(2026, 1, 15), description: "past" }),       // Feb 15 < Mar 1
      makeImport({ eta: new Date(2026, 2, 20), description: "this_month" }), // Mar 20
      makeImport({ eta: new Date(2026, 3, 10), description: "next_month" }), // Apr 10
      makeImport({ eta: new Date(2026, 5, 1), description: "upcoming" }),    // Jun 1
    ];
    const result = toArrivals(rows);
    const statusMap = Object.fromEntries(result.map(r => [r.description, r.status]));
    expect(statusMap["past"]).toBe("past");
    expect(statusMap["this_month"]).toBe("this_month");
    expect(statusMap["next_month"]).toBe("next_month");
    expect(statusMap["upcoming"]).toBe("upcoming");
  });
});

// ─── groupArrivals ───────────────────────────────────────────────────────────

describe("groupArrivals", () => {
  it("groups by brand+supplier+etaLabel and sums totalUnits", () => {
    const arrivals = toArrivals([
      makeImport({ brand: "Martel", supplier: "ProvA", etaLabel: "03/15/2026", quantity: 50 }),
      makeImport({ brand: "Martel", supplier: "ProvA", etaLabel: "03/15/2026", quantity: 30 }),
      makeImport({ brand: "Lee", supplier: "ProvB", etaLabel: "04/01/2026", quantity: 70 }),
    ]);
    const groups = groupArrivals(arrivals);
    expect(groups).toHaveLength(2);
    const g1 = groups.find(g => g.brand === "Martel")!;
    expect(g1.totalUnits).toBe(80);
    const g2 = groups.find(g => g.brand === "Lee")!;
    expect(g2.totalUnits).toBe(70);
  });

  it("extracts unique categories per group", () => {
    const arrivals = toArrivals([
      makeImport({ category: "Remera", etaLabel: "03/15/2026" }),
      makeImport({ category: "Pantalon", etaLabel: "03/15/2026" }),
      makeImport({ category: "Remera", etaLabel: "03/15/2026" }),
    ]);
    const groups = groupArrivals(arrivals);
    expect(groups[0].categories).toEqual(["Remera", "Pantalon"]);
  });
});

// ─── computeSummary ──────────────────────────────────────────────────────────

describe("computeSummary", () => {
  const pastImport = makeImport({ eta: new Date(2026, 1, 10), quantity: 200, brand: "Lee", origin: "" });
  const activeImport1 = makeImport({ eta: new Date(2026, 2, 15), quantity: 100, brand: "Martel", origin: "China" });
  const activeImport2 = makeImport({ eta: new Date(2026, 3, 5), quantity: 50, brand: "Martel", origin: "Brasil", supplier: "ProvB", etaLabel: "04/05/2026" });

  function buildData() {
    const arrivals = toArrivals([pastImport, activeImport1, activeImport2]);
    const groups = groupArrivals(arrivals);
    return { arrivals, groups };
  }

  it("excludes 'past' from activeOrders and totalUnits", () => {
    const { arrivals, groups } = buildData();
    const summary = computeSummary(groups, arrivals);
    expect(summary.activeOrders).toBe(2);
    expect(summary.totalUnits).toBe(150);
  });

  it("byBrand sums correctly", () => {
    const { arrivals, groups } = buildData();
    const summary = computeSummary(groups, arrivals);
    expect(summary.byBrand["Martel"]).toBe(150);
    expect(summary.byBrand["Lee"]).toBeUndefined();
  });

  it('byOrigin uses "Sin dato" for empty origins', () => {
    const all = toArrivals([
      makeImport({ eta: new Date(2026, 2, 15), origin: "", quantity: 40 }),
      makeImport({ eta: new Date(2026, 2, 20), origin: "China", quantity: 60 }),
    ]);
    const groups = groupArrivals(all);
    const summary = computeSummary(groups, all);
    expect(summary.byOrigin["Sin dato"]).toBe(40);
    expect(summary.byOrigin["China"]).toBe(60);
  });

  it("nextDate picks first non-null eta", () => {
    const { arrivals, groups } = buildData();
    const summary = computeSummary(groups, arrivals);
    expect(summary.nextDate).not.toBe("—");
  });
});
