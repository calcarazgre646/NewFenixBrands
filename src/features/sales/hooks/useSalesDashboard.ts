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
import { useFilters } from "@/hooks/useFilters";
import { fetchMonthlySalesWide, fetchDailySalesWide } from "@/queries/sales.queries";
import type { DailySalesRow } from "@/queries/sales.queries";
import { fetchBudget } from "@/queries/budget.queries";
import type { BudgetRow } from "@/queries/budget.queries";
import { fetchAnnualTickets } from "@/queries/tickets.queries";
import { fetchStores } from "@/queries/stores.queries";
import { salesKeys, budgetKeys, storeKeys, STALE_30MIN, GC_60MIN } from "@/queries/keys";
import { classifyStore } from "@/api/normalize";
import { filterSalesRows } from "@/queries/filters";
import { resolvePeriod } from "@/domain/period/resolve";
import { currentMonthProrata } from "@/domain/period/helpers";
import { brandIdToCanonical } from "@/api/normalize";
import {
  calcGrossMargin,
  calcYoY,
  calcMarkdownDependency,
} from "@/domain/kpis/calculations";

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
  /** Ticket promedio global del período (ventas totales / tickets). */
  globalAOV: number;
  isPartialMonth: boolean;
}

export interface SalesDashboardData {
  metrics: SalesMetrics | null;
  periodLabel: string;
  activeMonths: number[];
  closedMonths: number[];
  isLoading: boolean;
  error: string | null;
  /** Último día con datos reales (null si no aplica). */
  lastDataDay: number | null;
  /** Mes del último dato real (1-12, null si no aplica). */
  lastDataMonth: number | null;
}

// ─── Helpers de filtrado local ───────────────────────────────────────────────

function aggregateBudget(
  rows: BudgetRow[],
  months: number[],
  brand: string,
  channel: string,
  partialProrata?: { month: number; factor: number } | null,
): number {
  const canonical = brand !== "total" ? brandIdToCanonical(brand) : null;
  const ch = channel !== "total" ? channel.toUpperCase() : null;
  let total = 0;
  for (const r of rows) {
    if (!months.includes(r.month)) continue;
    if (ch && r.area !== ch) continue;
    if (canonical && r.brand !== canonical) continue;
    const factor = partialProrata && r.month === partialProrata.month ? partialProrata.factor : 1;
    total += r.revenue * factor;
  }
  return total;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useSalesDashboard(): SalesDashboardData {
  const { filters } = useFilters();
  const prorata = currentMonthProrata(filters.year);

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

  // Ventas diarias CY (para detectar último día con datos reales — query ya cacheada por Executive)
  const dailyCYQ = useQuery({
    queryKey: salesKeys.dailyWide(filters.year),
    queryFn: () => fetchDailySalesWide(filters.year),
    staleTime: STALE_30MIN,
    gcTime: GC_60MIN,
  });

  // Tickets anuales (para AOV global — shared cache con useSalesAnalytics)
  const ticketsQ = useQuery({
    queryKey: ["tickets", "annual", filters.year] as const,
    queryFn: () => fetchAnnualTickets(filters.year),
    staleTime: STALE_30MIN,
    gcTime: GC_60MIN,
  });

  // Mapa de tiendas cosupc → cosujd (para filtrar tickets por canal)
  const storesQ = useQuery({
    queryKey: storeKeys.list(),
    queryFn: () => fetchStores(),
    staleTime: STALE_30MIN,
    gcTime: GC_60MIN,
  });

  // Ventas diarias PY (para prorrateo del mes parcial — cache compartido con Executive)
  const dailyPYQ = useQuery({
    queryKey: salesKeys.dailyWide(filters.year - 1),
    queryFn: () => fetchDailySalesWide(filters.year - 1),
    staleTime: STALE_30MIN,
    gcTime: GC_60MIN,
  });

  const filteredDailyPY = useMemo((): DailySalesRow[] => {
    const rows = dailyPYQ.data ?? [];
    const canonical = filters.brand !== "total" ? brandIdToCanonical(filters.brand) : null;
    const ch = filters.channel !== "total" ? filters.channel.toUpperCase() : null;
    return rows.filter(r => {
      if (canonical && r.brand !== canonical) return false;
      if (ch && r.channel !== ch) return false;
      return true;
    });
  }, [dailyPYQ.data, filters.brand, filters.channel]);

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

  // ── Último día con datos reales (usa datos WIDE, sin filtros de usuario) ──
  // Busca el dato más reciente de cualquier mes del año actual.
  const { lastDataDay, lastDataMonth } = useMemo(() => {
    if (!prorata) return { lastDataDay: null, lastDataMonth: null };
    const allDaily = dailyCYQ.data ?? [];
    if (allDaily.length === 0) return { lastDataDay: null, lastDataMonth: null };
    let maxMonth = 0;
    let maxDay = 0;
    for (const r of allDaily) {
      if (r.month > maxMonth || (r.month === maxMonth && r.day > maxDay)) {
        maxMonth = r.month;
        maxDay = r.day;
      }
    }
    return { lastDataDay: maxDay || null, lastDataMonth: maxMonth || null };
  }, [dailyCYQ.data, prorata]);

  // Prorata corregido: último día con datos reales (no calendario)
  const correctedProrata = useMemo(() => {
    if (!prorata) return null;
    const effectiveDay = (lastDataMonth === prorata.month && lastDataDay != null)
      ? lastDataDay
      : new Date().getDate();
    const dim = new Date(filters.year, prorata.month, 0).getDate();
    return { month: prorata.month, factor: effectiveDay / dim };
  }, [prorata, lastDataDay, lastDataMonth, filters.year]);

  // ── Calculo de metricas ──────────────────────────────────────────────────
  const metrics = useMemo((): SalesMetrics | null => {
    if (salesQ.isLoading) return null;

    const currRows = filteredCY.filter((r) => activeMonths.includes(r.month));

    let real = 0, cogs = 0, bruto = 0, dcto = 0;
    for (const r of currRows) { real += r.neto; cogs += r.cogs; bruto += r.bruto; dcto += r.dcto; }

    // YoY: meses cerrados PY completos + mes parcial PY prorrateado al mismo
    // día de corte que CY (manzanas con manzanas).
    let prevNeto = 0;
    const partialMonth = correctedProrata?.month;
    const isPartialInScope = partialMonth != null && activeMonths.includes(partialMonth);
    for (const r of filteredPY) {
      if (!activeMonths.includes(r.month)) continue;
      if (isPartialInScope && r.month === partialMonth) continue;
      prevNeto += r.neto;
    }
    if (isPartialInScope) {
      const cutoffDay = lastDataDay ?? new Date().getDate();
      for (const r of filteredDailyPY) {
        if (r.month === partialMonth && r.day <= cutoffDay) {
          prevNeto += r.neto;
        }
      }
    }

    // Budget de los meses activos (sin prorrateo)
    const periodBudget = aggregateBudget(
      budgetQ.data ?? [], activeMonths, filters.brand, filters.channel, null,
    );

    // En YTD: mostrar meta anual completa, consistente con Executive/Inicio.
    // Sin filtros (total/total): meta fija 70MM Gs (definida por el cliente).
    // Con filtros: sumar budget de BD para los 12 meses.
    const isYtd = filters.period === "ytd";
    const isUnfiltered = filters.brand === "total" && filters.channel === "total";
    const fullYearBudget = isYtd
      ? isUnfiltered
        ? 70_000_000_000
        : aggregateBudget(
            budgetQ.data ?? [],
            [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
            filters.brand,
            filters.channel,
            null,
          )
      : periodBudget;

    const budget = isYtd ? fullYearBudget : periodBudget;

    const grossMarginPct = calcGrossMargin(real, cogs);
    const markdownPct = calcMarkdownDependency(dcto, bruto);
    const budgetAttainment = budget > 0 ? (real / budget) * 100 : 0;
    const growthVsLY = prevNeto > 0 ? calcYoY(real, prevNeto) : 0;

    // ── AOV global (tickets filtrados por canal/tienda) ───────────────────
    const storeMap = new Map<string, string>();
    for (const s of storesQ.data ?? []) storeMap.set(s.cosupc, s.cosujd);

    let totalTickets = 0;
    let totalTicketSales = 0;
    for (const t of ticketsQ.data ?? []) {
      if (!activeMonths.includes(t.month)) continue;
      // Filtrar por canal
      if (filters.channel !== "total") {
        const cosujd = storeMap.get(t.storeCode) ?? "";
        const storeChannel = classifyStore(cosujd);
        if (storeChannel !== filters.channel.toLowerCase()) continue;
      }
      // Filtrar por tienda
      if (filters.store) {
        const cosujd = storeMap.get(t.storeCode) ?? "";
        if (cosujd.trim().toUpperCase() !== filters.store.trim().toUpperCase()) continue;
      }
      totalTickets += t.tickets;
      totalTicketSales += t.totalSales;
    }
    const globalAOV = totalTickets > 0 ? totalTicketSales / totalTickets : 0;

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
      globalAOV,
      isPartialMonth: isPartial,
    };
  }, [filteredCY, filteredPY, filteredDailyPY, salesQ.isLoading, activeMonths,
      budgetQ.data, ticketsQ.data, storesQ.data, filters.brand, filters.channel, filters.store,
      filters.period, isPartial, correctedProrata, lastDataDay]);

  const isLoading = salesQ.isLoading || prevSalesQ.isLoading || budgetQ.isLoading || dailyCYQ.isLoading || dailyPYQ.isLoading || ticketsQ.isLoading || storesQ.isLoading;
  const error = salesQ.error?.message ?? prevSalesQ.error?.message
    ?? budgetQ.error?.message ?? dailyCYQ.error?.message ?? dailyPYQ.error?.message ?? null;

  return { metrics, periodLabel, activeMonths, closedMonths, isLoading, error, lastDataDay, lastDataMonth };
}
