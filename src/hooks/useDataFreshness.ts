/**
 * hooks/useDataFreshness.ts
 *
 * Hook compartido de freshness con dos señales:
 *   1. lastDataDay/lastDataMonth — "Datos hasta Jue 2 Abr" (verdad del dato)
 *   2. MV refresh status — punto verde/amarillo/rojo (salud del cron)
 *
 * La señal 1 viene de mv_ventas_diarias (MAX month/day del año actual).
 * La señal 2 viene de la tabla data_freshness.
 *
 * Uso:
 *   const { lastDataDay, lastDataMonth, worstStatus, getInfo } = useDataFreshness();
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  freshnessKeys,
  salesKeys,
  STALE_5MIN,
  STALE_30MIN,
  GC_60MIN,
} from "@/queries/keys";
import { fetchDataFreshness } from "@/queries/freshness.queries";
import { fetchDailySalesWide } from "@/queries/sales.queries";
import type {
  FreshnessSource,
  FreshnessInfo,
  FreshnessStatus,
} from "@/domain/freshness/types";

const EMPTY_MAP = new Map<FreshnessSource, FreshnessInfo>();

const STATUS_PRIORITY: Record<FreshnessStatus, number> = {
  ok: 0,
  stale: 1,
  unknown: 2,
  risk: 3,
};

export function useDataFreshness() {
  // ── Señal 1: MV refresh timestamps ────────────────────────────────────────
  const freshnessQ = useQuery({
    queryKey: freshnessKeys.status(),
    queryFn: fetchDataFreshness,
    staleTime: STALE_5MIN,
    gcTime: GC_60MIN,
  });

  const map = freshnessQ.data ?? EMPTY_MAP;

  // ── Señal 2: último día con datos reales (ventas diarias del año actual) ──
  const calYear = new Date().getFullYear();

  const dailyQ = useQuery({
    queryKey: salesKeys.dailyWide(calYear),
    queryFn: () => fetchDailySalesWide(calYear),
    staleTime: STALE_30MIN,
    gcTime: GC_60MIN,
  });

  const { lastDataDay, lastDataMonth } = useMemo(() => {
    const allDaily = dailyQ.data ?? [];
    if (allDaily.length === 0) return { lastDataDay: null, lastDataMonth: null };
    let maxMonth = 0;
    let maxDay = 0;
    for (const r of allDaily) {
      if (r.month > maxMonth || (r.month === maxMonth && r.day > maxDay)) {
        maxMonth = r.month;
        maxDay = r.day;
      }
    }
    return {
      lastDataDay: maxDay || null,
      lastDataMonth: maxMonth || null,
    };
  }, [dailyQ.data]);

  return {
    /** Último día con datos reales (1-31). null si no hay datos del año actual. */
    lastDataDay,
    /** Mes del último dato real (1-12). null si no hay datos del año actual. */
    lastDataMonth,

    freshnessMap: map,
    isLoading: freshnessQ.isLoading,

    /** Estado de una fuente específica. 'unknown' si no hay datos. */
    getStatus(source: FreshnessSource): FreshnessStatus {
      return map.get(source)?.computedStatus ?? "unknown";
    },

    /** Info completa de una fuente. undefined si no hay datos. */
    getInfo(source: FreshnessSource): FreshnessInfo | undefined {
      return map.get(source);
    },

    /** El peor status de un grupo de fuentes (risk > unknown > stale > ok). */
    worstStatus(sources: FreshnessSource[]): FreshnessStatus {
      let worst: FreshnessStatus = "ok";
      for (const s of sources) {
        const status = map.get(s)?.computedStatus ?? "unknown";
        if (STATUS_PRIORITY[status] > STATUS_PRIORITY[worst]) {
          worst = status;
        }
      }
      return worst;
    },
  };
}
