/**
 * features/projections/hooks/useMyProjection.ts
 *
 * Devuelve la proyección del vendedor mapeado al usuario autenticado +
 * la serie diaria para el gráfico acumulado.
 *
 * Reusa `useSellerProjections` (gerencia) filtrando por vendedorCodigo.
 * Para la serie diaria llama directamente a la query daily y construye los
 * puntos con el módulo de dominio.
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useSellerProjections } from "./useSellerProjections";
import { fetchSellerDailySales } from "@/queries/commissions.queries";
import { commissionKeys, STALE_30MIN, GC_60MIN } from "@/queries/keys";
import { buildDailyProjectionSeries } from "@/domain/projections/calculations";
import {
  getCalendarDay,
  getCalendarMonth,
  getCalendarYear,
} from "@/domain/period/helpers";
import type {
  DailyProjectionPoint,
  DailySalePoint,
  SellerProjection,
} from "@/domain/projections/types";

export interface UseMyProjectionResult {
  vendedorCodigo: number | null;
  projection: SellerProjection | null;
  series:     DailyProjectionPoint[];
  isLoading:  boolean;
  error:      Error | null;
}

export function useMyProjection(year: number, month: number): UseMyProjectionResult {
  const { profile } = useAuth();
  const vendedorCodigo = profile?.vendedorCodigo ?? null;

  const { projections, isLoading: aggLoading, error: aggError } = useSellerProjections(year, month);

  const dailyQ = useQuery({
    queryKey: commissionKeys.sellerDaily(year, month),
    queryFn: () => fetchSellerDailySales(year, month),
    staleTime: STALE_30MIN,
    gcTime: GC_60MIN,
    enabled: vendedorCodigo != null,
  });

  const projection = useMemo(() => {
    if (vendedorCodigo == null) return null;
    return projections.find(p => p.vendedorCodigo === vendedorCodigo) ?? null;
  }, [projections, vendedorCodigo]);

  const series = useMemo(() => {
    if (vendedorCodigo == null || !dailyQ.data) return [];
    const myDaily: DailySalePoint[] = dailyQ.data
      .filter(r => r.vendedorCodigo === vendedorCodigo)
      .map(r => ({ day: r.día, ventaNeta: r.ventaNeta }));
    return buildDailyProjectionSeries(
      myDaily,
      year,
      month,
      getCalendarDay(),
      getCalendarMonth(),
      getCalendarYear(),
      projection?.metaVentas ?? null,
    );
  }, [dailyQ.data, vendedorCodigo, projection, year, month]);

  return {
    vendedorCodigo,
    projection,
    series,
    isLoading: aggLoading || dailyQ.isLoading,
    error: (aggError ?? dailyQ.error) as Error | null,
  };
}
