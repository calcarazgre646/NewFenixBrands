/**
 * features/sales/hooks/useSalesDashboard.ts
 *
 * Hook de metricas principales para la pagina de ventas.
 * Patron: fetch wide, filter local (identico a useKpiDashboard).
 *
 * Queries WIDE cacheadas (compartidas con KpiDashboard y Executive):
 *   - fetchMonthlySalesWide CY (~1K filas)
 *   - fetchMonthlySalesWide PY (~1K filas)
 *   - fetchBudget (~2.8K filas)
 *
 * Cambio de filtro = re-render instantaneo via useMemo, sin API call.
 */
import { useMemo } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useFilters } from "@/context/FilterContext";
import { fetchMonthlySalesWide } from "@/queries/sales.queries";
import type { MonthlySalesRow } from "@/queries/sales.queries";
import { fetchBudget } from "@/queries/budget.queries";
import type { BudgetRow } from "@/queries/budget.queries";
import { salesKeys, budgetKeys } from "@/queries/keys";
import { resolvePeriod } from "@/domain/period/resolve";
import { brandIdToCanonical } from "@/api/normalize";
import {
  calcGrossMargin,
  calcYoY,
  calcMarkdownDependency,
} from "@/domain/kpis/calculations";

// ─── Cache ───────────────────────────────────────────────────────────────────
const STALE_30MIN = 30 * 60 * 1000;
const GC_60MIN    = 60 * 60 * 1000;

// ─── Tipos publicos ──────────────────────────────────────────────────────────

export interface SalesMetrics {
  real: number;
  cogs: number;
  bruto: number;
  dcto: number;
  grossMarginPct: number;
  markdownPct: number;
  budget: number;
  budgetAttainment: number;    // % (0-100+)
  lastYear: number;
  growthVsLY: number;          // % YoY
  isPartialMonth: boolean;
}

export interface SalesDashboardData {
  metrics: SalesMetrics | null;
  periodLabel: string;
  activeMonths: number[];
  closedMonths: number[];
  isLoading: boolean;
  error: string | null;
}

// ─── Helpers de filtrado local ───────────────────────────────────────────────

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

function aggregateBudget(
  rows: BudgetRow[],
  months: number[],
  brand: string,
  channel: string,
): number {
  const canonical = brand !== "total" ? brandIdToCanonical(brand) : null;
  const ch = channel !== "total" ? channel.toUpperCase() : null;
  let total = 0;
  for (const r of rows) {
    if (!months.includes(r.month)) continue;
    if (ch && r.area !== ch) continue;
    if (canonical && r.brand !== canonical) continue;
    total += r.revenue;
  }
  return total;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useSalesDashboard(): SalesDashboardData {
  const { filters } = useFilters();

  // ── Queries WIDE ─────────────────────────────────────────────────────────
  const [salesQ, prevSalesQ] = useQueries({
    queries: [
      {
        queryKey: salesKeys.monthlyWide(filters.year),
        queryFn: () => fetchMonthlySalesWide(filters.year),
        staleTime: STALE_30MIN,
        gcTime: GC_60MIN,
      },
      {
        queryKey: salesKeys.priorYearWide(filters.year),
        queryFn: () => fetchMonthlySalesWide(filters.year - 1),
        staleTime: STALE_30MIN,
        gcTime: GC_60MIN,
      },
    ],
  });

  const budgetQ = useQuery({
    queryKey: budgetKeys.annual(filters.year),
    queryFn: () => fetchBudget(filters.year),
    staleTime: STALE_30MIN,
    gcTime: GC_60MIN,
  });

  // ── Periodo resuelto ──────────────────────────────────────────────────────
  const { activeMonths, closedMonths, periodLabel, isPartial } = useMemo(() => {
    const allRows = salesQ.data ?? [];
    const monthsInDB = [...new Set(allRows.map((r) => r.month))].sort((a, b) => a - b);
    const resolved = resolvePeriod(filters.period, monthsInDB, filters.year);
    return {
      activeMonths: resolved.activeMonths,
      closedMonths: resolved.closedMonths,
      periodLabel: resolved.label,
      isPartial: resolved.isPartial,
    };
  }, [salesQ.data, filters.period, filters.year]);

  // ── Filtrado local ────────────────────────────────────────────────────────
  const filteredCY = useMemo(
    () => filterSalesRows(salesQ.data ?? [], filters.brand, filters.channel, filters.store),
    [salesQ.data, filters.brand, filters.channel, filters.store],
  );

  const filteredPY = useMemo(
    () => filterSalesRows(prevSalesQ.data ?? [], filters.brand, filters.channel, filters.store),
    [prevSalesQ.data, filters.brand, filters.channel, filters.store],
  );

  // ── Calculo de metricas ──────────────────────────────────────────────────
  const metrics = useMemo((): SalesMetrics | null => {
    if (salesQ.isLoading) return null;

    const currRows = filteredCY.filter((r) => activeMonths.includes(r.month));
    const prevRows = filteredPY.filter((r) => closedMonths.includes(r.month));

    let real = 0, cogs = 0, bruto = 0, dcto = 0;
    for (const r of currRows) { real += r.neto; cogs += r.cogs; bruto += r.bruto; dcto += r.dcto; }

    // YoY simétrico: solo meses cerrados para ambos lados.
    // Evita comparar "Ene+Feb+7d Mar" vs "Ene+Feb" durante mes parcial.
    let closedReal = 0;
    for (const r of filteredCY.filter((r) => closedMonths.includes(r.month))) { closedReal += r.neto; }

    let prevNeto = 0;
    for (const r of prevRows) { prevNeto += r.neto; }

    const budget = aggregateBudget(
      budgetQ.data ?? [], activeMonths, filters.brand, filters.channel,
    );

    const grossMarginPct = calcGrossMargin(real, cogs);
    const markdownPct = calcMarkdownDependency(dcto, bruto);
    const budgetAttainment = budget > 0 ? (real / budget) * 100 : 0;
    const growthVsLY = closedMonths.length > 0 ? calcYoY(closedReal, prevNeto) : 0;

    return {
      real,
      cogs,
      bruto,
      dcto,
      grossMarginPct,
      markdownPct,
      budget,
      budgetAttainment,
      lastYear: prevNeto,
      growthVsLY,
      isPartialMonth: isPartial,
    };
  }, [filteredCY, filteredPY, salesQ.isLoading, activeMonths, closedMonths,
      budgetQ.data, filters.brand, filters.channel, isPartial]);

  const isLoading = salesQ.isLoading || prevSalesQ.isLoading || budgetQ.isLoading;
  const error = salesQ.error?.message ?? prevSalesQ.error?.message
    ?? budgetQ.error?.message ?? null;

  return { metrics, periodLabel, activeMonths, closedMonths, isLoading, error };
}
