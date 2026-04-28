/**
 * features/commissions/hooks/useCompensation.ts
 *
 * Hook unificado de compensación. Wrapea `useSellerProjections` (gerencia) +
 * `useMyProjection` (per-vendedor) y expone una API única para la nueva
 * página `/comisiones-v2`:
 *
 *   - `time`: contexto temporal del mes (días transcurridos, restantes,
 *     isMonthClosed, isInProgress).
 *   - `rows`: una entrada por vendedor con `projection` + `result` (estado
 *     actual derivado de la proyección con días restantes = 0).
 *   - `summary`: agregado del scope (cuando scope=self es solo el vendedor).
 *   - `self`: cuando scope=self, también la serie diaria para el chart.
 *
 * No introduce queries nuevas: reusa los queryKeys ya cacheados por los
 * hooks viejos. PR 3 va a colapsar todo dentro de este hook y borrar los
 * hooks viejos.
 */
import { useMemo } from "react";
import { useCommissionScales } from "@/hooks/useConfig";
import {
  getCalendarDay,
  getCalendarMonth,
  getCalendarYear,
} from "@/domain/period/helpers";
import { resolveMonthTime, type MonthTime } from "@/domain/projections/calculations";
import { useSellerProjections } from "@/features/projections/hooks/useSellerProjections";
import { useMyProjection } from "@/features/projections/hooks/useMyProjection";
import { useCompensationScope, type CompensationScope } from "./useCompensationScope";
import {
  projectionToResult,
  buildCompensationSummary,
  type CompensationRow,
  type CompensationSummary,
} from "./derive";
import type {
  CommissionResult,
  CommissionScale,
} from "@/domain/commissions/types";
import type {
  DailyProjectionPoint,
  SellerProjection,
} from "@/domain/projections/types";

// ─── Tipos públicos ────────────────────────────────────────────────────────

export type { CompensationRow, CompensationSummary } from "./derive";

export interface CompensationSelf {
  vendedorCodigo: number;
  projection:     SellerProjection;
  result:         CommissionResult;
  series:         DailyProjectionPoint[];
}

export interface UseCompensationResult {
  scope: CompensationScope;
  /** Filas por vendedor (vacía cuando scope=self sin mapeo). */
  rows: CompensationRow[];
  /** Vista agregada del scope. */
  summary: CompensationSummary;
  /** Detalle personal: solo cuando scope=self y vendedorCodigo está mapeado. */
  self: CompensationSelf | null;
  /** Contexto temporal del mes (no depende de hay datos cargados). */
  time: MonthTime;
  /** Escalas activas (BD config_commission_scale + fallback). */
  scales: Record<string, CommissionScale>;
  isLoading: boolean;
  error: Error | null;
}

// ─── Implementación ────────────────────────────────────────────────────────

export function useCompensation(year: number, month: number): UseCompensationResult {
  const { scope, vendedorCodigo, isVendedor } = useCompensationScope();
  const scales = useCommissionScales();

  const teamQ = useSellerProjections(year, month);
  // Solo se ejecuta si el rol es vendedor (useMyProjection ya filtra por scope).
  const myQ = useMyProjection(year, month);

  const time = useMemo(
    () => resolveMonthTime(year, month, getCalendarDay(), getCalendarMonth(), getCalendarYear()),
    [year, month],
  );

  const rows = useMemo<CompensationRow[]>(() => {
    if (scope === "self") {
      if (!myQ.projection || vendedorCodigo == null) return [];
      return [{ projection: myQ.projection, result: projectionToResult(myQ.projection) }];
    }
    return teamQ.projections.map((p) => ({ projection: p, result: projectionToResult(p) }));
  }, [scope, vendedorCodigo, myQ.projection, teamQ.projections]);

  const summary = useMemo<CompensationSummary>(() => buildCompensationSummary(rows), [rows]);

  const self = useMemo<CompensationSelf | null>(() => {
    if (!isVendedor || vendedorCodigo == null || !myQ.projection) return null;
    return {
      vendedorCodigo,
      projection: myQ.projection,
      result: projectionToResult(myQ.projection),
      series: myQ.series,
    };
  }, [isVendedor, vendedorCodigo, myQ.projection, myQ.series]);

  return {
    scope,
    rows,
    summary,
    self,
    time,
    scales,
    isLoading: scope === "self" ? myQ.isLoading : teamQ.isLoading,
    error: (scope === "self" ? myQ.error : teamQ.error) as Error | null,
  };
}

