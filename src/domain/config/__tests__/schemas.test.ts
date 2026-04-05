/**
 * Tests de validación de schemas de configuración.
 * Verifica que los schemas aceptan valores válidos y rechazan inválidos.
 */
import { describe, it, expect } from "vitest";
import {
  validateWaterfallConfig,
  validateDepotConfig,
  validateFreshnessThresholds,
  validateFreshnessConfig,
  validateExecutiveConfig,
  validateMarginConfig,
  validateStoreConfigRow,
  validateCommissionTier,
  validateCommissionScale,
  validateNumericParam,
} from "../schemas";
import { DEFAULT_WATERFALL_CONFIG, DEFAULT_DEPOT_CONFIG, DEFAULT_FRESHNESS_CONFIG, DEFAULT_EXECUTIVE_CONFIG, DEFAULT_MARGIN_CONFIG } from "../defaults";

// ─── Waterfall ─────────────────────────────────────────────────────────────

describe("validateWaterfallConfig", () => {
  it("accepts valid config (current defaults)", () => {
    const r = validateWaterfallConfig(DEFAULT_WATERFALL_CONFIG);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual(DEFAULT_WATERFALL_CONFIG);
  });

  it("rejects non-object", () => {
    expect(validateWaterfallConfig(null).ok).toBe(false);
    expect(validateWaterfallConfig(42).ok).toBe(false);
    expect(validateWaterfallConfig("string").ok).toBe(false);
  });

  it("rejects negative ratio", () => {
    const r = validateWaterfallConfig({ ...DEFAULT_WATERFALL_CONFIG, lowStockRatio: -1 });
    expect(r.ok).toBe(false);
  });

  it("rejects missing importedBrands", () => {
    const { importedBrands: _, ...rest } = DEFAULT_WATERFALL_CONFIG;
    const r = validateWaterfallConfig(rest);
    expect(r.ok).toBe(false);
  });

  it("rejects non-string importedBrands", () => {
    const r = validateWaterfallConfig({ ...DEFAULT_WATERFALL_CONFIG, importedBrands: [1, 2] });
    expect(r.ok).toBe(false);
  });

  it("rejects paretoTarget > 1", () => {
    const r = validateWaterfallConfig({ ...DEFAULT_WATERFALL_CONFIG, paretoTarget: 1.5 });
    expect(r.ok).toBe(false);
  });
});

// ─── Depot ─────────────────────────────────────────────────────────────────

describe("validateDepotConfig", () => {
  it("accepts valid config", () => {
    const r = validateDepotConfig(DEFAULT_DEPOT_CONFIG);
    expect(r.ok).toBe(true);
  });

  it("rejects criticalWeeks >= lowWeeks", () => {
    const r = validateDepotConfig({ ...DEFAULT_DEPOT_CONFIG, criticalWeeks: 10, lowWeeks: 8 });
    expect(r.ok).toBe(false);
  });

  it("rejects lowWeeks >= highWeeks", () => {
    const r = validateDepotConfig({ ...DEFAULT_DEPOT_CONFIG, lowWeeks: 20, highWeeks: 16 });
    expect(r.ok).toBe(false);
  });

  it("rejects noveltyCoverage > 1", () => {
    const r = validateDepotConfig({ ...DEFAULT_DEPOT_CONFIG, noveltyCoverage: 1.5 });
    expect(r.ok).toBe(false);
  });
});

// ─── Freshness ─────────────────────────────────────────────────────────────

describe("validateFreshnessThresholds", () => {
  it("accepts valid thresholds", () => {
    const r = validateFreshnessThresholds({ staleMinutes: 90, riskMinutes: 180 });
    expect(r.ok).toBe(true);
  });

  it("rejects risk <= stale", () => {
    expect(validateFreshnessThresholds({ staleMinutes: 180, riskMinutes: 90 }).ok).toBe(false);
    expect(validateFreshnessThresholds({ staleMinutes: 90, riskMinutes: 90 }).ok).toBe(false);
  });

  it("rejects non-positive", () => {
    expect(validateFreshnessThresholds({ staleMinutes: 0, riskMinutes: 90 }).ok).toBe(false);
    expect(validateFreshnessThresholds({ staleMinutes: -1, riskMinutes: 90 }).ok).toBe(false);
  });

  it("rejects non-integer", () => {
    expect(validateFreshnessThresholds({ staleMinutes: 90.5, riskMinutes: 180 }).ok).toBe(false);
  });
});

describe("validateFreshnessConfig", () => {
  it("accepts full default config", () => {
    const r = validateFreshnessConfig(DEFAULT_FRESHNESS_CONFIG);
    expect(r.ok).toBe(true);
  });
});

// ─── Executive ─────────────────────────────────────────────────────────────

describe("validateExecutiveConfig", () => {
  it("accepts valid config", () => {
    const r = validateExecutiveConfig(DEFAULT_EXECUTIVE_CONFIG);
    expect(r.ok).toBe(true);
  });

  it("rejects negative target", () => {
    const r = validateExecutiveConfig({ annualTargetFallback: -1, lyBudgetFactor: 0.90 });
    expect(r.ok).toBe(false);
  });

  it("rejects factor > 1", () => {
    const r = validateExecutiveConfig({ annualTargetFallback: 70_000_000_000, lyBudgetFactor: 1.5 });
    expect(r.ok).toBe(false);
  });
});

// ─── Margin ────────────────────────────────────────────────────────────────

describe("validateMarginConfig", () => {
  it("accepts valid config", () => {
    const r = validateMarginConfig(DEFAULT_MARGIN_CONFIG);
    expect(r.ok).toBe(true);
  });

  it("rejects b2cModerate >= b2cHealthy", () => {
    const r = validateMarginConfig({ ...DEFAULT_MARGIN_CONFIG, b2cModerate: 60, b2cHealthy: 55 });
    expect(r.ok).toBe(false);
  });

  it("rejects values > 100", () => {
    const r = validateMarginConfig({ ...DEFAULT_MARGIN_CONFIG, b2cHealthy: 101 });
    expect(r.ok).toBe(false);
  });
});

// ─── Store Config Row ──────────────────────────────────────────────────────

describe("validateStoreConfigRow", () => {
  it("accepts valid row", () => {
    const r = validateStoreConfigRow({
      storeCode: "MARTELMCAL",
      cluster: "A",
      assortment: 5500,
      timeRestriction: "Sin restricción",
      isExcluded: false,
      isB2b: false,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.storeCode).toBe("MARTELMCAL");
      expect(r.value.cluster).toBe("A");
    }
  });

  it("accepts row with null assortment and timeRestriction", () => {
    const r = validateStoreConfigRow({
      storeCode: "SHOPMCAL",
      cluster: "A",
      assortment: null,
      timeRestriction: null,
      isExcluded: false,
      isB2b: false,
    });
    expect(r.ok).toBe(true);
  });

  it("accepts camelCase keys (query layer normalizes from DB)", () => {
    const r = validateStoreConfigRow({
      storeCode: "TEST",
      cluster: "B",
      assortment: null,
      timeRestriction: null,
      isExcluded: true,
      isB2b: false,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.storeCode).toBe("TEST");
      expect(r.value.isExcluded).toBe(true);
    }
  });

  it("rejects invalid cluster", () => {
    const r = validateStoreConfigRow({
      storeCode: "X",
      cluster: "C",
      assortment: null,
      timeRestriction: null,
      isExcluded: false,
      isB2b: false,
    });
    expect(r.ok).toBe(false);
  });

  it("rejects negative assortment", () => {
    const r = validateStoreConfigRow({
      storeCode: "X",
      cluster: "A",
      assortment: -100,
      timeRestriction: null,
      isExcluded: false,
      isB2b: false,
    });
    expect(r.ok).toBe(false);
  });

  it("rejects empty storeCode", () => {
    const r = validateStoreConfigRow({
      storeCode: "",
      cluster: "A",
      assortment: null,
      timeRestriction: null,
      isExcluded: false,
      isB2b: false,
    });
    expect(r.ok).toBe(false);
  });
});

// ─── Commission Tier ───────────────────────────────────────────────────────

describe("validateCommissionTier", () => {
  it("accepts valid tier", () => {
    const r = validateCommissionTier({ minPct: 70, maxPct: 80, value: 0.85 });
    expect(r.ok).toBe(true);
  });

  it("accepts null maxPct as Infinity", () => {
    const r = validateCommissionTier({ minPct: 120, maxPct: null, value: 1.35 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.maxPct).toBe(Infinity);
  });

  it("rejects maxPct <= minPct", () => {
    const r = validateCommissionTier({ minPct: 80, maxPct: 70, value: 0.85 });
    expect(r.ok).toBe(false);
  });

  it("rejects negative value", () => {
    const r = validateCommissionTier({ minPct: 0, maxPct: 70, value: -1 });
    expect(r.ok).toBe(false);
  });
});

// ─── Commission Scale ──────────────────────────────────────────────────────

describe("validateCommissionScale", () => {
  const validScale = {
    role: "vendedor_tienda",
    channel: "retail",
    type: "percentage",
    label: "Vendedor Tienda",
    tiers: [
      { minPct: 0,   maxPct: 70,   value: 0 },
      { minPct: 70,  maxPct: 80,   value: 0.85 },
      { minPct: 80,  maxPct: 90,   value: 0.95 },
      { minPct: 90,  maxPct: 100,  value: 1.05 },
      { minPct: 100, maxPct: 110,  value: 1.15 },
      { minPct: 110, maxPct: 120,  value: 1.25 },
      { minPct: 120, maxPct: null, value: 1.35 },
    ],
  };

  it("accepts valid scale with null maxPct on last tier", () => {
    const r = validateCommissionScale(validScale);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.tiers).toHaveLength(7);
      expect(r.value.tiers[6].maxPct).toBe(Infinity);
    }
  });

  it("rejects invalid channel", () => {
    const r = validateCommissionScale({ ...validScale, channel: "online" });
    expect(r.ok).toBe(false);
  });

  it("rejects < 2 tiers", () => {
    const r = validateCommissionScale({
      ...validScale,
      tiers: [{ minPct: 0, maxPct: null, value: 0 }],
    });
    expect(r.ok).toBe(false);
  });

  it("rejects first tier not starting at 0", () => {
    const r = validateCommissionScale({
      ...validScale,
      tiers: [
        { minPct: 10, maxPct: 70, value: 0 },
        { minPct: 70, maxPct: null, value: 0.85 },
      ],
    });
    expect(r.ok).toBe(false);
  });

  it("rejects last tier without Infinity", () => {
    const r = validateCommissionScale({
      ...validScale,
      tiers: [
        { minPct: 0, maxPct: 70, value: 0 },
        { minPct: 70, maxPct: 120, value: 0.85 },
      ],
    });
    expect(r.ok).toBe(false);
  });
});

// ─── Numeric Param ─────────────────────────────────────────────────────────

describe("validateNumericParam", () => {
  it("accepts in-range value", () => {
    const r = validateNumericParam(0.40, 0, 10);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(0.40);
  });

  it("rejects non-number", () => {
    expect(validateNumericParam("hello", 0, 10).ok).toBe(false);
    expect(validateNumericParam(null, 0, 10).ok).toBe(false);
  });

  it("rejects out of range", () => {
    expect(validateNumericParam(-1, 0, 10).ok).toBe(false);
    expect(validateNumericParam(11, 0, 10).ok).toBe(false);
  });

  it("accepts boundary values", () => {
    expect(validateNumericParam(0, 0, 10).ok).toBe(true);
    expect(validateNumericParam(10, 0, 10).ok).toBe(true);
  });
});
