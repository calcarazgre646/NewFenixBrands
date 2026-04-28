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
import { useFilters } from "@/hooks/useFilters";
import { fetchMonthlySalesWide, fetchDailySalesWide } from "@/queries/sales.queries";
import type { MonthlySalesRow, DailySalesRow } from "@/queries/sales.queries";
import { fetchBudget } from "@/queries/budget.queries";
import type { BudgetRow } from "@/queries/budget.queries";
import { fetchStoreGoals } from "@/queries/stores.queries";
import { fetchInventoryValue } from "@/queries/inventory.queries";
import { salesKeys, budgetKeys, storeKeys, inventoryKeys, STALE_30MIN, GC_60MIN } from "@/queries/keys";
import { filterSalesRows } from "@/queries/filters";
import { getCalendarMonth, getCalendarYear, currentMonthProrata, daysInMonth } from "@/domain/period/helpers";
import { resolvePeriod } from "@/domain/period/resolve";
import { brandIdToCanonical, classifyStore } from "@/api/normalize";
import type { StoreGoal } from "@/queries/stores.queries";
import {
  calcAnnualTarget,
  calcForecast,
  calcRequiredMonthlyRunRate,
  dayOfYear,
  buildCumulativeSeries,
  buildMonthlyRows,
  buildDailySeries,
} from "@/domain/executive/calcs";
import { calcGrossMargin, calcGMROI, calcInventoryTurnover } from "@/domain/kpis/calculations";
import { useExecutiveConfig } from "@/hooks/useConfig";
import type { ChartPoint, MonthlyRow, DailyChartPoint } from "@/domain/executive/calcs";
import {
  generateBrandInsights,
  generateChannelInsights,
  aggregateSalesByBrand,
  aggregateSalesByChannel,
  aggregateBudgetByBrand,
  aggregateBudgetByChannel,
} from "@/domain/executive/insights";
import type { BrandInsight } from "@/domain/executive/insights";

// ─── Tipos públicos ─────────────────────────────────────────────────────────

export interface ExecutiveMetrics {
  /** Meta del período prorrateada al último día con datos (comparación justa). */
  periodTarget: number;
  /** Meta anual completa (12 meses budget o store goals). Para proyecciones anuales. */
  annualTarget: number;
  ytd: number;
  forecastYearEnd: number;
  /** periodTarget - ytd. Positivo = faltante, negativo = adelantado. */
  gapToTarget: number;
  requiredMonthlyRunRate: number;
  /** ytd / periodTarget * 100 — progreso real vs meta del período. */
  realProgressPct: number;
  /** forecastYearEnd / annualTarget * 100 — proyección vs meta anual. */
  forecastProgressPct: number;
  monthsRemaining: number;
  /** YoY: (ytd - priorYtd) / priorYtd * 100. 0 si no hay datos PY. */
  yoyPct: number;
  yoyDelta: number;
  /** Margen Bruto % del período: (neto - costo) / neto * 100. */
  grossMarginPct: number;
  /** Diferencia en puntos porcentuales vs mismo período año anterior. */
  grossMarginYoY: number;
  /** GMROI anualizado: (grossMargin / inventoryValue) × (12/months). */
  gmroi: number;
  /** Rotación de inventario anualizada: (COGS / inventoryValue) × (12/months). */
  inventoryTurnover: number;
}

export interface ExecutiveData {
  metrics: ExecutiveMetrics | null;
  chartPoints: ChartPoint[];
  /** Puntos diarios para vista de mes individual (null cuando period=ytd). */
  dailyChartPoints: DailyChartPoint[] | null;
  monthlyRows: MonthlyRow[];
  insights: BrandInsight[];
  /** Channel insights para rotación (solo cuando brand="total"). */
  channelInsights: BrandInsight[];
  periodLabel: string;
  calendarMonth: number;
  isPartialMonth: boolean;
  /** true cuando el periodo es YTD (vista anual). false para vistas de mes individual. */
  isYtdView: boolean;
  isLoading: boolean;
  /** true mientras la query de inventario (GMROI/Rotación) está cargando. */
  isInventoryLoading: boolean;
  error: string | null;
  /** Último día con datos reales (null si no aplica). */
  lastDataDay: number | null;
  /** Mes del último dato real (1-12, null si no aplica). */
  lastDataMonth: number | null;
  /** Re-filter cached wide data for a specific brand/channel view (instant, no API call). */
  getRowsForView: (brand: string, channel: string) => MonthlyRow[];
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Agrega filas de ventas por mes → Map<month, neto>. */
function aggregateByMonth(rows: MonthlySalesRow[]): Map<number, number> {
  const map = new Map<number, number>();
  for (const r of rows) {
    map.set(r.month, (map.get(r.month) ?? 0) + r.neto);
  }
  return map;
}

/** Agrega costo por mes → Map<month, cogs>. */
function aggregateCostByMonth(rows: MonthlySalesRow[]): Map<number, number> {
  const map = new Map<number, number>();
  for (const r of rows) {
    map.set(r.month, (map.get(r.month) ?? 0) + r.cogs);
  }
  return map;
}

/** Filtra metas de tienda por canal y/o tienda. Las metas NO tienen marca, solo tienda. */
function filterGoals(
  goals: StoreGoal[],
  channel: string,
  store: string | null,
): StoreGoal[] {
  const ch = channel !== "total" ? channel.toLowerCase() : null;
  return goals.filter((g) => {
    if (store && g.storeName !== store) return false;
    if (ch) {
      const storeChannel = classifyStore(g.storeName);
      if (storeChannel === "excluded") return false;
      if (storeChannel !== ch) return false;
    }
    return true;
  });
}

/** Filtra budget rows por brand/channel. Reutilizado por varias agregaciones. */
function filterBudgetRows(rows: BudgetRow[], brand: string, channel: string): BudgetRow[] {
  const canonical = brand !== "total" ? brandIdToCanonical(brand) : null;
  const ch = channel !== "total" ? channel.toUpperCase() : null;
  return rows.filter((r) => {
    if (ch && r.area !== ch) return false;
    if (canonical && r.brand !== canonical) return false;
    return true;
  });
}

/** Agrega filas de presupuesto por mes, filtradas por brand/channel/store. */
function aggregateBudgetByMonth(
  rows: BudgetRow[],
  brand: string,
  channel: string,
): Map<number, number> {
  const map = new Map<number, number>();
  for (const r of filterBudgetRows(rows, brand, channel)) {
    map.set(r.month, (map.get(r.month) ?? 0) + r.revenue);
  }
  return map;
}

/** Agrega GM% presupuesto por mes — promedio ponderado por revenue. */
function aggregateBudgetGmPctByMonth(
  rows: BudgetRow[],
  brand: string,
  channel: string,
): Map<number, number> {
  const filtered = filterBudgetRows(rows, brand, channel);
  // Agrupar revenue y grossMargin por mes para calcular GM% ponderado
  const revMap = new Map<number, number>();
  const gmMap = new Map<number, number>();
  for (const r of filtered) {
    revMap.set(r.month, (revMap.get(r.month) ?? 0) + r.revenue);
    gmMap.set(r.month, (gmMap.get(r.month) ?? 0) + r.grossMargin);
  }
  const result = new Map<number, number>();
  for (const [m, rev] of revMap) {
    const gm = gmMap.get(m) ?? 0;
    result.set(m, rev > 0 ? (gm / rev) * 100 : 0);
  }
  return result;
}

/** Agrega unidades de presupuesto por mes. */
function aggregateBudgetUnitsByMonth(
  rows: BudgetRow[],
  brand: string,
  channel: string,
): Map<number, number> {
  const map = new Map<number, number>();
  for (const r of filterBudgetRows(rows, brand, channel)) {
    map.set(r.month, (map.get(r.month) ?? 0) + r.units);
  }
  return map;
}

/** Agrega unidades de ventas diarias por mes → Map<month, units>. */
function aggregateUnitsByMonthFromDaily(rows: DailySalesRow[]): Map<number, number> {
  const map = new Map<number, number>();
  for (const r of rows) {
    map.set(r.month, (map.get(r.month) ?? 0) + r.units);
  }
  return map;
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useExecutiveData(): ExecutiveData {
  const { filters } = useFilters();
  const execConfig = useExecutiveConfig();
  const calMonth = getCalendarMonth();
  const calYear  = getCalendarYear();
  const year     = filters.year;
  const prorata  = currentMonthProrata(year);

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

  // Inventario (para GMROI y Rotación — shared cache con KPI dashboard)
  const inventoryQ = useQuery({
    queryKey: inventoryKeys.value(),
    queryFn: () => fetchInventoryValue(),
    staleTime: STALE_30MIN,
    gcTime: GC_60MIN,
  });

  // Ventas diarias del año anterior (para YoY día-a-día preciso)
  const dailyPYQ = useQuery({
    queryKey: salesKeys.dailyWide(year - 1),
    queryFn: () => fetchDailySalesWide(year - 1),
    staleTime: STALE_30MIN,
    gcTime: GC_60MIN,
  });

  // Ventas diarias del año actual (para detectar último día con datos reales)
  const dailyCYQ = useQuery({
    queryKey: salesKeys.dailyWide(year),
    queryFn: () => fetchDailySalesWide(year),
    staleTime: STALE_30MIN,
    gcTime: GC_60MIN,
  });

  // ── Filtrado local ─────────────────────────────────────────────────────
  const filteredSales = useMemo(
    () => filterSalesRows(salesQ.data ?? [], filters.brand, filters.channel, filters.store, filters.b2bSubchannel),
    [salesQ.data, filters.brand, filters.channel, filters.store, filters.b2bSubchannel],
  );

  const filteredPrevSales = useMemo(
    () => filterSalesRows(prevSalesQ.data ?? [], filters.brand, filters.channel, filters.store, filters.b2bSubchannel),
    [prevSalesQ.data, filters.brand, filters.channel, filters.store, filters.b2bSubchannel],
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

  // ── Detectar último día con datos reales en el año ──────────────────
  // Busca el dato más reciente de CUALQUIER mes del año actual (no solo calMonth).
  // Así el indicador "Datos hasta…" se muestra incluso si el mes calendario
  // aún no tiene datos (ej: 1 de abril, datos hasta 28 de marzo).
  const { lastDataDay, lastDataMonth } = useMemo(() => {
    if (!prorata) return { lastDataDay: null, lastDataMonth: null }; // no es el año actual
    const allDaily = dailyCYQ.data ?? [];
    if (allDaily.length === 0) return { lastDataDay: null, lastDataMonth: null };
    // Encontrar el registro más reciente por (month, day)
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

  // Prorata corregido: usa el último día con datos reales en vez del día del calendario.
  // Evita dividir N días de ventas por un factor de M días (M > N → forecast subestimado).
  // Si el mes con datos más recientes coincide con prorata.month, usamos ese día;
  // si no (ej: prorata=abril pero datos hasta marzo), usamos el día calendario.
  const correctedProrata = useMemo(() => {
    if (!prorata) return null;
    const effectiveDay = (lastDataMonth === prorata.month && lastDataDay != null)
      ? lastDataDay
      : new Date().getDate();
    const dim = daysInMonth(year, prorata.month);
    return { month: prorata.month, factor: effectiveDay / dim };
  }, [prorata, lastDataDay, lastDataMonth, year]);

  // ── Agregación por mes ─────────────────────────────────────────────────
  const monthlyReal   = useMemo(() => aggregateByMonth(filteredSales), [filteredSales]);
  const monthlyPY     = useMemo(() => aggregateByMonth(filteredPrevSales), [filteredPrevSales]);
  const monthlyCost   = useMemo(() => aggregateCostByMonth(filteredSales), [filteredSales]);
  const monthlyPYCost = useMemo(() => aggregateCostByMonth(filteredPrevSales), [filteredPrevSales]);
  const monthlyBudget = useMemo(
    () => aggregateBudgetByMonth(budgetQ.data ?? [], filters.brand, filters.channel),
    [budgetQ.data, filters.brand, filters.channel],
  );
  const monthlyBudgetGmPct = useMemo(
    () => aggregateBudgetGmPctByMonth(budgetQ.data ?? [], filters.brand, filters.channel),
    [budgetQ.data, filters.brand, filters.channel],
  );
  const monthlyBudgetUnits = useMemo(
    () => aggregateBudgetUnitsByMonth(budgetQ.data ?? [], filters.brand, filters.channel),
    [budgetQ.data, filters.brand, filters.channel],
  );

  // ── Período resuelto (respeta filtro de periodo global) ────────────────
  const { activeMonths, closedMonths, periodLabel, isPartial: isPartialMonth } = useMemo(() => {
    const allRows = salesQ.data ?? [];
    const monthsInDB = [...new Set(allRows.map((r) => r.month))].sort((a, b) => a - b);
    const resolved = resolvePeriod(filters.period, monthsInDB, year);
    return {
      activeMonths: resolved.activeMonths,
      closedMonths: resolved.closedMonths,
      periodLabel: resolved.label,
      isPartial: resolved.isPartial,
    };
  }, [salesQ.data, filters.period, year]);

  const isCurrentYear = year === calYear;

  // Último mes con datos reales (para gráfico y YTD)
  const lastRealMonth = useMemo(() => {
    const realMonths = [...monthlyReal.keys()].sort((a, b) => a - b);
    return realMonths.length > 0 ? realMonths[realMonths.length - 1] : 0;
  }, [monthlyReal]);

  // ── Cálculos ejecutivos (period-aware) ─────────────────────────────────
  const metrics = useMemo((): ExecutiveMetrics | null => {
    if (salesQ.isLoading || budgetQ.isLoading || goalsQ.isLoading) return null;

    const isYtd = filters.period === "ytd";
    const isCurrentMonth = filters.period === "currentMonth";
    const isBrandFiltered = filters.brand !== "total";
    const filteredGoals = filterGoals(goalsQ.data ?? [], filters.channel, filters.store);

    // ── 1. Objetivo anual ──────────────────────────────────────────────
    // Sin filtros (total/total): meta fija 70MM Gs (definida por el cliente).
    // Con filtro de marca o canal: usar budget de BD o store goals.
    const isUnfiltered = !isBrandFiltered && filters.channel === "total";
    let fullYearTarget: number;
    if (isUnfiltered) {
      fullYearTarget = execConfig.annualTargetFallback;
    } else if (isBrandFiltered) {
      let budgetTotal = 0;
      for (const [, v] of monthlyBudget) budgetTotal += v;
      fullYearTarget = budgetTotal > 0 ? budgetTotal : calcAnnualTarget(filteredGoals, execConfig.annualTargetFallback);
    } else {
      // Canal filtrado, marca total → usar store goals filtradas por canal
      fullYearTarget = calcAnnualTarget(filteredGoals, execConfig.annualTargetFallback);
    }

    // ── 2. Objetivo del período — budget prorrateado al último día con datos ──
    // Compara períodos equivalentes: si tenemos datos hasta el día 7 de marzo,
    // el target es budget(ene) + budget(feb) + budget(mar) × 7/31.
    // Para lastClosedMonth: budget completo del mes (no hay prorrateo).
    let periodBudget = 0;   // budget COMPLETO de los meses activos (sin prorrateo)
    let periodTarget = 0;   // budget PRORRATEADO al último día con datos
    for (const [m, rev] of monthlyBudget) {
      if (!activeMonths.includes(m)) continue;
      periodBudget += rev;
      if (correctedProrata && m === correctedProrata.month) {
        periodTarget += rev * correctedProrata.factor;
      } else {
        periodTarget += rev;
      }
    }

    // annualTarget = meta anual completa (para proyecciones a fin de año)
    const annualTarget = isYtd ? fullYearTarget : periodBudget;

    // ── 3. Ventas reales del periodo ───────────────────────────────────
    let ytd = 0;
    for (const [m, neto] of monthlyReal) {
      if (activeMonths.includes(m)) ytd += neto;
    }

    // ── 4. Temporal + Forecast (adaptado al periodo) ───────────────────
    const now = new Date();
    const daysInYear = (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)) ? 366 : 365;

    // Usar el último día con datos reales (no el calendario) para calcular días transcurridos.
    // Evita dividir N días de ventas por un denominador de M días (M > N → forecast subestimado).
    const effectiveDate = lastDataDay != null && lastDataMonth != null && isCurrentYear
      ? new Date(year, lastDataMonth - 1, lastDataDay)
      : now;
    const daysElapsed = dayOfYear(effectiveDate);
    const daysRemaining = Math.max(0, daysInYear - daysElapsed);

    let forecastYearEnd: number;
    let requiredMonthlyRunRate: number;
    let monthsRemainingCalc: number;

    if (isYtd) {
      // YTD: proyectar a fin de año
      forecastYearEnd = calcForecast(ytd, daysElapsed, daysInYear);
      requiredMonthlyRunRate = calcRequiredMonthlyRunRate(fullYearTarget, ytd, daysRemaining);
      monthsRemainingCalc = Math.max(1, Math.round(daysRemaining / (365 / 12)));
    } else if (isCurrentMonth && correctedProrata && correctedProrata.factor > 0) {
      // Mes actual: proyectar a fin del mes usando factor corregido
      forecastYearEnd = ytd / correctedProrata.factor;
      requiredMonthlyRunRate = 0;
      monthsRemainingCalc = 0;
    } else {
      // Mes pasado (cerrado): no hay proyección
      forecastYearEnd = ytd;
      requiredMonthlyRunRate = 0;
      monthsRemainingCalc = 0;
    }

    // Brecha vs objetivo del período (budget-aligned, no lineal)
    // periodTarget ya está prorrateado al último día con datos reales.
    const gapToTarget = periodTarget - ytd;

    // Progreso real = ventas vs meta del período (comparación justa)
    const realProgressPct = periodTarget > 0 ? (ytd / periodTarget) * 100 : 0;
    // Pronóstico = proyección anual vs meta anual (forward-looking)
    const forecastProgressPct = annualTarget > 0 ? (forecastYearEnd / annualTarget) * 100 : 0;

    // ── 5. YoY vs año anterior (prorrateado en mes parcial) ───────────
    // Meses cerrados: PY completo (sin prorrateo).
    // Mes parcial (actual con datos incompletos): PY prorrateado al mismo
    // día de corte que CY usando datos diarios — manzanas con manzanas.
    // NOTA: La tabla Performance Mensual NO se toca — sigue meses completos.
    let priorYtd = 0;
    const partialMonth = correctedProrata?.month;
    const isPartialInScope = partialMonth != null && activeMonths.includes(partialMonth);
    for (const [m, neto] of monthlyPY) {
      if (!activeMonths.includes(m)) continue;
      if (isPartialInScope && m === partialMonth) continue;
      priorYtd += neto;
    }
    if (isPartialInScope) {
      const cutoffDay = lastDataDay ?? new Date().getDate();
      for (const r of filteredDailyPY) {
        if (r.month === partialMonth && r.day <= cutoffDay) {
          priorYtd += r.neto;
        }
      }
    }
    const yoyDelta = ytd - priorYtd;
    const yoyPct = priorYtd > 0 ? (yoyDelta / priorYtd) * 100 : 0;

    // ── 6. Margen Bruto % ─────────────────────────────────────────────
    // GM% ponderado por revenue: sum(neto - costo) / sum(neto) * 100
    let ytdCost = 0;
    for (const [m, cost] of monthlyCost) {
      if (activeMonths.includes(m)) ytdCost += cost;
    }
    const grossMarginPct = calcGrossMargin(ytd, ytdCost);

    // PY GM% — mismos meses completos (sin prorrateo, consistente con YoY)
    let priorCost = 0;
    for (const [m, cost] of monthlyPYCost) {
      if (activeMonths.includes(m)) priorCost += cost;
    }
    const prevGrossMarginPct = calcGrossMargin(priorYtd, priorCost);
    const grossMarginYoY = grossMarginPct - prevGrossMarginPct;

    // ── 7. GMROI & Rotación (inventario) ──────────────────────────────────
    // Valor del inventario filtrado por marca (si aplica).
    let invValue = inventoryQ.data?.totalValue ?? 0;
    if (filters.brand !== "total" && inventoryQ.data) {
      const canonical = brandIdToCanonical(filters.brand);
      const brandInv = inventoryQ.data.byBrand.find((b) => b.brand === canonical);
      invValue = brandInv?.value ?? 0;
    }
    const months = activeMonths.length;
    const gmroi = calcGMROI(ytd - ytdCost, invValue, months);
    const inventoryTurnover = calcInventoryTurnover(ytdCost, invValue, months);

    return {
      periodTarget,
      annualTarget,
      ytd,
      forecastYearEnd,
      gapToTarget,
      requiredMonthlyRunRate,
      realProgressPct,
      forecastProgressPct,
      monthsRemaining: monthsRemainingCalc,
      yoyPct,
      yoyDelta,
      grossMarginPct,
      grossMarginYoY,
      gmroi,
      inventoryTurnover,
    };
  }, [salesQ.isLoading, budgetQ.isLoading, goalsQ.isLoading, goalsQ.data, inventoryQ.data,
      monthlyReal, monthlyBudget, monthlyPY, monthlyCost, monthlyPYCost,
      activeMonths,
      isCurrentYear, year, filters.brand, filters.channel, filters.store,
      filters.period, correctedProrata, lastDataDay, lastDataMonth, filteredDailyPY,
      execConfig.annualTargetFallback]);

  // ── Series del gráfico (siempre muestra 12 meses para contexto anual) ──
  const chartPoints = useMemo((): ChartPoint[] => {
    if (!metrics) return [];
    // Monthly run rate = promedio de los meses cerrados con datos
    let closedSum = 0;
    let closedCount = 0;
    for (const [m, neto] of monthlyReal) {
      if (closedMonths.includes(m)) { closedSum += neto; closedCount++; }
    }
    const monthlyRunRate = closedCount > 0 ? closedSum / closedCount : 0;

    // PY del mes parcial: suma día a día exacta (no prorrateo)
    let partialMonthPY: number | undefined;
    if (correctedProrata) {
      const cutoffDay = lastDataDay ?? new Date().getDate();
      let sum = 0;
      for (const r of filteredDailyPY) {
        if (r.month === correctedProrata.month && r.day <= cutoffDay) sum += r.neto;
      }
      partialMonthPY = sum;
    }

    return buildCumulativeSeries(monthlyReal, monthlyBudget, lastRealMonth, monthlyRunRate, correctedProrata, monthlyPY, partialMonthPY);
  }, [metrics, monthlyReal, monthlyBudget, lastRealMonth, closedMonths, correctedProrata, monthlyPY, lastDataDay, filteredDailyPY]);

  // ── Filtrado de datos diarios CY (para gráfico diario) ────────────────
  const filteredDailyCY = useMemo((): DailySalesRow[] => {
    const rows = dailyCYQ.data ?? [];
    const canonical = filters.brand !== "total" ? brandIdToCanonical(filters.brand) : null;
    const ch = filters.channel !== "total" ? filters.channel.toUpperCase() : null;
    return rows.filter(r => {
      if (canonical && r.brand !== canonical) return false;
      if (ch && r.channel !== ch) return false;
      return true;
    });
  }, [dailyCYQ.data, filters.brand, filters.channel]);

  // ── Unidades por mes (desde datos diarios, que sí tienen campo units) ──
  const monthlyUnits = useMemo(
    () => aggregateUnitsByMonthFromDaily(filteredDailyCY),
    [filteredDailyCY],
  );
  const monthlyPYUnits = useMemo(
    () => aggregateUnitsByMonthFromDaily(filteredDailyPY),
    [filteredDailyPY],
  );

  // ── Series diarias (vista de mes individual) ────────────────────────────
  const dailyChartPoints = useMemo((): DailyChartPoint[] | null => {
    if (filters.period === "ytd" || activeMonths.length === 0) return null;
    const targetMonth = activeMonths[0]; // lastClosedMonth o currentMonth → 1 solo mes
    const dim = daysInMonth(year, targetMonth);
    const budget = monthlyBudget.get(targetMonth) ?? 0;
    const isCurrentPartial = correctedProrata && targetMonth === correctedProrata.month;
    const cutoff = isCurrentPartial ? lastDataDay : null;
    return buildDailySeries(filteredDailyCY, filteredDailyPY, targetMonth, budget, dim, cutoff);
  }, [filters.period, activeMonths, year, monthlyBudget, correctedProrata, lastDataDay, filteredDailyCY, filteredDailyPY]);

  // ── Filas de tabla mensual ─────────────────────────────────────────────
  const monthlyRows = useMemo(
    () => buildMonthlyRows({
      monthlyReal, monthlyBudget, monthlyPY,
      monthlyCost, monthlyPYCost, monthlyBudgetGmPct,
      monthlyUnits, monthlyBudgetUnits, monthlyPYUnits,
      calendarMonth: calMonth, partialProrata: correctedProrata,
    }, execConfig.lyBudgetFactor),
    [monthlyReal, monthlyBudget, monthlyPY, monthlyCost, monthlyPYCost,
     monthlyBudgetGmPct, monthlyUnits, monthlyBudgetUnits, monthlyPYUnits,
     calMonth, correctedProrata, execConfig.lyBudgetFactor],
  );

  // ── Insights automáticos ──────────────────────────────────────────────
  // Modo 1 (brand="total"): compara marcas entre sí vs presupuesto.
  // Modo 2 (brand específica): compara canales (B2B vs B2C) para esa marca.
  const insights = useMemo((): BrandInsight[] => {
    if (!metrics || !salesQ.data || !budgetQ.data) return [];

    if (filters.brand === "total") {
      // Modo 1: comparar marcas
      const salesAgg = aggregateSalesByBrand(
        filterSalesRows(salesQ.data, "total", filters.channel, filters.store, filters.b2bSubchannel),
        activeMonths,
      );
      const budgetAgg = aggregateBudgetByBrand(
        budgetQ.data ?? [],
        activeMonths,
        filters.channel,
        correctedProrata,
      );
      return generateBrandInsights(salesAgg, budgetAgg, 3);
    } else {
      // Modo 2: comparar canales para la marca seleccionada
      const salesAgg = aggregateSalesByChannel(
        filterSalesRows(salesQ.data, filters.brand, "total", filters.store),
        activeMonths,
      );
      const budgetAgg = aggregateBudgetByChannel(
        budgetQ.data ?? [],
        activeMonths,
        brandIdToCanonical(filters.brand) ?? undefined,
        correctedProrata,
      );
      return generateChannelInsights(salesAgg, budgetAgg, 3);
    }
  }, [metrics, salesQ.data, budgetQ.data, filters.brand, filters.channel, filters.b2bSubchannel, filters.store, activeMonths, correctedProrata]);

  // Channel insights (solo para brand="total" — se usa en rotación con brand insights)
  const channelInsights = useMemo((): BrandInsight[] => {
    if (!metrics || !salesQ.data || !budgetQ.data) return [];
    if (filters.brand !== "total") return [];
    if (filters.channel !== "total") return []; // con filtro de canal, rotación no aplica
    const salesAgg = aggregateSalesByChannel(
      filterSalesRows(salesQ.data, "total", "total", filters.store),
      activeMonths,
    );
    const budgetAgg = aggregateBudgetByChannel(
      budgetQ.data ?? [],
      activeMonths,
      undefined,
      correctedProrata,
    );
    return generateChannelInsights(salesAgg, budgetAgg, 3);
  }, [metrics, salesQ.data, budgetQ.data, filters.store, activeMonths, correctedProrata, filters.brand, filters.channel]);

  // ── getRowsForView: re-filtra datos wide cacheados para una vista ──────
  const getRowsForView = useCallback(
    (viewBrand: string, viewChannel: string): MonthlyRow[] => {
      const cyRows  = filterSalesRows(salesQ.data ?? [], viewBrand, viewChannel, null);
      const pyRows  = filterSalesRows(prevSalesQ.data ?? [], viewBrand, viewChannel, null);
      const cyMap   = aggregateByMonth(cyRows);
      const pyMap   = aggregateByMonth(pyRows);
      const budMap  = aggregateBudgetByMonth(budgetQ.data ?? [], viewBrand, viewChannel);
      // Simplified view — margin and units use empty maps (not shown in InsightBar)
      const empty = new Map<number, number>();
      return buildMonthlyRows({
        monthlyReal: cyMap, monthlyBudget: budMap, monthlyPY: pyMap,
        monthlyCost: aggregateCostByMonth(cyRows), monthlyPYCost: aggregateCostByMonth(pyRows),
        monthlyBudgetGmPct: aggregateBudgetGmPctByMonth(budgetQ.data ?? [], viewBrand, viewChannel),
        monthlyUnits: empty, monthlyBudgetUnits: empty, monthlyPYUnits: empty,
        calendarMonth: calMonth, partialProrata: correctedProrata,
      }, execConfig.lyBudgetFactor);
    },
    [salesQ.data, prevSalesQ.data, budgetQ.data, calMonth, correctedProrata, execConfig.lyBudgetFactor],
  );

  // ── Estado consolidado ─────────────────────────────────────────────────
  const isLoading = salesQ.isLoading || prevSalesQ.isLoading || budgetQ.isLoading || goalsQ.isLoading || dailyPYQ.isLoading || dailyCYQ.isLoading;
  const isInventoryLoading = inventoryQ.isLoading;
  const error = salesQ.error?.message ?? prevSalesQ.error?.message
    ?? budgetQ.error?.message ?? goalsQ.error?.message ?? dailyPYQ.error?.message ?? dailyCYQ.error?.message ?? null;

  return {
    metrics,
    chartPoints,
    dailyChartPoints,
    monthlyRows,
    insights,
    channelInsights,
    periodLabel,
    calendarMonth: calMonth,
    isPartialMonth,
    isYtdView: filters.period === "ytd",
    isLoading,
    isInventoryLoading,
    error,
    lastDataDay,
    lastDataMonth,
    getRowsForView,
  };
}
