import { describe, it, expect } from "vitest";
import { analyzeSequentially } from "../sequentialDecision";
import type { SizeCurveAnalysis, StoreSizeCurve } from "../sizeCurve";

// ─── Helpers ────────────────────────────────────────────────────────────────

function mkStoreCurve(store: string, talles: string[], cluster: string | null = "A"): StoreSizeCurve {
  return {
    store,
    storeCluster: cluster,
    sizes: talles.map(t => ({ talle: t, units: 5 })),
    presentTalles: new Set(talles),
    totalUnits: talles.length * 5,
  };
}

function mkSizeCurve(
  stores: StoreSizeCurve[],
  sku = "SKU001",
): SizeCurveAnalysis {
  const allTalles = new Set<string>();
  for (const s of stores) s.presentTalles.forEach(t => allTalles.add(t));
  const networkTalles = [...allTalles].sort();

  // Build gap sources
  const tallesWithGaps: string[] = [];
  const gapSources = new Map<string, Map<string, string[]>>();
  for (const talle of networkTalles) {
    const withTalle = stores.filter(s => s.presentTalles.has(talle));
    const without = stores.filter(s => !s.presentTalles.has(talle));
    if (without.length > 0 && withTalle.length > 0) {
      tallesWithGaps.push(talle);
      const m = new Map<string, string[]>();
      for (const miss of without) m.set(miss.store, withTalle.map(s => s.store));
      gapSources.set(talle, m);
    }
  }

  return {
    sku,
    brand: "Martel",
    description: "Test",
    networkTalles,
    stores,
    tallesWithGaps,
    gapSources,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("analyzeSequentially", () => {
  // Step 1-2: Size curve gaps with no sales data → consolidate (volume fallback)
  it("consolidate when sizes available elsewhere and current store has competitive volume", () => {
    const sizeCurve = mkSizeCurve([
      mkStoreCurve("TIENDA1", ["S", "M"]),     // 10 units
      mkStoreCurve("TIENDA2", ["S", "M", "L"]), // 15 units — TIENDA1 is 67% of leader, >= 50%
    ]);
    const result = analyzeSequentially(
      { store: "TIENDA1", storeCluster: "A", productType: "basicos", storeSth: 50, networkAvgSth: 40, storeAvgSth: 40, ageDays: 30 },
      sizeCurve,
    );
    expect(result.outcome).toBe("consolidate_here");
    expect(result.sourcableSizes).toEqual(["L"]);
    expect(result.responsibleRoles).toContain("brand_manager");
  });

  // Step 3: consolidate here when current store is best performer
  it("consolidate_here when current store is the best performer", () => {
    const sizeCurve = mkSizeCurve([
      mkStoreCurve("TIENDA1", ["S", "M"]),
      mkStoreCurve("TIENDA2", ["S", "M", "L"]),
    ]);
    const result = analyzeSequentially(
      { store: "TIENDA1", storeCluster: "A", productType: "basicos", storeSth: 50, networkAvgSth: 40, storeAvgSth: 40, ageDays: 30, bestPerformerStore: "TIENDA1", currentStoreSales: 10, bestPerformerSales: 10 },
      sizeCurve,
    );
    expect(result.outcome).toBe("consolidate_here");
    expect(result.reason).toContain("Consolidar");
  });

  // Step 3: consolidate when current store is within 80% of best
  it("consolidate_here when current store is near the best performer", () => {
    const sizeCurve = mkSizeCurve([
      mkStoreCurve("TIENDA1", ["S", "M"]),
      mkStoreCurve("TIENDA2", ["S", "M", "L"]),
    ]);
    const result = analyzeSequentially(
      { store: "TIENDA1", storeCluster: "A", productType: "basicos", storeSth: 50, networkAvgSth: 40, storeAvgSth: 40, ageDays: 30, bestPerformerStore: "TIENDA2", currentStoreSales: 9, bestPerformerSales: 10 },
      sizeCurve,
    );
    expect(result.outcome).toBe("consolidate_here");
  });

  // Step 3: move to best performer when another store is significantly better
  it("move_to_best_performer when another store sells much more", () => {
    const sizeCurve = mkSizeCurve([
      mkStoreCurve("TIENDA1", ["S", "M"]),
      mkStoreCurve("TIENDA2", ["S", "M", "L"]),
    ]);
    const result = analyzeSequentially(
      { store: "TIENDA1", storeCluster: "A", productType: "basicos", storeSth: 50, networkAvgSth: 40, storeAvgSth: 40, ageDays: 30, bestPerformerStore: "TIENDA2", currentStoreSales: 2, bestPerformerSales: 10 },
      sizeCurve,
    );
    expect(result.outcome).toBe("move_to_best_performer");
    expect(result.suggestedDestination).toBe("TIENDA2");
  });

  // No size gaps + good STH → no action
  it("no action when STH above threshold and complete curve", () => {
    const sizeCurve = mkSizeCurve([
      mkStoreCurve("TIENDA1", ["S", "M", "L"]),
      mkStoreCurve("TIENDA2", ["S", "M", "L"]),
    ]);
    const result = analyzeSequentially(
      { store: "TIENDA1", storeCluster: "A", productType: "basicos", storeSth: 80, networkAvgSth: 60, storeAvgSth: 60, ageDays: 30 },
      sizeCurve,
    );
    expect(result.outcome).toBe("no_action");
  });

  // STH below threshold but above network average → maintain
  it("maintain when STH below threshold but above network average", () => {
    const result = analyzeSequentially(
      { store: "TIENDA1", storeCluster: "A", productType: "basicos", storeSth: 25, networkAvgSth: 20, storeAvgSth: 20, ageDays: 30 },
      null,
    );
    expect(result.outcome).toBe("maintain_until_sold");
  });

  // 90d+ with high STH: Rodrigo says "revisar curva, consolidar si posible, sino mantener"
  it("90d with high STH → maintain_until_sold (not markdown, not no_action)", () => {
    const result = analyzeSequentially(
      { store: "TIENDA1", storeCluster: "A", productType: "carry_over", storeSth: 96, networkAvgSth: 40, storeAvgSth: 40, ageDays: 95 },
      null, // no size curve → can't consolidate → maintain
    );
    expect(result.outcome).toBe("maintain_until_sold");
    expect(result.reason).toContain("mantener hasta agotar");
  });

  // STH below threshold AND below network average at 60d+ in A store → cascade to B
  it("cascade A→B when STH poor at 60+ days", () => {
    const result = analyzeSequentially(
      { store: "TIENDA1", storeCluster: "A", productType: "basicos", storeSth: 30, networkAvgSth: 50, storeAvgSth: 50, ageDays: 60 },
      null,
    );
    expect(result.outcome).toBe("transfer_cascade");
    expect(result.lifecycleAction).toBe("markdown_selectivo");
  });

  // STH below threshold at 90d, OUT store → markdown (no cascade from OUT)
  it("markdown when OUT store has poor STH (no further cascade)", () => {
    const result = analyzeSequentially(
      { store: "TOSUR", storeCluster: "OUT", productType: "basicos", storeSth: 20, networkAvgSth: 50, storeAvgSth: 50, ageDays: 90 },
      null,
    );
    expect(result.outcome).toBe("markdown");
    expect(result.lifecycleAction).toBe("markdown_liquidacion");
    expect(result.responsibleRoles).toContain("gerencia_retail");
  });

  // No STH data → no_action
  it("no action when STH data unavailable", () => {
    const result = analyzeSequentially(
      { store: "TIENDA1", storeCluster: "A", productType: "basicos", storeSth: null, networkAvgSth: null, storeAvgSth: null, ageDays: null },
      null,
    );
    expect(result.outcome).toBe("no_action");
    expect(result.reason).toContain("Sin datos de STH");
  });

  // Carry over at 90d with STH 80% → no action (above 95% threshold? no, below)
  it("carry_over at 90d STH 80% → below 95% threshold → markdown", () => {
    const result = analyzeSequentially(
      { store: "TIENDA1", storeCluster: "B", productType: "carry_over", storeSth: 80, networkAvgSth: 85, storeAvgSth: 85, ageDays: 90 },
      null,
    );
    // carry_over at 90d requires ≥95%, 80% < 95% → action
    // 80% < 85% (network avg) → intervene
    expect(result.outcome).toBe("transfer_cascade");
  });

  // A store at 30d cascades to B (new: cascade min for A is 30d, not 60d)
  it("cascade A→B at 30d when STH poor (A stores cascade earlier)", () => {
    const result = analyzeSequentially(
      { store: "TIENDA1", storeCluster: "A", productType: "basicos", storeSth: 20, networkAvgSth: 40, storeAvgSth: 40, ageDays: 30 },
      null,
    );
    expect(result.outcome).toBe("transfer_cascade");
    expect(result.lifecycleAction).toBe("revisar_asignacion");
  });

  // B store at 30d does NOT cascade (B cascade min is still 60d)
  it("B store at 30d does NOT cascade — markdown instead", () => {
    const result = analyzeSequentially(
      { store: "TIENDA2", storeCluster: "B", productType: "basicos", storeSth: 20, networkAvgSth: 40, storeAvgSth: 40, ageDays: 30 },
      null,
    );
    expect(result.outcome).toBe("markdown");
    expect(result.lifecycleAction).toBe("revisar_asignacion");
  });

  // Temporada at 15d STH 5% → revisar_exhibicion (but below network avg → markdown path)
  it("temporada at 15d with STH below threshold and below avg → markdown", () => {
    const result = analyzeSequentially(
      { store: "TIENDA1", storeCluster: "A", productType: "temporada", storeSth: 5, networkAvgSth: 15, storeAvgSth: 15, ageDays: 15 },
      null,
    );
    // 15d bracket: threshold is 10% for temporada. STH 5% < 10% → below threshold
    // STH 5% < avg 15% → intervene. Bracket 15 < 30 (A cascade min) so no cascade → markdown
    expect(result.outcome).toBe("markdown");
    expect(result.lifecycleAction).toBe("revisar_exhibicion");
  });

  // No size curve provided → goes straight to STH analysis
  it("null sizeCurve goes to STH analysis directly", () => {
    const result = analyzeSequentially(
      { store: "TIENDA1", storeCluster: "A", productType: "basicos", storeSth: 90, networkAvgSth: 50, storeAvgSth: 50, ageDays: 45 },
      null,
    );
    // STH 90% ≥ threshold 40% for basicos at 45d → no action
    expect(result.outcome).toBe("no_action");
  });

  // Young SKU (age < 15) → no threshold applies → no action regardless of STH
  it("age < 15 → no bracket → no action", () => {
    const result = analyzeSequentially(
      { store: "TIENDA1", storeCluster: "A", productType: "basicos", storeSth: 1, networkAvgSth: 50, storeAvgSth: 50, ageDays: 10 },
      null,
    );
    expect(result.outcome).toBe("no_action");
  });
});
