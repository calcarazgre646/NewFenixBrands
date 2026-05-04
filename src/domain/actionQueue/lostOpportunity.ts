/**
 * domain/actionQueue/lostOpportunity.ts
 *
 * Monetiza el `gapUnits` del waterfall en "déficit no cubierto" (a.k.a. venta perdida proyectada).
 * Lente "por compañía" y "por tienda" para directorio (pedido de Rod, audio 17/03/2026).
 *
 * Diferencia con purchasePlanning.ts:
 *   - purchasePlanning agrega por SKU (qué comprar).
 *   - lostOpportunity agrega por brand y por store (cuánto $ se está dejando sobre la mesa).
 *
 * Comparte el dedup por (store, sku, talle) — un mismo gap puede aparecer en N1 y N2.
 *
 * Pure function — no React, no side effects.
 */
import type { ActionItemFull } from "./waterfall";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BrandOpportunityRow {
  brand: string;
  gapUnits: number;
  lostRevenue: number;
  skuCount: number;
  storeCount: number;
}

export interface StoreOpportunityRow {
  store: string;
  gapUnits: number;
  lostRevenue: number;
  skuCount: number;
  brandsBreakdown: Array<{ brand: string; lostRevenue: number; gapUnits: number }>;
}

export interface OpportunityTotals {
  totalGapUnits: number;
  totalLostRevenue: number;
  skuCount: number;
  storeCount: number;
  brandCount: number;
}

// ─── Core ────────────────────────────────────────────────────────────────────

/**
 * Dedup por (store, sku, talle) — un mismo gap puede aparecer como N1 (transfer) y N2 (depot)
 * para la misma tienda. Tomamos el max gap por combinación.
 *
 * Idéntico patrón al usado en buildPurchasePlan.
 */
function dedupByStoreSkuTalle(items: ActionItemFull[]): ActionItemFull[] {
  const dedup = new Map<string, ActionItemFull>();
  for (const item of items) {
    if (item.gapUnits <= 0) continue;
    const key = `${item.store}|${item.sku}|${item.talle}`;
    const existing = dedup.get(key);
    if (!existing || item.gapUnits > existing.gapUnits) {
      dedup.set(key, item);
    }
  }
  return Array.from(dedup.values());
}

/**
 * Revenue por unidad derivado del impactScore del item.
 * impactScore = units × max(price,1) × marginFactor — el waterfall ya respeta el canal
 * (priceMay para B2B, price para B2C) al pre-calcularlo.
 */
export function getRevenuePerUnit(item: ActionItemFull): number {
  if (item.suggestedUnits > 0) return item.impactScore / item.suggestedUnits;
  if (item.idealUnits > 0)     return item.impactScore / item.idealUnits;
  return 0;
}

/**
 * Agrega oportunidad perdida por marca/compañía.
 * Ordena descendente por lostRevenue.
 */
export function buildOpportunityByBrand(items: ActionItemFull[]): BrandOpportunityRow[] {
  const dedup = dedupByStoreSkuTalle(items);
  if (dedup.length === 0) return [];

  const map = new Map<string, {
    gapUnits: number;
    lostRevenue: number;
    skus: Set<string>;
    stores: Set<string>;
  }>();

  for (const item of dedup) {
    const brand = item.brand || "Sin marca";
    const revenue = item.gapUnits * getRevenuePerUnit(item);
    const existing = map.get(brand);
    if (existing) {
      existing.gapUnits    += item.gapUnits;
      existing.lostRevenue += revenue;
      existing.skus.add(item.sku);
      existing.stores.add(item.store);
    } else {
      map.set(brand, {
        gapUnits: item.gapUnits,
        lostRevenue: revenue,
        skus: new Set([item.sku]),
        stores: new Set([item.store]),
      });
    }
  }

  const rows: BrandOpportunityRow[] = [];
  for (const [brand, agg] of map) {
    rows.push({
      brand,
      gapUnits: agg.gapUnits,
      lostRevenue: agg.lostRevenue,
      skuCount: agg.skus.size,
      storeCount: agg.stores.size,
    });
  }
  rows.sort((a, b) => b.lostRevenue - a.lostRevenue);
  return rows;
}

/**
 * Agrega oportunidad perdida por tienda. Cada fila incluye el desglose por marca
 * para poder mostrar "Pinedo: ₲80M (Martel ₲50M, Wrangler ₲20M, Lee ₲10M)".
 * Los depots (RETAILS/STOCK) se excluyen — no son tiendas que pierdan venta al consumidor.
 */
export function buildOpportunityByStore(
  items: ActionItemFull[],
  depotStores: ReadonlySet<string> = new Set(),
): StoreOpportunityRow[] {
  const dedup = dedupByStoreSkuTalle(items);
  if (dedup.length === 0) return [];

  const map = new Map<string, {
    gapUnits: number;
    lostRevenue: number;
    skus: Set<string>;
    byBrand: Map<string, { lostRevenue: number; gapUnits: number }>;
  }>();

  for (const item of dedup) {
    const store = item.store;
    if (depotStores.has(store)) continue;

    const brand = item.brand || "Sin marca";
    const revenue = item.gapUnits * getRevenuePerUnit(item);

    let existing = map.get(store);
    if (!existing) {
      existing = {
        gapUnits: 0,
        lostRevenue: 0,
        skus: new Set(),
        byBrand: new Map(),
      };
      map.set(store, existing);
    }
    existing.gapUnits    += item.gapUnits;
    existing.lostRevenue += revenue;
    existing.skus.add(item.sku);

    const brandAgg = existing.byBrand.get(brand);
    if (brandAgg) {
      brandAgg.lostRevenue += revenue;
      brandAgg.gapUnits    += item.gapUnits;
    } else {
      existing.byBrand.set(brand, { lostRevenue: revenue, gapUnits: item.gapUnits });
    }
  }

  const rows: StoreOpportunityRow[] = [];
  for (const [store, agg] of map) {
    const brandsBreakdown = Array.from(agg.byBrand.entries())
      .map(([brand, b]) => ({ brand, lostRevenue: b.lostRevenue, gapUnits: b.gapUnits }))
      .sort((a, b) => b.lostRevenue - a.lostRevenue);
    rows.push({
      store,
      gapUnits: agg.gapUnits,
      lostRevenue: agg.lostRevenue,
      skuCount: agg.skus.size,
      brandsBreakdown,
    });
  }
  rows.sort((a, b) => b.lostRevenue - a.lostRevenue);
  return rows;
}

/**
 * Totales globales para los stat cards de la tab.
 * No suma por brandRows porque un SKU puede repetirse entre marcas (no en este dominio,
 * pero por simetría con storeCount derivamos los counts de los items dedup).
 */
export function computeOpportunityTotals(
  items: ActionItemFull[],
  depotStores: ReadonlySet<string> = new Set(),
): OpportunityTotals {
  const dedup = dedupByStoreSkuTalle(items);
  const skus = new Set<string>();
  const stores = new Set<string>();
  const brands = new Set<string>();
  let totalGapUnits = 0;
  let totalLostRevenue = 0;

  for (const item of dedup) {
    if (depotStores.has(item.store)) continue;
    totalGapUnits    += item.gapUnits;
    totalLostRevenue += item.gapUnits * getRevenuePerUnit(item);
    skus.add(item.sku);
    stores.add(item.store);
    brands.add(item.brand || "Sin marca");
  }

  return {
    totalGapUnits,
    totalLostRevenue,
    skuCount: skus.size,
    storeCount: stores.size,
    brandCount: brands.size,
  };
}
