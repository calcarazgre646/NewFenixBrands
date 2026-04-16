import { describe, it, expect } from "vitest";
import { computeConfigDiff } from "../diff";

const empty = { appParams: [], storeConfig: [], commissionConfig: [] };

describe("computeConfigDiff", () => {
  it("returns empty diff when snapshots are identical", () => {
    const snap = {
      appParams: [{ key: "minImpactGs", value: 500000 }],
      storeConfig: [{ store_code: "MCAL", cluster: "A" }],
      commissionConfig: [{ role: "vendedor_retail", tiers: [{ min: 0, pct: 0.02 }] }],
    };
    expect(computeConfigDiff(snap, snap)).toEqual([]);
  });

  it("detects change in app_params JSONB value", () => {
    const prev = {
      ...empty,
      appParams: [{ key: "minImpactGs", value: 500000 }],
    };
    const curr = {
      ...empty,
      appParams: [{ key: "minImpactGs", value: 1000000 }],
    };
    const diff = computeConfigDiff(prev, curr);
    expect(diff).toEqual([
      { table: "app_params", key: "minImpactGs", field: "value", old: 500000, new: 1000000 },
    ]);
  });

  it("detects change in config_store (cluster, assortment)", () => {
    const prev = {
      ...empty,
      storeConfig: [{ store_code: "MCAL", cluster: "A", assortment: 100 }],
    };
    const curr = {
      ...empty,
      storeConfig: [{ store_code: "MCAL", cluster: "B", assortment: 80 }],
    };
    const diff = computeConfigDiff(prev, curr);
    expect(diff).toHaveLength(2);
    expect(diff).toContainEqual({ table: "config_store", key: "MCAL", field: "cluster", old: "A", new: "B" });
    expect(diff).toContainEqual({ table: "config_store", key: "MCAL", field: "assortment", old: 100, new: 80 });
  });

  it("detects change in config_commission_scale tiers", () => {
    const prevTiers = [{ min: 0, pct: 0.02 }];
    const currTiers = [{ min: 0, pct: 0.03 }, { min: 100, pct: 0.05 }];
    const prev = {
      ...empty,
      commissionConfig: [{ role: "vendedor_retail", tiers: prevTiers }],
    };
    const curr = {
      ...empty,
      commissionConfig: [{ role: "vendedor_retail", tiers: currTiers }],
    };
    const diff = computeConfigDiff(prev, curr);
    expect(diff).toEqual([
      { table: "config_commission_scale", key: "vendedor_retail", field: "tiers", old: prevTiers, new: currTiers },
    ]);
  });

  it("detects added rows", () => {
    const prev = { ...empty, appParams: [] };
    const curr = { ...empty, appParams: [{ key: "newParam", value: 42 }] };
    const diff = computeConfigDiff(prev, curr);
    expect(diff).toEqual([
      { table: "app_params", key: "newParam", field: "value", old: undefined, new: 42 },
    ]);
  });

  it("detects removed rows", () => {
    const prev = { ...empty, storeConfig: [{ store_code: "OLD", cluster: "A" }] };
    const curr = { ...empty, storeConfig: [] };
    const diff = computeConfigDiff(prev, curr);
    expect(diff).toEqual([
      { table: "config_store", key: "OLD", field: "cluster", old: "A", new: undefined },
    ]);
  });

  it("handles empty snapshots", () => {
    expect(computeConfigDiff(empty, empty)).toEqual([]);
  });

  it("handles multiple tables changing simultaneously", () => {
    const prev = {
      appParams: [{ key: "a", value: 1 }],
      storeConfig: [{ store_code: "S1", cluster: "A" }],
      commissionConfig: [{ role: "r1", tiers: [] }],
    };
    const curr = {
      appParams: [{ key: "a", value: 2 }],
      storeConfig: [{ store_code: "S1", cluster: "B" }],
      commissionConfig: [{ role: "r1", tiers: [{ min: 0, pct: 0.1 }] }],
    };
    const diff = computeConfigDiff(prev, curr);
    expect(diff).toHaveLength(3);
    expect(diff.map(d => d.table)).toContain("app_params");
    expect(diff.map(d => d.table)).toContain("config_store");
    expect(diff.map(d => d.table)).toContain("config_commission_scale");
  });

  it("ignores key field itself in diffs", () => {
    const snap = {
      ...empty,
      appParams: [{ key: "x", value: 10 }],
    };
    const diff = computeConfigDiff(snap, snap);
    // No change reported for "key" field
    expect(diff.filter(d => d.field === "key")).toHaveLength(0);
  });
});
