/**
 * features/sales/hooks/useSalesAnalytics.ts
 *
 * Hook de datos para las cards analíticas de la página de ventas.
 *
 * OPTIMIZACIÓN V2:
 *   - brandBreakdown y channelMix se derivan LOCALMENTE de datos cacheados
 *     (salesWide CY + PY, ya cargados por useSalesDashboard → 0 queries nuevas)
 *   - skusQ y dailyQ son LAZY: solo se disparan cuando su card está habilitada
 *   - storeBreakdown usa datos cacheados (salesWide + tickets + stores)
 *
 * El periodo viene de useSalesDashboard (activeMonths / closedMonths).
 */
import { useMemo } from "react";
import { useQuery, useQueries } from "@tanstack/react-query";
import { useFilters } from "@/context/FilterContext";
import {
  fetchTopSkus,
  fetchDailyDetail,
  fetchMonthlySalesWide,
} from "@/queries/sales.queries";
import type {
  BrandBreakdownRow,
  ChannelMixRow,
  TopSkuRow,
  DailyDetailRow,
  MonthlySalesRow,
} from "@/queries/sales.queries";
import { fetchAnnualTickets, filterTicketsByChannel } from "@/queries/tickets.queries";
import type { TicketRow } from "@/queries/tickets.queries";
import { fetchStores } from "@/queries/stores.queries";
import { salesKeys, storeKeys, STALE_30MIN, GC_60MIN } from "@/queries/keys";
import { brandIdToCanonical } from "@/api/normalize";

import {
  calcGrossMargin,
  calcMarkdownDependency,
  calcYoY,
} from "@/domain/kpis/calculations";

// ─── Tipos publicos ──────────────────────────────────────────────────────────

const DOW_LABELS = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];
const DOW_LABELS_FULL = ["Domingo", "Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado"];

export interface DayOfWeekStat {
  dayNum: number;
  dayName: string;
  dayShort: string;
  totalNeto: number;
  avgNeto: number;
  txCount: number;
  isBest: boolean;
}

export interface StoreBreakdownRow {
  storeCode: string;
  neto: number;
  cogs: number;
  grossMargin: number;
  markdownPct: number;
  tickets: number;
  aov: number;
  revenuePct: number;
  /** Ventas netas del mismo período año anterior (undefined si no hay datos PY) */
  prevNeto?: number;
  /** % variación año contra año de ventas netas (undefined si no hay datos PY) */
  yoyPct?: number;
}

export interface SalesAnalyticsData {
  brandBreakdown: BrandBreakdownRow[];
  channelMix: ChannelMixRow[];
  topSkus: TopSkuRow[];
  dayOfWeek: DayOfWeekStat[];
  storeBreakdown: StoreBreakdownRow[];
  storeBreakdownB2C: StoreBreakdownRow[];
  storeBreakdownB2B: StoreBreakdownRow[];
  /** Raw monthly rows (CY) — for store detail derivation in UI. */
  salesWideRaw: MonthlySalesRow[];
  /** Raw daily detail rows — for single-month store sparklines/charts. */
  dailyDetailRaw: DailyDetailRow[];
  /** Raw ticket rows (annual, all stores) — for store detail tooltips. */
  ticketRows: TicketRow[];
  /** Map cosupc → cosujd — for resolving ticket store codes. */
  storeMap: Map<string, string>;
  activeMonths: number[];
  isLoading: boolean;
  isDowLoading: boolean;
  isSkusLoading: boolean;
  isStoresLoading: boolean;
  error: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildDayOfWeek(rows: DailyDetailRow[]): DayOfWeekStat[] {
  const acc = new Map<number, { neto: number; count: number; days: Set<string> }>();
  for (let d = 0; d < 7; d++) acc.set(d, { neto: 0, count: 0, days: new Set() });

  for (const r of rows) {
    if (r.neto <= 0) continue;
    const date = new Date(r.year, r.month - 1, r.day);
    const dow = date.getDay(); // 0=Sun
    const entry = acc.get(dow)!;
    entry.neto += r.neto;
    entry.count++;
    entry.days.add(`${r.year}-${r.month}-${r.day}`);
  }

  let maxNeto = 0;
  const stats: DayOfWeekStat[] = [];
  for (let d = 0; d < 7; d++) {
    const entry = acc.get(d)!;
    const uniqueDays = entry.days.size || 1;
    const avgNeto = entry.neto / uniqueDays;
    if (entry.neto > maxNeto) maxNeto = entry.neto;
    stats.push({
      dayNum: d,
      dayName: DOW_LABELS_FULL[d],
      dayShort: DOW_LABELS[d],
      totalNeto: entry.neto,
      avgNeto,
      txCount: entry.count,
      isBest: false,
    });
  }

  for (const s of stats) {
    if (s.totalNeto === maxNeto && maxNeto > 0) s.isBest = true;
  }

  return stats;
}

function buildStoreBreakdown(
  salesRows: MonthlySalesRow[],
  pyRows: MonthlySalesRow[],
  activeMonths: number[],
  brand: string,
  channel: string,
  ticketRows: Array<{ storeCode: string; tickets: number; totalSales: number; month: number }>,
  storeMap: Map<string, string>,
): StoreBreakdownRow[] {
  const canonical = brand !== "total" ? brandIdToCanonical(brand) : null;
  const ch = channel !== "total" ? channel.toUpperCase() : null;

  const storeAcc = new Map<string, { neto: number; cogs: number; bruto: number; dcto: number }>();
  for (const r of salesRows) {
    if (!activeMonths.includes(r.month)) continue;
    if (canonical && r.brand !== canonical) continue;
    if (ch && r.channel !== ch) continue;
    const acc = storeAcc.get(r.store) ?? { neto: 0, cogs: 0, bruto: 0, dcto: 0 };
    acc.neto  += r.neto;
    acc.cogs  += r.cogs;
    acc.bruto += r.bruto;
    acc.dcto  += r.dcto;
    storeAcc.set(r.store, acc);
  }

  // Prior year: mismos meses, mismos filtros, agrupado por tienda
  const pyAcc = new Map<string, number>();
  for (const r of pyRows) {
    if (!activeMonths.includes(r.month)) continue;
    if (canonical && r.brand !== canonical) continue;
    if (ch && r.channel !== ch) continue;
    pyAcc.set(r.store, (pyAcc.get(r.store) ?? 0) + r.neto);
  }

  const ticketsByStore = new Map<string, { tickets: number; sales: number }>();
  for (const t of ticketRows) {
    if (!activeMonths.includes(t.month)) continue;
    const cosujd = storeMap.get(t.storeCode)?.trim().toUpperCase() ?? "";
    if (!cosujd) continue;
    const acc = ticketsByStore.get(cosujd) ?? { tickets: 0, sales: 0 };
    acc.tickets += t.tickets;
    acc.sales   += t.totalSales;
    ticketsByStore.set(cosujd, acc);
  }

  let totalNeto = 0;
  storeAcc.forEach((v) => { totalNeto += v.neto; });

  const rows: StoreBreakdownRow[] = [];
  storeAcc.forEach((v, store) => {
    const tkt = ticketsByStore.get(store.trim().toUpperCase());
    const prevNeto = pyAcc.get(store) ?? 0;
    rows.push({
      storeCode:   store,
      neto:        v.neto,
      cogs:        v.cogs,
      grossMargin: calcGrossMargin(v.neto, v.cogs),
      markdownPct: calcMarkdownDependency(v.dcto, v.bruto),
      tickets:     tkt?.tickets ?? 0,
      aov:         tkt && tkt.tickets > 0 ? tkt.sales / tkt.tickets : 0,
      revenuePct:  totalNeto > 0 ? (v.neto / totalNeto) * 100 : 0,
      prevNeto:    prevNeto > 0 ? prevNeto : undefined,
      yoyPct:      prevNeto > 0 ? calcYoY(v.neto, prevNeto) : undefined,
    });
  });

  return rows.sort((a, b) => b.neto - a.neto);
}

/** Deriva brandBreakdown localmente de datos cacheados (0 queries). */
function deriveBrandBreakdown(
  cyRows: MonthlySalesRow[],
  pyRows: MonthlySalesRow[],
  activeMonths: number[],
  channel: string,
  store: string,
): BrandBreakdownRow[] {
  const ch = channel !== "total" ? channel.toUpperCase() : null;

  const aggCurr = new Map<string, { neto: number; cogs: number; bruto: number; dcto: number }>();
  for (const r of cyRows) {
    if (!activeMonths.includes(r.month)) continue;
    if (ch && r.channel !== ch) continue;
    if (store && r.store !== store) continue;
    const acc = aggCurr.get(r.brand) ?? { neto: 0, cogs: 0, bruto: 0, dcto: 0 };
    acc.neto  += r.neto;
    acc.cogs  += r.cogs;
    acc.bruto += r.bruto;
    acc.dcto  += r.dcto;
    aggCurr.set(r.brand, acc);
  }

  const aggPrev = new Map<string, number>();
  for (const r of pyRows) {
    if (!activeMonths.includes(r.month)) continue;
    if (ch && r.channel !== ch) continue;
    if (store && r.store !== store) continue;
    aggPrev.set(r.brand, (aggPrev.get(r.brand) ?? 0) + r.neto);
  }

  const result: BrandBreakdownRow[] = [];
  aggCurr.forEach((vals, brand) => {
    const prevNeto = aggPrev.get(brand) ?? 0;
    const yoyPct = prevNeto > 0 ? calcYoY(vals.neto, prevNeto) : undefined;
    result.push({ brand, ...vals, prevNeto, yoyPct });
  });

  return result.sort((a, b) => b.neto - a.neto);
}

/** Deriva channelMix localmente de datos cacheados (0 queries). */
function deriveChannelMix(
  cyRows: MonthlySalesRow[],
  activeMonths: number[],
  brand: string,
  store: string,
): ChannelMixRow[] {
  const canonical = brand !== "total" ? brandIdToCanonical(brand) : null;

  const acc = new Map<string, number>();
  for (const r of cyRows) {
    if (!activeMonths.includes(r.month)) continue;
    if (canonical && r.brand !== canonical) continue;
    if (store && r.store !== store) continue;
    if (!r.channel) continue;
    acc.set(r.channel, (acc.get(r.channel) ?? 0) + r.neto);
  }

  let total = 0;
  acc.forEach((v) => { total += v; });

  const result: ChannelMixRow[] = [];
  acc.forEach((neto, channel) => {
    result.push({
      channel: channel as "B2C" | "B2B",
      neto,
      pct: total > 0 ? (neto / total) * 100 : 0,
    });
  });

  return result.sort((a, b) => b.neto - a.neto);
}

// ─── Hook ────────────────────────────────────────────────────────────────────

interface UseSalesAnalyticsOptions {
  activeMonths: number[];
  /** Habilitar query pesada de SKUs (lazy). */
  enableSkus?: boolean;
  /** Habilitar query pesada de Comportamiento (lazy). */
  enableBehavior?: boolean;
  /** Override de tienda para filtrar Top SKUs (selección desde StoresTable). */
  selectedStoreOverride?: string | null;
}

export function useSalesAnalytics({
  activeMonths,
  enableSkus = false,
  enableBehavior = false,
  selectedStoreOverride,
}: UseSalesAnalyticsOptions): SalesAnalyticsData {
  const { filters } = useFilters();
  const enabled = activeMonths.length > 0;

  // Filtros con override de tienda (para SKUs, channelMix, comportamiento)
  const storeFilters = useMemo(
    () => selectedStoreOverride
      ? { ...filters, store: selectedStoreOverride }
      : filters,
    [filters, selectedStoreOverride],
  );

  // ── Datos cacheados WIDE (compartidos con useSalesDashboard, 0 cost) ────
  const [salesCYQ, salesPYQ] = useQueries({
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

  // ── Queries LAZY (solo se disparan cuando su card está visible) ─────────
  const skusQ = useQuery({
    queryKey: [...salesKeys.topSkus(storeFilters), activeMonths] as const,
    queryFn: () => fetchTopSkus(storeFilters, activeMonths),
    enabled: enabled && enableSkus,
    staleTime: STALE_30MIN,
    gcTime: GC_60MIN,
  });

  const dailyQ = useQuery({
    queryKey: [
      "sales", "daily",
      storeFilters.brand, storeFilters.channel, storeFilters.store, storeFilters.year,
      "salesPage", activeMonths,
    ] as const,
    queryFn: () => fetchDailyDetail(storeFilters, activeMonths),
    enabled: enabled && enableBehavior,
    staleTime: STALE_30MIN,
    gcTime: GC_60MIN,
    retry: 1,
  });

  // ── Wide data para store breakdown (shared cache) ──────────────────────
  const [ticketsQ, storesQ] = useQueries({
    queries: [
      {
        queryKey: ["tickets", "annual", filters.year] as const,
        queryFn: () => fetchAnnualTickets(filters.year),
        staleTime: STALE_30MIN,
        gcTime: GC_60MIN,
        retry: 1,
      },
      {
        queryKey: storeKeys.list(),
        queryFn: () => fetchStores(),
        staleTime: STALE_30MIN,
        gcTime: GC_60MIN,
      },
    ],
  });

  // ── Derivación LOCAL de brandBreakdown (0 queries) ─────────────────────
  const brandBreakdown = useMemo(
    () => deriveBrandBreakdown(
      salesCYQ.data ?? [], salesPYQ.data ?? [],
      activeMonths, filters.channel, filters.store ?? "",
    ).filter((b) => b.brand !== "Otras"),
    [salesCYQ.data, salesPYQ.data, activeMonths, filters.channel, filters.store],
  );

  // ── Derivación LOCAL de channelMix (0 queries) ─────────────────────────
  const channelMix = useMemo(
    () => deriveChannelMix(
      salesCYQ.data ?? [], activeMonths, storeFilters.brand, storeFilters.store ?? "",
    ),
    [salesCYQ.data, activeMonths, storeFilters.brand, storeFilters.store],
  );

  // ── Compute day-of-week from daily detail ───────────────────────────────
  const dayOfWeek = useMemo(
    () => buildDayOfWeek(dailyQ.data ?? []),
    [dailyQ.data],
  );

  // ── Compute store breakdown from wide cached data ──────────────────────
  const storeMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of storesQ.data ?? []) map.set(s.cosupc, s.cosujd);
    return map;
  }, [storesQ.data]);

  const filteredTickets = useMemo(
    () => filterTicketsByChannel(
      (ticketsQ.data ?? []).filter((t) => activeMonths.includes(t.month)),
      storeMap,
      filters.channel,
      filters.store,
    ),
    [ticketsQ.data, activeMonths, storeMap, filters.channel, filters.store],
  );

  const storeBreakdown = useMemo(
    () => buildStoreBreakdown(
      salesCYQ.data ?? [],
      salesPYQ.data ?? [],
      activeMonths,
      filters.brand,
      filters.channel,
      filteredTickets,
      storeMap,
    ),
    [salesCYQ.data, salesPYQ.data, activeMonths, filters.brand, filters.channel, filteredTickets, storeMap],
  );

  // Breakdowns separados por canal (para vista "total")
  const storeBreakdownB2C = useMemo(
    () => filters.channel === "total"
      ? buildStoreBreakdown(salesCYQ.data ?? [], salesPYQ.data ?? [], activeMonths, filters.brand, "b2c", filteredTickets, storeMap)
      : [],
    [salesCYQ.data, salesPYQ.data, activeMonths, filters.brand, filters.channel, filteredTickets, storeMap],
  );

  const storeBreakdownB2B = useMemo(
    () => filters.channel === "total"
      ? buildStoreBreakdown(salesCYQ.data ?? [], salesPYQ.data ?? [], activeMonths, filters.brand, "b2b", filteredTickets, storeMap)
      : [],
    [salesCYQ.data, salesPYQ.data, activeMonths, filters.brand, filters.channel, filteredTickets, storeMap],
  );

  // ── Loading states ─────────────────────────────────────────────────────
  const isLoading = salesCYQ.isLoading || salesPYQ.isLoading;
  const isDowLoading = enableBehavior && dailyQ.isLoading;
  const isSkusLoading = enableSkus && skusQ.isLoading;
  const isStoresLoading = ticketsQ.isLoading || storesQ.isLoading;
  const error = salesCYQ.error?.message ?? salesPYQ.error?.message
    ?? skusQ.error?.message ?? dailyQ.error?.message ?? null;

  return {
    brandBreakdown,
    channelMix,
    topSkus: skusQ.data ?? [],
    dayOfWeek,
    storeBreakdown,
    storeBreakdownB2C,
    storeBreakdownB2B,
    salesWideRaw: salesCYQ.data ?? [],
    dailyDetailRaw: dailyQ.data ?? [],
    ticketRows: ticketsQ.data ?? [],
    storeMap,
    activeMonths,
    isLoading,
    isDowLoading,
    isSkusLoading,
    isStoresLoading,
    error,
  };
}
