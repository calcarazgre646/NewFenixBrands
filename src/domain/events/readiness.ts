/**
 * domain/events/readiness.ts
 *
 * Scorecard del evento: orquestador puro que combina los datos del evento
 * (SKUs, tiendas) con el estado del mundo (inventario, ETAs) y produce
 * EventReadiness con counters + exceptions.
 *
 * Reglas de readiness:
 *   - skusOutOfStock        → SKU sin stock > 0 en NINGUNA tienda activation
 *   - skusWithIncompleteCurve → SKU con al menos una (sku, store) incompleta
 *   - skusWithPendingArrival → SKU con import en estado != "EN STOCK"
 *   - skusFullyReady        → SKU con stock + curva completa en TODAS las tiendas activation
 *
 *   readinessPct = round(skusFullyReady / totalSkus × 100, 1)
 *
 * Pure function — sin BD ni efectos.
 */
import type {
  EventArrival,
  EventInventoryRow,
  EventReadiness,
  ReadinessException,
} from "./types";
import { computeEventCurveCoverage } from "./curveCompleteness";

export interface ReadinessInput {
  eventId: string;
  startDate: string | null;        // ISO date (YYYY-MM-DD) o null
  today?: Date;                    // inyectable para tests
  eventSkus: { skuComercial: string; brand: string }[];
  eventStores: { storeCode: string; role: "activation" | "warehouse" | "support" }[];
  inventory: EventInventoryRow[];  // inventario completo (para curva de red)
  arrivals: EventArrival[];        // ETAs filtradas a SKUs del evento
  exceptionLimit?: number;         // top N excepciones a devolver (default 20)
}

const ARRIVED_STATUS = new Set(["EN STOCK", "RECIBIDO"]);

export function computeReadiness(input: ReadinessInput): EventReadiness {
  const {
    eventId,
    startDate,
    today = new Date(),
    eventSkus,
    eventStores,
    inventory,
    arrivals,
    exceptionLimit = 20,
  } = input;

  const skuSet = new Set(eventSkus.map((s) => s.skuComercial));
  const skuMeta = new Map(eventSkus.map((s) => [s.skuComercial, s.brand]));

  // Solo activation+support cuentan para readiness (warehouse no)
  const activationStores = eventStores
    .filter((s) => s.role !== "warehouse")
    .map((s) => s.storeCode);

  const totalSkus = skuSet.size;
  const totalStores = eventStores.length;

  if (totalSkus === 0) {
    return emptyReadiness(eventId, startDate, today, totalStores);
  }

  // Index stock para queries rápidas
  // Map<"sku|store", units>
  const stockByStoreSku = new Map<string, number>();
  // Map<sku, totalUnitsAcrossAllStores>
  const totalStockBySku = new Map<string, number>();
  for (const row of inventory) {
    if (!skuSet.has(row.skuComercial)) continue;
    const stkKey = `${row.skuComercial}|${row.store}`;
    stockByStoreSku.set(stkKey, (stockByStoreSku.get(stkKey) ?? 0) + row.units);
    totalStockBySku.set(
      row.skuComercial,
      (totalStockBySku.get(row.skuComercial) ?? 0) + row.units,
    );
  }

  // Map<sku, hasPendingArrival>
  const pendingArrivals = new Set<string>();
  for (const a of arrivals) {
    if (!skuSet.has(a.skuComercial)) continue;
    if (!ARRIVED_STATUS.has(a.status.toUpperCase())) {
      pendingArrivals.add(a.skuComercial);
    }
  }

  // Curva por (sku, store) — solo activation
  const coverages = computeEventCurveCoverage(
    Array.from(skuSet),
    activationStores,
    inventory,
  );

  // Index curve coverage
  const incompleteByStoreSku = new Map<string, string[]>(); // "sku|store" → missingTalles
  const skuStoresComplete = new Map<string, Set<string>>(); // sku → Set<store completas>
  for (const c of coverages) {
    const key = `${c.skuComercial}|${c.store}`;
    if (c.isComplete) {
      const set = skuStoresComplete.get(c.skuComercial) ?? new Set<string>();
      set.add(c.store);
      skuStoresComplete.set(c.skuComercial, set);
    } else if (c.missingTalles.length > 0) {
      // Solo registramos como "curva incompleta" cuando realmente faltan talles
      // (networkTalles vacío → SKU sin stock en la red, ya capturado en no_stock)
      incompleteByStoreSku.set(key, c.missingTalles);
    }
  }

  // Counters
  let skusOutOfStock = 0;
  let skusWithIncompleteCurve = 0;
  let skusFullyReady = 0;
  for (const sku of skuSet) {
    const total = totalStockBySku.get(sku) ?? 0;
    if (total === 0) {
      skusOutOfStock += 1;
      continue;
    }
    const completeStores = skuStoresComplete.get(sku)?.size ?? 0;
    const isFullyReady =
      activationStores.length > 0 && completeStores === activationStores.length;
    if (isFullyReady) {
      skusFullyReady += 1;
    } else {
      skusWithIncompleteCurve += 1;
    }
  }

  const skusWithPendingArrival = pendingArrivals.size;

  // Exceptions (top N)
  const exceptions: ReadinessException[] = [];
  for (const sku of skuSet) {
    const brand = skuMeta.get(sku) ?? "";
    const total = totalStockBySku.get(sku) ?? 0;
    if (total === 0) {
      exceptions.push({
        type: "no_stock",
        skuComercial: sku,
        brand,
        store: null,
        detail: pendingArrivals.has(sku)
          ? "Sin stock en la red. Llegada pendiente."
          : "Sin stock en la red. Sin llegada en tránsito.",
      });
    }
  }
  for (const [key, missing] of incompleteByStoreSku) {
    const [sku, store] = key.split("|");
    if ((totalStockBySku.get(sku) ?? 0) === 0) continue; // ya capturado en no_stock
    const brand = skuMeta.get(sku) ?? "";
    exceptions.push({
      type: "missing_size",
      skuComercial: sku,
      brand,
      store,
      detail: `Faltan ${missing.length} talle${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}`,
    });
  }
  for (const sku of pendingArrivals) {
    if ((totalStockBySku.get(sku) ?? 0) === 0) continue; // ya en no_stock
    const brand = skuMeta.get(sku) ?? "";
    exceptions.push({
      type: "pending_arrival",
      skuComercial: sku,
      brand,
      store: null,
      detail: "Importación en tránsito (no recibida).",
    });
  }

  exceptions.sort((a, b) => severityRank(a.type) - severityRank(b.type));
  const limitedExceptions = exceptions.slice(0, exceptionLimit);

  const readinessPct =
    totalSkus === 0 ? 0 : Math.round((skusFullyReady / totalSkus) * 1000) / 10;

  return {
    eventId,
    daysToEvent: computeDaysToEvent(startDate, today),
    totalSkus,
    totalStores,
    skusOutOfStock,
    skusWithIncompleteCurve,
    skusWithPendingArrival,
    skusFullyReady,
    readinessPct,
    exceptions: limitedExceptions,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function severityRank(type: ReadinessException["type"]): number {
  switch (type) {
    case "no_stock": return 0;
    case "missing_size": return 1;
    case "pending_arrival": return 2;
  }
}

function computeDaysToEvent(startDate: string | null, today: Date): number | null {
  if (!startDate) return null;
  const start = new Date(`${startDate}T00:00:00Z`);
  if (Number.isNaN(start.getTime())) return null;
  const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const diffMs = start.getTime() - todayUtc.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

function emptyReadiness(
  eventId: string,
  startDate: string | null,
  today: Date,
  totalStores: number,
): EventReadiness {
  return {
    eventId,
    daysToEvent: computeDaysToEvent(startDate, today),
    totalSkus: 0,
    totalStores,
    skusOutOfStock: 0,
    skusWithIncompleteCurve: 0,
    skusWithPendingArrival: 0,
    skusFullyReady: 0,
    readinessPct: 0,
    exceptions: [],
  };
}
