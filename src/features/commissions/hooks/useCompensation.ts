/**
 * features/commissions/hooks/useCompensation.ts
 *
 * Hook unificado de compensación de la sección `/comisiones`. Orquesta dos
 * sub-hooks internos:
 *
 *   - `useSellerProjections(year, month)` — proyección a nivel equipo
 *     (asimetría retail/B2B incluida).
 *   - `useMyProjection(year, month)` — vista personal del vendedor mapeado
 *     al perfil + serie diaria para el chart.
 *
 * Y expone una API única:
 *
 *   - `time`: contexto temporal del mes.
 *   - `rows`: una entrada por vendedor con `projection` + `result` (estado
 *     actual derivado de la proyección).
 *   - `summary`: totales del scope.
 *   - `self`: detalle personal cuando scope=self y el vendedor está mapeado.
 */
import { useMemo } from "react";
import { useCommissionScales } from "@/hooks/useConfig";
import {
  getCalendarDay,
  getCalendarMonth,
  getCalendarYear,
} from "@/domain/period/helpers";
import { resolveMonthTime, type MonthTime } from "@/domain/projections/calculations";
import { useSellerProjections } from "./useSellerProjections";
import { useMyProjection } from "./useMyProjection";
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
import type { CobranzaUnattributed } from "@/domain/cobranza/types";

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
  /**
   * Pool de cobranza no atribuida a un vendedor individual (UNIFORMES, sin
   * vendedor declarado). La página decide cuándo agregarlo al summary según
   * el filtro de canal: UTP/Todos lo incluye, Mayorista/Retail no.
   */
  cobranzaUnattributed: CobranzaUnattributed[];
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

  const cobranzaUnattributed = useMemo<CobranzaUnattributed[]>(() => {
    return teamQ.summary?.cobranzaUnattributed ?? [];
  }, [teamQ.summary]);

  // Summary inicial: incluye TODO el unattributed (vista "todos").
  // La página puede recalcular con un canal específico via buildCompensationSummary.
  const summary = useMemo<CompensationSummary>(
    () => buildCompensationSummary(rows, cobranzaUnattributed, "todos"),
    [rows, cobranzaUnattributed],
  );

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
    cobranzaUnattributed,
    self,
    time,
    scales,
    isLoading: scope === "self" ? myQ.isLoading : teamQ.isLoading,
    error: (scope === "self" ? myQ.error : teamQ.error) as Error | null,
  };
}

