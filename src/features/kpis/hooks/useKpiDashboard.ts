/**
 * features/kpis/hooks/useKpiDashboard.ts
 *
 * Hook principal del KPI Dashboard.
 * Conecta queries → domain → 9 KPIs core listos para mostrar.
 *
 * ─── Arquitectura: patrón mixto de fetch ────────────────────────────────────
 *
 * "Fetch wide, filter local" (monthly + priorYearMTD):
 *   Datos pequeños (~1K filas). Se cachean sin filtros de usuario.
 *   Cambio de brand/channel/store = re-render instantáneo vía useMemo.
 *
 * "Fetch filtered" (daily):
 *   Datos grandes (~20K+ filas/mes). Se mantienen filtros de usuario en
 *   Supabase para reducir volumen. Paginación secuencial.
 *
 * Tickets: ya era wide (fetch por año, filter en JS).
 *
 * ─── Bug documentado: isLoading con queries disabled ─────────────────────────
 *
 * En TanStack Query v5, cuando enabled=false:
 *   status='pending', fetchStatus='idle' → isLoading = false (!)
 *
 * Todos los loading states incluyen salesQ.isLoading para garantizar skeleton
 * hasta que el período esté determinado con exactitud.
 *
 * ─── YoY por período ──────────────────────────────────────────────────────────
 *
 * lastClosedMonth: usa closedMonths (simétrico — mes completo vs mes completo).
 * ytd (año actual): usa closedMonths LY + fetchPriorYearMTDWide para
 *   comparar "Ene–Mar 4, 2026" vs "Ene–Mar 4, 2025".
 * currentMonth: usa fetchPriorYearMTDWide para día-a-día exacto.
 * ytd (año anterior): usa todos los meses cerrados LY (no hay partial).
 */
import { useMemo } from "react";
import { useQuery, useQueries } from "@tanstack/react-query";
import { useFilters } from "@/hooks/useFilters";
import {
  fetchMonthlySalesWide,
  fetchDailyDetail,
  fetchDailySalesWide,
  fetchPriorYearMTDWide,
} from "@/queries/sales.queries";
import type { PriorYearMTDRow } from "@/queries/sales.queries";
import { fetchInventoryValue } from "@/queries/inventory.queries";
import {
  fetchAnnualTickets,
  fetchPriorYearAnnualTickets,
  filterTicketsByChannel,
} from "@/queries/tickets.queries";
import { fetchStores } from "@/queries/stores.queries";
import { fetchSellThroughByWindow, fetchSkuBrandMap } from "@/queries/sellThrough.queries";
import { fetchDSO } from "@/queries/dso.queries";
import { fetchCustomerRecurrence } from "@/queries/recurrence.queries";
import {
  salesKeys, inventoryKeys, storeKeys, sthKeys, dsoKeys, recurrenceKeys,
  STALE_30MIN, GC_60MIN,
} from "@/queries/keys";
import { filterSalesRows } from "@/queries/filters";
import { resolvePeriod } from "@/domain/period/resolve";
import { getCalendarMonth, getCalendarYear, getCalendarDay } from "@/domain/period/helpers";
import { brandIdToCanonical, classifyStore } from "@/api/normalize";
import type { PeriodFilter, B2bSubchannel } from "@/domain/filters/types";
import {
  calcGrossMargin,
  calcGMROI,
  calcInventoryTurnover,
  calcYoY,
  calcLfL,
  calcMarkdownDependency,
  calcReturnsRate,
  calcAOV,
  calcUPT,
  calcCustomerRecurrence,
  calcDSO,
  calcSellThrough,
} from "@/domain/kpis/calculations";
import type { KpiUnit } from "@/utils/format";
import { checkKpiAvailability } from "@/domain/kpis/filterSupport";

// ─── Tipos públicos ───────────────────────────────────────────────────────────

export interface KpiCardData {
  id: string;
  title: string;
  value: number;
  unit: KpiUnit;
  /** null = sin dato de comparación disponible (período sin meses cerrados) */
  yoyPct: number | null;
  positiveDirection: "up" | "down";
  /** Cada KPI sabe exactamente qué queries lo alimentan */
  isLoading: boolean;
  error?: string;
  /** Aviso sobre limitación de datos (p.ej. UPT aproximado por filtro de marca) */
  note?: string;
  /** Datos mensuales para sparkline (1 valor por mes activo) */
  sparkline?: number[];
}

export interface UseKpiDashboardResult {
  kpis: KpiCardData[];
  periodLabel: string;
}

// ─── Helper: meses provisionales desde calendario ────────────────────────────

/**
 * Calcula los meses esperados a partir del calendario del sistema, sin BD.
 *
 * Permite que ticketsQ y dailyQ se disparen en paralelo con salesQ,
 * eliminando el waterfall de 1-2s que generaba esperar a salesQ.
 *
 * Precisión: exacta para año actual (ETL carga meses cerrados puntualmente).
 * Para años anteriores asume que todos los meses tienen datos.
 */
function computeProvisionalMonths(period: PeriodFilter, year: number): number[] {
  const calMonth = getCalendarMonth();
  const calYear  = getCalendarYear();
  const isCurrentYear = year === calYear;

  switch (period) {
    case "ytd":
      if (!isCurrentYear) return Array.from({ length: 12 }, (_, i) => i + 1);
      // Meses activos ytd: 1...calMonth (incluye mes en curso parcial)
      return Array.from({ length: calMonth }, (_, i) => i + 1);

    case "lastClosedMonth":
      if (!isCurrentYear) return [12];
      return calMonth > 1 ? [calMonth - 1] : [];

    case "currentMonth":
      return [calMonth];
  }
}

// ─── Helpers de filtrado local (solo para queries WIDE) ──────────────────────

/** Filtra y agrega filas PriorYearMTDRow por los filtros activos del usuario. */
function filterPriorYearMTD(
  rows: PriorYearMTDRow[],
  brand: string,
  channel: string,
  store: string | null,
  b2bSub: B2bSubchannel = "all",
): { neto: number; cogs: number; bruto: number; dcto: number } {
  const canonical = brand !== "total" ? brandIdToCanonical(brand) : null;
  const ch = channel !== "total" ? channel.toUpperCase() : null;
  const subActive = ch === "B2B" && b2bSub !== "all";
  return rows.reduce(
    (acc, r) => {
      if (canonical && r.brand !== canonical) return acc;
      if (ch && r.channel !== ch) return acc;
      if (store && r.store !== store) return acc;
      if (subActive) {
        const isUtp = r.store === "UTP" || r.store === "UNIFORMES";
        if (b2bSub === "utp" && !isUtp) return acc;
        if (b2bSub === "mayorista" && isUtp) return acc;
      }
      return {
        neto:  acc.neto  + r.neto,
        cogs:  acc.cogs  + r.cogs,
        bruto: acc.bruto + r.bruto,
        dcto:  acc.dcto  + r.dcto,
      };
    },
    { neto: 0, cogs: 0, bruto: 0, dcto: 0 },
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useKpiDashboard(): UseKpiDashboardResult {
  const { filters } = useFilters();

  // ── Meses provisionales: desde calendario, sin esperar a la BD ─────────────
  const provisionalMonths = useMemo(
    () => computeProvisionalMonths(filters.period, filters.year),
    [filters.period, filters.year]
  );

  // ── Queries WIDE (monthly: ~1K filas, filtro en JS) ─────────────────────
  //   staleTime 30min para todo: año actual Y anterior.
  //   Aunque 2025 está "cerrado", la BD puede cambiar (columnas nuevas,
  //   correcciones de Derlys, ETL re-cargado). No asumimos Infinity.
  //   30 min es suficiente: si volvés de otra pestaña en < 30min → cache hit.
  const calYear = getCalendarYear();

  const [salesQ, prevSalesQ, invQ, storesQ] = useQueries({
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
      {
        queryKey: inventoryKeys.value(),
        queryFn: () => fetchInventoryValue(),
        staleTime: STALE_30MIN,
        gcTime: GC_60MIN,
      },
      {
        queryKey: storeKeys.list(),
        queryFn: () => fetchStores(),
        staleTime: STALE_30MIN,
        gcTime: GC_60MIN,
      },
    ],
  });

  // ── Tickets: query anual sin filtro de mes (robusta al tipo de columna) ──────
  const ticketsQ = useQuery({
    queryKey: ["tickets", "annual", filters.year] as const,
    queryFn: () => fetchAnnualTickets(filters.year),
    staleTime: STALE_30MIN,
    gcTime: GC_60MIN,
    retry: 1,
  });

  const prevTicketsQ = useQuery({
    queryKey: ["tickets", "annual", filters.year - 1] as const,
    queryFn: () => fetchPriorYearAnnualTickets(filters.year),
    enabled: filters.period !== "currentMonth",
    staleTime: STALE_30MIN,
    gcTime: GC_60MIN,
    retry: 1,
  });

  // ── Daily FILTERED (fjdhstvta1: ~20K+ filas/mes, demasiado para wide) ──────
  //   Mantiene filtros de usuario en Supabase para reducir volumen.
  //   Key incluye filters + period → cambio de filtro = refetch.
  const dailyQ = useQuery({
    queryKey: [
      "sales", "daily",
      filters.brand, filters.channel, filters.store, filters.year,
      filters.period,
    ] as const,
    queryFn: () => fetchDailyDetail(filters, provisionalMonths),
    enabled: provisionalMonths.length > 0,
    staleTime: STALE_30MIN,
    gcTime: GC_60MIN,
    retry: 1,
  });

  // ── Prior year MTD WIDE (para YoY currentMonth y YTD) ─────────────────────
  //   Pre-agregado por brand+channel+store durante paginación (~50 filas).
  //   Acumulación order-agnostic: elimina no-determinismo de fjdhstvta1 sin ORDER BY.
  //   Key incluye lastDataDay para simetría con datos CY reales.
  const calMonth = getCalendarMonth();
  const needsDayPreciseYoY =
    filters.period === "currentMonth" ||
    (filters.period === "ytd" && filters.year === calYear);

  // ── Detectar último día con datos reales (cache hit desde Executive) ─────
  const dailyCYQ = useQuery({
    queryKey: salesKeys.dailyWide(calYear),
    queryFn: () => fetchDailySalesWide(calYear),
    enabled: needsDayPreciseYoY,
    staleTime: STALE_30MIN,
    gcTime: GC_60MIN,
  });

  const lastDataDay = useMemo((): number | null => {
    if (!needsDayPreciseYoY) return null;
    const allDaily = dailyCYQ.data ?? [];
    const daysInCurrentMonth = allDaily
      .filter(r => r.month === calMonth)
      .map(r => r.day);
    if (daysInCurrentMonth.length === 0) return null;
    return Math.max(...daysInCurrentMonth);
  }, [dailyCYQ.data, calMonth, needsDayPreciseYoY]);

  // cutoffDay: último día con datos reales, o fallback al día calendario
  const cutoffDay = lastDataDay ?? getCalendarDay();

  const prevCurrentMonthQ = useQuery({
    queryKey: salesKeys.priorYearMTDWide(calYear, calMonth, cutoffDay),
    queryFn: () => fetchPriorYearMTDWide(cutoffDay),
    enabled: needsDayPreciseYoY,
    staleTime: STALE_30MIN,
    gcTime: GC_60MIN,
    retry: 2,
  });

  // ── KPIs desbloqueados (sesión 02/05/2026) ───────────────────────────────
  // sell_through, dso, customer_recurrence — datos vivos en BD operacional.

  // Map sku→brand para filtrar sell-through por marca (v_sth_cohort no tiene brand).
  const brandCanonical = filters.brand !== "total" ? brandIdToCanonical(filters.brand) : null;
  const skuBrandMapQ = useQuery({
    queryKey: sthKeys.brandMap(),
    queryFn: () => fetchSkuBrandMap(),
    enabled: brandCanonical !== null,
    staleTime: STALE_30MIN,
    gcTime: GC_60MIN,
  });

  const sthWindowsQ = useQuery({
    queryKey: sthKeys.windows(filters.store, brandCanonical),
    queryFn: () => fetchSellThroughByWindow(filters.store, skuBrandMapQ.data ?? null, brandCanonical),
    // Espera a brandMap solo si hay filtro de marca (sino brandMap no se carga).
    enabled: brandCanonical === null || skuBrandMapQ.data !== undefined,
    staleTime: STALE_30MIN,
    gcTime: GC_60MIN,
    retry: 1,
  });

  // ── Filtrado local: datos WIDE cacheados → filtrados por brand/channel/store
  const filteredSales = useMemo(
    () => filterSalesRows(salesQ.data ?? [], filters.brand, filters.channel, filters.store, filters.b2bSubchannel),
    [salesQ.data, filters.brand, filters.channel, filters.store, filters.b2bSubchannel],
  );

  const filteredPrevSales = useMemo(
    () => filterSalesRows(prevSalesQ.data ?? [], filters.brand, filters.channel, filters.store, filters.b2bSubchannel),
    [prevSalesQ.data, filters.brand, filters.channel, filters.store, filters.b2bSubchannel],
  );

  const filteredPrevMTD = useMemo(
    () => filterPriorYearMTD(prevCurrentMonthQ.data ?? [], filters.brand, filters.channel, filters.store, filters.b2bSubchannel),
    [prevCurrentMonthQ.data, filters.brand, filters.channel, filters.store, filters.b2bSubchannel],
  );

  // ── DSO + Customer Recurrence: dependen de meses provisionales (no requieren
  //     resolver activeMonths exactos via salesQ — usan rango calendario directo).
  const channelKey: "b2b" | "b2c" | null =
    filters.channel === "b2b" || filters.channel === "b2c" ? filters.channel : null;

  // DSO es solo a nivel total — c_cobrar no tiene brand/channel/store. La
  // disponibilidad por filtros la enforce checkKpiAvailability del catálogo
  // (supportedFilters: false en las 3); aquí disparamos siempre que el período
  // tenga meses provisionales, y el card final lo bloqueará si hay filtros.
  const dsoQ = useQuery({
    queryKey: dsoKeys.byPeriod(filters.year, provisionalMonths),
    queryFn: () => fetchDSO({ year: filters.year, months: provisionalMonths }),
    enabled: provisionalMonths.length > 0,
    staleTime: STALE_30MIN,
    gcTime: GC_60MIN,
    retry: 1,
  });

  // Recurrence: store viene como cosujd; necesitamos cosupc para query directa.
  const storeCosupc = useMemo(() => {
    if (!filters.store) return null;
    const target = filters.store.trim().toUpperCase();
    return (storesQ.data ?? []).find((s) => s.cosujd.toUpperCase() === target)?.cosupc ?? null;
  }, [filters.store, storesQ.data]);

  const storeMapForChannel = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of storesQ.data ?? []) map.set(s.cosupc, s.cosujd);
    return map;
  }, [storesQ.data]);

  const recurrenceQ = useQuery({
    queryKey: recurrenceKeys.byPeriod(filters.year, provisionalMonths, channelKey, filters.store),
    queryFn: () => fetchCustomerRecurrence({
      year: filters.year,
      months: provisionalMonths,
      channel: channelKey,
      storeCosupc,
      storeMap: storeMapForChannel,
    }),
    enabled:
      provisionalMonths.length > 0 &&
      // Si filtra por tienda, esperar a que tengamos cosupc resuelto.
      (!filters.store || storeCosupc !== null) &&
      // brand no soportado en este KPI → si activo, no disparar (UI muestra error).
      brandCanonical === null,
    staleTime: STALE_30MIN,
    gcTime: GC_60MIN,
    retry: 1,
  });

  // ── Período exacto desde datos reales de la BD ────────────────────────────
  // IMPORTANTE: usar salesQ.data (sin filtrar) para determinar qué meses existen.
  // Los meses disponibles en BD son un hecho estructural que NO depende de
  // brand/channel/store. Si usáramos filteredSales, cambiar de marca podría
  // hacer desaparecer un mes (ej: marca sin ventas en enero), alterando
  // activeMonths/closedMonths y corrompiendo el cálculo YoY.
  const { activeMonths, closedMonths, periodLabel } = useMemo(() => {
    const allRows = salesQ.data ?? [];
    const monthsInDB = [...new Set(allRows.map((r) => r.month))].sort((a, b) => a - b);
    const resolved = resolvePeriod(filters.period, monthsInDB, filters.year);
    return {
      activeMonths: resolved.activeMonths,
      closedMonths: resolved.closedMonths,
      periodLabel: resolved.label,
    };
  }, [salesQ.data, filters.period, filters.year]);

  // ── Cálculo de los 9 KPIs core ─────────────────────────────────────────────
  const kpis = useMemo((): KpiCardData[] => {
    const currRows       = filteredSales.filter((r) => activeMonths.includes(r.month));
    const prevRows       = filteredPrevSales.filter((r) => closedMonths.includes(r.month));
    const prevRowsAll    = filteredPrevSales.filter((r) => activeMonths.includes(r.month));
    const ticketsForMonths     = (ticketsQ.data ?? []).filter((t) => activeMonths.includes(t.month));
    const prevTicketsForMonths = (prevTicketsQ.data ?? []).filter((t) => closedMonths.includes(t.month));
    const daily          = (dailyQ.data ?? []).filter((r) => activeMonths.includes(r.month));

    // Inventario filtrado por canal: mv_stock_tienda.store + classifyStore.
    // Cuando filters.channel = "total" usamos el agregado total. Cuando es
    // "b2b" / "b2c", sumamos solo las tiendas cuyo classifyStore coincide.
    // Si filtra por tienda específica, sumamos solo esa.
    const invValue = (() => {
      const byStore = invQ.data?.byStore ?? [];
      if (filters.store) {
        const target = filters.store.trim().toUpperCase();
        return byStore.find((s) => s.store === target)?.value ?? 0;
      }
      if (filters.channel === "total") return invQ.data?.totalValue ?? 0;
      return byStore
        .filter((s) => classifyStore(s.store) === filters.channel)
        .reduce((sum, s) => sum + s.value, 0);
    })();
    const months   = activeMonths.length || 1; // guard /0 en GMROI/rotación

    // ── Agregar ventas ─────────────────────────────────────────────────────
    let currNeto = 0, currCogs = 0, currBruto = 0, currDcto = 0, currUnitsMonthly = 0;
    for (const r of currRows) { currNeto += r.neto; currCogs += r.cogs; currBruto += r.bruto; currDcto += r.dcto; currUnitsMonthly += r.units; }

    let prevNeto = 0, prevCogs = 0, prevBruto = 0, prevDcto = 0, prevUnitsMonthly = 0;
    for (const r of prevRows) { prevNeto += r.neto; prevCogs += r.cogs; prevBruto += r.bruto; prevDcto += r.dcto; prevUnitsMonthly += r.units; }

    // Prior year para TODOS los meses activos (incluye mes en curso completo, sin prorrateo)
    let prevNetoAll = 0;
    for (const r of prevRowsAll) { prevNetoAll += r.neto; }

    // ── Tickets (filtrado en memoria por canal y tienda) ───────────────────
    const storeMap = new Map<string, string>();
    for (const s of storesQ.data ?? []) storeMap.set(s.cosupc, s.cosujd);

    const filteredTickets     = filterTicketsByChannel(ticketsForMonths, storeMap, filters.channel, filters.store, filters.b2bSubchannel);
    const filteredPrevTickets = filterTicketsByChannel(prevTicketsForMonths, storeMap, filters.channel, filters.store, filters.b2bSubchannel);

    let totalTickets = 0, totalSales = 0;
    for (const t of filteredTickets) { totalTickets += t.tickets; totalSales += t.totalSales; }
    let prevTotalTickets = 0, prevTotalSales = 0;
    for (const t of filteredPrevTickets) { prevTotalTickets += t.tickets; prevTotalSales += t.totalSales; }

    // ── Detalle diario → devoluciones ──────────────────────────────────────
    let positiveNeto = 0, absNegativeNeto = 0;
    for (const r of daily) {
      if (r.neto > 0)  positiveNeto    += r.neto;
      if (r.neto < 0)  absNegativeNeto += Math.abs(r.neto);
    }

    // ── Cálculos (calculations.ts — cero fórmulas inline) ─────────────────
    const grossMarginPct     = calcGrossMargin(currNeto, currCogs);
    const gmroi              = calcGMROI(currNeto - currCogs, invValue, months);
    const inventoryTurnover  = calcInventoryTurnover(currCogs, invValue, months);
    const aov                = calcAOV(totalSales, totalTickets);
    const prevAov            = calcAOV(prevTotalSales, prevTotalTickets);
    const upt                = calcUPT(currUnitsMonthly, totalTickets);
    const prevUpt            = calcUPT(prevUnitsMonthly, prevTotalTickets);
    const uptYoY             = calcYoY(upt, prevUpt);
    const returnsRate        = calcReturnsRate(absNegativeNeto, positiveNeto);
    const markdownDep        = calcMarkdownDependency(currDcto, currBruto);

    // ── YoY por período ────────────────────────────────────────────────────
    //
    // NOTA: prevCurrMo (mes parcial del año anterior para day-precise YoY) se
    // carga desde fjdhstvta1 (~18 páginas, lento). Si aún está cargando:
    //   - Los VALORES principales (Revenue, GM%, Markdown%) se muestran
    //     inmediatamente desde salesQ/prevSalesQ (rápidos, mv_ventas_mensual).
    //   - Los YoY% se muestran como null ("Sin comparación anual") para evitar
    //     mostrar un cálculo incompleto que después cambia.
    //   - NO mostramos skeleton: el dato principal ya está disponible.
    const isCurrentYear     = filters.year === calYear;
    const isCurrMonthPeriod = filters.period === "currentMonth";
    const isYtdCurrentYear  = filters.period === "ytd" && isCurrentYear;
    const prevCurrMoLoading = needsDayPreciseYoY && prevCurrentMonthQ.isLoading;
    // Si la query erroreó (statement timeout en fjdhstvta1 2025), tratar como
    // "dato no disponible" → YoY = null. NUNCA usar {neto:0} de un error como
    // si fueran "0 ventas" — eso infla el YoY artificialmente.
    const prevCurrMoError   = needsDayPreciseYoY && !!prevCurrentMonthQ.error;
    const prevCurrMo        = needsDayPreciseYoY && !prevCurrMoLoading && !prevCurrMoError
      ? filteredPrevMTD
      : null;

    let cmpNeto:     number;
    let cmpCogs:     number;
    let cmpBruto:    number;
    let cmpDcto:     number;
    let hasFullYoY:  boolean;

    if (isCurrMonthPeriod && prevCurrMo && prevCurrMo.neto > 0) {
      cmpNeto     = prevCurrMo.neto;
      cmpCogs     = prevCurrMo.cogs;
      cmpBruto    = prevCurrMo.bruto;
      cmpDcto     = prevCurrMo.dcto;
      hasFullYoY  = true;
    } else if (isYtdCurrentYear) {
      if (prevCurrMo) {
        cmpNeto     = prevNeto  + prevCurrMo.neto;
        cmpCogs     = prevCogs  + prevCurrMo.cogs;
        cmpBruto    = prevBruto + prevCurrMo.bruto;
        cmpDcto     = prevDcto  + prevCurrMo.dcto;
        hasFullYoY  = cmpNeto > 0;
      } else {
        cmpNeto     = prevNeto;
        cmpCogs     = prevCogs;
        cmpBruto    = prevBruto;
        cmpDcto     = prevDcto;
        hasFullYoY  = !prevCurrMoLoading && closedMonths.length > 0 && prevNeto > 0;
      }
    } else {
      cmpNeto     = prevNeto;
      cmpCogs     = prevCogs;
      cmpBruto    = prevBruto;
      cmpDcto     = prevDcto;
      hasFullYoY  = closedMonths.length > 0 && prevNeto > 0;
    }

    const hasClosedYoY = closedMonths.length > 0 && prevNeto > 0;

    const prevGMPct      = calcGrossMargin(cmpNeto, cmpCogs);
    const prevMarkdown   = calcMarkdownDependency(cmpDcto, cmpBruto);

    // Revenue YoY: misma ventana que lflValue (mes parcial vs mes completo AA)
    const revenueYoY     = prevNetoAll > 0 ? calcYoY(currNeto, prevNetoAll) : null;
    // YoY: mes en curso parcial vs mes completo año anterior (sin prorrateo)
    const lflValue       = prevNetoAll > 0 ? calcLfL(currNeto, prevNetoAll) : 0;
    const grossMarginYoY = hasFullYoY ? grossMarginPct - prevGMPct : null;
    const aovYoY         = hasClosedYoY && prevTotalTickets > 0 ? calcYoY(aov, prevAov) : null;
    const markdownYoY    = hasFullYoY ? markdownDep - prevMarkdown : null;

    // ── Loading per-card ───────────────────────────────────────────────────
    // prevCurrMoLoading NO bloquea salesLoading: los valores principales
    // (Revenue, GM%, Markdown%) se calculan desde salesQ/prevSalesQ.
    // Solo el YoY% depende de prevCurrentMonthQ → se muestra null mientras carga.
    const salesLoading   = salesQ.isLoading || prevSalesQ.isLoading;
    const invLoading     = salesQ.isLoading || invQ.isLoading;
    const aovLoading     = salesQ.isLoading || ticketsQ.isLoading || storesQ.isLoading;
    const returnsLoading = salesQ.isLoading || dailyQ.isLoading;

    // ── Errores per-card ───────────────────────────────────────────────────
    const salesError   = salesQ.error   ? "Error al cargar ventas"          : undefined;
    const invError     = invQ.error     ? "Error al cargar inventario"       : undefined;
    const ticketsError = ticketsQ.error ? "Error al cargar tickets"          : undefined;
    const dailyError   = dailyQ.error   ? "Error al cargar detalle diario"   : undefined;

    // ── Sparklines mensuales ────────────────────────────────────────────────
    const sortedMonths = [...activeMonths].sort((a, b) => a - b);
    const monthlyNeto = sortedMonths.map((m) =>
      currRows.filter((r) => r.month === m).reduce((s, r) => s + r.neto, 0));
    const monthlyGM = sortedMonths.map((m) => {
      const rows = currRows.filter((r) => r.month === m);
      const n = rows.reduce((s, r) => s + r.neto, 0);
      const c = rows.reduce((s, r) => s + r.cogs, 0);
      return calcGrossMargin(n, c);
    });
    const monthlyAOV = sortedMonths.map((m) => {
      const tix = filteredTickets.filter((t) => t.month === m);
      const sales = tix.reduce((s, t) => s + t.totalSales, 0);
      const tickets = tix.reduce((s, t) => s + t.tickets, 0);
      return calcAOV(sales, tickets);
    });
    const monthlyUPT = sortedMonths.map((m) => {
      const units = currRows.filter((r) => r.month === m).reduce((s, r) => s + r.units, 0);
      const tickets = filteredTickets.filter((t) => t.month === m).reduce((s, t) => s + t.tickets, 0);
      return calcUPT(units, tickets);
    });
    const monthlyMarkdown = sortedMonths.map((m) => {
      const rows = currRows.filter((r) => r.month === m);
      const d = rows.reduce((s, r) => s + r.dcto, 0);
      const b = rows.reduce((s, r) => s + r.bruto, 0);
      return calcMarkdownDependency(d, b);
    });

    // ── Disponibilidad por filtros (arquitectural — catálogo) ──────────────
    const filterCtx = { brand: filters.brand, channel: filters.channel, store: filters.store };
    const avail = (id: string) => checkKpiAvailability(id, filterCtx);

    const rawCards: KpiCardData[] = [
      {
        id: "revenue", title: "Ventas Netas",
        value: currNeto, unit: "currency", yoyPct: revenueYoY, positiveDirection: "up",
        isLoading: salesLoading, error: salesError, sparkline: monthlyNeto,
      },
      {
        id: "lfl", title: "Crecimiento YoY",
        value: lflValue, unit: "percent", yoyPct: null, positiveDirection: "up",
        isLoading: salesLoading, error: salesError,
      },
      {
        id: "gross_margin", title: "Margen Bruto",
        value: grossMarginPct, unit: "percent", yoyPct: grossMarginYoY, positiveDirection: "up",
        isLoading: salesLoading, error: salesError, sparkline: monthlyGM,
      },
      {
        id: "gmroi", title: "GMROI",
        value: gmroi, unit: "ratio", yoyPct: null, positiveDirection: "up",
        isLoading: invLoading, error: invError ?? salesError,
      },
      {
        id: "inventory_turnover", title: "Rotación de Inventario",
        value: inventoryTurnover, unit: "ratio", yoyPct: null, positiveDirection: "up",
        isLoading: invLoading, error: invError ?? salesError,
      },
      {
        id: "aov", title: "Ticket Promedio",
        value: aov, unit: "currency", yoyPct: aovYoY, positiveDirection: "up", sparkline: monthlyAOV,
        isLoading: aovLoading,
        error: ticketsError ?? (
          !aovLoading && totalTickets === 0 && !ticketsError
            ? "Sin datos de tickets para este filtro"
            : undefined
        ),
      },
      {
        id: "upt", title: "Unidades por Ticket",
        value: upt, unit: "ratio", yoyPct: uptYoY, positiveDirection: "up", sparkline: monthlyUPT,
        isLoading: aovLoading,
        error: ticketsError ?? (
          !aovLoading && totalTickets === 0 && !ticketsError
            ? "Sin datos de tickets para este filtro"
            : undefined
        ),
      },
      {
        id: "returns_rate", title: "Tasa de Devoluciones",
        value: returnsRate, unit: "percent", yoyPct: null, positiveDirection: "down",
        isLoading: returnsLoading, error: dailyError,
      },
      {
        id: "markdown_dependency", title: "Dependencia de Ofertas",
        value: markdownDep, unit: "percent", yoyPct: markdownYoY, positiveDirection: "down",
        isLoading: salesLoading, error: salesError, sparkline: monthlyMarkdown,
      },
      // ── KPIs desbloqueados (sesión 02/05/2026) ─────────────────────────
      // Sell-through 30/60/90: muestra ventana 90d como valor principal con
      // sparkline de las 3 ventanas (30 → 60 → 90) para dar perspectiva.
      // calcSellThrough es referencia; el cálculo ya viene agregado de la query.
      {
        id: "sell_through", title: "Sell-through 90d",
        value: sthWindowsQ.data?.windows.find((w) => w.windowDays === 90)?.sthPct
          ?? calcSellThrough(0, 0),
        unit: "percent", yoyPct: null, positiveDirection: "up",
        isLoading: sthWindowsQ.isLoading || (brandCanonical !== null && skuBrandMapQ.isLoading),
        error: sthWindowsQ.error ? "Error al cargar sell-through" : undefined,
        sparkline: sthWindowsQ.data?.windows.map((w) => w.sthPct),
      },
      {
        id: "dso", title: "DSO (días cobranza)",
        value: dsoQ.data?.dataAvailable
          ? calcDSO(dsoQ.data.cuentasPorCobrar, dsoQ.data.ventasDiariasPromedio)
          : 0,
        unit: "days", yoyPct: null, positiveDirection: "down",
        isLoading: dsoQ.isLoading,
        error: dsoQ.error
          ? "Error al cargar CxC"
          : (!dsoQ.isLoading && dsoQ.data && !dsoQ.data.dataAvailable
              ? "Sin ventas registradas en el período (mv_ventas_diarias se actualiza con un día de retraso)"
              : undefined),
      },
      {
        id: "customer_recurrence", title: "Recurrencia clientes",
        value: recurrenceQ.data
          ? calcCustomerRecurrence(recurrenceQ.data.recurrentCustomers, recurrenceQ.data.totalCustomers)
          : 0,
        unit: "percent", yoyPct: null, positiveDirection: "up",
        isLoading: recurrenceQ.isLoading,
        // v_transacciones_dwh hoy llega hasta 31/12/2025; explicar antes que falle.
        error: recurrenceQ.error
          ? "Error al cargar transacciones"
          : (!recurrenceQ.isLoading && recurrenceQ.data?.totalCustomers === 0
              ? "Sin transacciones cargadas para este período (ETL Derlys pendiente para 2026)"
              : undefined),
      },
    ];

    return rawCards.map((card) => {
      const check = avail(card.id);
      if (check.available) return card;
      return {
        ...card,
        value: 0,
        yoyPct: null,
        isLoading: false,
        error: check.reason,
      };
    });
  }, [
    filteredSales, filteredPrevSales, filteredPrevMTD,
    salesQ.isLoading, salesQ.error,
    prevSalesQ.isLoading,
    invQ.data, invQ.isLoading, invQ.error,
    ticketsQ.data, ticketsQ.isLoading, ticketsQ.error,
    prevTicketsQ.data,
    dailyQ.data, dailyQ.isLoading, dailyQ.error,
    storesQ.data, storesQ.isLoading,
    prevCurrentMonthQ.isLoading, prevCurrentMonthQ.error,
    activeMonths, closedMonths,
    filters.channel, filters.b2bSubchannel, filters.store, filters.brand, filters.period, filters.year,
    needsDayPreciseYoY, calYear,
    // KPIs desbloqueados sesión 02/05/2026
    sthWindowsQ.data, sthWindowsQ.isLoading, sthWindowsQ.error,
    skuBrandMapQ.isLoading, brandCanonical,
    dsoQ.data, dsoQ.isLoading, dsoQ.error,
    recurrenceQ.data, recurrenceQ.isLoading, recurrenceQ.error,
  ]);

  return { kpis, periodLabel };
}
