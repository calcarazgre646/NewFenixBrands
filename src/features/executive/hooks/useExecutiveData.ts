/**
 * features/executive/hooks/useExecutiveData.ts
 *
 * Hook de datos para la vista ejecutiva "Road to Annual Target".
 *
 * Patrón: fetch wide, filter local.
 *   - fetchMonthlySalesWide → ~1K filas CY
 *   - fetchMonthlySalesWide → ~1K filas PY
 *   - fetchBudget → ~2.8K filas
 *   - fetchStoreGoals → ~180 filas
 *
 * Todos se cachean WIDE y se filtran localmente con useMemo.
 * Cambio de brand/channel/store = re-render instantáneo.
 */
import { useMemo, useCallback } from "react";
import { useQuery, useQueries } from "@tanstack/react-query";
import { useFilters } from "@/context/FilterContext";
import { fetchMonthlySalesWide } from "@/queries/sales.queries";
import type { MonthlySalesRow } from "@/queries/sales.queries";
import { fetchBudget } from "@/queries/budget.queries";
import type { BudgetRow } from "@/queries/budget.queries";
import { fetchStoreGoals } from "@/queries/stores.queries";
import { salesKeys, budgetKeys, storeKeys } from "@/queries/keys";
import { getCalendarMonth, getCalendarYear } from "@/domain/period/helpers";
import { brandIdToCanonical } from "@/api/normalize";
import {
  calcAnnualTarget,
  calcForecast,
  calcRequiredMonthlyRunRate,
  calcLinearPaceGap,
  dayOfYear,
  buildCumulativeSeries,
  buildMonthlyRows,
} from "@/domain/executive/calcs";
import type { ChartPoint, MonthlyRow } from "@/domain/executive/calcs";

// ─── Cache ──────────────────────────────────────────────────────────────────
const STALE_30MIN = 30 * 60 * 1000;
const GC_60MIN    = 60 * 60 * 1000;

// ─── Tipos públicos ─────────────────────────────────────────────────────────

export interface ExecutiveMetrics {
  annualTarget: number;
  ytd: number;
  forecastYearEnd: number;
  gapToTarget: number;                 // negativo = adelantado
  requiredMonthlyRunRate: number;
  linearPaceGap: number;               // negativo = adelantado
  realProgressPct: number;
  forecastProgressPct: number;
  monthsRemaining: number;
}

export interface ExecutiveData {
  metrics: ExecutiveMetrics | null;
  chartPoints: ChartPoint[];
  monthlyRows: MonthlyRow[];
  calendarMonth: number;
  isPartialMonth: boolean;
  isLoading: boolean;
  error: string | null;
  /** Re-filter cached wide data for a specific brand/channel view (instant, no API call). */
  getRowsForView: (brand: string, channel: string) => MonthlyRow[];
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Filtra filas de ventas mensuales por brand/channel/store (local, sin API). */
function filterSalesRows(
  rows: MonthlySalesRow[],
  brand: string,
  channel: string,
  store: string | null,
): MonthlySalesRow[] {
  const canonical = brand !== "total" ? brandIdToCanonical(brand) : null;
  const ch = channel !== "total" ? channel.toUpperCase() : null;
  return rows.filter((r) => {
    if (canonical && r.brand !== canonical) return false;
    if (ch && r.channel !== ch) return false;
    if (store && r.store !== store) return false;
    return true;
  });
}

/** Agrega filas de ventas por mes → Map<month, neto>. */
function aggregateByMonth(rows: MonthlySalesRow[]): Map<number, number> {
  const map = new Map<number, number>();
  for (const r of rows) {
    map.set(r.month, (map.get(r.month) ?? 0) + r.neto);
  }
  return map;
}

/** Agrega filas de presupuesto por mes, filtradas por brand/channel/store. */
function aggregateBudgetByMonth(
  rows: BudgetRow[],
  brand: string,
  channel: string,
): Map<number, number> {
  const canonical = brand !== "total" ? brandIdToCanonical(brand) : null;
  const ch = channel !== "total" ? channel.toUpperCase() : null;

  const map = new Map<number, number>();
  for (const r of rows) {
    // Budget_2026 tiene Area = "B2C" | "B2B" y Brand = "Lee" | "Wrangler" | "Martel"
    if (ch && r.area !== ch) continue;
    if (canonical && r.brand !== canonical) continue;
    map.set(r.month, (map.get(r.month) ?? 0) + r.revenue);
  }
  return map;
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useExecutiveData(): ExecutiveData {
  const { filters } = useFilters();
  const calMonth = getCalendarMonth();
  const calYear  = getCalendarYear();
  const year     = filters.year;

  // ── Queries WIDE (cacheadas, sin filtros de usuario en BD) ──────────────
  const [salesQ, prevSalesQ] = useQueries({
    queries: [
      {
        queryKey: salesKeys.monthlyWide(year),
        queryFn: () => fetchMonthlySalesWide(year),
        staleTime: STALE_30MIN,
        gcTime: GC_60MIN,
      },
      {
        queryKey: salesKeys.priorYearWide(year),
        queryFn: () => fetchMonthlySalesWide(year - 1),
        staleTime: STALE_30MIN,
        gcTime: GC_60MIN,
      },
    ],
  });

  const budgetQ = useQuery({
    queryKey: budgetKeys.annual(year),
    queryFn: () => fetchBudget(year),
    staleTime: STALE_30MIN,
    gcTime: GC_60MIN,
  });

  const goalsQ = useQuery({
    queryKey: storeKeys.goals(year),
    queryFn: () => fetchStoreGoals(year),
    staleTime: STALE_30MIN,
    gcTime: GC_60MIN,
  });

  // ── Filtrado local ─────────────────────────────────────────────────────
  const filteredSales = useMemo(
    () => filterSalesRows(salesQ.data ?? [], filters.brand, filters.channel, filters.store),
    [salesQ.data, filters.brand, filters.channel, filters.store],
  );

  const filteredPrevSales = useMemo(
    () => filterSalesRows(prevSalesQ.data ?? [], filters.brand, filters.channel, filters.store),
    [prevSalesQ.data, filters.brand, filters.channel, filters.store],
  );

  // ── Agregación por mes ─────────────────────────────────────────────────
  const monthlyReal   = useMemo(() => aggregateByMonth(filteredSales), [filteredSales]);
  const monthlyPY     = useMemo(() => aggregateByMonth(filteredPrevSales), [filteredPrevSales]);
  const monthlyBudget = useMemo(
    () => aggregateBudgetByMonth(budgetQ.data ?? [], filters.brand, filters.channel),
    [budgetQ.data, filters.brand, filters.channel],
  );

  // ── Período y detección de mes parcial ─────────────────────────────────
  const monthsWithData = useMemo(() => {
    const all = salesQ.data ?? [];
    return [...new Set(all.map((r) => r.month))].sort((a, b) => a - b);
  }, [salesQ.data]);

  const isCurrentYear  = year === calYear;
  const isPartialMonth = isCurrentYear && monthsWithData.includes(calMonth);

  // Último mes con datos reales (para gráfico y YTD)
  const lastRealMonth = useMemo(() => {
    const realMonths = [...monthlyReal.keys()].sort((a, b) => a - b);
    return realMonths.length > 0 ? realMonths[realMonths.length - 1] : 0;
  }, [monthlyReal]);

  // ── Cálculos ejecutivos ────────────────────────────────────────────────
  const metrics = useMemo((): ExecutiveMetrics | null => {
    if (salesQ.isLoading || budgetQ.isLoading || goalsQ.isLoading) return null;

    const annualTarget = calcAnnualTarget(goalsQ.data ?? []);

    // YTD: solo meses cerrados (< calendarMonth) para evitar parcialidad
    const closedMonthLimit = isCurrentYear ? calMonth - 1 : 12;
    let ytd = 0;
    for (const [m, neto] of monthlyReal) {
      if (m <= closedMonthLimit) ytd += neto;
    }

    // Temporal: días
    const now = new Date();
    const daysElapsed = dayOfYear(now);
    const daysInYear = (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)) ? 366 : 365;
    const daysRemaining = Math.max(0, daysInYear - daysElapsed);

    const forecastYearEnd = calcForecast(ytd, daysElapsed, daysInYear);
    const gapToTarget = annualTarget - forecastYearEnd;
    const requiredMonthlyRunRate = calcRequiredMonthlyRunRate(annualTarget, ytd, daysRemaining);
    const linearPaceGap = calcLinearPaceGap(annualTarget, ytd, daysElapsed, daysInYear);

    const realProgressPct = annualTarget > 0 ? (ytd / annualTarget) * 100 : 0;
    const forecastProgressPct = annualTarget > 0 ? (forecastYearEnd / annualTarget) * 100 : 0;
    const monthsRemainingCalc = Math.max(1, Math.round(daysRemaining / (365 / 12)));

    return {
      annualTarget,
      ytd,
      forecastYearEnd,
      gapToTarget,
      requiredMonthlyRunRate,
      linearPaceGap,
      realProgressPct,
      forecastProgressPct,
      monthsRemaining: monthsRemainingCalc,
    };
  }, [salesQ.isLoading, budgetQ.isLoading, goalsQ.isLoading, goalsQ.data,
      monthlyReal, calMonth, isCurrentYear, year]);

  // ── Series del gráfico ─────────────────────────────────────────────────
  const chartPoints = useMemo((): ChartPoint[] => {
    if (!metrics) return [];
    // Monthly run rate = promedio de los meses cerrados con datos
    const closedLimit = isCurrentYear ? calMonth - 1 : 12;
    let closedSum = 0;
    let closedCount = 0;
    for (const [m, neto] of monthlyReal) {
      if (m <= closedLimit) { closedSum += neto; closedCount++; }
    }
    const monthlyRunRate = closedCount > 0 ? closedSum / closedCount : 0;

    return buildCumulativeSeries(monthlyReal, monthlyBudget, lastRealMonth, monthlyRunRate);
  }, [metrics, monthlyReal, monthlyBudget, lastRealMonth, calMonth, isCurrentYear]);

  // ── Filas de tabla mensual ─────────────────────────────────────────────
  const monthlyRows = useMemo(
    () => buildMonthlyRows(monthlyReal, monthlyBudget, monthlyPY, calMonth),
    [monthlyReal, monthlyBudget, monthlyPY, calMonth],
  );

  // ── getRowsForView: re-filtra datos wide cacheados para una vista ──────
  const getRowsForView = useCallback(
    (viewBrand: string, viewChannel: string): MonthlyRow[] => {
      const cyRows  = filterSalesRows(salesQ.data ?? [], viewBrand, viewChannel, null);
      const pyRows  = filterSalesRows(prevSalesQ.data ?? [], viewBrand, viewChannel, null);
      const cyMap   = aggregateByMonth(cyRows);
      const pyMap   = aggregateByMonth(pyRows);
      const budMap  = aggregateBudgetByMonth(budgetQ.data ?? [], viewBrand, viewChannel);
      return buildMonthlyRows(cyMap, budMap, pyMap, calMonth);
    },
    [salesQ.data, prevSalesQ.data, budgetQ.data, calMonth],
  );

  // ── Estado consolidado ─────────────────────────────────────────────────
  const isLoading = salesQ.isLoading || prevSalesQ.isLoading || budgetQ.isLoading || goalsQ.isLoading;
  const error = salesQ.error?.message ?? prevSalesQ.error?.message
    ?? budgetQ.error?.message ?? goalsQ.error?.message ?? null;

  return {
    metrics,
    chartPoints,
    monthlyRows,
    calendarMonth: calMonth,
    isPartialMonth,
    isLoading,
    error,
    getRowsForView,
  };
}
