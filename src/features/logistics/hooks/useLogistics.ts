/**
 * features/logistics/hooks/useLogistics.ts
 *
 * Orchestrates import data fetch + domain logic for the logistics page.
 * Pattern: fetch → transform pure → filter → memoize.
 */
import { useMemo, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchLogisticsImports } from "@/queries/logistics.queries";
import { logisticsKeys } from "@/queries/keys";
import { toArrivals, groupArrivals, computeSummary } from "@/domain/logistics/arrivals";
import type { LogisticsArrival, LogisticsGroup, LogisticsSummary } from "@/domain/logistics/types";

const STALE_15MIN = 15 * 60 * 1000;
const GC_30MIN    = 30 * 60 * 1000;

export interface LogisticsFilters {
  brand:    string | null;
  category: string | null;
  showPast: boolean;
}

export interface LogisticsData {
  arrivals:    LogisticsArrival[];
  groups:      LogisticsGroup[];
  summary:     LogisticsSummary;
  filters:     LogisticsFilters;
  setBrand:    (b: string | null) => void;
  setCategory: (c: string | null) => void;
  togglePast:  () => void;
  clearFilters: () => void;
  hasFilters:  boolean;
  isLoading:   boolean;
  error:       string | null;
  availableBrands:     string[];
  availableCategories: string[];
}

export function useLogistics(): LogisticsData {
  const [brand, setBrand]       = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [showPast, setShowPast] = useState(false);

  const togglePast = useCallback(() => setShowPast(p => !p), []);
  const clearFilters = useCallback(() => {
    setBrand(null);
    setCategory(null);
    setShowPast(false);
  }, []);

  const hasFilters = brand !== null || category !== null || showPast;

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

  // ── Available filter options ───────────────────────────────────────────────
  const { availableBrands, availableCategories } = useMemo(() => {
    const brands = new Set<string>();
    const cats   = new Set<string>();
    for (const a of allArrivals) {
      if (a.brand) brands.add(a.brand);
      if (a.category) cats.add(a.category);
    }
    return {
      availableBrands:     Array.from(brands).sort(),
      availableCategories: Array.from(cats).sort(),
    };
  }, [allArrivals]);

  // ── Apply filters ──────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return allArrivals.filter(a => {
      if (!showPast && a.status === "past") return false;
      if (brand && a.brandNorm !== brand.toLowerCase()) return false;
      if (category && a.category.toLowerCase() !== category.toLowerCase()) return false;
      return true;
    });
  }, [allArrivals, brand, category, showPast]);

  // ── Group + summary ────────────────────────────────────────────────────────
  const groups  = useMemo(() => groupArrivals(filtered), [filtered]);
  const summary = useMemo(() => computeSummary(groups, filtered), [groups, filtered]);

  return {
    arrivals: filtered,
    groups,
    summary,
    filters: { brand, category, showPast },
    setBrand,
    setCategory,
    togglePast,
    clearFilters,
    hasFilters,
    isLoading: importsQ.isLoading,
    error: importsQ.error?.message ?? null,
    availableBrands,
    availableCategories,
  };
}
