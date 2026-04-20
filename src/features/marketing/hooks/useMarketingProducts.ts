/**
 * features/marketing/hooks/useMarketingProducts.ts
 *
 * Hook para datos de performance de productos desde perspectiva de marketing.
 * Usa fetchProductPerformance (fjdhstvta1 + Dim_maestro_comercial via dataClient).
 * Filtrado por marca + canal + período — lee useFilters().
 */
import { useQuery } from "@tanstack/react-query";
import { marketingKeys, STALE_30MIN, GC_60MIN } from "@/queries/keys";
import {
  fetchProductPerformance,
  type PimSummary,
} from "@/queries/marketing.queries";
import { useFilters } from "@/hooks/useFilters";
import { brandIdToCanonical } from "@/api/normalize";
import { getCalendarMonth, getCalendarYear } from "@/domain/period/helpers";
import type { PeriodFilter } from "@/domain/filters/types";

const EMPTY: PimSummary = {
  topSellers: [],
  slowMovers: [],
  totalProducts: 0,
  byBrand: [],
  byType: [],
};

function resolveMonths(period: PeriodFilter, year: number): number[] {
  const calMonth = getCalendarMonth();
  const calYear = getCalendarYear();
  const isCurrentYear = year === calYear;
  switch (period) {
    case "ytd":
      return isCurrentYear
        ? Array.from({ length: calMonth }, (_, i) => i + 1)
        : Array.from({ length: 12 }, (_, i) => i + 1);
    case "lastClosedMonth":
      return isCurrentYear ? (calMonth > 1 ? [calMonth - 1] : []) : [12];
    case "currentMonth":
      return [calMonth];
  }
}

export function useMarketingProducts() {
  const { filters } = useFilters();
  const brandCanonical = filters.brand !== "total" ? brandIdToCanonical(filters.brand) : null;
  const months = resolveMonths(filters.period, filters.year);
  const channel = filters.channel;

  const q = useQuery({
    queryKey: marketingKeys.products(filters.year, filters.period, channel, brandCanonical),
    queryFn: async () => {
      // eslint-disable-next-line no-console
      console.log("[marketing/products] fetch", { year: filters.year, period: filters.period, months, channel, brand: brandCanonical });
      const result = await fetchProductPerformance({
        year: filters.year,
        months,
        channel,
        brandCanonical,
      });
      // eslint-disable-next-line no-console
      console.log("[marketing/products] result", { topSellers: result.topSellers.length, slowMovers: result.slowMovers.length, firstTop: result.topSellers[0]?.sku });
      return result;
    },
    staleTime: STALE_30MIN,
    gcTime: GC_60MIN,
    enabled: months.length > 0,
  });

  return {
    data: q.data ?? EMPTY,
    isLoading: q.isLoading,
    error: q.error,
  };
}
