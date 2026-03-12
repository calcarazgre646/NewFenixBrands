import { describe, it, expect } from "vitest";
import {
  calcAnnualTarget,
  dayOfYear,
  calcForecast,
  calcRequiredMonthlyRunRate,
  calcLinearPaceGap,
  buildCumulativeSeries,
  buildMonthlyRows,
  buildDailySeries,
} from "../calcs";

// ─── calcAnnualTarget ──────────────────────────────────────────────────────

describe("calcAnnualTarget", () => {
  it("sums goals when present", () => {
    expect(calcAnnualTarget([{ goal: 30e9 }, { goal: 40e9 }])).toBe(70e9);
  });

  it("returns fallback 70B when array is empty", () => {
    expect(calcAnnualTarget([])).toBe(70_000_000_000);
  });

  it("returns fallback when total is 0", () => {
    expect(calcAnnualTarget([{ goal: 0 }, { goal: 0 }])).toBe(70_000_000_000);
  });

  it("handles single goal", () => {
    expect(calcAnnualTarget([{ goal: 50e9 }])).toBe(50e9);
  });
});

// ─── dayOfYear ─────────────────────────────────────────────────────────────

describe("dayOfYear", () => {
  it("Jan 1 → day 1", () => {
    expect(dayOfYear(new Date(2026, 0, 1))).toBe(1);
  });

  it("Feb 1 → day 32", () => {
    expect(dayOfYear(new Date(2026, 1, 1))).toBe(32);
  });

  it("Mar 1 non-leap year → day 60", () => {
    expect(dayOfYear(new Date(2026, 2, 1))).toBe(60);
  });

  it("Mar 1 leap year → day 61", () => {
    expect(dayOfYear(new Date(2024, 2, 1))).toBe(61);
  });

  it("Dec 31 non-leap → day 365", () => {
    expect(dayOfYear(new Date(2026, 11, 31))).toBe(365);
  });

  it("Dec 31 leap year → day 366", () => {
    expect(dayOfYear(new Date(2024, 11, 31))).toBe(366);
  });
});

// ─── calcForecast ──────────────────────────────────────────────────────────

describe("calcForecast", () => {
  it("projects linearly to full year", () => {
    // 10B in 60 days → daily rate ~166M → forecast ~60.8B
    const result = calcForecast(10e9, 60, 365);
    expect(result).toBeCloseTo(60.833e9, -7);
  });

  it("returns ytd when daysElapsed is 0 (no division by zero)", () => {
    expect(calcForecast(5e9, 0, 365)).toBe(5e9);
  });

  it("returns ytd when daysElapsed equals daysInYear (year complete)", () => {
    expect(calcForecast(50e9, 365, 365)).toBe(50e9);
  });

  it("returns ytd when daysElapsed is negative", () => {
    expect(calcForecast(5e9, -1, 365)).toBe(5e9);
  });
});

// ─── calcRequiredMonthlyRunRate ────────────────────────────────────────────

describe("calcRequiredMonthlyRunRate", () => {
  it("calculates gap / remaining months", () => {
    // Target 70B, YTD 10B, 305 days remaining ≈ 10 months
    const result = calcRequiredMonthlyRunRate(70e9, 10e9, 305);
    expect(result).toBeCloseTo(6e9, -7);
  });

  it("returns 0 when already ahead of target", () => {
    expect(calcRequiredMonthlyRunRate(50e9, 60e9, 100)).toBe(0);
  });

  it("handles very few days remaining (minimum 1 month)", () => {
    // 10 days remaining → rounds to 0 → max(1, 0) = 1
    const result = calcRequiredMonthlyRunRate(70e9, 60e9, 10);
    expect(result).toBeCloseTo(10e9, -7);
  });

  it("handles 0 days remaining (clamp to 1 month)", () => {
    const result = calcRequiredMonthlyRunRate(70e9, 50e9, 0);
    expect(result).toBeCloseTo(20e9, -7);
  });
});

// ─── calcLinearPaceGap ─────────────────────────────────────────────────────

describe("calcLinearPaceGap", () => {
  it("returns positive when behind linear pace", () => {
    // Target 70B, 60 days of 365 → ideal ~11.5B, YTD 8B → gap = +3.5B
    const result = calcLinearPaceGap(70e9, 8e9, 60, 365);
    expect(result).toBeGreaterThan(0);
  });

  it("returns negative when ahead of linear pace", () => {
    const result = calcLinearPaceGap(70e9, 20e9, 60, 365);
    expect(result).toBeLessThan(0);
  });

  it("returns 0 when exactly on pace", () => {
    // 70B target, 182.5 days of 365 → ideal 35B, YTD 35B
    expect(calcLinearPaceGap(70e9, 35e9, 182.5, 365)).toBeCloseTo(0, -5);
  });
});

// ─── buildCumulativeSeries ─────────────────────────────────────────────────

describe("buildCumulativeSeries", () => {
  it("builds 12 points", () => {
    const monthlyReal = new Map([[1, 5e9], [2, 6e9]]);
    const monthlyBudget = new Map([[1, 5.5e9], [2, 5.5e9], [3, 6e9]]);
    const result = buildCumulativeSeries(monthlyReal, monthlyBudget, 2, 5.5e9);
    expect(result).toHaveLength(12);
  });

  it("cumulates real values correctly", () => {
    const monthlyReal = new Map([[1, 5e9], [2, 6e9], [3, 7e9]]);
    const monthlyBudget = new Map<number, number>();
    const result = buildCumulativeSeries(monthlyReal, monthlyBudget, 3, 0);
    expect(result[0].cumReal).toBe(5e9);
    expect(result[1].cumReal).toBe(11e9);
    expect(result[2].cumReal).toBe(18e9);
  });

  it("null for months without real data", () => {
    const monthlyReal = new Map([[1, 5e9]]);
    const monthlyBudget = new Map<number, number>();
    const result = buildCumulativeSeries(monthlyReal, monthlyBudget, 1, 0);
    expect(result[0].cumReal).toBe(5e9);
    expect(result[1].cumReal).toBeNull();
  });

  it("projects forecast after last real month", () => {
    const monthlyReal = new Map([[1, 5e9], [2, 6e9]]);
    const monthlyBudget = new Map<number, number>();
    const runRate = 5.5e9;
    const result = buildCumulativeSeries(monthlyReal, monthlyBudget, 2, runRate);
    // Month 3 (index 2): forecast = cumReal(month2) + runRate
    expect(result[2].cumForecast).toBeCloseTo(11e9 + runRate, -5);
  });

  it("connects forecast to last real point", () => {
    const monthlyReal = new Map([[1, 5e9], [2, 6e9]]);
    const monthlyBudget = new Map<number, number>();
    const result = buildCumulativeSeries(monthlyReal, monthlyBudget, 2, 5e9);
    // Month 2 (last real) should have cumForecast = cumReal
    expect(result[1].cumForecast).toBe(result[1].cumReal);
  });

  it("prorates budget for partial month", () => {
    const monthlyReal = new Map([[1, 5e9], [2, 3e9]]);
    const monthlyBudget = new Map([[1, 5e9], [2, 6e9]]);
    const prorata = { month: 2, factor: 0.5 };
    const result = buildCumulativeSeries(monthlyReal, monthlyBudget, 2, 0, prorata);
    // Budget month 2 prorated: 6B * 0.5 = 3B; cumTarget = 5B + 3B = 8B
    expect(result[1].cumTarget).toBe(8e9);
  });

  it("uses partialMonthPY for partial month prior year", () => {
    const monthlyReal = new Map([[1, 5e9], [2, 3e9]]);
    const monthlyBudget = new Map<number, number>();
    const monthlyPY = new Map([[1, 4e9], [2, 5e9]]);
    const prorata = { month: 2, factor: 0.5 };
    const partialPY = 2e9; // exact PY from daily data
    const result = buildCumulativeSeries(monthlyReal, monthlyBudget, 2, 0, prorata, monthlyPY, partialPY);
    // cumPY month 2: 4B (month1 full) + 2B (partialPY) = 6B
    expect(result[1].cumPriorYear).toBe(6e9);
  });
});

// ─── buildMonthlyRows ──────────────────────────────────────────────────────

describe("buildMonthlyRows", () => {
  it("builds 12 rows", () => {
    const rows = buildMonthlyRows({
      monthlyReal: new Map(),
      monthlyBudget: new Map(),
      monthlyPY: new Map(),
      monthlyCost: new Map(),
      monthlyPYCost: new Map(),
      monthlyBudgetGmPct: new Map(),
      monthlyUnits: new Map(),
      monthlyBudgetUnits: new Map(),
      monthlyPYUnits: new Map(),
      calendarMonth: 3,
    });
    expect(rows).toHaveLength(12);
  });

  it("marks current month correctly", () => {
    const rows = buildMonthlyRows({
      monthlyReal: new Map([[3, 5e9]]),
      monthlyBudget: new Map(),
      monthlyPY: new Map(),
      monthlyCost: new Map(),
      monthlyPYCost: new Map(),
      monthlyBudgetGmPct: new Map(),
      monthlyUnits: new Map(),
      monthlyBudgetUnits: new Map(),
      monthlyPYUnits: new Map(),
      calendarMonth: 3,
    });
    expect(rows[2].isCurrentMonth).toBe(true);
    expect(rows[0].isCurrentMonth).toBe(false);
  });

  it("calculates vsBudget and vsLastYear", () => {
    const rows = buildMonthlyRows({
      monthlyReal: new Map([[1, 10e9]]),
      monthlyBudget: new Map([[1, 8e9]]),
      monthlyPY: new Map([[1, 9e9]]),
      monthlyCost: new Map(),
      monthlyPYCost: new Map(),
      monthlyBudgetGmPct: new Map(),
      monthlyUnits: new Map(),
      monthlyBudgetUnits: new Map(),
      monthlyPYUnits: new Map(),
      calendarMonth: 3,
    });
    expect(rows[0].vsBudget).toBe(2e9);
    expect(rows[0].vsLastYear).toBe(1e9);
  });

  it("prorates budget in partial month", () => {
    const rows = buildMonthlyRows({
      monthlyReal: new Map([[2, 3e9]]),
      monthlyBudget: new Map([[2, 6e9]]),
      monthlyPY: new Map(),
      monthlyCost: new Map(),
      monthlyPYCost: new Map(),
      monthlyBudgetGmPct: new Map(),
      monthlyUnits: new Map(),
      monthlyBudgetUnits: new Map(),
      monthlyPYUnits: new Map(),
      calendarMonth: 2,
      partialProrata: { month: 2, factor: 0.5 },
    });
    expect(rows[1].budget).toBe(3e9);
  });

  it("uses budget * 0.90 as lastYear fallback when no PY data", () => {
    const rows = buildMonthlyRows({
      monthlyReal: new Map([[1, 5e9]]),
      monthlyBudget: new Map([[1, 10e9]]),
      monthlyPY: new Map(), // no PY data
      monthlyCost: new Map(),
      monthlyPYCost: new Map(),
      monthlyBudgetGmPct: new Map(),
      monthlyUnits: new Map(),
      monthlyBudgetUnits: new Map(),
      monthlyPYUnits: new Map(),
      calendarMonth: 3,
    });
    expect(rows[0].lastYear).toBe(9e9); // 10B * 0.90
  });
});

// ─── buildDailySeries ──────────────────────────────────────────────────────

describe("buildDailySeries", () => {
  it("builds cumulative daily points", () => {
    const cy = [
      { month: 3, day: 1, neto: 100e6 },
      { month: 3, day: 2, neto: 150e6 },
      { month: 3, day: 3, neto: 200e6 },
    ];
    const py = [
      { month: 3, day: 1, neto: 80e6 },
      { month: 3, day: 2, neto: 120e6 },
    ];
    const result = buildDailySeries(cy, py, 3, 3e9, 31, 3);
    expect(result).toHaveLength(3);
    expect(result[0].real).toBe(100e6);
    expect(result[1].real).toBe(250e6); // cumulative
    expect(result[2].real).toBe(450e6);
    expect(result[0].priorYear).toBe(80e6);
    expect(result[1].priorYear).toBe(200e6);
  });

  it("distributes budget evenly across days", () => {
    const result = buildDailySeries(
      [{ month: 1, day: 1, neto: 1e6 }],
      [], 1, 31e9, 31, 1,
    );
    expect(result[0].budgetDaily).toBeCloseTo(1e9, -5);
  });

  it("uses totalDays for maxDay when lastDay is null", () => {
    const cy = [{ month: 1, day: 1, neto: 1e6 }];
    const result = buildDailySeries(cy, [], 1, 31e9, 31, null);
    expect(result).toHaveLength(31);
  });

  it("returns empty for no matching month", () => {
    const cy = [{ month: 2, day: 1, neto: 1e6 }];
    const result = buildDailySeries(cy, [], 1, 10e9, 31, 10);
    // CY data is for month 2, asking for month 1 → no data accumulated
    expect(result[0].real).toBe(0);
  });

  it("handles 0 totalDays (budgetDaily = 0)", () => {
    const result = buildDailySeries(
      [{ month: 1, day: 1, neto: 1e6 }],
      [], 1, 10e9, 0, null,
    );
    expect(result).toHaveLength(0);
  });
});
