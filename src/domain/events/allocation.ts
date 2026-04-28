/**
 * domain/events/allocation.ts
 *
 * Generador de propuesta de allocation para un evento.
 *
 * Estrategia (push, evento-driven):
 *   Para cada (sku_comercial, talle, eventStore) donde la tienda evento NO
 *   tiene stock suficiente y el talle existe en la red:
 *     1. Buscar stock en otras tiendas (no eventStores, no warehouses):
 *        → AllocationLine con reason = "transfer_from_store" / "missing_size"
 *     2. Si no hay stock externo, buscar en STOCK/RETAILS (depots):
 *        → AllocationLine con reason = "restock_from_depot"
 *     3. Si tampoco, devolver línea con units=0 y reason = "out_of_stock"
 *        (señal de compra).
 *
 * Pure function — sin BD ni efectos.
 */
import type { AllocationLine, AllocationReason, EventInventoryRow } from "./types";

export interface AllocationInput {
  eventSkus: { skuComercial: string; brand: string }[];
  eventStores: { storeCode: string; role: "activation" | "warehouse" | "support" }[];
  inventory: EventInventoryRow[];      // inventario completo
  /** Tiendas que actúan como depósito central. Default ["STOCK", "RETAILS"] */
  depotStores?: string[];
  /** Mínimo de unidades por talle por tienda activation (default 1). */
  minUnitsPerTalleStore?: number;
  /**
   * Lookup de unidades ideales por (sku_comercial, talle, store). Si está
   * definido, sobreescribe `minUnitsPerTalleStore`. Útil para alimentar
   * la curva ideal por assortment de tienda (config_store.assortment).
   * Si retorna 0 o un valor negativo, esa combinación se omite.
   */
  idealUnitsLookup?: (skuComercial: string, talle: string, storeCode: string) => number;
}

const DEFAULT_DEPOTS = ["STOCK", "RETAILS"];

export function generateAllocationProposal(input: AllocationInput): AllocationLine[] {
  const {
    eventSkus,
    eventStores,
    inventory,
    depotStores = DEFAULT_DEPOTS,
    minUnitsPerTalleStore = 1,
    idealUnitsLookup,
  } = input;

  const skuSet = new Set(eventSkus.map((s) => s.skuComercial));
  const skuMeta = new Map(eventSkus.map((s) => [s.skuComercial, s.brand]));

  const activationStores = eventStores
    .filter((s) => s.role !== "warehouse")
    .map((s) => s.storeCode);
  const eventWarehouses = eventStores
    .filter((s) => s.role === "warehouse")
    .map((s) => s.storeCode);

  if (skuSet.size === 0 || activationStores.length === 0) return [];

  // Destinos del evento (no pueden ser source)
  const destinationSet = new Set(activationStores);
  // Depots = depots globales + warehouses declarados del evento
  const depotSet = new Set([...depotStores, ...eventWarehouses]);

  // Index: Map<"sku|store", { talle → { units, sku, price, brand, description }[] }>
  // Per-store, per-talle stock list (rows can repeat per sku/talle)
  type StockKey = string; // "skuComercial|talle|store"
  const stockMap = new Map<StockKey, { sku: string; units: number; price: number }>();

  // También vamos a llevar una visión "qué talles tiene cada SKU en la red"
  const networkTallesBySku = new Map<string, Set<string>>();

  for (const row of inventory) {
    if (!skuSet.has(row.skuComercial)) continue;
    const stkKey = `${row.skuComercial}|${row.talle}|${row.store}`;
    const existing = stockMap.get(stkKey);
    if (existing) {
      existing.units += row.units;
    } else {
      stockMap.set(stkKey, { sku: row.sku, units: row.units, price: row.price });
    }
    if (row.units > 0) {
      const set = networkTallesBySku.get(row.skuComercial) ?? new Set<string>();
      set.add(row.talle);
      networkTallesBySku.set(row.skuComercial, set);
    }
  }

  const lines: AllocationLine[] = [];

  for (const sku of skuSet) {
    const brand = skuMeta.get(sku) ?? "";
    const networkTalles = Array.from(networkTallesBySku.get(sku) ?? []).sort();

    // Si el SKU no existe en ningún lado de la red → out_of_stock para cada tienda
    if (networkTalles.length === 0) {
      for (const toStore of activationStores) {
        lines.push({
          sku: "",
          skuComercial: sku,
          talle: "",
          brand,
          fromStore: null,
          toStore,
          units: 0,
          reason: "out_of_stock",
          estimatedRevenue: 0,
        });
      }
      continue;
    }

    for (const talle of networkTalles) {
      // Sources: tiendas no-evento (excluyendo depots) que tienen stock para este (sku, talle)
      const sourcesByStore: { store: string; sku: string; units: number; price: number }[] = [];
      const depotSources: { store: string; sku: string; units: number; price: number }[] = [];
      for (const store of allStoresInIndex(stockMap, sku, talle)) {
        const data = stockMap.get(`${sku}|${talle}|${store}`);
        if (!data || data.units <= 0) continue;
        if (destinationSet.has(store)) continue; // destino del evento, no source
        if (depotSet.has(store)) {
          depotSources.push({ store, ...data });
        } else {
          sourcesByStore.push({ store, ...data });
        }
      }
      // Ordenar fuentes por mayor stock primero (greedy)
      sourcesByStore.sort((a, b) => b.units - a.units);
      depotSources.sort((a, b) => b.units - a.units);

      for (const toStore of activationStores) {
        const currentInStore =
          stockMap.get(`${sku}|${talle}|${toStore}`)?.units ?? 0;
        const target = idealUnitsLookup
          ? Math.max(0, idealUnitsLookup(sku, talle, toStore))
          : minUnitsPerTalleStore;
        const need = Math.max(0, target - currentInStore);
        if (need <= 0) continue;

        // Greedy fill desde otras tiendas
        let remaining = need;
        for (const source of sourcesByStore) {
          if (remaining <= 0) break;
          if (source.units <= 0) continue;
          const take = Math.min(remaining, source.units);
          const reason: AllocationReason =
            currentInStore === 0 ? "missing_size" : "transfer_from_store";
          lines.push({
            sku: source.sku,
            skuComercial: sku,
            talle,
            brand,
            fromStore: source.store,
            toStore,
            units: take,
            reason,
            estimatedRevenue: take * source.price,
          });
          source.units -= take;
          remaining -= take;
        }

        // Greedy fill desde depots
        for (const depot of depotSources) {
          if (remaining <= 0) break;
          if (depot.units <= 0) continue;
          const take = Math.min(remaining, depot.units);
          lines.push({
            sku: depot.sku,
            skuComercial: sku,
            talle,
            brand,
            fromStore: depot.store,
            toStore,
            units: take,
            reason: "restock_from_depot",
            estimatedRevenue: take * depot.price,
          });
          depot.units -= take;
          remaining -= take;
        }

        // Si todavía falta, señal de compra
        if (remaining > 0) {
          // Tomar precio de cualquier fuente conocida del SKU/talle (o 0)
          const refPrice =
            sourcesByStore[0]?.price ??
            depotSources[0]?.price ??
            inferPrice(stockMap, sku, talle);
          lines.push({
            sku: sourcesByStore[0]?.sku ?? depotSources[0]?.sku ?? "",
            skuComercial: sku,
            talle,
            brand,
            fromStore: null,
            toStore,
            units: 0,
            reason: "out_of_stock",
            estimatedRevenue: remaining * refPrice,
          });
        }
      }
    }
  }

  return lines;
}

/**
 * Resumen de una propuesta para persistir como counters en allocation_proposals.
 */
export function summarizeProposal(lines: AllocationLine[]): {
  totalLines: number;
  totalUnits: number;
  totalRevenue: number;
} {
  let totalUnits = 0;
  let totalRevenue = 0;
  for (const l of lines) {
    totalUnits += l.units;
    totalRevenue += l.estimatedRevenue;
  }
  return { totalLines: lines.length, totalUnits, totalRevenue };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function allStoresInIndex(
  stockMap: Map<string, { sku: string; units: number; price: number }>,
  sku: string,
  talle: string,
): string[] {
  const prefix = `${sku}|${talle}|`;
  const set = new Set<string>();
  for (const key of stockMap.keys()) {
    if (key.startsWith(prefix)) {
      set.add(key.slice(prefix.length));
    }
  }
  return Array.from(set);
}

function inferPrice(
  stockMap: Map<string, { sku: string; units: number; price: number }>,
  sku: string,
  talle: string,
): number {
  for (const [key, data] of stockMap) {
    if (key.startsWith(`${sku}|${talle}|`) && data.price > 0) return data.price;
  }
  return 0;
}
