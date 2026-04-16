/**
 * features/action-queue/hooks/useActionQueue.ts
 *
 * Orchestrates inventory + sales history fetches, then runs the
 * waterfall algorithm to produce the prioritized action queue.
 *
 * Pattern: fetch data → compute pure → memoize result.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useFilters } from "@/context/FilterContext";
import { fetchInventory, toInventoryRecord } from "@/queries/inventory.queries";
import { fetchSalesHistory } from "@/queries/salesHistory.queries";
import type { SalesHistoryMap } from "@/queries/salesHistory.queries";
import { inventoryKeys, salesHistoryKeys, doiAgeKeys, sthKeys, STALE_30MIN, GC_60MIN } from "@/queries/keys";
import { persistDecisionRun, persistDecisionActions } from "@/queries/decisions.queries";
import { useAuth } from "@/context/AuthContext";
import { fetchDoiAge } from "@/queries/doiAge.queries";
import type { DoiAgeData } from "@/queries/doiAge.queries";
import { fetchSthCohort } from "@/queries/sth.queries";
import type { SthCohortData } from "@/queries/sth.queries";
import { getStoreCluster } from "@/domain/actionQueue/clusters";
import { useStoreConfig, useWaterfallConfig } from "@/hooks/useConfig";
import { computeActionQueue } from "@/domain/actionQueue/waterfall";
import type { ActionItemFull } from "@/domain/actionQueue/waterfall";
import type { InventoryRecord } from "@/domain/actionQueue/types";
import { filterActionsByRole } from "@/domain/auth/types";
// analyses.ts functions (analyzeSizeReposition, analyzeStoreAssignment, analyzeCoverage)
// are integrated into the waterfall engine via sequentialDecision.ts, not called separately.

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
  | "fetching-doi"
  | "fetching-sth"
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
  stockoutCount: number;
  lifecycleCriticalCount: number;
  lowCount: number;
  overstockCount: number;
  uniqueSkus: number;
  /** Total gap units (unmet demand across all actions) */
  totalGapUnits: number;
  /** Average inventory age in days (weighted by historicalAvg) */
  avgDOI: number;
  /** Count of movement actions (waterfall N1-N4) visible to the user */
  movementCount: number;
  /** Count of lifecycle actions visible to the user */
  lifecycleCount: number;
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
  const { user, profile } = useAuth();
  const storeConfig = useStoreConfig();
  const waterfallConfig = useWaterfallConfig();
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
        rec.storeCluster = getStoreCluster(rec.store, storeConfig.clusters);
        return rec;
      });
  }, [inventoryQ.data, storeConfig.clusters]);

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

  // ── Fetch DOI-edad (days since last movement per SKU-talle-store) ─────────
  const doiAgeQ = useQuery({
    queryKey: doiAgeKeys.list(),
    queryFn: fetchDoiAge,
    staleTime: STALE_30MIN,
    gcTime: GC_60MIN,
    retry: 1,
  });

  // ── Fetch STH cohort (sell-through rate per SKU-talle-store) ──────────────
  const sthQ = useQuery({
    queryKey: sthKeys.cohort(),
    queryFn: fetchSthCohort,
    staleTime: STALE_30MIN,
    gcTime: GC_60MIN,
    retry: 1,
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
  const computationMsRef = useRef<number>(0);

  // Pure computation — no setState inside useMemo
  const waterfallResult = useMemo<{ items: ActionItemFull[]; error: string | null; ran: boolean }>(() => {
    if (records.length === 0) return { items: [], error: null, ran: false };
    if (!historyQ.data && historyQ.isLoading) return { items: [], error: null, ran: false };
    if (doiAgeQ.isLoading || sthQ.isLoading) return { items: [], error: null, ran: false };
    const history: SalesHistoryMap = historyQ.data ?? new Map();
    const doiAge: DoiAgeData | undefined = doiAgeQ.data ?? undefined;
    const sthData: SthCohortData | undefined = sthQ.data ?? undefined;
    if (import.meta.env.DEV) {
      console.info(
        `[waterfall-input] STH: ${sthData?.exact.size ?? 0} exact, ${sthData?.byStoreSku.size ?? 0} bySku | DOI: ${doiAge?.exact.size ?? 0} exact, ${doiAge?.byStoreSku.size ?? 0} bySku`,
      );
    }
    try {
      const t0 = performance.now();
      const result = computeActionQueue(
        { inventory: records, salesHistory: history, doiAge, sthData },
        {
          mode: channel,
          brandFilter: brand,
          impactThreshold: waterfallConfig.minImpactGs,
          storeClusters: storeConfig.clusters,
          storeTimeRestrictions: storeConfig.timeRestrictions,
          waterfallConfig,
        },
      );
      const elapsed = performance.now() - t0;
      computationMsRef.current = Math.round(elapsed);
      if (import.meta.env.DEV) {
        console.info(
          `[waterfall] ${records.length} rows → ${result.length} actions (${result.filter(a => a.paretoFlag).length} pareto) in ${elapsed.toFixed(1)}ms`,
        );
      }
      return { items: result, error: null, ran: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[waterfall] computation error:", msg);
      return { items: [], error: `Error en cálculo: ${msg}`, ran: true };
    }
  }, [records, historyQ.data, historyQ.isLoading, doiAgeQ.data, doiAgeQ.isLoading, sthQ.data, sthQ.isLoading, channel, brand, storeConfig.clusters, storeConfig.timeRestrictions, waterfallConfig]);

  // Sync derived state from computation result (outside useMemo)
  useEffect(() => {
    setWaterfallRan(waterfallResult.ran);
    setWaterfallError(waterfallResult.error);
  }, [waterfallResult]);

  const items = waterfallResult.items;

  // ── Role-based filtering ──────────────────────────────────────────────────
  // The waterfall now produces BOTH movement and lifecycle actions in a single pass.
  // Filter by the logged-in user's role so each person sees only their tasks.
  const visibleItems: ActionItemFull[] = useMemo(() => {
    if (!user) return items;
    return filterActionsByRole(items, profile?.role ?? "negocio", profile?.cargo);
  }, [items, user, profile?.role, profile?.cargo]);

  // ── Fire-and-forget persistence of decision run ───────────────────────────
  const persistedRunId = useRef<string | null>(null);
  const prevFilterKey = useRef<string>("");

  useEffect(() => {
    const filterKey = JSON.stringify({ channel, brand: globalFilters.brand });
    if (filterKey !== prevFilterKey.current) {
      persistedRunId.current = null;
      prevFilterKey.current = filterKey;
    }

    if (!items.length || persistedRunId.current || !user) return;

    const totalImpact = items.reduce((sum, a) => sum + a.impactScore, 0);
    const totalGap = items.reduce((sum, a) => sum + a.gapUnits, 0);

    persistDecisionRun({
      run_type: "waterfall",
      triggered_by: user.id,
      filters_snapshot: {
        channel,
        brand: globalFilters.brand,
        year: globalFilters.year,
      },
      total_actions: items.length,
      total_gap_units: totalGap,
      total_impact_gs: totalImpact,
      pareto_count: items.filter(a => a.paretoFlag).length,
      critical_count: items.filter(a => a.risk === "critical").length,
      computation_ms: computationMsRef.current,
      inventory_row_count: records.length,
      sales_history_row_count: historyQ.data?.size ?? null,
      doi_age_row_count: doiAgeQ.data?.exact.size ?? null,
    })
      .then(runId => {
        persistedRunId.current = runId;
        return persistDecisionActions(runId, items);
      })
      .catch(err => console.error("[decision-persist]", err));
  }, [items, channel, globalFilters.brand, globalFilters.year, user, records.length, historyQ.data, doiAgeQ.data]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived stats ──────────────────────────────────────────────────────────
  const { totalItems, paretoCount, stockoutCount, lifecycleCriticalCount, lowCount, overstockCount, uniqueSkus, totalGapUnits, avgDOI, movementCount, lifecycleCount } =
    useMemo(() => {
      let pareto = 0, stockouts = 0, lcCritical = 0, low = 0, overstock = 0;
      let totalGap = 0;
      let doiWeightedSum = 0;
      let doiWeightTotal = 0;
      let movements = 0, lifecycle = 0;
      const skuSet = new Set<string>();
      for (const item of visibleItems) {
        if (item.paretoFlag) pareto++;
        if (item.risk === "critical" && item.category === "movement") stockouts++;
        if (item.risk === "critical" && item.category === "lifecycle") lcCritical++;
        if (item.risk === "low") low++;
        if (item.risk === "overstock") overstock++;
        if (item.category === "movement") movements++;
        else lifecycle++;
        totalGap += item.gapUnits;
        skuSet.add(item.sku);
        if (item.historicalAvg > 0) {
          doiWeightedSum += item.daysOfInventory * item.historicalAvg;
          doiWeightTotal += item.historicalAvg;
        }
      }
      return {
        totalItems: visibleItems.length,
        paretoCount: pareto,
        stockoutCount: stockouts,
        lifecycleCriticalCount: lcCritical,
        lowCount: low,
        overstockCount: overstock,
        uniqueSkus: skuSet.size,
        totalGapUnits: totalGap,
        avgDOI: doiWeightTotal > 0 ? doiWeightedSum / doiWeightTotal : 0,
        movementCount: movements,
        lifecycleCount: lifecycle,
      };
    }, [visibleItems]);

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
    if (doiAgeQ.isLoading) {
      return { phase: "fetching-doi", inventoryRows: records.length, uniqueSkus: uniqueSkuList.length, totalActions: 0 };
    }
    if (sthQ.isLoading) {
      return { phase: "fetching-sth", inventoryRows: records.length, uniqueSkus: uniqueSkuList.length, totalActions: 0 };
    }
    if (records.length > 0 && !waterfallRan) {
      return { phase: "computing-waterfall", inventoryRows: records.length, uniqueSkus: uniqueSkuList.length, totalActions: 0 };
    }
    return { phase: "done", inventoryRows: records.length, uniqueSkus: uniqueSkuList.length, totalActions: visibleItems.length };
  }, [inventoryQ.isLoading, records.length, uniqueSkuList.length, historyQ.isLoading, doiAgeQ.isLoading, sthQ.isLoading, waterfallRan, visibleItems.length]);

  return {
    items: visibleItems,
    storeStockMap,
    totalItems,
    paretoCount,
    stockoutCount,
    lifecycleCriticalCount,
    lowCount,
    overstockCount,
    uniqueSkus,
    totalGapUnits,
    avgDOI,
    movementCount,
    lifecycleCount,
    filters: { channel, brand: globalFilters.brand },
    setChannel,
    isLoading: inventoryQ.isLoading || (historyQ.isLoading && records.length > 0) || doiAgeQ.isLoading || sthQ.isLoading,
    isHistoryLoading: historyQ.isLoading,
    error: inventoryQ.error?.message ?? historyQ.error?.message ?? doiAgeQ.error?.message ?? waterfallError ?? null,
    loadingProgress,
  };
}
