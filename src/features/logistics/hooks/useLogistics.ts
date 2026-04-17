/**
 * features/logistics/hooks/useLogistics.ts
 *
 * Orchestrates import data fetch + domain logic for the logistics page.
 * Pattern: fetch → transform pure → filter → memoize.
 *
 * Marca: viene del filtro global (useFilters) — consistente con Inicio/Ventas/Acciones.
 * showPast: único filtro local (toggle para ver embarques pasados).
 * expanded: estado interactivo de grupos expandidos (absorbe del page).
 */
import { useMemo, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchLogisticsImports } from "@/queries/logistics.queries";
import { logisticsKeys } from "@/queries/keys";
import { useFilters } from "@/hooks/useFilters";
import {
  toArrivals,
  groupArrivals,
  computeSummary,
  computeBrandPipeline,
  groupByStatus,
} from "@/domain/logistics/arrivals";
import type {
  LogisticsArrival,
  LogisticsGroup,
  LogisticsSummary,
  BrandPipelineDetail,
  StatusSection,
} from "@/domain/logistics/types";

const STALE_15MIN = 15 * 60 * 1000;
const GC_30MIN    = 30 * 60 * 1000;

export interface LogisticsData {
  arrivals:    LogisticsArrival[];
  groups:      LogisticsGroup[];
  summary:     LogisticsSummary;
  pipeline:    BrandPipelineDetail[];
  sections:    StatusSection[];
  showPast:    boolean;
  togglePast:  () => void;
  isLoading:   boolean;
  error:       string | null;
  /** Total de items con status "past" (no incluye overdue) */
  hiddenPastCount: number;
  /** Set de group keys expandidos */
  expanded:    Set<string>;
  toggleGroup: (key: string) => void;
  expandAll:   () => void;
  collapseAll: () => void;
}

export function useLogistics(): LogisticsData {
  // Marca viene del filtro global (header con avatares)
  const { filters: globalFilters } = useFilters();
  const globalBrand = globalFilters.brand; // "total" | "martel" | "wrangler" | "lee"

  const [showPast, setShowPast] = useState(false);
  const togglePast = useCallback(() => setShowPast(p => !p), []);

  // ── Expanded state (absorbe del page) ────────────────────────────────────
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggleGroup = useCallback((key: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const importsQ = useQuery({
    queryKey: logisticsKeys.imports(),
    queryFn: fetchLogisticsImports,
    staleTime: STALE_15MIN,
    gcTime: GC_30MIN,
    retry: 1,
  });

  // ── Transform to arrivals ──────────────────────────────────────────────────
  const allArrivals = useMemo(() => {
    if (!importsQ.data) return [];
    return toArrivals(importsQ.data);
  }, [importsQ.data]);

  // ── Count hidden past items (for badge display) ────────────────────────────
  const hiddenPastCount = useMemo(() => {
    if (showPast) return 0;
    return allArrivals.filter(a => a.status === "past").length;
  }, [allArrivals, showPast]);

  // ── Apply filters ──────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return allArrivals.filter(a => {
      if (!showPast && a.status === "past") return false;
      if (globalBrand !== "total" && a.brandNorm !== globalBrand) return false;
      return true;
    });
  }, [allArrivals, globalBrand, showPast]);

  // ── Group + summary + pipeline + sections ──────────────────────────────────
  const groups   = useMemo(() => groupArrivals(filtered), [filtered]);
  const summary  = useMemo(() => computeSummary(groups, filtered), [groups, filtered]);
  const pipeline = useMemo(() => computeBrandPipeline(filtered), [filtered]);
  const sections = useMemo(() => groupByStatus(groups), [groups]);

  // ── Expand/collapse all (depends on groups) ────────────────────────────────
  const expandAll = useCallback(() => {
    setExpanded(new Set(groups.map(g => g.key)));
  }, [groups]);

  const collapseAll = useCallback(() => {
    setExpanded(new Set());
  }, []);

  return {
    arrivals: filtered,
    groups,
    summary,
    pipeline,
    sections,
    showPast,
    togglePast,
    isLoading: importsQ.isLoading,
    error: importsQ.error?.message ?? null,
    hiddenPastCount,
    expanded,
    toggleGroup,
    expandAll,
    collapseAll,
  };
}
