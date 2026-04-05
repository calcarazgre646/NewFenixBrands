/**
 * Golden test: snapshot de todos los defaults.
 * Detecta cambios accidentales en valores hardcoded.
 *
 * Si un cambio es intencional, actualizar el snapshot con:
 *   npx vitest -u
 */
import { describe, it, expect } from "vitest";
import {
  DEFAULT_WATERFALL_CONFIG,
  DEFAULT_DEPOT_CONFIG,
  DEFAULT_FRESHNESS_CONFIG,
  DEFAULT_EXECUTIVE_CONFIG,
  DEFAULT_MARGIN_CONFIG,
  DEFAULT_STORE_CONFIG,
} from "../defaults";
import {
  validateWaterfallConfig,
  validateDepotConfig,
  validateFreshnessConfig,
  validateExecutiveConfig,
  validateMarginConfig,
} from "../schemas";

describe("defaults golden tests", () => {
  it("DEFAULT_WATERFALL_CONFIG matches snapshot", () => {
    expect(DEFAULT_WATERFALL_CONFIG).toMatchSnapshot();
  });

  it("DEFAULT_DEPOT_CONFIG matches snapshot", () => {
    expect(DEFAULT_DEPOT_CONFIG).toMatchSnapshot();
  });

  it("DEFAULT_FRESHNESS_CONFIG matches snapshot", () => {
    expect(DEFAULT_FRESHNESS_CONFIG).toMatchSnapshot();
  });

  it("DEFAULT_EXECUTIVE_CONFIG matches snapshot", () => {
    expect(DEFAULT_EXECUTIVE_CONFIG).toMatchSnapshot();
  });

  it("DEFAULT_MARGIN_CONFIG matches snapshot", () => {
    expect(DEFAULT_MARGIN_CONFIG).toMatchSnapshot();
  });

  // Store config has Sets which don't snapshot well — test structurally
  it("DEFAULT_STORE_CONFIG has expected structure", () => {
    expect(Object.keys(DEFAULT_STORE_CONFIG.clusters).length).toBe(20);
    expect(Object.keys(DEFAULT_STORE_CONFIG.assortments).length).toBe(12);
    expect(Object.keys(DEFAULT_STORE_CONFIG.timeRestrictions).length).toBe(12);
    expect(DEFAULT_STORE_CONFIG.excludedStores.size).toBe(21);
    expect(DEFAULT_STORE_CONFIG.b2bStores.size).toBe(3);
  });

  it("all cluster values are valid", () => {
    const valid = new Set(["A", "B", "OUT"]);
    for (const [store, cluster] of Object.entries(DEFAULT_STORE_CONFIG.clusters)) {
      expect(valid.has(cluster), `${store} has invalid cluster: ${cluster}`).toBe(true);
    }
  });

  it("all assortments are positive integers", () => {
    for (const [store, val] of Object.entries(DEFAULT_STORE_CONFIG.assortments)) {
      expect(val > 0 && Number.isInteger(val), `${store}: ${val}`).toBe(true);
    }
  });
});

describe("defaults pass their own validation", () => {
  it("waterfall config validates", () => {
    expect(validateWaterfallConfig(DEFAULT_WATERFALL_CONFIG).ok).toBe(true);
  });

  it("depot config validates", () => {
    expect(validateDepotConfig(DEFAULT_DEPOT_CONFIG).ok).toBe(true);
  });

  it("freshness config validates", () => {
    expect(validateFreshnessConfig(DEFAULT_FRESHNESS_CONFIG).ok).toBe(true);
  });

  it("executive config validates", () => {
    expect(validateExecutiveConfig(DEFAULT_EXECUTIVE_CONFIG).ok).toBe(true);
  });

  it("margin config validates", () => {
    expect(validateMarginConfig(DEFAULT_MARGIN_CONFIG).ok).toBe(true);
  });

});
