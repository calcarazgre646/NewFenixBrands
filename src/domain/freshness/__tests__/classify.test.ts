import { describe, it, expect } from "vitest";
import {
  classifyFreshness,
  getThresholds,
  formatRelativeTime,
  SOURCE_THRESHOLDS,
} from "../classify";
import type { FreshnessThresholds } from "../types";

// ─── Helpers ────────────────────────────────────────────────────────────────

const now = new Date("2026-04-04T12:00:00Z");

function minutesAgo(min: number): Date {
  return new Date(now.getTime() - min * 60_000);
}

// ─── classifyFreshness ──────────────────────────────────────────────────────

describe("classifyFreshness", () => {
  const t: FreshnessThresholds = { staleMinutes: 90, riskMinutes: 180 };

  it("returns 'ok' when refresh is recent", () => {
    expect(classifyFreshness(minutesAgo(30), now, t)).toBe("ok");
  });

  it("returns 'ok' at exactly the stale boundary", () => {
    expect(classifyFreshness(minutesAgo(90), now, t)).toBe("ok");
  });

  it("returns 'stale' just past stale boundary", () => {
    expect(classifyFreshness(minutesAgo(91), now, t)).toBe("stale");
  });

  it("returns 'stale' at exactly the risk boundary", () => {
    expect(classifyFreshness(minutesAgo(180), now, t)).toBe("stale");
  });

  it("returns 'risk' beyond risk boundary", () => {
    expect(classifyFreshness(minutesAgo(181), now, t)).toBe("risk");
  });

  it("returns 'risk' for very old timestamps", () => {
    expect(classifyFreshness(minutesAgo(1440), now, t)).toBe("risk");
  });

  it("returns 'ok' for future timestamps (clock skew)", () => {
    const future = new Date(now.getTime() + 60_000);
    expect(classifyFreshness(future, now, t)).toBe("ok");
  });

  it("returns 'ok' when refreshed at exactly now (0 diff)", () => {
    expect(classifyFreshness(now, now, t)).toBe("ok");
  });

  it("uses default thresholds when none provided", () => {
    // Default: staleMinutes=120, riskMinutes=360
    expect(classifyFreshness(minutesAgo(100), now)).toBe("ok");
    expect(classifyFreshness(minutesAgo(121), now)).toBe("stale");
    expect(classifyFreshness(minutesAgo(361), now)).toBe("risk");
  });
});

// ─── getThresholds ──────────────────────────────────────────────────────────

describe("getThresholds", () => {
  it("returns specific thresholds for known sources", () => {
    const t = getThresholds("mv_ventas_mensual");
    expect(t.staleMinutes).toBe(90);
    expect(t.riskMinutes).toBe(180);
  });

  it("returns DOI thresholds for mv_doi_edad", () => {
    const t = getThresholds("mv_doi_edad");
    expect(t.staleMinutes).toBe(120);
    expect(t.riskMinutes).toBe(360);
  });

  it("returns default thresholds for unknown sources", () => {
    const t = getThresholds("unknown_table");
    expect(t.staleMinutes).toBe(120);
    expect(t.riskMinutes).toBe(360);
  });

  it("has thresholds for all 5 MVs", () => {
    const sources = [
      "mv_ventas_mensual",
      "mv_ventas_diarias",
      "mv_ventas_12m_por_tienda_sku",
      "mv_stock_tienda",
      "mv_doi_edad",
    ];
    for (const s of sources) {
      expect(SOURCE_THRESHOLDS[s]).toBeDefined();
    }
  });
});

// ─── formatRelativeTime ─────────────────────────────────────────────────────

describe("formatRelativeTime", () => {
  it("returns 'ahora' for < 1 min ago", () => {
    expect(formatRelativeTime(new Date(now.getTime() - 30_000), now)).toBe("ahora");
  });

  it("returns minutes for < 60 min", () => {
    expect(formatRelativeTime(minutesAgo(5), now)).toBe("hace 5 min");
    expect(formatRelativeTime(minutesAgo(59), now)).toBe("hace 59 min");
  });

  it("returns hours for < 24 h", () => {
    expect(formatRelativeTime(minutesAgo(60), now)).toBe("hace 1 h");
    expect(formatRelativeTime(minutesAgo(120), now)).toBe("hace 2 h");
    expect(formatRelativeTime(minutesAgo(23 * 60), now)).toBe("hace 23 h");
  });

  it("returns days for >= 24 h", () => {
    expect(formatRelativeTime(minutesAgo(24 * 60), now)).toBe("hace 1 día");
    expect(formatRelativeTime(minutesAgo(48 * 60), now)).toBe("hace 2 días");
  });

  it("returns 'ahora' for future timestamps", () => {
    const future = new Date(now.getTime() + 60_000);
    expect(formatRelativeTime(future, now)).toBe("ahora");
  });
});
