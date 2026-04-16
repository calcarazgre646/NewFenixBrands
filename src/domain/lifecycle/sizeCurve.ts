/**
 * domain/lifecycle/sizeCurve.ts
 *
 * Análisis de curva de tallas por SKU.
 * Detecta quiebre de talla (tallas faltantes) y sugiere consolidación o reposición.
 *
 * Fuente: Rodrigo Aguayo, email 09/04/2026 — Análisis secuencial paso 1-2.
 * Pure function — no React, no side effects.
 */
import type { InventoryRecord } from "@/domain/actionQueue/types";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SizeCurveEntry {
  talle: string;
  units: number;
}

export interface StoreSizeCurve {
  store: string;
  storeCluster: string | null;
  sizes: SizeCurveEntry[];
  /** Tallas presentes en esta tienda */
  presentTalles: Set<string>;
  /** Total units across all sizes in this store */
  totalUnits: number;
}

export interface SizeCurveAnalysis {
  sku: string;
  brand: string;
  description: string;
  /** All known sizes for this SKU across the entire network */
  networkTalles: string[];
  /** Size curve per store */
  stores: StoreSizeCurve[];
  /** Tallas que existen en alguna tienda pero no en todas */
  tallesWithGaps: string[];
  /** For each missing talle in a store, which OTHER stores have it */
  gapSources: Map<string, Map<string, string[]>>; // talle → store_missing → [stores_that_have_it]
}

// ─── Core ───────────────────────────────────────────────────────────────────

/**
 * Builds a complete size curve analysis for a single SKU across all B2C stores.
 * Excludes depots (STOCK, RETAILS) and B2B stores.
 *
 * @param records All inventory records for a single SKU (pre-filtered by caller)
 * @returns Full analysis including gaps and potential sources
 */
export function buildSizeCurveForSku(records: InventoryRecord[]): SizeCurveAnalysis | null {
  if (records.length === 0) return null;

  const first = records[0];
  const networkTalles = new Set<string>();
  const storeMap = new Map<string, StoreSizeCurve>();

  for (const r of records) {
    if (r.channel !== "b2c") continue;
    const store = r.store.toUpperCase();
    if (store === "STOCK" || store === "RETAILS") continue;

    networkTalles.add(r.talle);

    let entry = storeMap.get(store);
    if (!entry) {
      entry = {
        store,
        storeCluster: r.storeCluster,
        sizes: [],
        presentTalles: new Set(),
        totalUnits: 0,
      };
      storeMap.set(store, entry);
    }
    entry.sizes.push({ talle: r.talle, units: r.units });
    entry.presentTalles.add(r.talle);
    entry.totalUnits += r.units;
  }

  if (storeMap.size === 0) return null;

  const sortedTalles = [...networkTalles].sort();
  const stores = [...storeMap.values()];

  // Find talles with gaps (exist somewhere but not everywhere)
  const tallesWithGaps: string[] = [];
  const gapSources = new Map<string, Map<string, string[]>>();

  for (const talle of sortedTalles) {
    const storesWithTalle = stores.filter(s => s.presentTalles.has(talle));
    const storesWithout = stores.filter(s => !s.presentTalles.has(talle));

    if (storesWithout.length > 0 && storesWithTalle.length > 0) {
      tallesWithGaps.push(talle);
      const sourcesByStore = new Map<string, string[]>();
      for (const missing of storesWithout) {
        sourcesByStore.set(
          missing.store,
          storesWithTalle.map(s => s.store),
        );
      }
      gapSources.set(talle, sourcesByStore);
    }
  }

  return {
    sku: first.sku,
    brand: first.brand,
    description: first.description,
    networkTalles: sortedTalles,
    stores,
    tallesWithGaps,
    gapSources,
  };
}

/**
 * Checks if a store has a complete size curve for a given SKU.
 */
export function hasCompleteCurve(
  storeCurve: StoreSizeCurve,
  networkTalles: string[],
): boolean {
  return networkTalles.every(t => storeCurve.presentTalles.has(t));
}

/**
 * Calculates the % of the network curve covered by a store.
 */
export function curveCoverage(
  storeCurve: StoreSizeCurve,
  networkTalles: string[],
): number {
  if (networkTalles.length === 0) return 100;
  const covered = networkTalles.filter(t => storeCurve.presentTalles.has(t)).length;
  return (covered / networkTalles.length) * 100;
}
