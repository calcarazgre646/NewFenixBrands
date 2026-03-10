/**
 * features/sales/components/SalesAnalyticsPanel.tsx
 *
 * Cards independientes de analytics: Marcas, Canal/Tiendas, Comportamiento, Top SKUs.
 * Diseño consistente con ExecutivePage (design tokens, tipografía, spacing).
 *
 * REGLA: Sin lógica de negocio. Solo layout.
 */
import { useState, useMemo } from "react";
import Chart from "react-apexcharts";
import type { ApexOptions } from "apexcharts";
import type { BrandBreakdownRow, ChannelMixRow, TopSkuRow, MonthlySalesRow, DailyDetailRow } from "@/queries/sales.queries";
import type { DayOfWeekStat, StoreBreakdownRow } from "../hooks/useSalesAnalytics";
import { calcGrossMargin, calcMarkdownDependency, classifyMarginHealth, marginHealthThresholds } from "@/domain/kpis/calculations";
import type { MarginHealth } from "@/domain/kpis/calculations";
import { formatPYGShort, formatPYGSuffix, formatPct, formatChange } from "@/utils/format";
import { MONTH_SHORT } from "@/domain/period/helpers";
import { brandIdToCanonical } from "@/api/normalize";
import { Card } from "@/components/ui/card/Card";

// ─── Margin health colors (DRY) ───────────────────────────────────────────────

const MARGIN_TEXT: Record<MarginHealth, string> = {
  healthy: "text-success-600 dark:text-success-400",
  moderate: "text-warning-600 dark:text-warning-400",
  low: "text-error-600 dark:text-error-400",
};
const MARGIN_BG: Record<MarginHealth, string> = {
  healthy: "bg-success-50 dark:bg-success-500/10",
  moderate: "bg-warning-50 dark:bg-warning-500/10",
  low: "bg-error-50 dark:bg-error-500/10",
};
const MARGIN_LABEL: Record<MarginHealth, string> = {
  healthy: "Saludable",
  moderate: "Moderado",
  low: "Bajo",
};
const MARGIN_DOT: Record<MarginHealth, string> = {
  healthy: "bg-success-500",
  moderate: "bg-warning-500",
  low: "bg-error-500",
};

// ─── Brand config ─────────────────────────────────────────────────────────────


const BRAND_COLORS: Record<string, { bg: string; text: string; bar: string }> = {
  Martel:   { bg: "bg-emerald-50 dark:bg-emerald-500/10", text: "text-emerald-700 dark:text-emerald-400", bar: "bg-gradient-to-r from-emerald-400 to-emerald-500" },
  Wrangler: { bg: "bg-amber-50 dark:bg-amber-500/10",     text: "text-amber-700 dark:text-amber-400",     bar: "bg-gradient-to-r from-amber-400 to-amber-500" },
  Lee:      { bg: "bg-red-50 dark:bg-red-500/10",         text: "text-red-700 dark:text-red-400",         bar: "bg-gradient-to-r from-red-400 to-red-500" },
  Otras:    { bg: "bg-gray-50 dark:bg-gray-700/50",       text: "text-gray-600 dark:text-gray-400",       bar: "bg-gradient-to-r from-gray-300 to-gray-400" },
};

/** Brand-specific chart color for radial. */
const BRAND_CHART_COLOR: Record<string, string> = {
  Martel:   "#10B981",
  Wrangler: "#F59E0B",
  Lee:      "#EF4444",
};

/** Radial chart options for brand mix — semicircle, brand-colored. */
function buildBrandRadialOptions(pct: number, brand: string): ApexOptions {
  return {
    chart: {
      type: "radialBar",
      fontFamily: "Outfit, sans-serif",
      sparkline: { enabled: true },
    },
    colors: [BRAND_CHART_COLOR[brand] ?? "#465FFF"],
    plotOptions: {
      radialBar: {
        startAngle: -90,
        endAngle: 90,
        hollow: { size: "70%" },
        track: {
          background: "#F2F4F7",
          strokeWidth: "100%",
        },
        dataLabels: {
          name: { show: false },
          value: {
            fontSize: "18px",
            fontWeight: "700",
            offsetY: -20,
            color: undefined,
            formatter: () => `${pct.toFixed(1)}%`,
          },
        },
      },
    },
    fill: { type: "solid" },
    stroke: { lineCap: "round" },
    labels: ["del total"],
  };
}

function brandColor(brand: string) {
  return BRAND_COLORS[brand] ?? BRAND_COLORS.Otras;
}

// ─── Section header (consistent with StatCard label style) ───────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-4 text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
      {children}
    </p>
  );
}

// ─── Lazy load prompt ────────────────────────────────────────────────────────

function LazyLoadPrompt({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-dashed border-gray-200 bg-gray-50/50 py-10 text-sm font-medium text-gray-400 transition-all duration-200 hover:border-brand-300 hover:bg-brand-50/30 hover:text-brand-500 dark:border-gray-700 dark:bg-gray-800/30 dark:text-gray-500 dark:hover:border-brand-500/30 dark:hover:bg-brand-500/5 dark:hover:text-brand-400"
    >
      {icon}
      {label}
    </button>
  );
}

// ─── Skeleton bars ───────────────────────────────────────────────────────────

function SkeletonBars() {
  return (
    <div className="flex h-36 items-end gap-2">
      {[60, 90, 75, 100, 85, 50, 40].map((h, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-1">
          <div className="w-full animate-pulse rounded-t bg-gray-100 dark:bg-gray-700" style={{ height: `${h}px` }} />
          <div className="h-3 w-5 animate-pulse rounded bg-gray-100 dark:bg-gray-700" />
        </div>
      ))}
    </div>
  );
}


// ─── Mini sparkline (pure SVG, no ApexCharts overhead) ──────────────────────

function MiniSparkline({ data, color = "#465FFF" }: { data: number[]; color?: string }) {
  if (data.length < 2 || data.every((v) => v === 0)) return null;

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 100;
  const h = 32;
  const pad = 4;

  const pts = data.map((v, i) => ({
    x: pad + (i / (data.length - 1)) * (w - pad * 2),
    y: pad + (1 - (v - min) / range) * (h - pad * 2),
  }));

  // Smooth cubic bezier through points (Catmull-Rom → cubic)
  const tension = 0.3;
  let curvePath = `M${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(i - 1, 0)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(i + 2, pts.length - 1)];

    const cp1x = p1.x + (p2.x - p0.x) * tension;
    const cp1y = p1.y + (p2.y - p0.y) * tension;
    const cp2x = p2.x - (p3.x - p1.x) * tension;
    const cp2y = p2.y - (p3.y - p1.y) * tension;

    curvePath += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
  }

  const lastX = pts[pts.length - 1].x;
  const firstX = pts[0].x;
  const areaPath = `${curvePath} L${lastX},${h} L${firstX},${h} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-10 w-24 shrink-0" preserveAspectRatio="none">
      <path d={areaPath} fill={color} opacity={0.08} />
      <path d={curvePath} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Build a Map<storeCode, number[]> with monthly neto for sparklines. */
function buildStoreSparklines(
  raw: MonthlySalesRow[],
  activeMonths: number[],
  channelFilter: string,
  brandFilter: string,
): Map<string, number[]> {
  const canonical = brandFilter !== "total" ? brandIdToCanonical(brandFilter) : null;
  const ch = channelFilter !== "total" ? channelFilter.toUpperCase() : null;
  const sorted = [...activeMonths].sort((a, b) => a - b);

  const acc = new Map<string, Map<number, number>>();
  for (const r of raw) {
    if (!sorted.includes(r.month)) continue;
    if (canonical && r.brand !== canonical) continue;
    if (ch && r.channel !== ch) continue;
    let storeMap = acc.get(r.store);
    if (!storeMap) { storeMap = new Map(); acc.set(r.store, storeMap); }
    storeMap.set(r.month, (storeMap.get(r.month) ?? 0) + r.neto);
  }

  const result = new Map<string, number[]>();
  acc.forEach((monthMap, store) => {
    result.set(store, sorted.map((m) => monthMap.get(m) ?? 0));
  });
  return result;
}

/** Build daily sparklines for a single month from DailyDetailRow[]. */
function buildStoreDailySparklines(
  rows: DailyDetailRow[],
  month: number,
  channelFilter: string,
  brandFilter: string,
): Map<string, number[]> {
  const canonical = brandFilter !== "total" ? brandIdToCanonical(brandFilter) : null;
  const ch = channelFilter !== "total" ? channelFilter.toUpperCase() : null;

  const acc = new Map<string, Map<number, number>>();
  let maxDay = 0;
  for (const r of rows) {
    if (r.month !== month) continue;
    if (r.neto <= 0) continue;
    if (canonical && r.brand !== canonical) continue;
    if (ch && r.channel !== ch) continue;
    let dayMap = acc.get(r.store);
    if (!dayMap) { dayMap = new Map(); acc.set(r.store, dayMap); }
    dayMap.set(r.day, (dayMap.get(r.day) ?? 0) + r.neto);
    if (r.day > maxDay) maxDay = r.day;
  }

  const days = Array.from({ length: maxDay }, (_, i) => i + 1);
  const result = new Map<string, number[]>();
  acc.forEach((dayMap, store) => {
    result.set(store, days.map((d) => dayMap.get(d) ?? 0));
  });
  return result;
}

/** Derive daily points for store detail chart in single-month view. */
function deriveStoreDaily(
  rows: DailyDetailRow[],
  storeCode: string,
  month: number,
  channelMode: string,
  brandFilter: string,
): { day: number; neto: number; cogs: number; margin: number }[] {
  const canonical = brandFilter !== "total" ? brandIdToCanonical(brandFilter) : null;
  const ch = channelMode !== "total" ? channelMode.toUpperCase() : null;

  const acc = new Map<number, { neto: number; cogs: number }>();
  for (const r of rows) {
    if (r.store !== storeCode) continue;
    if (r.month !== month) continue;
    if (canonical && r.brand !== canonical) continue;
    if (ch && r.channel !== ch) continue;
    const entry = acc.get(r.day) ?? { neto: 0, cogs: 0 };
    entry.neto += r.neto;
    entry.cogs += r.cogs;
    acc.set(r.day, entry);
  }

  const maxDay = acc.size > 0 ? Math.max(...acc.keys()) : 0;
  const result: { day: number; neto: number; cogs: number; margin: number }[] = [];
  for (let d = 1; d <= maxDay; d++) {
    const v = acc.get(d) ?? { neto: 0, cogs: 0 };
    result.push({
      day: d,
      neto: v.neto,
      cogs: v.cogs,
      margin: v.neto > 0 ? calcGrossMargin(v.neto, v.cogs) : 0,
    });
  }
  return result;
}

// ─── Brands Card ─────────────────────────────────────────────────────────────

export function BrandsCard({ data, year }: { data: BrandBreakdownRow[]; year: number }) {
  const totalNeto = data.reduce((s, b) => s + b.neto, 0);

  const visible = data.filter((b) => b.brand !== "Otras");
  if (visible.length === 0) return null;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {visible.map((b) => {
          const mix = totalNeto > 0 ? (b.neto / totalNeto) * 100 : 0;
          const margin = calcGrossMargin(b.neto, b.cogs);
          const markdown = calcMarkdownDependency(b.dcto, b.bruto);
          const yoy = b.yoyPct;

          return (
            <div
              key={b.brand}
              className="rounded-2xl border border-gray-200 bg-white p-5 transition-shadow duration-200 hover:shadow-theme-sm dark:border-gray-700 dark:bg-gray-800"
            >
              {/* Header: name */}
              <div className="flex items-center gap-3">
                <p className="text-sm font-bold text-gray-900 dark:text-white">{b.brand}</p>
              </div>

              {/* Radial chart — mix % */}
              <div className="relative mt-2 h-[100px] overflow-hidden">
                <Chart
                  options={buildBrandRadialOptions(mix, b.brand)}
                  series={[Math.min(Math.round(mix * 10) / 10, 100)]}
                  type="radialBar"
                  height={180}
                />
                <p className="absolute inset-x-0 bottom-2 text-center text-[10px] font-medium text-gray-400 dark:text-gray-500">de las ventas totales</p>
              </div>

              {/* Revenue — cifra completa */}
              <p className="mt-3 text-center text-lg font-bold tabular-nums text-gray-900 dark:text-white">
                {formatPYGSuffix(b.neto)}
              </p>

              {/* YoY badge */}
              {yoy != null && (
                <div className="mt-2 flex justify-center">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                      yoy >= 0
                        ? "bg-success-50 text-success-600 dark:bg-success-500/10 dark:text-success-400"
                        : "bg-error-50 text-error-600 dark:bg-error-500/10 dark:text-error-400"
                    }`}
                  >
                    {yoy >= 0 ? (
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
                      </svg>
                    ) : (
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 4.5l15 15m0 0V8.25m0 11.25H8.25" />
                      </svg>
                    )}
                    {formatChange(yoy)} vs {year - 1}
                  </span>
                </div>
              )}

              {/* Margen + Markdown — clean row */}
              <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3 text-xs dark:border-gray-700">
                <div className="text-center">
                  <p className="text-[10px] text-gray-400 dark:text-gray-500">Margen</p>
                  <p className={`mt-0.5 font-bold tabular-nums ${
                    margin >= 30
                      ? "text-success-600 dark:text-success-400"
                      : margin >= 20
                        ? "text-warning-600 dark:text-warning-400"
                        : "text-error-600 dark:text-error-400"
                  }`}>
                    {formatPct(margin)}
                  </p>
                </div>
                <div className="h-6 w-px bg-gray-100 dark:bg-gray-700" />
                <div className="text-center">
                  <p className="text-[10px] text-gray-400 dark:text-gray-500">Markdown</p>
                  <p className={`mt-0.5 font-bold tabular-nums ${
                    markdown > 20
                      ? "text-error-600 dark:text-error-400"
                      : "text-gray-700 dark:text-gray-300"
                  }`}>
                    {formatPct(markdown)}
                  </p>
                </div>
              </div>
            </div>
          );
      })}
    </div>
  );
}

// ─── Channel Card ────────────────────────────────────────────────────────────

export function ChannelCard({
  channelMix,
  storeBreakdown,
  channelMode,
  salesWideRaw,
  activeMonths,
  brand,
}: {
  channelMix: ChannelMixRow[];
  storeBreakdown: StoreBreakdownRow[];
  channelMode: string;
  isStoresLoading: boolean;
  salesWideRaw?: MonthlySalesRow[];
  activeMonths?: number[];
  brand?: string;
}) {
  const [selectedStore, setSelectedStore] = useState<string | null>(null);
  const sorted = [...channelMix].sort((a, b) => b.neto - a.neto);

  // Store detail view
  const storeDetail = selectedStore
    ? storeBreakdown.find((s) => s.storeCode === selectedStore)
    : null;

  if (storeDetail) {
    return (
      <Card padding="lg">
        <StoreDetailView
          store={storeDetail}
          onBack={() => setSelectedStore(null)}
          channelLabel={channelMode === "b2b" ? "B2B" : "B2C"}
          salesWideRaw={salesWideRaw}
          activeMonths={activeMonths}
          channelMode={channelMode}
          brand={brand}
        />
      </Card>
    );
  }

  // Horizontal bar chart options for channel comparison
  const barOptions: ApexOptions = useMemo(() => ({
    chart: {
      type: "bar",
      fontFamily: "Outfit, sans-serif",
      background: "transparent",
      toolbar: { show: false },
      animations: { enabled: true, dynamicAnimation: { speed: 600 } },
    },
    plotOptions: {
      bar: {
        horizontal: true,
        barHeight: "60%",
        borderRadius: 6,
        borderRadiusApplication: "end",
        distributed: true,
      },
    },
    colors: ["#465FFF", "#93AAFD"],
    dataLabels: {
      enabled: true,
      style: { fontSize: "13px", fontWeight: "700", fontFamily: "Outfit, sans-serif" },
      formatter: (_: number, opts: { dataPointIndex: number }) =>
        `${sorted[opts.dataPointIndex]?.pct.toFixed(1) ?? 0}%`,
      offsetX: 4,
    },
    xaxis: {
      categories: sorted.map((c) => c.channel),
      labels: { show: false },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      labels: {
        style: { fontSize: "13px", fontWeight: 700, colors: "#667085", fontFamily: "Outfit, sans-serif" },
      },
    },
    grid: { show: false },
    legend: { show: false },
    tooltip: {
      enabled: true,
      y: { formatter: (val: number) => formatPYGShort(val) },
    },
  }), [sorted]);

  // When channel is total → bar chart + metrics
  if (channelMode === "total") {
    if (channelMix.length === 0) {
      return (
        <Card padding="lg">
          <SectionLabel>Mix de Canal</SectionLabel>
          <p className="py-6 text-center text-sm text-gray-400 dark:text-gray-500">Sin datos de canal</p>
        </Card>
      );
    }

    return (
      <Card padding="lg" className="flex h-full flex-col">
        <SectionLabel>Mix de Canal</SectionLabel>

        {/* Bar chart */}
        <div className="mt-2">
          <Chart
            options={barOptions}
            series={[{ name: "Ventas", data: sorted.map((c) => c.neto) }]}
            type="bar"
            height={120}
          />
        </div>

        {/* Metrics row */}
        <div className="mt-auto grid grid-cols-2 gap-3 border-t border-gray-100 pt-4 dark:border-gray-700">
          {sorted.map((c, i) => (
            <div key={c.channel} className="text-center">
              <div className="flex items-center justify-center gap-1.5">
                <span className={`inline-block h-2 w-2 rounded-full ${i === 0 ? "bg-brand-500" : "bg-brand-300"}`} />
                <span className="text-[11px] font-medium text-gray-400 dark:text-gray-500">{c.channel}</span>
              </div>
              <p className="mt-1 text-sm font-bold tabular-nums text-gray-900 dark:text-white">
                {formatPYGShort(c.neto)}
              </p>
            </div>
          ))}
        </div>
      </Card>
    );
  }

  // When channel is B2B or B2C → StoresTable already shown above, hide ChannelCard
  return null;
}

// ─── Stores Table (standalone, always visible) ──────────────────────────────

export function StoresTable({
  storeBreakdown,
  storeBreakdownB2B,
  isStoresLoading,
  channelMode,
  onSelectStore,
  salesWideRaw,
  dailyDetailRaw,
  activeMonths,
  brand,
}: {
  storeBreakdown: StoreBreakdownRow[];
  storeBreakdownB2B?: StoreBreakdownRow[];
  isStoresLoading: boolean;
  channelMode: string;
  onSelectStore?: (storeCode: string) => void;
  salesWideRaw?: MonthlySalesRow[];
  dailyDetailRaw?: DailyDetailRow[];
  activeMonths?: number[];
  brand?: string;
}) {
  const [selectedStore, setSelectedStore] = useState<string | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);

  const isSingleMonth = activeMonths?.length === 1;

  // All hooks MUST be before any early return
  // Multi-month: sparklines from monthly data; single-month: sparklines from daily data
  const sparklines = useMemo(
    () => {
      if (!activeMonths || activeMonths.length === 0) return new Map<string, number[]>();
      if (isSingleMonth && dailyDetailRaw && dailyDetailRaw.length > 0) {
        return buildStoreDailySparklines(dailyDetailRaw, activeMonths[0], channelMode, brand ?? "total");
      }
      if (salesWideRaw && activeMonths.length > 1) {
        return buildStoreSparklines(salesWideRaw, activeMonths, channelMode, brand ?? "total");
      }
      return new Map<string, number[]>();
    },
    [salesWideRaw, dailyDetailRaw, activeMonths, channelMode, brand, isSingleMonth],
  );

  const hasB2B = !!(storeBreakdownB2B && storeBreakdownB2B.length > 0);

  const sparklinesB2B = useMemo(
    () => {
      if (!activeMonths || activeMonths.length === 0 || !hasB2B) return new Map<string, number[]>();
      if (isSingleMonth && dailyDetailRaw && dailyDetailRaw.length > 0) {
        return buildStoreDailySparklines(dailyDetailRaw, activeMonths[0], "b2b", brand ?? "total");
      }
      if (salesWideRaw && activeMonths.length > 1) {
        return buildStoreSparklines(salesWideRaw, activeMonths, "b2b", brand ?? "total");
      }
      return new Map<string, number[]>();
    },
    [salesWideRaw, dailyDetailRaw, activeMonths, brand, hasB2B, isSingleMonth],
  );

  const handleSelect = (code: string, ch?: string) => {
    if (onSelectStore) onSelectStore(code);
    else {
      setSelectedStore(code);
      setSelectedChannel(ch ?? channelMode);
    }
  };

  // Find detail in B2C or B2B
  const allStores = [...storeBreakdown, ...(storeBreakdownB2B ?? [])];
  const storeDetail = selectedStore
    ? allStores.find((s) => s.storeCode === selectedStore)
    : null;

  if (storeDetail) {
    return (
      <Card padding="lg">
        <StoreDetailView
          store={storeDetail}
          onBack={() => { setSelectedStore(null); setSelectedChannel(null); }}
          channelLabel={selectedChannel === "b2b" ? "B2B" : selectedChannel === "b2c" ? "B2C" : "Total"}
          salesWideRaw={salesWideRaw}
          dailyDetailRaw={dailyDetailRaw}
          activeMonths={activeMonths}
          channelMode={selectedChannel ?? channelMode}
          brand={brand}
        />
      </Card>
    );
  }

  // ── Skeleton ──
  if (isStoresLoading) {
    return (
      <Card padding="lg">
        <SectionLabel>Puntos de Venta</SectionLabel>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="animate-pulse rounded-xl border border-gray-100 p-4 dark:border-gray-700/50">
              <div className="h-4 w-20 rounded bg-gray-100 dark:bg-gray-700" />
              <div className="mt-3 h-5 w-24 rounded bg-gray-100 dark:bg-gray-700" />
              <div className="mt-2 h-1.5 w-full rounded-full bg-gray-100 dark:bg-gray-700" />
              <div className="mt-3 flex gap-3">
                <div className="h-3 w-14 rounded bg-gray-100 dark:bg-gray-700" />
                <div className="h-3 w-14 rounded bg-gray-100 dark:bg-gray-700" />
              </div>
            </div>
          ))}
        </div>
      </Card>
    );
  }

  const hasB2C = storeBreakdown.length > 0;

  if (!hasB2C && !hasB2B) {
    return (
      <Card padding="lg">
        <SectionLabel>Puntos de Venta</SectionLabel>
        <p className="py-6 text-center text-sm text-gray-400 dark:text-gray-500">Sin datos.</p>
      </Card>
    );
  }

  const totalNetoB2C = storeBreakdown.reduce((s, r) => s + r.neto, 0);
  const totalNetoB2B = hasB2B ? storeBreakdownB2B.reduce((s, r) => s + r.neto, 0) : 0;

  return (
    <Card padding="lg">
      <div className="space-y-6">

        {/* ── Zonas Mayoristas (B2B) — same card design, grid of 2 ── */}
        {hasB2B && (
          <div>
            <div className="mb-3 flex items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                B2B
              </span>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                Zonas Mayoristas
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {storeBreakdownB2B.map((row) => {
                const share = totalNetoB2B > 0 ? (row.neto / totalNetoB2B) * 100 : 0;
                const mh = classifyMarginHealth(row.grossMargin, "b2b");
                const marginColor = MARGIN_TEXT[mh];
                const marginBg = MARGIN_BG[mh];

                return (
                  <div
                    key={row.storeCode}
                    className="group relative cursor-pointer rounded-2xl border border-gray-200 bg-white p-4 transition-all duration-200 hover:border-gray-300 hover:shadow-theme-sm dark:border-gray-700 dark:bg-gray-800 dark:hover:border-gray-600"
                    onClick={() => handleSelect(row.storeCode, "b2b")}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-gray-900 dark:text-white">{row.storeCode}</p>
                      <MiniSparkline data={sparklinesB2B.get(row.storeCode) ?? []} />
                    </div>
                    <p className="mt-2 truncate text-lg font-bold tabular-nums text-gray-900 dark:text-white" title={formatPYGSuffix(row.neto)}>
                      {formatPYGSuffix(row.neto)}
                    </p>
                    <p className="mt-0.5 text-[10px] tabular-nums text-gray-400 dark:text-gray-500">
                      {formatPct(share)} del canal
                    </p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${marginBg} ${marginColor}`}>
                        M {formatPct(row.grossMargin, 0)}
                      </span>
                      <span className={`inline-flex items-center rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums dark:bg-gray-700 ${row.markdownPct > 20 ? "text-error-600 dark:text-error-400" : "text-gray-600 dark:text-gray-400"}`}>
                        Mkd {formatPct(row.markdownPct, 0)}
                      </span>
                    </div>
                    <div className="absolute right-3 top-3 opacity-0 transition-opacity group-hover:opacity-100">
                      <svg className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
                      </svg>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Divider when both sections exist ── */}
        {hasB2B && hasB2C && (
          <div className="border-t border-gray-100 dark:border-gray-700/50" />
        )}

        {/* ── Tiendas (B2C) ── */}
        {hasB2C && (
          <div>
            {hasB2B && (
              <div className="mb-3 flex items-center gap-2">
                <span className="inline-flex items-center rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
                  B2C
                </span>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                  Tiendas
                </p>
              </div>
            )}
            {!hasB2B && <SectionLabel>Tiendas</SectionLabel>}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {storeBreakdown.map((row) => {
                const share = totalNetoB2C > 0 ? (row.neto / totalNetoB2C) * 100 : 0;
                const mh = classifyMarginHealth(row.grossMargin, "b2c");
                const marginColor = MARGIN_TEXT[mh];
                const marginBg = MARGIN_BG[mh];

                return (
                  <div
                    key={row.storeCode}
                    className="group relative cursor-pointer rounded-2xl border border-gray-200 bg-white p-4 transition-all duration-200 hover:border-gray-300 hover:shadow-theme-sm dark:border-gray-700 dark:bg-gray-800 dark:hover:border-gray-600"
                    onClick={() => handleSelect(row.storeCode, "b2c")}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-gray-900 dark:text-white">{row.storeCode}</p>
                      <MiniSparkline data={sparklines.get(row.storeCode) ?? []} />
                    </div>
                    <p className="mt-2 truncate text-lg font-bold tabular-nums text-gray-900 dark:text-white" title={formatPYGSuffix(row.neto)}>
                      {formatPYGSuffix(row.neto)}
                    </p>
                    <p className="mt-0.5 text-[10px] tabular-nums text-gray-400 dark:text-gray-500">
                      {formatPct(share)} del total
                    </p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${marginBg} ${marginColor}`}>
                        M {formatPct(row.grossMargin, 0)}
                      </span>
                      {row.tickets > 0 && (
                        <span className="inline-flex items-center rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                          {row.tickets.toLocaleString("es-PY")} tkt
                        </span>
                      )}
                      {row.aov > 0 && (
                        <span className="inline-flex items-center rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                          AOV {formatPYGShort(row.aov)}
                        </span>
                      )}
                    </div>
                    <div className="absolute right-3 top-3 opacity-0 transition-opacity group-hover:opacity-100">
                      <svg className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
                      </svg>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

// ─── Behavior Card ───────────────────────────────────────────────────────────

export function BehaviorCard({
  data,
  isLoading,
  onRequestLoad,
}: {
  data: DayOfWeekStat[];
  isLoading: boolean;
  onRequestLoad: () => void;
}) {
  const bestDay = data.find((d) => d.isBest);
  const hasData = data.some((d) => d.totalNeto > 0);

  const chartOptions: ApexOptions = useMemo(() => ({
    colors: data.map((d) => (d.isBest ? "#465FFF" : "#E4E7EC")),
    chart: { fontFamily: "Outfit, sans-serif", type: "bar", toolbar: { show: false }, animations: { enabled: true, dynamicAnimation: { speed: 400 } } },
    plotOptions: { bar: { distributed: true, borderRadius: 6, columnWidth: "50%", borderRadiusApplication: "end" } },
    dataLabels: { enabled: false },
    legend: { show: false },
    states: { hover: { filter: { type: "darken", value: 0.9 } } },
    xaxis: {
      categories: data.map((d) => d.dayShort),
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: { style: { fontFamily: "Outfit", fontSize: "11px", colors: "#98a2b3", fontWeight: 500 } },
    },
    yaxis: {
      labels: {
        formatter: (val: number) => formatPYGShort(val),
        style: { fontFamily: "Outfit", fontSize: "10px", colors: ["#98a2b3"] },
      },
    },
    grid: { yaxis: { lines: { show: true } }, xaxis: { lines: { show: false } }, borderColor: "#f2f4f7" },
    tooltip: { y: { formatter: (val: number) => formatPYGShort(val) } },
  }), [data]);

  // Lazy load prompt
  if (!hasData && !isLoading) {
    return (
      <Card padding="lg" className="flex h-full flex-col">
        <SectionLabel>Comportamiento Semanal</SectionLabel>
        <div className="mt-auto">
          <LazyLoadPrompt
            label="Cargar distribución por día"
            onClick={onRequestLoad}
            icon={
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
            }
          />
        </div>
      </Card>
    );
  }

  return (
    <Card padding="lg" className="flex h-full flex-col">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <SectionLabel>Comportamiento Semanal</SectionLabel>
        {bestDay && !isLoading && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 dark:bg-brand-500/15 dark:text-brand-400">
            &#9733; Mejor día: {bestDay.dayName}
          </span>
        )}
      </div>

      {isLoading ? (
        <SkeletonBars />
      ) : (
        <>
          <Chart
            options={chartOptions}
            series={[{ name: "Ventas", data: data.map((d) => Math.round(d.totalNeto)) }]}
            type="bar"
            height={220}
          />
          {bestDay && (
            <div className="mt-auto flex flex-wrap gap-6 border-t border-gray-100 pt-3 dark:border-gray-700">
              <div className="text-xs">
                <span className="text-gray-400 dark:text-gray-500">Promedio {bestDay.dayName}: </span>
                <span className="font-semibold tabular-nums text-gray-700 dark:text-gray-300">{formatPYGShort(bestDay.avgNeto)}</span>
              </div>
              <div className="text-xs">
                <span className="text-gray-400 dark:text-gray-500">Transacciones: </span>
                <span className="font-semibold tabular-nums text-gray-700 dark:text-gray-300">{bestDay.txCount.toLocaleString("es-PY")}</span>
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

// ─── SKUs Card ───────────────────────────────────────────────────────────────

export function SkusCard({
  data,
  isLoading,
  onRequestLoad,
}: {
  data: TopSkuRow[];
  isLoading: boolean;
  onRequestLoad: () => void;
}) {
  // Lazy load prompt
  if (data.length === 0 && !isLoading) {
    return (
      <Card padding="lg" className="flex h-full flex-col">
        <SectionLabel>Top SKUs</SectionLabel>
        <div className="mt-auto">
          <LazyLoadPrompt
            label="Cargar ranking de SKUs"
            onClick={onRequestLoad}
            icon={
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
              </svg>
            }
          />
        </div>
      </Card>
    );
  }

  return (
    <Card padding="lg" className="flex h-full flex-col">
      <SectionLabel>Top SKUs</SectionLabel>
      {isLoading ? (
        <div className="-mb-2 flex flex-1 flex-col gap-2">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="flex animate-pulse items-start gap-3 rounded-xl border border-gray-100 p-3.5 dark:border-gray-700/50">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700" />
              <div className="flex flex-1 flex-col gap-1.5">
                <div className="h-3.5 w-3/4 rounded bg-gray-100 dark:bg-gray-700" />
                <div className="flex gap-2">
                  <div className="h-4 w-14 rounded-full bg-gray-100 dark:bg-gray-700" />
                  <div className="h-3 w-20 rounded bg-gray-100 dark:bg-gray-700" />
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <div className="h-3.5 w-16 rounded bg-gray-100 dark:bg-gray-700" />
                <div className="h-3 w-10 rounded bg-gray-100 dark:bg-gray-700" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="-mb-2 flex flex-1 flex-col gap-1.5 overflow-y-auto">
          {data.map((sku, i) => {
            const colors = brandColor(sku.brand);
            const name = sku.description !== sku.sku ? sku.description : (sku.skuComercial || sku.sku);
            const code = sku.skuComercial || sku.sku;

            return (
              <div
                key={sku.sku}
                className="flex items-start gap-3 rounded-xl border border-gray-100 px-3.5 py-3 transition-colors hover:border-gray-200 hover:bg-gray-50/50 dark:border-gray-700/50 dark:hover:border-gray-600 dark:hover:bg-white/[0.02]"
              >
                {/* Rank */}
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-[11px] font-bold tabular-nums text-gray-400 dark:bg-gray-700 dark:text-gray-500">
                  {i + 1}
                </div>

                {/* Product info */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-gray-900 dark:text-white" title={name}>
                    {name}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${colors.bg} ${colors.text}`}>
                      {sku.brand}
                    </span>
                    <span className="font-mono text-[10px] text-gray-400 dark:text-gray-500">
                      {code}{sku.skuComercial ? ` · ${sku.sku}` : ""}
                    </span>
                  </div>
                </div>

                {/* Metrics */}
                <div className="shrink-0 text-right">
                  <p className="text-sm font-bold tabular-nums text-gray-900 dark:text-white">
                    {formatPYGShort(sku.neto)}
                  </p>
                  <p className="mt-0.5 text-[11px] tabular-nums text-gray-400 dark:text-gray-500">
                    {Math.round(sku.units).toLocaleString("es-PY")} uds
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

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
    if (brand === "Otras" && neto === 0) return;
    result.push({ brand, neto, pct: total > 0 ? (neto / total) * 100 : 0 });
  });

  return result.sort((a, b) => b.neto - a.neto);
}

// ─── Store detail view (redesigned with charts) ──────────────────────────────

function StoreDetailView({
  store,
  onBack,
  channelLabel,
  salesWideRaw,
  dailyDetailRaw,
  activeMonths,
  channelMode,
  brand,
}: {
  store: StoreBreakdownRow;
  onBack: () => void;
  channelLabel: string;
  salesWideRaw?: MonthlySalesRow[];
  dailyDetailRaw?: DailyDetailRow[];
  activeMonths?: number[];
  channelMode?: string;
  brand?: string;
}) {
  const isSingleMonth = activeMonths?.length === 1;

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
      y: { formatter: (val: number) => formatPYGSuffix(val) },
    },
    markers: {
      size: 4,
      colors: ["#fff"],
      strokeColors: "#465FFF",
      strokeWidth: 2,
      hover: { size: 6 },
    },
  }), [monthly]);

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
      x: { formatter: (val: number) => `Día ${val}` },
      y: { formatter: (val: number) => formatPYGSuffix(val) },
    },
    markers: {
      size: 3,
      colors: ["#fff"],
      strokeColors: "#465FFF",
      strokeWidth: 2,
      hover: { size: 5 },
    },
  }), [daily]);

  // ── Margin health indicator (channel-aware thresholds) ──
  const ch = (channelMode === "b2b" ? "b2b" : "b2c") as "b2b" | "b2c";
  const mHealth = classifyMarginHealth(store.grossMargin, ch);
  const marginColor = MARGIN_TEXT[mHealth];
  const marginBg = MARGIN_BG[mHealth];
  const marginLabel = MARGIN_LABEL[mHealth];

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex items-start justify-between">
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
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">{store.storeCode}</h3>
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
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {/* Hero: Venta Neta — spans 1 col but larger */}
        <div className="rounded-2xl border border-brand-100 bg-brand-50/50 p-4 dark:border-brand-500/20 dark:bg-brand-500/5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-400 dark:text-brand-400/70">Venta Neta</p>
          <p className="mt-1.5 text-xl font-bold tabular-nums text-brand-700 dark:text-brand-300">
            {formatPYGShort(store.neto)}
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 p-4 dark:border-gray-700">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">Margen Bruto</p>
          <div className="mt-1.5 flex items-end gap-2">
            <p className={`text-xl font-bold tabular-nums ${marginColor}`}>
              {formatPct(store.grossMargin)}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 p-4 dark:border-gray-700">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">Markdown</p>
          <p className={`mt-1.5 text-xl font-bold tabular-nums ${store.markdownPct > 20 ? "text-error-600 dark:text-error-400" : "text-gray-900 dark:text-white"}`}>
            {formatPct(store.markdownPct)}
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 p-4 dark:border-gray-700">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">Tickets</p>
          <p className="mt-1.5 text-xl font-bold tabular-nums text-gray-900 dark:text-white">
            {store.tickets > 0 ? store.tickets.toLocaleString("es-PY") : "\u2014"}
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 p-4 dark:border-gray-700">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">AOV</p>
          <p className="mt-1.5 text-xl font-bold tabular-nums text-gray-900 dark:text-white">
            {store.aov > 0 ? formatPYGShort(store.aov) : "\u2014"}
          </p>
        </div>
      </div>

      {/* ── Charts row ── */}
      <div className={`grid gap-4 ${hasBrands ? "grid-cols-1 lg:grid-cols-[1fr_1fr]" : "grid-cols-1"}`}>

        {/* Monthly trend area chart (multi-month) */}
        {hasMultipleMonths && (
          <div className="rounded-2xl border border-gray-200 p-5 dark:border-gray-700">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
              Evolución Mensual
            </p>
            <Chart
              options={trendOptions}
              series={[{ name: "Ventas", data: monthly.map((m) => Math.round(m.neto)) }]}
              type="area"
              height={200}
            />
            {/* Monthly margin mini-row */}
            <div className="mt-2 flex flex-wrap gap-2">
              {monthly.filter((m) => m.neto > 0).map((m) => {
                const mc = MARGIN_TEXT[classifyMarginHealth(m.margin, ch)];
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
          <div className="rounded-2xl border border-gray-200 p-5 dark:border-gray-700">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
              Evolución Diaria
            </p>
            <Chart
              options={dailyTrendOptions}
              series={[{ name: "Ventas", data: daily.map((d) => Math.round(d.neto)) }]}
              type="area"
              height={200}
            />
          </div>
        )}

        {/* Brand mix — horizontal bars */}
        {hasBrands && (
          <div className="rounded-2xl border border-gray-200 p-5 dark:border-gray-700">
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
        const th = marginHealthThresholds(ch);
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
          <div className="rounded-2xl border border-gray-200 p-5 dark:border-gray-700">
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
