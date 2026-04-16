/**
 * domain/lifecycle/analyses.ts
 *
 * Tres análisis constantes que corren independiente del waterfall.
 * Fuente: Rodrigo Aguayo, email 09/04/2026 — "Acción Constante".
 *
 * 1. Reposición de tallas: detectar %OOS por SKU × tienda
 * 2. Asignación de tienda: comparar STH × SKU por tienda vs promedio red
 * 3. Cobertura de ventas: DOI derivado de STH
 *
 * Pure functions — no React, no side effects.
 */
import type { InventoryRecord } from "@/domain/actionQueue/types";
import type { SthRecord } from "@/queries/sth.queries";
import { calcDoiFromSth } from "./sth";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SizeRepositionAlert {
  sku: string;
  skuComercial: string;
  description: string;
  brand: string;
  store: string;
  /** Tallas presentes en esta tienda */
  presentSizes: string[];
  /** Tallas disponibles en OTRAS tiendas (para completar curva) */
  availableElsewhere: string[];
  /** Tallas faltantes que NO están en ninguna tienda */
  missingEverywhere: string[];
  /** % de tallas cubiertas vs total conocido */
  coveragePct: number;
}

export interface StoreAssignmentAlert {
  sku: string;
  store: string;
  brand: string;
  /** STH de este SKU en esta tienda (0-100) */
  storeSth: number;
  /** STH promedio de este SKU en toda la red (0-100) */
  networkAvgSth: number;
  /** Diferencia: storeSth - networkAvgSth */
  gap: number;
  /** true si la tienda rinde peor que el promedio */
  isUnderperforming: boolean;
}

export interface CoverageAlert {
  sku: string;
  store: string;
  brand: string;
  /** STH actual (0-100) */
  sth: number;
  /** Edad del cohorte en días */
  ageDays: number;
  /** DOI derivado = age × (1-STH) / STH */
  derivedDoi: number;
  /** true si la cobertura derivada supera el threshold */
  isInsufficient: boolean;
}

// ─── 1. Reposición de tallas ────────────────────────────────────────────────

/**
 * Detecta quiebre de tallas por SKU en cada tienda.
 * Compara las tallas presentes en la tienda vs todas las tallas conocidas
 * para ese SKU en la red.
 *
 * Solo analiza tiendas B2C (no depósitos, no B2B).
 */
export function analyzeSizeReposition(records: InventoryRecord[]): SizeRepositionAlert[] {
  // Build: sku → { allSizes: Set, byStore: Map<store, {sizes, record}> }
  const skuIndex = new Map<string, {
    allSizes: Set<string>;
    byStore: Map<string, { sizes: Set<string>; record: InventoryRecord }>;
  }>();

  for (const r of records) {
    if (r.channel !== "b2c") continue;
    const store = r.store.toUpperCase();
    if (store === "STOCK" || store === "RETAILS") continue;

    let entry = skuIndex.get(r.sku);
    if (!entry) {
      entry = { allSizes: new Set(), byStore: new Map() };
      skuIndex.set(r.sku, entry);
    }
    entry.allSizes.add(r.talle);
    let storeEntry = entry.byStore.get(store);
    if (!storeEntry) {
      storeEntry = { sizes: new Set(), record: r };
      entry.byStore.set(store, storeEntry);
    }
    storeEntry.sizes.add(r.talle);
  }

  const alerts: SizeRepositionAlert[] = [];

  for (const [sku, { allSizes, byStore }] of skuIndex) {
    if (allSizes.size <= 1) continue; // single-size SKU, nothing to analyze

    for (const [store, { sizes, record }] of byStore) {
      if (sizes.size >= allSizes.size) continue; // store has all sizes

      const missing = [...allSizes].filter(s => !sizes.has(s));
      const availableElsewhere: string[] = [];
      const missingEverywhere: string[] = [];

      for (const m of missing) {
        let found = false;
        for (const [otherStore, other] of byStore) {
          if (otherStore !== store && other.sizes.has(m)) {
            found = true;
            break;
          }
        }
        if (found) availableElsewhere.push(m);
        else missingEverywhere.push(m);
      }

      alerts.push({
        sku,
        skuComercial: record.skuComercial,
        description: record.description,
        brand: record.brand,
        store,
        presentSizes: [...sizes].sort(),
        availableElsewhere: availableElsewhere.sort(),
        missingEverywhere: missingEverywhere.sort(),
        coveragePct: allSizes.size > 0 ? (sizes.size / allSizes.size) * 100 : 100,
      });
    }
  }

  // Sort by coverage ascending (worst first)
  alerts.sort((a, b) => a.coveragePct - b.coveragePct);
  return alerts;
}

// ─── 2. Asignación de tienda ────────────────────────────────────────────────

/**
 * Compara STH de cada SKU por tienda vs el promedio de la red.
 * Identifica tiendas que rinden peor que el promedio para sugerir reasignación.
 */
export function analyzeStoreAssignment(
  sthData: Map<string, SthRecord>,
): StoreAssignmentAlert[] {
  // Group by SKU (strip store from key)
  const skuGroups = new Map<string, Array<{ store: string; sth: number; brand: string }>>();

  for (const [key, record] of sthData) {
    const parts = key.split("|");
    if (parts.length < 2) continue;
    const [store, sku] = parts;
    const sth = record.sth * 100; // Convert 0-1 → 0-100

    let group = skuGroups.get(sku);
    if (!group) {
      group = [];
      skuGroups.set(sku, group);
    }
    group.push({ store, sth, brand: "" }); // brand not available in SthRecord
  }

  const alerts: StoreAssignmentAlert[] = [];

  for (const [sku, stores] of skuGroups) {
    if (stores.length < 2) continue; // need at least 2 stores to compare
    const avgSth = stores.reduce((s, x) => s + x.sth, 0) / stores.length;

    for (const { store, sth, brand } of stores) {
      const gap = sth - avgSth;
      if (gap < -5) { // only flag if >5pp below average
        alerts.push({
          sku,
          store,
          brand,
          storeSth: sth,
          networkAvgSth: Math.round(avgSth * 100) / 100,
          gap: Math.round(gap * 100) / 100,
          isUnderperforming: true,
        });
      }
    }
  }

  alerts.sort((a, b) => a.gap - b.gap); // worst performers first
  return alerts;
}

// ─── 3. Cobertura de ventas (DOI derivado) ──────────────────────────────────

/**
 * Calcula DOI derivado desde STH y alerta cuando la cobertura es insuficiente.
 * DOI = age × (1-STH) / STH (fórmula de Rodrigo).
 *
 * @param doiThreshold - Días de cobertura por encima del cual alertar (default: 90)
 */
export function analyzeCoverage(
  sthData: Map<string, SthRecord>,
  doiThreshold: number = 90,
): CoverageAlert[] {
  const alerts: CoverageAlert[] = [];

  for (const [key, record] of sthData) {
    const parts = key.split("|");
    if (parts.length < 2) continue;
    const [store, sku] = parts;
    const sth = record.sth * 100;
    const ageDays = record.cohortAgeDays;
    const derivedDoi = calcDoiFromSth(ageDays, sth);

    if (derivedDoi > doiThreshold) {
      alerts.push({
        sku,
        store,
        brand: "",
        sth,
        ageDays,
        derivedDoi,
        isInsufficient: true,
      });
    }
  }

  alerts.sort((a, b) => b.derivedDoi - a.derivedDoi); // worst first
  return alerts;
}
