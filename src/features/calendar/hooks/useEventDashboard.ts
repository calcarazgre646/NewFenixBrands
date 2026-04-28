/**
 * features/calendar/hooks/useEventDashboard.ts
 *
 * Orquestador del dashboard de un evento del calendario.
 *
 * Compone:
 *   - useEventSkus       (SKUs vinculados al evento)
 *   - useEventStores     (tiendas del evento)
 *   - fetchInventory     (inventario completo, reutilizado de TanStack cache)
 *   - fetchLogisticsImports (ETAs filtradas por brand del evento)
 *
 * Computa con domain functions:
 *   - computeReadiness        (scorecard)
 *   - computeEventCurveCoverage + summarizeCoverageBySku (curva)
 *
 * Devuelve datos listos para el EventDashboardPage y los widgets.
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  inventoryKeys,
  logisticsKeys,
  STALE_30MIN,
  GC_60MIN,
} from "@/queries/keys";
import { fetchInventory, type InventoryItem } from "@/queries/inventory.queries";
import { fetchLogisticsImports } from "@/queries/logistics.queries";
import {
  computeReadiness,
  type ReadinessInput,
} from "@/domain/events/readiness";
import {
  computeEventCurveCoverage,
  summarizeCoverageBySku,
} from "@/domain/events/curveCompleteness";
import type {
  EventArrival,
  EventInventoryRow,
  EventReadiness,
} from "@/domain/events/types";
import { useEventSkus } from "./useEventSkus";
import { useEventStores } from "./useEventStores";

export interface EventDashboardInput {
  eventId: string | null | undefined;
  startDate: string | null;       // ISO date para daysToEvent
}

export interface EventDashboardData {
  eventId: string | null;
  // raw entities
  skus: ReturnType<typeof useEventSkus>["skus"];
  stores: ReturnType<typeof useEventStores>["stores"];
  // computed
  readiness: EventReadiness | null;
  coverages: ReturnType<typeof computeEventCurveCoverage>;
  coverageBySku: ReturnType<typeof summarizeCoverageBySku>;
  inventory: EventInventoryRow[];     // ya filtrado a SKUs del evento (para widgets)
  inventoryFull: EventInventoryRow[]; // sin filtrar (para domain fns)
  arrivalsForBrand: EventArrival[];   // arrivals filtradas por brands del evento (informativo)
  // status
  isLoading: boolean;
  error: Error | null;
}

const ARRIVED_STATUSES = new Set(["EN STOCK", "RECIBIDO"]);

export function useEventDashboard(input: EventDashboardInput): EventDashboardData {
  const { eventId, startDate } = input;

  const skusH = useEventSkus(eventId);
  const storesH = useEventStores(eventId);

  const inventoryQ = useQuery({
    queryKey: inventoryKeys.list(),
    queryFn: fetchInventory,
    staleTime: STALE_30MIN,
    gcTime: GC_60MIN,
    enabled: !!eventId,
  });

  const arrivalsQ = useQuery({
    queryKey: logisticsKeys.imports(),
    queryFn: fetchLogisticsImports,
    staleTime: STALE_30MIN,
    gcTime: GC_60MIN,
    enabled: !!eventId,
  });

  // ─── Inventario para domain (siempre full) ───────────────────────────────
  const inventoryFull = useMemo<EventInventoryRow[]>(
    () => (inventoryQ.data ?? []).map(toEventInventoryRow),
    [inventoryQ.data],
  );

  // SKUs vinculados al evento (como sets para filtros rápidos)
  const skuSet = useMemo(
    () => new Set(skusH.skus.map((s) => s.skuComercial)),
    [skusH.skus],
  );
  const brandSet = useMemo(
    () => new Set(skusH.skus.map((s) => s.brand.toLowerCase())),
    [skusH.skus],
  );

  // ─── Inventario filtrado a SKUs del evento (para widgets) ────────────────
  const inventory = useMemo<EventInventoryRow[]>(
    () => inventoryFull.filter((r) => skuSet.has(r.skuComercial)),
    [inventoryFull, skuSet],
  );

  // ─── Arrivals informativas (por brand del evento) ────────────────────────
  // NOTE Fase A: productos_importacion no expone sku_comercial. Filtramos por
  // brand y dejamos el campo skuComercial vacío. El widget muestra esto como
  // "llegadas relevantes de la marca", no match 1-to-1 al SKU del evento.
  const arrivalsForBrand = useMemo<EventArrival[]>(() => {
    if (!arrivalsQ.data || brandSet.size === 0) return [];
    return arrivalsQ.data
      .filter((imp) => brandSet.has(imp.brand.toLowerCase()))
      .filter((imp) => !ARRIVED_STATUSES.has((imp.erpStatus ?? "").toUpperCase()))
      .map((imp) => ({
        skuComercial: "", // sin match per-SKU en Fase A
        brand: imp.brand,
        eta: imp.eta ? imp.eta.toISOString().slice(0, 10) : null,
        status: imp.erpStatus ?? "",
        units: imp.quantity,
        description: imp.description,
      }));
  }, [arrivalsQ.data, brandSet]);

  // ─── Coverages (curva por sku × store activation) ────────────────────────
  const coverages = useMemo(() => {
    const skus = skusH.skus.map((s) => s.skuComercial);
    const stores = storesH.stores
      .filter((s) => s.role !== "warehouse")
      .map((s) => s.storeCode);
    if (skus.length === 0 || stores.length === 0) return [];
    return computeEventCurveCoverage(skus, stores, inventoryFull);
  }, [skusH.skus, storesH.stores, inventoryFull]);

  const coverageBySku = useMemo(() => summarizeCoverageBySku(coverages), [coverages]);

  // ─── Readiness scorecard ─────────────────────────────────────────────────
  // Pendiente arrivals: vacío en Fase A (productos_importacion sin sku_comercial).
  const readiness = useMemo<EventReadiness | null>(() => {
    if (!eventId) return null;
    if (skusH.isLoading || storesH.isLoading || inventoryQ.isLoading) return null;
    const readinessInput: ReadinessInput = {
      eventId,
      startDate,
      eventSkus: skusH.skus.map((s) => ({ skuComercial: s.skuComercial, brand: s.brand })),
      eventStores: storesH.stores.map((s) => ({ storeCode: s.storeCode, role: s.role })),
      inventory: inventoryFull,
      arrivals: [], // Fase A: sin matching per-SKU
    };
    return computeReadiness(readinessInput);
  }, [
    eventId,
    startDate,
    skusH.skus,
    skusH.isLoading,
    storesH.stores,
    storesH.isLoading,
    inventoryFull,
    inventoryQ.isLoading,
  ]);

  return {
    eventId: eventId ?? null,
    skus: skusH.skus,
    stores: storesH.stores,
    readiness,
    coverages,
    coverageBySku,
    inventory,
    inventoryFull,
    arrivalsForBrand,
    isLoading:
      skusH.isLoading ||
      storesH.isLoading ||
      inventoryQ.isLoading ||
      arrivalsQ.isLoading,
    error: (skusH.error ?? storesH.error ?? inventoryQ.error ?? arrivalsQ.error) as Error | null,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toEventInventoryRow(item: InventoryItem): EventInventoryRow {
  return {
    sku: item.sku,
    skuComercial: item.skuComercial,
    talle: item.talle,
    brand: item.brand,
    store: item.store,
    units: item.units,
    price: item.price,
  };
}
