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
import { currentMonthProrata, daysInMonth } from "@/domain/period/helpers";
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
  /** Último día con datos reales en el mes actual (null si no aplica). */
  lastDataDay: number | null;
  /** Mes calendario actual (1-12). */
  calendarMonth: number;
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

  // Ventas diarias del año anterior (para YoY día-a-día preciso en mes parcial)
  const dailyPYQ = useQuery({
    queryKey: salesKeys.dailyWide(filters.year - 1),
    queryFn: () => fetchDailySalesWide(filters.year - 1),
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

  // Filtrado local de ventas diarias PY (sin store — la vista no tiene esa dimensión)
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

  // ── Último día con datos reales (usa datos WIDE, sin filtros de usuario) ──
  const calendarMonth = new Date().getMonth() + 1;
  const year = filters.year;
  const lastDataDay = useMemo((): number | null => {
    if (!prorata) return null;
    const allDaily = dailyCYQ.data ?? [];
    const daysInCurrentMonth = allDaily
      .filter((r) => r.month === prorata.month)
      .map((r) => r.day);
    return daysInCurrentMonth.length > 0 ? Math.max(...daysInCurrentMonth) : null;
  }, [dailyCYQ.data, prorata]);

  // Prorata corregido: usa el último día con datos reales en vez del día del calendario.
  // Evita dividir N días de ventas por un factor de M días (M > N → forecast/budget subestimado).
  const correctedProrata = useMemo(() => {
    if (!prorata) return null;
    const effectiveDay = lastDataDay ?? new Date().getDate();
    const dim = daysInMonth(year, prorata.month);
    return { month: prorata.month, factor: effectiveDay / dim };
  }, [prorata, lastDataDay, year]);

  // ── Calculo de metricas ──────────────────────────────────────────────────
  const metrics = useMemo((): SalesMetrics | null => {
    if (salesQ.isLoading) return null;

    const currRows = filteredCY.filter((r) => activeMonths.includes(r.month));

    let real = 0, cogs = 0, bruto = 0, dcto = 0;
    for (const r of currRows) { real += r.neto; cogs += r.cogs; bruto += r.bruto; dcto += r.dcto; }

    // YoY día-a-día preciso (simétrico con Executive):
    // Meses cerrados: usar datos mensuales (completos, simétricos).
    // Mes parcial: usar datos diarios con corte en lastDataDay (no día calendario).
    let prevNeto = 0;
    for (const r of filteredPY.filter((r) => closedMonths.includes(r.month))) {
      prevNeto += r.neto;
    }
    if (correctedProrata && activeMonths.includes(correctedProrata.month)) {
      const cutoffDay = lastDataDay ?? new Date().getDate();
      for (const r of filteredDailyPY) {
        if (r.month === correctedProrata.month && r.day <= cutoffDay) {
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
  }, [filteredCY, filteredPY, filteredDailyPY, salesQ.isLoading, activeMonths, closedMonths,
      budgetQ.data, ticketsQ.data, storesQ.data, filters.brand, filters.channel, filters.store,
      filters.period, isPartial, correctedProrata, lastDataDay]);

  const isLoading = salesQ.isLoading || prevSalesQ.isLoading || budgetQ.isLoading || dailyPYQ.isLoading || dailyCYQ.isLoading || ticketsQ.isLoading || storesQ.isLoading;
  const error = salesQ.error?.message ?? prevSalesQ.error?.message
    ?? budgetQ.error?.message ?? dailyPYQ.error?.message ?? dailyCYQ.error?.message ?? null;

  return { metrics, periodLabel, activeMonths, closedMonths, isLoading, error, lastDataDay, calendarMonth };
}
