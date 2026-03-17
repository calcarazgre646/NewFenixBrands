/**
 * features/action-queue/hooks/useActionQueue.ts
 *
 * Orchestrates inventory + sales history fetches, then runs the
 * waterfall algorithm to produce the prioritized action queue.
 *
 * Pattern: fetch data → compute pure → memoize result.
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useFilters } from "@/context/FilterContext";
import { fetchInventory, toInventoryRecord } from "@/queries/inventory.queries";
import { fetchSalesHistory } from "@/queries/salesHistory.queries";
import type { SalesHistoryMap } from "@/queries/salesHistory.queries";
import { inventoryKeys, salesHistoryKeys, STALE_30MIN, GC_60MIN } from "@/queries/keys";
import { getStoreCluster } from "@/domain/actionQueue/clusters";
import { computeActionQueue } from "@/domain/actionQueue/waterfall";
import type { ActionItemFull } from "@/domain/actionQueue/waterfall";
import type { InventoryRecord } from "@/domain/actionQueue/types";

// ─── Public types ────────────────────────────────────────────────────────────

export type ChannelMode = "b2c" | "b2b";

export interface ActionQueueFilters {
  channel: ChannelMode;
  /** Brand from global FilterContext ("total"|"martel"|"wrangler"|"lee") */
  brand: string;
}

/** Granular loading phases for transparent loading UX */
export type LoadingPhase =
  | "idle"
  | "fetching-inventory"
  | "fetching-history"
  | "computing-waterfall"
  | "done";

export interface LoadingProgress {
  phase: LoadingPhase;
  inventoryRows: number;
  uniqueSkus: number;
  totalActions: number;
}

export interface ActionQueueData {
  items: ActionItemFull[];
  /** Total units currently in stock per store (all SKUs, not just actioned ones) */
  storeStockMap: Map<string, number>;
  totalItems: number;
  paretoCount: number;
  criticalCount: number;
  lowCount: number;
  overstockCount: number;
  uniqueSkus: number;
  filters: ActionQueueFilters;
  setChannel: (ch: ChannelMode) => void;
  isLoading: boolean;
  isHistoryLoading: boolean;
  error: string | null;
  /** Granular loading progress for transparent loading UX */
  loadingProgress: LoadingProgress;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useActionQueue(): ActionQueueData {
  const { filters: globalFilters } = useFilters();
  const [channel, setChannel] = useState<ChannelMode>("b2c");

  // Brand comes from global FilterContext (header avatars)
  const brand = globalFilters.brand === "total" ? null : globalFilters.brand;

  // ── Fetch inventory ────────────────────────────────────────────────────────
  const inventoryQ = useQuery({
    queryKey: inventoryKeys.list(),
    queryFn: fetchInventory,
    staleTime: STALE_30MIN,
    gcTime: GC_60MIN,
    retry: 1,
  });

  // ── Convert to InventoryRecord + enrich storeCluster ──────────────────────
  const records: InventoryRecord[] = useMemo(() => {
    if (!inventoryQ.data) return [];
    return inventoryQ.data
      .filter(item => item.storeType !== "excluded")
      .map(item => {
        const rec = toInventoryRecord(item);
        rec.storeCluster = getStoreCluster(rec.store);
        return rec;
      });
  }, [inventoryQ.data]);

  // ── Extract unique SKUs for sales history query ────────────────────────────
  const uniqueSkuList = useMemo(() => {
    const set = new Set<string>();
    for (const r of records) set.add(r.sku);
    return Array.from(set).sort();
  }, [records]);

  // ── Fetch sales history (depends on inventory SKUs) ────────────────────────
  const historyQ = useQuery({
    queryKey: salesHistoryKeys.byStore(uniqueSkuList, 6),
    queryFn: () => fetchSalesHistory(uniqueSkuList),
    enabled: uniqueSkuList.length > 0,
    staleTime: STALE_30MIN,
    gcTime: GC_60MIN,
    retry: 1, // Consistent with inventoryQ — fail fast, don't mask Supabase issues
  });

  // ── Total stock per store (all SKUs, for occupancy display) ───────────────
  const storeStockMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of records) {
      const store = r.store.trim().toUpperCase();
      map.set(store, (map.get(store) ?? 0) + r.units);
    }
    return map;
  }, [records]);

  // ── Run waterfall algorithm ────────────────────────────────────────────────
  // IMPORTANT: Wait for sales history before computing. Running without history
  // produces wrong deficit/surplus classification that flickers when history loads.
  const [waterfallError, setWaterfallError] = useState<string | null>(null);
  const [waterfallRan, setWaterfallRan] = useState(false);
  const items = useMemo(() => {
    if (records.length === 0) { setWaterfallRan(false); return []; }
    if (!historyQ.data && historyQ.isLoading) { setWaterfallRan(false); return []; }
    const history: SalesHistoryMap = historyQ.data ?? new Map();
    try {
      const t0 = performance.now();
      const result = computeActionQueue(
        { inventory: records, salesHistory: history },
        channel,
        brand,
        null,
        null,
        null,
      );
      const elapsed = performance.now() - t0;
      if (import.meta.env.DEV) {
        console.info(
          `[waterfall] ${records.length} rows → ${result.length} actions (${result.filter(a => a.paretoFlag).length} pareto) in ${elapsed.toFixed(1)}ms`,
        );
      }
      // Clear any previous waterfall error on success
      if (waterfallError) setWaterfallError(null);
      setWaterfallRan(true);
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[waterfall] computation error:", msg);
      setWaterfallError(`Error en cálculo: ${msg}`);
      setWaterfallRan(true);
      return [];
    }
  }, [records, historyQ.data, historyQ.isLoading, channel, brand]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived stats ──────────────────────────────────────────────────────────
  const { totalItems, paretoCount, criticalCount, lowCount, overstockCount, uniqueSkus } =
    useMemo(() => {
      let pareto = 0, critical = 0, low = 0, overstock = 0;
      const skuSet = new Set<string>();
      for (const item of items) {
        if (item.paretoFlag) pareto++;
        if (item.risk === "critical") critical++;
        if (item.risk === "low") low++;
        if (item.risk === "overstock") overstock++;
        skuSet.add(item.sku);
      }
      return {
        totalItems: items.length,
        paretoCount: pareto,
        criticalCount: critical,
        lowCount: low,
        overstockCount: overstock,
        uniqueSkus: skuSet.size,
      };
    }, [items]);

  // ── Loading progress (granular phases for transparent loading UX) ─────────
  // Phase 2 ("processing-records") removed: useMemo is synchronous, so
  // records→skus happens in the same render — the phase was never visible.
  // Phase 4 ("computing-waterfall") now uses waterfallRan flag to distinguish
  // "waterfall returned 0 actions" (done) from "waterfall hasn't run yet".
  const loadingProgress: LoadingProgress = useMemo(() => {
    if (inventoryQ.isLoading) {
      return { phase: "fetching-inventory", inventoryRows: 0, uniqueSkus: 0, totalActions: 0 };
    }
    if (historyQ.isLoading && uniqueSkuList.length > 0) {
      return { phase: "fetching-history", inventoryRows: records.length, uniqueSkus: uniqueSkuList.length, totalActions: 0 };
    }
    if (records.length > 0 && !waterfallRan) {
      return { phase: "computing-waterfall", inventoryRows: records.length, uniqueSkus: uniqueSkuList.length, totalActions: 0 };
    }
    return { phase: "done", inventoryRows: records.length, uniqueSkus: uniqueSkuList.length, totalActions: items.length };
  }, [inventoryQ.isLoading, records.length, uniqueSkuList.length, historyQ.isLoading, waterfallRan, items.length]);

  return {
    items,
    storeStockMap,
    totalItems,
    paretoCount,
    criticalCount,
    lowCount,
    overstockCount,
    uniqueSkus,
    filters: { channel, brand: globalFilters.brand },
    setChannel,
    isLoading: inventoryQ.isLoading || (historyQ.isLoading && records.length > 0),
    isHistoryLoading: historyQ.isLoading,
    error: inventoryQ.error?.message ?? historyQ.error?.message ?? waterfallError ?? null,
    loadingProgress,
  };
}
