/**
 * features/marketing/hooks/useMarketingDashboard.ts
 *
 * Hook principal del dashboard de marketing.
 * - Métricas KPI
 * - Insights por trigger (cuántos clientes matchean cada regla)
 * - Auto-sync: si no hay clientes, dispara ETL automáticamente
 */
import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { marketingKeys, STALE_30MIN, GC_60MIN } from "@/queries/keys";
import {
  fetchMarketingDashboardMetrics,
  fetchSamCustomerCount,
  fetchTriggerInsights,
  fetchEtlStats,
} from "@/queries/marketing.queries";
import type { MarketingMetrics, EtlStats } from "@/domain/marketing/types";
import { useCustomerETL } from "./useCustomerETL";

const EMPTY_METRICS: MarketingMetrics = {
  totalCustomers: 0,
  reachableEmail: 0,
  reachableWhatsapp: 0,
  activeTriggers: 0,
  totalExecutions: 0,
  openRate: 0,
};

const EMPTY_ETL_STATS: EtlStats = {
  totalSynced: 0,
  withPhone: 0,
  withEmail: 0,
  withBoth: 0,
  tierBreakdown: { vip: 0, frequent: 0, occasional: 0, at_risk: 0, inactive: 0 },
  lastSyncedAt: null,
};

export function useMarketingDashboard() {
  const etl = useCustomerETL();
  const autoSyncTriggered = useRef(false);

  // ── Auto-sync: si no hay clientes, correr ETL automáticamente ──
  const { data: customerCount } = useQuery({
    queryKey: ["marketing", "customerCount"],
    queryFn: fetchSamCustomerCount,
    staleTime: STALE_30MIN,
  });

  useEffect(() => {
    if (
      customerCount === 0 &&
      !autoSyncTriggered.current &&
      !etl.isRunning
    ) {
      autoSyncTriggered.current = true;
      etl.runETL();
    }
  }, [customerCount, etl]);

  // ── Métricas del dashboard ──
  const metricsQ = useQuery({
    queryKey: marketingKeys.dashboard(),
    queryFn: fetchMarketingDashboardMetrics,
    staleTime: STALE_30MIN,
    gcTime: GC_60MIN,
    enabled: (customerCount ?? 0) > 0,
  });

  // ── ETL Stats (computed server-side via count queries) ──
  const etlQ = useQuery({
    queryKey: marketingKeys.etlStats(),
    queryFn: fetchEtlStats,
    staleTime: STALE_30MIN,
    gcTime: GC_60MIN,
    enabled: (customerCount ?? 0) > 0,
  });

  // ── Trigger insights (cuántos clientes matchean cada regla) ──
  const insightsQ = useQuery({
    queryKey: ["marketing", "insights"],
    queryFn: fetchTriggerInsights,
    staleTime: STALE_30MIN,
    gcTime: GC_60MIN,
    enabled: (customerCount ?? 0) > 0,
  });

  return {
    metrics: metricsQ.data ?? EMPTY_METRICS,
    etlStats: etlQ.data ?? EMPTY_ETL_STATS,
    insights: insightsQ.data ?? [],
    isLoading: metricsQ.isLoading || etlQ.isLoading,
    isSyncing: etl.isRunning,
    syncProgress: etl.progress,
    customerCount: customerCount ?? 0,
    error: metricsQ.error ?? etlQ.error,
    // Expose manual refresh
    runETL: etl.runETL,
  };
}
