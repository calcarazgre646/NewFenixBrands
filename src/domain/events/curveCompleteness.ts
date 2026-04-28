/**
 * domain/events/curveCompleteness.ts
 *
 * Cobertura de curva de talles para un SKU comercial en una tienda específica.
 *
 * Regla:
 *   - "Curva de la red" para un SKU = todos los talles donde existe stock > 0
 *     en cualquier tienda del universo (no solo las del evento).
 *   - "Curva en la tienda" = talles con stock > 0 en esa tienda.
 *   - Cobertura% = present / network × 100. Si network está vacío (SKU inexistente),
 *     cobertura es 0 y se marca como incompleta.
 *
 * Pure function — sin BD ni efectos.
 */
import type { CurveCoverage, EventInventoryRow } from "./types";

/**
 * Computa la curva de cada SKU comercial a partir del inventario completo
 * (no filtrado al evento). Devuelve Map<skuComercial, networkTalles[]>.
 *
 * Solo cuenta talles con stock > 0 — un talle existe en la red si al menos
 * una tienda lo tiene en stock.
 */
export function computeNetworkCurves(
  inventory: EventInventoryRow[],
): Map<string, string[]> {
  const curves = new Map<string, Set<string>>();
  for (const row of inventory) {
    if (row.units <= 0) continue;
    const set = curves.get(row.skuComercial) ?? new Set();
    set.add(row.talle);
    curves.set(row.skuComercial, set);
  }
  const result = new Map<string, string[]>();
  for (const [sku, set] of curves) {
    result.set(sku, Array.from(set).sort());
  }
  return result;
}

/**
 * Computa cobertura de curva para cada (sku_comercial, store) del evento.
 *
 * @param eventSkus    SKUs comerciales del evento
 * @param eventStores  Tiendas del evento (solo las activation+support, NO warehouse)
 * @param inventory    Inventario COMPLETO (no filtrado) — necesario para computar la curva de la red
 * @returns Una fila por cada combinación (sku, store) del evento
 */
export function computeEventCurveCoverage(
  eventSkus: string[],
  eventStores: string[],
  inventory: EventInventoryRow[],
): CurveCoverage[] {
  if (eventSkus.length === 0 || eventStores.length === 0) return [];

  const networkCurves = computeNetworkCurves(inventory);

  // Index inventory: Map<"sku|store", Set<talle>>
  const stockByStore = new Map<string, Set<string>>();
  for (const row of inventory) {
    if (row.units <= 0) continue;
    const key = `${row.skuComercial}|${row.store}`;
    const set = stockByStore.get(key) ?? new Set();
    set.add(row.talle);
    stockByStore.set(key, set);
  }

  const result: CurveCoverage[] = [];
  for (const sku of eventSkus) {
    const networkTalles = networkCurves.get(sku) ?? [];
    for (const store of eventStores) {
      const presentSet = stockByStore.get(`${sku}|${store}`) ?? new Set<string>();
      const presentTalles = Array.from(presentSet).sort();
      const missingTalles = networkTalles.filter((t) => !presentSet.has(t));
      const coveragePct =
        networkTalles.length === 0
          ? 0
          : Math.round((presentTalles.length / networkTalles.length) * 1000) / 10;
      result.push({
        skuComercial: sku,
        store,
        presentTalles,
        networkTalles,
        missingTalles,
        coveragePct,
        isComplete: networkTalles.length > 0 && missingTalles.length === 0,
      });
    }
  }
  return result;
}

/**
 * Resume cobertura por SKU: promedio de % en las tiendas del evento.
 * Útil para tabla SKU-level del dashboard.
 */
export function summarizeCoverageBySku(
  coverages: CurveCoverage[],
): Map<string, { avgCoveragePct: number; storesComplete: number; storesIncomplete: number }> {
  const grouped = new Map<string, { sum: number; complete: number; incomplete: number; count: number }>();
  for (const c of coverages) {
    const acc = grouped.get(c.skuComercial) ?? { sum: 0, complete: 0, incomplete: 0, count: 0 };
    acc.sum += c.coveragePct;
    if (c.isComplete) acc.complete += 1;
    else acc.incomplete += 1;
    acc.count += 1;
    grouped.set(c.skuComercial, acc);
  }
  const result = new Map<string, { avgCoveragePct: number; storesComplete: number; storesIncomplete: number }>();
  for (const [sku, { sum, complete, incomplete, count }] of grouped) {
    result.set(sku, {
      avgCoveragePct: count === 0 ? 0 : Math.round((sum / count) * 10) / 10,
      storesComplete: complete,
      storesIncomplete: incomplete,
    });
  }
  return result;
}
