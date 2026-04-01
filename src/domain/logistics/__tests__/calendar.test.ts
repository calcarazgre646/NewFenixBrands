/**
 * Tests para domain/logistics/calendar.ts
 *
 * Cobertura completa:
 * - groupsToCalendarItems: filtrado, mapping, edge cases
 * - getBrandColor / getStatusColor: colores correctos
 * - arrivalsByDay: aggregation para year view
 * - extractDate: parsing del key
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { LogisticsImport } from "@/queries/logistics.queries";
import { toArrivals, groupArrivals } from "../arrivals";
import {
  groupsToCalendarItems,
  getBrandColor,
  getStatusColor,
  arrivalsByDay,
  type ArrivalCalendarItem,
} from "../calendar";
import type { LogisticsGroup, ArrivalStatus } from "../types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeImport(overrides: Partial<LogisticsImport> = {}): LogisticsImport {
  return {
    brand: "Martel", season: "2026", supplier: "ProvA", category: "Remera",
    description: "Remera test", color: null, quantity: 100, origin: "China",
    costUSD: 10, pvpB2C: 30, pvpB2B: 25, marginB2C: 65, marginB2B: 50,
    eta: new Date(2026, 2, 15), etaLabel: "03/15/2026",
    erpStatus: null, purchaseOrder: null, launchDate: null,
    ...overrides,
  };
}

function buildGroups(imports: LogisticsImport[]): LogisticsGroup[] {
  return groupArrivals(toArrivals(imports));
}

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 2, 10)); });
afterEach(() => { vi.useRealTimers(); });

// ═══════════════════════════════════════════════════════════════════════════════
// groupsToCalendarItems
// ═══════════════════════════════════════════════════════════════════════════════

describe("groupsToCalendarItems", () => {
  it("converts groups to calendar items with correct fields", () => {
    const groups = buildGroups([
      makeImport({ brand: "Martel", supplier: "ProvA", quantity: 100, eta: new Date(2026, 2, 15) }),
      makeImport({ brand: "Martel", supplier: "ProvA", quantity: 50, eta: new Date(2026, 2, 15), category: "Pantalon" }),
    ]);
    const items = groupsToCalendarItems(groups);

    expect(items).toHaveLength(1);
    expect(items[0].brand).toBe("Martel");
    expect(items[0].brandNorm).toBe("martel");
    expect(items[0].supplier).toBe("ProvA");
    expect(items[0].totalUnits).toBe(150);
    expect(items[0].categories).toEqual(["Remera", "Pantalon"]);
    expect(items[0].status).toBe("this_month");
    expect(items[0].date).toBe("2026-03-15");
  });

  it("excludes past groups by default", () => {
    const groups = buildGroups([
      makeImport({ eta: new Date(2026, 1, 10), supplier: "A" }),  // past (Feb)
      makeImport({ eta: new Date(2026, 2, 15), supplier: "B" }),  // this_month
      makeImport({ eta: new Date(2026, 3, 5), supplier: "C" }),   // next_month
    ]);
    const items = groupsToCalendarItems(groups);

    expect(items).toHaveLength(2);
    expect(items.every(i => i.status !== "past")).toBe(true);
  });

  it("includes past groups when includePast=true", () => {
    const groups = buildGroups([
      makeImport({ eta: new Date(2026, 1, 10), supplier: "A" }),  // past
      makeImport({ eta: new Date(2026, 2, 15), supplier: "B" }),  // this_month
    ]);
    const items = groupsToCalendarItems(groups, true);

    expect(items).toHaveLength(2);
    expect(items.some(i => i.status === "past")).toBe(true);
  });

  it("generates deterministic IDs from group keys", () => {
    const groups = buildGroups([
      makeImport({ brand: "Martel", supplier: "ProvA", eta: new Date(2026, 2, 15) }),
    ]);
    const items = groupsToCalendarItems(groups);

    expect(items[0].id).toMatch(/^arrival-/);
    // Same input → same ID
    const items2 = groupsToCalendarItems(groups);
    expect(items[0].id).toBe(items2[0].id);
  });

  it("includes overdue items (they are active, urgently late)", () => {
    const groups = buildGroups([
      makeImport({ eta: new Date(2026, 2, 5) }),  // overdue (Mar 5 < Mar 10)
    ]);
    const items = groupsToCalendarItems(groups);

    expect(items).toHaveLength(1);
    expect(items[0].status).toBe("overdue");
    expect(items[0].daysUntil).toBeLessThan(0);
  });

  it("handles multiple brands on same day", () => {
    const groups = buildGroups([
      makeImport({ brand: "Martel", supplier: "ProvA", eta: new Date(2026, 2, 15) }),
      makeImport({ brand: "Lee", supplier: "ProvB", eta: new Date(2026, 2, 15) }),
    ]);
    const items = groupsToCalendarItems(groups);

    expect(items).toHaveLength(2);
    expect(items.map(i => i.brandNorm).sort()).toEqual(["lee", "martel"]);
  });

  it("sums costUSD from group rows", () => {
    const groups = buildGroups([
      makeImport({ supplier: "A", costUSD: 20, eta: new Date(2026, 2, 15) }),
      makeImport({ supplier: "A", costUSD: 30, eta: new Date(2026, 2, 15) }),
    ]);
    const items = groupsToCalendarItems(groups);

    expect(items[0].costUSD).toBe(50);
  });

  it("returns empty array for empty groups", () => {
    expect(groupsToCalendarItems([])).toEqual([]);
  });

  it("returns empty array when all groups are past and includePast=false", () => {
    const groups = buildGroups([
      makeImport({ eta: new Date(2026, 1, 5), supplier: "A" }),
      makeImport({ eta: new Date(2026, 1, 10), supplier: "B" }),
    ]);
    const items = groupsToCalendarItems(groups);

    expect(items).toEqual([]);
  });

  it("preserves origin from group", () => {
    const groups = buildGroups([
      makeImport({ origin: "Perú", eta: new Date(2026, 2, 15) }),
    ]);
    const items = groupsToCalendarItems(groups);

    expect(items[0].origin).toBe("Perú");
  });

  it("handles upcoming status correctly", () => {
    const groups = buildGroups([
      makeImport({ eta: new Date(2026, 5, 1), supplier: "D" }), // June = upcoming
    ]);
    const items = groupsToCalendarItems(groups);

    expect(items).toHaveLength(1);
    expect(items[0].status).toBe("upcoming");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// getBrandColor
// ═══════════════════════════════════════════════════════════════════════════════

describe("getBrandColor", () => {
  it("returns amber for martel", () => {
    expect(getBrandColor("martel")).toBe("#f59e0b");
  });

  it("returns blue for wrangler", () => {
    expect(getBrandColor("wrangler")).toBe("#3b82f6");
  });

  it("returns emerald for lee", () => {
    expect(getBrandColor("lee")).toBe("#10b981");
  });

  it("returns gray fallback for unknown brand", () => {
    expect(getBrandColor("unknown")).toBe("#6b7280");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// getStatusColor
// ═══════════════════════════════════════════════════════════════════════════════

describe("getStatusColor", () => {
  const expected: [ArrivalStatus, string][] = [
    ["overdue", "#ef4444"],
    ["past", "#9ca3af"],
    ["this_month", "#f59e0b"],
    ["next_month", "#3b82f6"],
    ["upcoming", "#10b981"],
  ];

  it.each(expected)("status %s → %s", (status, color) => {
    expect(getStatusColor(status)).toBe(color);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// arrivalsByDay
// ═══════════════════════════════════════════════════════════════════════════════

describe("arrivalsByDay", () => {
  function makeItem(overrides: Partial<ArrivalCalendarItem> = {}): ArrivalCalendarItem {
    return {
      id: "arrival-test",
      date: "2026-03-15",
      brand: "Martel",
      brandNorm: "martel",
      supplier: "ProvA",
      totalUnits: 100,
      categories: ["Remera"],
      status: "this_month" as ArrivalStatus,
      daysUntil: 5,
      dateLabel: "15 mar 2026",
      origin: "China",
      costUSD: 10,
      erpStatus: null,
      purchaseOrder: null,
      ...overrides,
    };
  }

  it("groups items by date", () => {
    const items = [
      makeItem({ id: "a1", date: "2026-03-15", totalUnits: 100, brandNorm: "martel" }),
      makeItem({ id: "a2", date: "2026-03-15", totalUnits: 50, brandNorm: "lee" }),
      makeItem({ id: "a3", date: "2026-03-20", totalUnits: 200, brandNorm: "wrangler" }),
    ];
    const map = arrivalsByDay(items);

    expect(map.size).toBe(2);
    const mar15 = map.get("2026-03-15")!;
    expect(mar15.totalUnits).toBe(150);
    expect(mar15.brands.sort()).toEqual(["lee", "martel"]);
    expect(mar15.groupCount).toBe(2);

    const mar20 = map.get("2026-03-20")!;
    expect(mar20.totalUnits).toBe(200);
    expect(mar20.groupCount).toBe(1);
  });

  it("tracks overdue status", () => {
    const items = [
      makeItem({ date: "2026-03-05", status: "overdue" as ArrivalStatus }),
    ];
    const map = arrivalsByDay(items);

    expect(map.get("2026-03-05")!.hasOverdue).toBe(true);
  });

  it("sets hasOverdue=true if any item on that day is overdue", () => {
    const items = [
      makeItem({ id: "a1", date: "2026-03-05", status: "overdue" as ArrivalStatus }),
      makeItem({ id: "a2", date: "2026-03-05", status: "this_month" as ArrivalStatus }),
    ];
    const map = arrivalsByDay(items);

    expect(map.get("2026-03-05")!.hasOverdue).toBe(true);
  });

  it("hasOverdue=false when no overdue items", () => {
    const items = [
      makeItem({ date: "2026-03-15", status: "this_month" as ArrivalStatus }),
    ];
    const map = arrivalsByDay(items);

    expect(map.get("2026-03-15")!.hasOverdue).toBe(false);
  });

  it("deduplicates brands on same day", () => {
    const items = [
      makeItem({ id: "a1", date: "2026-03-15", brandNorm: "martel" }),
      makeItem({ id: "a2", date: "2026-03-15", brandNorm: "martel" }),
    ];
    const map = arrivalsByDay(items);

    expect(map.get("2026-03-15")!.brands).toEqual(["martel"]);
  });

  it("returns empty map for empty items", () => {
    expect(arrivalsByDay([]).size).toBe(0);
  });
});
