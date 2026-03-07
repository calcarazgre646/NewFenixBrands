/**
 * features/action-queue/hooks/useActionQueue.ts
 *
 * Orchestrates inventory + sales history fetches, then runs the
 * waterfall algorithm to produce the prioritized action queue.
 *
 * Pattern: fetch data → compute pure → memoize result.
 */
import { useMemo, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchInventory, toInventoryRecord } from "@/queries/inventory.queries";
import { fetchSalesHistory } from "@/queries/salesHistory.queries";
import type { SalesHistoryMap } from "@/queries/salesHistory.queries";
import { inventoryKeys, salesHistoryKeys } from "@/queries/keys";
import { getStoreCluster } from "@/domain/actionQueue/clusters";
import { computeActionQueue } from "@/domain/actionQueue/waterfall";
import type { ActionItemFull } from "@/domain/actionQueue/waterfall";
import type { InventoryRecord } from "@/domain/actionQueue/types";

const STALE_30MIN = 30 * 60 * 1000;
const GC_60MIN    = 60 * 60 * 1000;

// ─── Public types ────────────────────────────────────────────────────────────

export type ChannelMode = "b2c" | "b2b";

export interface ActionQueueFilters {
  channel: ChannelMode;
  brand: string | null;
  linea: string | null;
  categoria: string | null;
  store: string | null;
}

export interface ActionQueueData {
  items: ActionItemFull[];
  totalItems: number;
  paretoCount: number;
  criticalCount: number;
  lowCount: number;
  overstockCount: number;
  uniqueSkus: number;
  filters: ActionQueueFilters;
  setChannel: (ch: ChannelMode) => void;
  setBrand: (b: string | null) => void;
  setLinea: (l: string | null) => void;
  setCategoria: (c: string | null) => void;
  setStore: (s: string | null) => void;
  clearFilters: () => void;
  hasFilters: boolean;
  isLoading: boolean;
  isHistoryLoading: boolean;
  error: string | null;
  availableBrands: string[];
  availableLineas: string[];
  availableCategorias: string[];
  availableStores: string[];
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useActionQueue(): ActionQueueData {
  const [channel, setChannel] = useState<ChannelMode>("b2c");
  const [brand, setBrand] = useState<string | null>(null);
  const [linea, setLinea] = useState<string | null>(null);
  const [categoria, setCategoria] = useState<string | null>(null);
  const [store, setStore] = useState<string | null>(null);

  const clearFilters = useCallback(() => {
    setBrand(null);
    setLinea(null);
    setCategoria(null);
    setStore(null);
  }, []);

  const hasFilters = brand !== null || linea !== null || categoria !== null || store !== null;

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
    queryKey: salesHistoryKeys.byStore(uniqueSkuList, 12),
    queryFn: () => fetchSalesHistory(uniqueSkuList),
    enabled: uniqueSkuList.length > 0,
    staleTime: STALE_30MIN,
    gcTime: GC_60MIN,
  });

  const bestDayMap = useMemo(() => new Map<string, string>(), []);

  // ── Extract available filter options ───────────────────────────────────────
  const { availableBrands, availableLineas, availableCategorias, availableStores } = useMemo(() => {
    const brands     = new Set<string>();
    const lineas     = new Set<string>();
    const categorias = new Set<string>();
    const stores     = new Set<string>();
    for (const r of records) {
      if (r.brand) brands.add(r.brand);
      if (r.linea && r.linea !== "Sin linea") lineas.add(r.linea);
      if (r.categoria && r.categoria !== "Sin categoria") categorias.add(r.categoria);
      if (r.store) stores.add(r.store);
    }
    return {
      availableBrands: Array.from(brands).sort(),
      availableLineas: Array.from(lineas).sort(),
      availableCategorias: Array.from(categorias).sort(),
      availableStores: Array.from(stores).sort(),
    };
  }, [records]);

  // ── Run waterfall algorithm ────────────────────────────────────────────────
  const items = useMemo(() => {
    if (records.length === 0) return [];
    const history: SalesHistoryMap = historyQ.data ?? new Map();
    return computeActionQueue(
      { inventory: records, salesHistory: history, bestDayMap },
      channel,
      brand,
      linea,
      categoria,
      store,
    );
  }, [records, historyQ.data, bestDayMap, channel, brand, linea, categoria, store]);

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

  return {
    items,
    totalItems,
    paretoCount,
    criticalCount,
    lowCount,
    overstockCount,
    uniqueSkus,
    filters: { channel, brand, linea, categoria, store },
    setChannel,
    setBrand,
    setLinea,
    setCategoria,
    setStore,
    clearFilters,
    hasFilters,
    isLoading: inventoryQ.isLoading,
    isHistoryLoading: historyQ.isLoading,
    error: inventoryQ.error?.message ?? historyQ.error?.message ?? null,
    availableBrands,
    availableLineas,
    availableCategorias,
    availableStores,
  };
}
