import { describe, it, expect, afterEach, vi } from "vitest";
import {
  MONTH_SHORT,
  MONTH_FULL,
  getCalendarMonth,
  getCalendarYear,
  getCalendarDay,
  detectPartialMonth,
  getClosedMonths,
  buildPeriodLabel,
  monthToQueryParts,
  daysInMonth,
  currentMonthProrata,
} from "../helpers";

// ─── MONTH_SHORT / MONTH_FULL ─────────────────────────────────────────────

describe("MONTH_SHORT", () => {
  it("has 12 entries (1-indexed)", () => {
    expect(Object.keys(MONTH_SHORT)).toHaveLength(12);
  });
  it('MONTH_SHORT[1] = "Ene", [12] = "Dic"', () => {
    expect(MONTH_SHORT[1]).toBe("Ene");
    expect(MONTH_SHORT[12]).toBe("Dic");
  });
});

describe("MONTH_FULL", () => {
  it('MONTH_FULL[1] = "Enero", [12] = "Diciembre"', () => {
    expect(MONTH_FULL[1]).toBe("Enero");
    expect(MONTH_FULL[12]).toBe("Diciembre");
  });
});

// ─── getCalendarMonth / getCalendarYear / getCalendarDay ───────────────────

describe("getCalendarMonth / getCalendarYear / getCalendarDay", () => {
  afterEach(() => { vi.useRealTimers(); });

  it("returns 3 / 2026 / 15 when mocked to March 15 2026", () => {
    vi.setSystemTime(new Date(2026, 2, 15)); // month 0-indexed
    expect(getCalendarMonth()).toBe(3);
    expect(getCalendarYear()).toBe(2026);
    expect(getCalendarDay()).toBe(15);
  });

  it("returns 1 / 2026 / 1 when mocked to January 1 2026", () => {
    vi.setSystemTime(new Date(2026, 0, 1));
    expect(getCalendarMonth()).toBe(1);
    expect(getCalendarDay()).toBe(1);
  });
});

// ─── detectPartialMonth ───────────────────────────────────────────────────

describe("detectPartialMonth", () => {
  afterEach(() => { vi.useRealTimers(); });

  it("returns true when current month is in monthsWithData", () => {
    vi.setSystemTime(new Date(2026, 2, 10)); // March
    expect(detectPartialMonth([1, 2, 3])).toBe(true);
  });

  it("returns false when current month is NOT in monthsWithData", () => {
    vi.setSystemTime(new Date(2026, 2, 10)); // March
    expect(detectPartialMonth([1, 2])).toBe(false);
  });

  it("returns false for empty array", () => {
    vi.setSystemTime(new Date(2026, 2, 10));
    expect(detectPartialMonth([])).toBe(false);
  });

  it("works at December boundary", () => {
    vi.setSystemTime(new Date(2026, 11, 15)); // December
    expect(detectPartialMonth([12])).toBe(true);
  });
});

// ─── getClosedMonths ──────────────────────────────────────────────────────

describe("getClosedMonths", () => {
  afterEach(() => { vi.useRealTimers(); });

  it("current year March → closed = [1, 2]", () => {
    vi.setSystemTime(new Date(2026, 2, 4)); // March 4
    expect(getClosedMonths(2026, 3)).toEqual([1, 2]);
  });

  it("prior year → all months up to maxMonthInDB are closed", () => {
    vi.setSystemTime(new Date(2026, 2, 4)); // March 2026
    expect(getClosedMonths(2025, 12)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it("January → no closed months yet", () => {
    vi.setSystemTime(new Date(2026, 0, 15)); // January
    expect(getClosedMonths(2026, 1)).toEqual([]);
  });

  it("capped by maxMonthInDB when DB has less data", () => {
    vi.setSystemTime(new Date(2026, 2, 4)); // March → closed should be [1, 2]
    expect(getClosedMonths(2026, 1)).toEqual([1]); // DB only has month 1
  });

  it("prior year capped by maxMonthInDB", () => {
    vi.setSystemTime(new Date(2026, 2, 4));
    expect(getClosedMonths(2025, 6)).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

// ─── buildPeriodLabel ─────────────────────────────────────────────────────

describe("buildPeriodLabel", () => {
  it('[1, 2, 3] 2026 → "Ene–Mar 2026"', () => {
    expect(buildPeriodLabel([1, 2, 3], 2026)).toBe("Ene–Mar 2026");
  });

  it('[3] 2026 → "Mar 2026"', () => {
    expect(buildPeriodLabel([3], 2026)).toBe("Mar 2026");
  });

  it('[] 2026 → "2026"', () => {
    expect(buildPeriodLabel([], 2026)).toBe("2026");
  });

  it('[1, 12] 2025 → "Ene–Dic 2025"', () => {
    expect(buildPeriodLabel([1, 12], 2025)).toBe("Ene–Dic 2025");
  });

  it("isPartial param does not affect output", () => {
    expect(buildPeriodLabel([1], 2026, true)).toBe("Ene 2026");
  });
});

// ─── monthToQueryParts ────────────────────────────────────────────────────

describe("monthToQueryParts", () => {
  it("returns identity { year, month }", () => {
    expect(monthToQueryParts(2026, 3)).toEqual({ year: 2026, month: 3 });
  });
});

// ─── daysInMonth ──────────────────────────────────────────────────────────

describe("daysInMonth", () => {
  it("January 2026 → 31", () => expect(daysInMonth(2026, 1)).toBe(31));
  it("February 2026 (non-leap) → 28", () => expect(daysInMonth(2026, 2)).toBe(28));
  it("February 2024 (leap) → 29", () => expect(daysInMonth(2024, 2)).toBe(29));
  it("April 2026 → 30", () => expect(daysInMonth(2026, 4)).toBe(30));
  it("December 2026 → 31", () => expect(daysInMonth(2026, 12)).toBe(31));
});

// ─── currentMonthProrata ──────────────────────────────────────────────────

describe("currentMonthProrata", () => {
  afterEach(() => { vi.useRealTimers(); });

  it("March 8 2026 → { month: 3, factor: 8/31 }", () => {
    vi.setSystemTime(new Date(2026, 2, 8));
    const result = currentMonthProrata(2026);
    expect(result).not.toBeNull();
    expect(result!.month).toBe(3);
    expect(result!.factor).toBeCloseTo(8 / 31, 5);
  });

  it("returns null for different year", () => {
    vi.setSystemTime(new Date(2026, 2, 8));
    expect(currentMonthProrata(2025)).toBeNull();
  });

  it("Feb 15 2024 (leap year) → { month: 2, factor: 15/29 }", () => {
    vi.setSystemTime(new Date(2024, 1, 15));
    const result = currentMonthProrata(2024);
    expect(result!.month).toBe(2);
    expect(result!.factor).toBeCloseTo(15 / 29, 5);
  });

  it("Jan 1 2026 → { month: 1, factor: 1/31 }", () => {
    vi.setSystemTime(new Date(2026, 0, 1));
    const result = currentMonthProrata(2026);
    expect(result!.month).toBe(1);
    expect(result!.factor).toBeCloseTo(1 / 31, 5);
  });

  it("Dec 31 2026 → factor = 1.0", () => {
    vi.setSystemTime(new Date(2026, 11, 31));
    const result = currentMonthProrata(2026);
    expect(result!.month).toBe(12);
    expect(result!.factor).toBeCloseTo(1.0, 5);
  });
});
