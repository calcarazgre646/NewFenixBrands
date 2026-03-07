/**
 * features/sales/hooks/useSalesAnalytics.ts
 *
 * Hook de datos para los tabs analiticos de la pagina de ventas.
 *
 * Fuentes:
 *   - fetchBrandBreakdown, fetchChannelMix, fetchTopSkus (server-filtered)
 *   - fetchDailyDetail (server-filtered, for day-of-week behavior)
 *   - fetchMonthlySalesWide + fetchAnnualTickets (cached wide, for store breakdown)
 *
 * El periodo viene de useSalesDashboard (activeMonths).
 */
import { useMemo } from "react";
import { useQuery, useQueries } from "@tanstack/react-query";
import { useFilters } from "@/context/FilterContext";
import {
  fetchBrandBreakdown,
  fetchChannelMix,
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
import { fetchStores } from "@/queries/stores.queries";
import { salesKeys, storeKeys } from "@/queries/keys";
import { brandIdToCanonical } from "@/api/normalize";
import {
  calcGrossMargin,
  calcMarkdownDependency,
} from "@/domain/kpis/calculations";

const STALE_30MIN = 30 * 60 * 1000;
const GC_60MIN    = 60 * 60 * 1000;

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
}

export interface SalesAnalyticsData {
  brandBreakdown: BrandBreakdownRow[];
  channelMix: ChannelMixRow[];
  topSkus: TopSkuRow[];
  dayOfWeek: DayOfWeekStat[];
  storeBreakdown: StoreBreakdownRow[];
  isLoading: boolean;
  isDowLoading: boolean;
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
  activeMonths: number[],
  brand: string,
  channel: string,
  ticketRows: Array<{ storeCode: string; tickets: number; totalSales: number }>,
  storeMap: Map<string, string>,
): StoreBreakdownRow[] {
  const canonical = brand !== "total" ? brandIdToCanonical(brand) : null;
  const ch = channel !== "total" ? channel.toUpperCase() : null;

  // Aggregate sales by store (cosujd)
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

  // Aggregate tickets by store (cosupc → cosujd via storeMap)
  const ticketsByStore = new Map<string, { tickets: number; sales: number }>();
  for (const t of ticketRows) {
    if (!activeMonths.includes((t as any).month)) continue;
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
    rows.push({
      storeCode:   store,
      neto:        v.neto,
      cogs:        v.cogs,
      grossMargin: calcGrossMargin(v.neto, v.cogs),
      markdownPct: calcMarkdownDependency(v.dcto, v.bruto),
      tickets:     tkt?.tickets ?? 0,
      aov:         tkt && tkt.tickets > 0 ? tkt.sales / tkt.tickets : 0,
      revenuePct:  totalNeto > 0 ? (v.neto / totalNeto) * 100 : 0,
    });
  });

  return rows.sort((a, b) => b.neto - a.neto);
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useSalesAnalytics(activeMonths: number[]): SalesAnalyticsData {
  const { filters } = useFilters();
  const enabled = activeMonths.length > 0;

  // ── Server-filtered queries ──────────────────────────────────────────────
  const brandsQ = useQuery({
    queryKey: [...salesKeys.brandBreakdown(filters), activeMonths] as const,
    queryFn: () => fetchBrandBreakdown(filters, activeMonths),
    enabled,
    staleTime: STALE_30MIN,
    gcTime: GC_60MIN,
  });

  const channelQ = useQuery({
    queryKey: [...salesKeys.channelMix(filters), activeMonths] as const,
    queryFn: () => fetchChannelMix(filters, activeMonths),
    enabled,
    staleTime: STALE_30MIN,
    gcTime: GC_60MIN,
  });

  const skusQ = useQuery({
    queryKey: [...salesKeys.topSkus(filters), activeMonths] as const,
    queryFn: () => fetchTopSkus(filters, activeMonths),
    enabled,
    staleTime: STALE_30MIN,
    gcTime: GC_60MIN,
  });

  // ── Daily detail for day-of-week behavior ──────────────────────────────
  const dailyQ = useQuery({
    queryKey: [
      "sales", "daily",
      filters.brand, filters.channel, filters.store, filters.year,
      "salesPage", activeMonths,
    ] as const,
    queryFn: () => fetchDailyDetail(filters, activeMonths),
    enabled,
    staleTime: STALE_30MIN,
    gcTime: GC_60MIN,
    retry: 1,
  });

  // ── Wide data for store breakdown (shared cache) ──────────────────────
  const [salesWideQ, ticketsQ, storesQ] = useQueries({
    queries: [
      {
        queryKey: salesKeys.monthlyWide(filters.year),
        queryFn: () => fetchMonthlySalesWide(filters.year),
        staleTime: STALE_30MIN,
        gcTime: GC_60MIN,
      },
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
      salesWideQ.data ?? [],
      activeMonths,
      filters.brand,
      filters.channel,
      filteredTickets,
      storeMap,
    ),
    [salesWideQ.data, activeMonths, filters.brand, filters.channel, filteredTickets, storeMap],
  );

  // ── Loading states ─────────────────────────────────────────────────────
  const isLoading = brandsQ.isLoading || channelQ.isLoading || skusQ.isLoading;
  const isDowLoading = dailyQ.isLoading;
  const isStoresLoading = salesWideQ.isLoading || ticketsQ.isLoading || storesQ.isLoading;
  const error = brandsQ.error?.message ?? channelQ.error?.message
    ?? skusQ.error?.message ?? null;

  return {
    brandBreakdown: brandsQ.data ?? [],
    channelMix: channelQ.data ?? [],
    topSkus: skusQ.data ?? [],
    dayOfWeek,
    storeBreakdown,
    isLoading,
    isDowLoading,
    isStoresLoading,
    error,
  };
}
