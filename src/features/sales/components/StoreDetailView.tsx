/**
 * features/sales/components/StoreDetailView.tsx
 *
 * Detailed view for a single store — KPI cards, trend charts, brand mix, margin gauge.
 * Private component used by ChannelCard and StoresTable.
 */
import { useMemo } from "react";
import type { ApexOptions } from "apexcharts";
import ResponsiveChart from "@/components/ui/chart/ResponsiveChart";
import type { MonthlySalesRow, DailyDetailRow } from "@/queries/sales.queries";
import type { TicketRow } from "@/queries/tickets.queries";
import type { StoreBreakdownRow } from "../hooks/useSalesAnalytics";
import { calcGrossMargin, classifyMarginHealth, marginHealthThresholds } from "@/domain/kpis/calculations";
import { useMarginConfig } from "@/hooks/useConfig";
import { formatPYGShort, formatPYGSuffix, formatPct, formatChange } from "@/utils/format";
import { useFilters } from "@/context/FilterContext";
import { MONTH_SHORT } from "@/domain/period/helpers";
import { brandIdToCanonical } from "@/api/normalize";
import {
  MARGIN_TEXT,
  MARGIN_BG,
  MARGIN_LABEL,
  MARGIN_DOT,
  BRAND_COLORS,
  BRAND_CHART_COLOR,
  deriveStoreDaily,
} from "./salesAnalytics.constants";

// ─── Store detail helpers ─────────────────────────────────────────────────────

interface StoreMonthlyPoint {
  month: number;
  label: string;
  neto: number;
  cogs: number;
  margin: number;
}

interface StoreBrandSlice {
  brand: string;
  neto: number;
  pct: number;
}

function deriveStoreMonthly(
  raw: MonthlySalesRow[],
  storeCode: string,
  activeMonths: number[],
  channelMode: string,
  brandFilter: string,
): StoreMonthlyPoint[] {
  const canonical = brandFilter !== "total" ? brandIdToCanonical(brandFilter) : null;
  const ch = channelMode !== "total" ? channelMode.toUpperCase() : null;

  const acc = new Map<number, { neto: number; cogs: number }>();
  for (const r of raw) {
    if (r.store !== storeCode) continue;
    if (!activeMonths.includes(r.month)) continue;
    if (canonical && r.brand !== canonical) continue;
    if (ch && r.channel !== ch) continue;
    const entry = acc.get(r.month) ?? { neto: 0, cogs: 0 };
    entry.neto += r.neto;
    entry.cogs += r.cogs;
    acc.set(r.month, entry);
  }

  const sorted = [...activeMonths].sort((a, b) => a - b);
  return sorted.map((m) => {
    const d = acc.get(m) ?? { neto: 0, cogs: 0 };
    return {
      month: m,
      label: MONTH_SHORT[m] ?? `${m}`,
      neto: d.neto,
      cogs: d.cogs,
      margin: d.neto > 0 ? calcGrossMargin(d.neto, d.cogs) : 0,
    };
  });
}

function deriveStoreBrands(
  raw: MonthlySalesRow[],
  storeCode: string,
  activeMonths: number[],
  channelMode: string,
): StoreBrandSlice[] {
  const ch = channelMode !== "total" ? channelMode.toUpperCase() : null;
  const acc = new Map<string, number>();
  let total = 0;

  for (const r of raw) {
    if (r.store !== storeCode) continue;
    if (!activeMonths.includes(r.month)) continue;
    if (ch && r.channel !== ch) continue;
    acc.set(r.brand, (acc.get(r.brand) ?? 0) + r.neto);
    total += r.neto;
  }

  const result: StoreBrandSlice[] = [];
  acc.forEach((neto, brand) => {
    if (brand === "Otras") return;
    result.push({ brand, neto, pct: total > 0 ? (neto / total) * 100 : 0 });
  });

  return result.sort((a, b) => b.neto - a.neto);
}

// ─── Ticket derivation helpers ───────────────────────────────────────────────

/** Resolve cosupc codes that map to a given cosujd store code. */
function resolveCosupcCodes(
  storeCosujd: string,
  storeMap: Map<string, string>,
): Set<string> {
  const target = storeCosujd.trim().toUpperCase();
  const codes = new Set<string>();
  storeMap.forEach((cosujd, cosupc) => {
    if (cosujd.trim().toUpperCase() === target) codes.add(cosupc);
  });
  return codes;
}

/** Tickets aggregated by month for a specific store. */
function deriveStoreTicketsMonthly(
  tickets: TicketRow[],
  cosupcCodes: Set<string>,
  activeMonths: number[],
): Map<number, number> {
  const acc = new Map<number, number>();
  for (const t of tickets) {
    if (!cosupcCodes.has(t.storeCode)) continue;
    if (!activeMonths.includes(t.month)) continue;
    acc.set(t.month, (acc.get(t.month) ?? 0) + t.tickets);
  }
  return acc;
}

/** Tickets aggregated by day for a specific store in a single month. */
function deriveStoreTicketsDaily(
  tickets: TicketRow[],
  cosupcCodes: Set<string>,
  month: number,
): Map<number, number> {
  const acc = new Map<number, number>();
  for (const t of tickets) {
    if (!cosupcCodes.has(t.storeCode)) continue;
    if (t.month !== month) continue;
    acc.set(t.day, (acc.get(t.day) ?? 0) + t.tickets);
  }
  return acc;
}

// ─── Store detail view (redesigned with charts) ──────────────────────────────

export function StoreDetailView({
  store,
  onBack,
  channelLabel,
  salesWideRaw,
  dailyDetailRaw,
  ticketRows,
  ticketStoreMap,
  activeMonths,
  channelMode,
  brand,
}: {
  store: StoreBreakdownRow;
  onBack: () => void;
  channelLabel: string;
  salesWideRaw?: MonthlySalesRow[];
  dailyDetailRaw?: DailyDetailRow[];
  ticketRows?: TicketRow[];
  ticketStoreMap?: Map<string, string>;
  activeMonths?: number[];
  channelMode?: string;
  brand?: string;
}) {
  const { filters: globalFilters } = useFilters();
  const priorYear = globalFilters.year - 1;
  const isSingleMonth = activeMonths?.length === 1;
  const marginConfig = useMarginConfig();

  const monthly = useMemo(
    () => salesWideRaw && activeMonths
      ? deriveStoreMonthly(salesWideRaw, store.storeCode, activeMonths, channelMode ?? "total", brand ?? "total")
      : [],
    [salesWideRaw, activeMonths, store.storeCode, channelMode, brand],
  );

  // Daily data for single-month view
  const daily = useMemo(
    () => isSingleMonth && dailyDetailRaw && activeMonths
      ? deriveStoreDaily(dailyDetailRaw, store.storeCode, activeMonths[0], channelMode ?? "total", brand ?? "total")
      : [],
    [dailyDetailRaw, activeMonths, store.storeCode, channelMode, brand, isSingleMonth],
  );

  const brandSlices = useMemo(
    () => salesWideRaw && activeMonths
      ? deriveStoreBrands(salesWideRaw, store.storeCode, activeMonths, channelMode ?? "total")
      : [],
    [salesWideRaw, activeMonths, store.storeCode, channelMode],
  );

  // ── Ticket data per period (for chart tooltips) ──
  const cosupcCodes = useMemo(
    () => ticketStoreMap ? resolveCosupcCodes(store.storeCode, ticketStoreMap) : new Set<string>(),
    [store.storeCode, ticketStoreMap],
  );

  const monthlyTickets = useMemo(
    () => ticketRows && activeMonths
      ? deriveStoreTicketsMonthly(ticketRows, cosupcCodes, activeMonths)
      : new Map<number, number>(),
    [ticketRows, cosupcCodes, activeMonths],
  );

  const dailyTickets = useMemo(
    () => isSingleMonth && ticketRows && activeMonths
      ? deriveStoreTicketsDaily(ticketRows, cosupcCodes, activeMonths[0])
      : new Map<number, number>(),
    [ticketRows, cosupcCodes, activeMonths, isSingleMonth],
  );

  const hasMultipleMonths = monthly.filter((m) => m.neto > 0).length > 1;
  const hasDailyData = daily.some((d) => d.neto > 0);
  const hasBrands = brandSlices.length > 1;
  const maxBrandNeto = brandSlices.length > 0 ? brandSlices[0].neto : 1;

  // ── Area chart: monthly trend ──
  const trendOptions: ApexOptions = useMemo(() => ({
    chart: {
      type: "area",
      fontFamily: "Outfit, sans-serif",
      toolbar: { show: false },
      sparkline: { enabled: false },
      animations: { enabled: true, dynamicAnimation: { speed: 500 } },
    },
    colors: ["#465FFF"],
    fill: {
      type: "gradient",
      gradient: { shadeIntensity: 1, opacityFrom: 0.35, opacityTo: 0.05, stops: [0, 95, 100] },
    },
    stroke: { curve: "smooth", width: 2.5 },
    dataLabels: { enabled: false },
    xaxis: {
      categories: monthly.map((m) => m.label),
      axisBorder: { show: false },
      axisTicks: { show: false },
      title: { text: "Mes", style: { fontSize: "11px", fontWeight: 500, color: "#98a2b3" } },
      labels: { style: { fontFamily: "Outfit", fontSize: "11px", colors: "#98a2b3", fontWeight: 500 } },
    },
    yaxis: {
      title: { text: "Gs.", style: { fontSize: "11px", fontWeight: 500, color: "#98a2b3" } },
      labels: {
        formatter: (val: number) => formatPYGShort(val),
        style: { fontFamily: "Outfit", fontSize: "10px", colors: ["#98a2b3"] },
      },
    },
    grid: {
      borderColor: "#f2f4f7",
      yaxis: { lines: { show: true } },
      xaxis: { lines: { show: false } },
      padding: { left: 8, right: 8 },
    },
    tooltip: {
      custom: ({ dataPointIndex }: { dataPointIndex: number }) => {
        const point = monthly[dataPointIndex];
        if (!point) return "";
        const tkt = monthlyTickets.get(point.month) ?? 0;
        return `<div style="font-family:Outfit,sans-serif;font-size:12px;padding:8px 12px">
          <div style="font-weight:600;margin-bottom:4px;color:#344054">${point.label}</div>
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:${tkt > 0 ? "3px" : "0"}">
            <span style="width:8px;height:8px;border-radius:50%;background:#465FFF;display:inline-block;flex-shrink:0"></span>
            <span style="color:#475467">Ventas: <b style="color:#101828">${formatPYGSuffix(point.neto)}</b></span>
          </div>
          ${tkt > 0 ? `<div style="display:flex;align-items:center;gap:6px">
            <span style="width:8px;height:8px;border-radius:50%;background:#98a2b3;display:inline-block;flex-shrink:0"></span>
            <span style="color:#475467">Tickets: <b style="color:#101828">${tkt.toLocaleString("es-PY")}</b></span>
          </div>` : ""}
        </div>`;
      },
    },
    markers: {
      size: 4,
      colors: ["#fff"],
      strokeColors: "#465FFF",
      strokeWidth: 2,
      hover: { size: 6 },
    },
    responsive: [{
      breakpoint: 640,
      options: {
        yaxis: { show: false, labels: { show: false, minWidth: 0, maxWidth: 0 } },
        xaxis: { title: { text: undefined }, labels: { style: { fontSize: "10px" } } },
        markers: { size: 3 },
      },
    }],
  }), [monthly, monthlyTickets]);

  // ── Area chart: daily trend (single-month) ──
  const dailyTrendOptions: ApexOptions = useMemo(() => ({
    chart: {
      type: "area",
      fontFamily: "Outfit, sans-serif",
      toolbar: { show: false },
      sparkline: { enabled: false },
      animations: { enabled: true, dynamicAnimation: { speed: 500 } },
    },
    colors: ["#465FFF"],
    fill: {
      type: "gradient",
      gradient: { shadeIntensity: 1, opacityFrom: 0.35, opacityTo: 0.05, stops: [0, 95, 100] },
    },
    stroke: { curve: "smooth", width: 2.5 },
    dataLabels: { enabled: false },
    xaxis: {
      categories: daily.map((d) => `${d.day}`),
      axisBorder: { show: false },
      axisTicks: { show: false },
      tickAmount: Math.min(daily.length, 10),
      title: { text: "Día", style: { fontSize: "11px", fontWeight: 500, color: "#98a2b3" } },
      labels: {
        style: { fontFamily: "Outfit", fontSize: "10px", colors: "#98a2b3", fontWeight: 500 },
      },
    },
    yaxis: {
      title: { text: "Gs.", style: { fontSize: "11px", fontWeight: 500, color: "#98a2b3" } },
      labels: {
        formatter: (val: number) => formatPYGShort(val),
        style: { fontFamily: "Outfit", fontSize: "10px", colors: ["#98a2b3"] },
      },
    },
    grid: {
      borderColor: "#f2f4f7",
      yaxis: { lines: { show: true } },
      xaxis: { lines: { show: false } },
      padding: { left: 8, right: 8 },
    },
    tooltip: {
      custom: ({ dataPointIndex }: { dataPointIndex: number }) => {
        const point = daily[dataPointIndex];
        if (!point) return "";
        const tkt = dailyTickets.get(point.day) ?? 0;
        return `<div style="font-family:Outfit,sans-serif;font-size:12px;padding:8px 12px">
          <div style="font-weight:600;margin-bottom:4px;color:#344054">Día ${point.day}</div>
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:${tkt > 0 ? "3px" : "0"}">
            <span style="width:8px;height:8px;border-radius:50%;background:#465FFF;display:inline-block;flex-shrink:0"></span>
            <span style="color:#475467">Ventas: <b style="color:#101828">${formatPYGSuffix(point.neto)}</b></span>
          </div>
          ${tkt > 0 ? `<div style="display:flex;align-items:center;gap:6px">
            <span style="width:8px;height:8px;border-radius:50%;background:#98a2b3;display:inline-block;flex-shrink:0"></span>
            <span style="color:#475467">Tickets: <b style="color:#101828">${tkt.toLocaleString("es-PY")}</b></span>
          </div>` : ""}
        </div>`;
      },
    },
    markers: {
      size: 3,
      colors: ["#fff"],
      strokeColors: "#465FFF",
      strokeWidth: 2,
      hover: { size: 5 },
    },
    responsive: [{
      breakpoint: 640,
      options: {
        yaxis: { show: false, labels: { show: false, minWidth: 0, maxWidth: 0 } },
        xaxis: { title: { text: undefined }, labels: { style: { fontSize: "9px" } } },
        markers: { size: 2 },
      },
    }],
  }), [daily, dailyTickets]);

  // ── Margin health indicator (channel-aware thresholds) ──
  const ch = (channelMode === "b2b" ? "b2b" : "b2c") as "b2b" | "b2c";
  const mHealth = classifyMarginHealth(store.grossMargin, ch, marginConfig);
  const marginColor = MARGIN_TEXT[mHealth];
  const marginBg = MARGIN_BG[mHealth];
  const marginLabel = MARGIN_LABEL[mHealth];

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-gray-200 text-gray-400 transition-colors hover:border-gray-300 hover:bg-gray-50 hover:text-gray-600 dark:border-gray-700 dark:hover:border-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
          </button>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">{store.storeCode}</h3>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Canal {channelLabel} · {formatPct(store.revenuePct)} del total
            </p>
          </div>
        </div>

        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${marginBg} ${marginColor}`}>
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-current" />
          {marginLabel}
        </span>
      </div>

      {/* ── KPI cards grid ── */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-6">
        {/* Hero: Venta Neta */}
        <div className="rounded-2xl border border-brand-100 bg-brand-50/50 p-3 sm:p-4 dark:border-brand-500/20 dark:bg-brand-500/5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-400 dark:text-brand-400/70">Venta Neta</p>
          <p className="mt-1.5 text-base sm:text-xl font-bold tabular-nums text-brand-700 dark:text-brand-300">
            {formatPYGShort(store.neto)}
          </p>
        </div>

        {/* YoY ventas */}
        <div className={`rounded-2xl border p-4 ${
          store.yoyPct != null
            ? store.yoyPct >= 0
              ? "border-success-100 bg-success-50/50 dark:border-success-500/20 dark:bg-success-500/5"
              : "border-error-100 bg-error-50/50 dark:border-error-500/20 dark:bg-error-500/5"
            : "border-gray-200 dark:border-gray-700"
        }`}>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">vs {priorYear}</p>
          {store.yoyPct != null ? (
            <p className={`mt-1.5 text-base sm:text-xl font-bold tabular-nums ${
              store.yoyPct >= 0
                ? "text-success-600 dark:text-success-400"
                : "text-error-600 dark:text-error-400"
            }`}>
              {store.yoyPct >= 0 ? "▲" : "▼"} {formatChange(store.yoyPct)}
            </p>
          ) : (
            <p className="mt-1.5 text-base sm:text-xl font-bold tabular-nums text-gray-400 dark:text-gray-500">&mdash;</p>
          )}
        </div>

        <div className="rounded-2xl border border-gray-200 p-3 sm:p-4 dark:border-gray-700">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">Margen Bruto</p>
          <div className="mt-1.5 flex items-end gap-2">
            <p className={`text-base sm:text-xl font-bold tabular-nums ${marginColor}`}>
              {formatPct(store.grossMargin)}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 p-3 sm:p-4 dark:border-gray-700">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">Markdown</p>
          <p className={`mt-1.5 text-base sm:text-xl font-bold tabular-nums ${store.markdownPct > 20 ? "text-error-600 dark:text-error-400" : "text-gray-900 dark:text-white"}`}>
            {formatPct(store.markdownPct)}
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 p-3 sm:p-4 dark:border-gray-700">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">Tickets</p>
          <p className="mt-1.5 text-base sm:text-xl font-bold tabular-nums text-gray-900 dark:text-white">
            {store.tickets > 0 ? store.tickets.toLocaleString("es-PY") : "\u2014"}
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 p-3 sm:p-4 dark:border-gray-700">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">AOV</p>
          <p className="mt-1.5 text-base sm:text-xl font-bold tabular-nums text-gray-900 dark:text-white">
            {store.aov > 0 ? formatPYGShort(store.aov) : "\u2014"}
          </p>
        </div>
      </div>

      {/* ── Charts row ── */}
      <div className={`grid gap-4 ${hasBrands ? "grid-cols-1 lg:grid-cols-[1fr_1fr]" : "grid-cols-1"}`}>

        {/* Monthly trend area chart (multi-month) */}
        {hasMultipleMonths && (
          <div className="rounded-2xl border border-gray-200 p-3 sm:p-5 dark:border-gray-700">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
              Evolución Mensual
            </p>
            <ResponsiveChart
              options={trendOptions}
              series={[{ name: "Ventas", data: monthly.map((m) => Math.round(m.neto)) }]}
              type="area"
              height={180}
            />
            {/* Monthly margin mini-row */}
            <div className="mt-2 flex flex-wrap gap-2">
              {monthly.filter((m) => m.neto > 0).map((m) => {
                const mc = MARGIN_TEXT[classifyMarginHealth(m.margin, ch, marginConfig)];
                return (
                  <div key={m.month} className="flex items-center gap-1 rounded-md bg-gray-50 px-2 py-1 dark:bg-gray-800">
                    <span className="text-[10px] text-gray-400 dark:text-gray-500">{m.label}</span>
                    <span className={`text-[10px] font-semibold tabular-nums ${mc}`}>{formatPct(m.margin, 0)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Daily trend area chart (single-month) */}
        {!hasMultipleMonths && hasDailyData && (
          <div className="rounded-2xl border border-gray-200 p-3 sm:p-5 dark:border-gray-700">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
              Evolución Diaria
            </p>
            <ResponsiveChart
              options={dailyTrendOptions}
              series={[{ name: "Ventas", data: daily.map((d) => Math.round(d.neto)) }]}
              type="area"
              height={180}
            />
          </div>
        )}

        {/* Brand mix — horizontal bars */}
        {hasBrands && (
          <div className="rounded-2xl border border-gray-200 p-3 sm:p-5 dark:border-gray-700">
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
              Mix de Marcas
            </p>
            <div className="space-y-3">
              {brandSlices.map((b) => {
                const colors = BRAND_COLORS[b.brand] ?? BRAND_COLORS.Otras;
                const chartColor = BRAND_CHART_COLOR[b.brand] ?? "#98a2b3";
                const barW = maxBrandNeto > 0 ? (b.neto / maxBrandNeto) * 100 : 0;

                return (
                  <div key={b.brand}>
                    <div className="mb-1.5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-gray-900 dark:text-white">{b.brand}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold tabular-nums text-gray-900 dark:text-white">{formatPYGShort(b.neto)}</span>
                        <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${colors.bg} ${colors.text}`}>
                          {formatPct(b.pct, 0)}
                        </span>
                      </div>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                      <div
                        className="h-full rounded-full transition-all duration-700 ease-out"
                        style={{ width: `${barW}%`, backgroundColor: chartColor }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Margin gauge visual (channel-aware thresholds) ── */}
      {(() => {
        const th = marginHealthThresholds(ch, marginConfig);
        // Gauge scale: show 20% before red threshold to 10% after green threshold
        const scaleMin = Math.max(0, th.red - 20);
        const scaleMax = Math.min(100, th.yellow + 15);
        const scaleRange = scaleMax - scaleMin;
        const redW = ((th.red - scaleMin) / scaleRange) * 100;
        const yellowW = ((th.yellow - th.red) / scaleRange) * 100;
        const greenW = 100 - redW - yellowW;
        const pointerPct = scaleRange > 0
          ? Math.max(0, Math.min(100, ((store.grossMargin - scaleMin) / scaleRange) * 100))
          : 50;
        return (
          <div className="rounded-2xl border border-gray-200 p-3 sm:p-5 dark:border-gray-700">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
              Salud del Margen
            </p>
            <div className="flex items-center gap-5">
              <div className="flex-1">
                <div className="relative h-3 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                  <div className="absolute inset-y-0 left-0 bg-error-100 dark:bg-error-500/10" style={{ width: `${redW}%` }} />
                  <div className="absolute inset-y-0 bg-warning-100 dark:bg-warning-500/10" style={{ left: `${redW}%`, width: `${yellowW}%` }} />
                  <div className="absolute inset-y-0 bg-success-100 dark:bg-success-500/10" style={{ left: `${redW + yellowW}%`, width: `${greenW}%` }} />
                  <div
                    className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
                    style={{ left: `${pointerPct}%` }}
                  >
                    <div className={`h-5 w-5 rounded-full border-[3px] border-white shadow-md dark:border-gray-800 ${MARGIN_DOT[mHealth]}`} />
                  </div>
                </div>
                <div className="mt-1.5 flex justify-between text-[10px] text-gray-400 dark:text-gray-500">
                  <span>{scaleMin}%</span>
                  <span>{th.red}%</span>
                  <span>{th.yellow}%</span>
                  <span>{scaleMax}%</span>
                </div>
              </div>
              <div className="text-right">
                <p className={`text-2xl font-bold tabular-nums ${marginColor}`}>
                  {formatPct(store.grossMargin)}
                </p>
                <p className="text-[10px] text-gray-400 dark:text-gray-500">
                  Mkd: {formatPct(store.markdownPct)}
                </p>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
