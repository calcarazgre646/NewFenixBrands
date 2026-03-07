/**
 * features/sales/components/SalesAnalyticsPanel.tsx
 *
 * Panel con 4 tabs de analytics: Marcas, Canal/Tiendas, Comportamiento, Top SKUs.
 * Incluye vista de detalle de tienda al hacer click en una fila.
 *
 * REGLA: Sin logica de negocio. Solo layout.
 */
import { useState, useMemo } from "react";
import Chart from "react-apexcharts";
import type { ApexOptions } from "apexcharts";
import type { BrandBreakdownRow, ChannelMixRow, TopSkuRow } from "@/queries/sales.queries";
import type { DayOfWeekStat, StoreBreakdownRow } from "../hooks/useSalesAnalytics";
import { calcGrossMargin, calcMarkdownDependency } from "@/domain/kpis/calculations";

// ─── Format helpers ──────────────────────────────────────────────────────────

function fmtGs(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)} MM Gs.`;
  if (value >= 1_000_000)     return `${(value / 1_000_000).toFixed(0)} M Gs.`;
  return `${Math.round(value).toLocaleString("es-PY")} Gs.`;
}

function fmtPct(value: number): string {
  return `${value.toFixed(1)}%`;
}

// ─── Brand colors ────────────────────────────────────────────────────────────

const BRAND_COLORS: Record<string, { bg: string; text: string; bar: string }> = {
  Martel:   { bg: "bg-emerald-100 dark:bg-emerald-500/15", text: "text-emerald-700 dark:text-emerald-400", bar: "bg-emerald-500" },
  Wrangler: { bg: "bg-amber-100 dark:bg-amber-500/15",     text: "text-amber-700 dark:text-amber-400",     bar: "bg-amber-500" },
  Lee:      { bg: "bg-red-100 dark:bg-red-500/15",         text: "text-red-700 dark:text-red-400",         bar: "bg-red-500" },
  Otras:    { bg: "bg-gray-100 dark:bg-gray-700",          text: "text-gray-700 dark:text-gray-400",       bar: "bg-gray-400" },
};

function brandColor(brand: string) {
  return BRAND_COLORS[brand] ?? BRAND_COLORS.Otras;
}

// ─── Tab types ───────────────────────────────────────────────────────────────

type TabKey = "brands" | "channel" | "behavior" | "skus";

interface TabDef {
  key: TabKey;
  label: string;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function BrandsTab({ data }: { data: BrandBreakdownRow[] }) {
  const totalNeto = data.reduce((s, b) => s + b.neto, 0);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {data.map((b) => {
        const mix = totalNeto > 0 ? (b.neto / totalNeto) * 100 : 0;
        const margin = calcGrossMargin(b.neto, b.cogs);
        const markdown = calcMarkdownDependency(b.dcto, b.bruto);
        const colors = brandColor(b.brand);
        const yoy = b.yoyPct;

        return (
          <div
            key={b.brand}
            className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800"
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-bold text-gray-900 dark:text-white">{b.brand}</span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${colors.bg} ${colors.text}`}>
                Mix: {fmtPct(mix)}
              </span>
            </div>
            <div className="mb-3 h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
              <div
                className={`h-full rounded-full ${colors.bar} transition-all duration-500`}
                style={{ width: `${Math.min(mix, 100)}%` }}
              />
            </div>
            {yoy != null && (
              <div className="mb-3">
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                    yoy >= 0
                      ? "bg-success-100 text-success-700 dark:bg-success-500/15 dark:text-success-400"
                      : "bg-error-100 text-error-700 dark:bg-error-500/15 dark:text-error-400"
                  }`}
                >
                  {yoy >= 0 ? "▲" : "▼"} {yoy >= 0 ? "+" : ""}{yoy.toFixed(1)}% vs A.A.
                </span>
              </div>
            )}
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Margen Bruto</span>
                <span className={margin >= 30 ? "font-semibold text-success-700 dark:text-success-400" : "font-semibold text-gray-900 dark:text-white"}>
                  {fmtPct(margin)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Markdown</span>
                <span className={markdown > 20 ? "font-semibold text-error-700 dark:text-error-400" : "font-semibold text-gray-900 dark:text-white"}>
                  {fmtPct(markdown)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Ventas Netas</span>
                <span className="font-semibold text-gray-900 dark:text-white">{fmtGs(b.neto)}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ChannelTab({
  channelMix,
  storeBreakdown,
  channelMode,
  isStoresLoading,
  onSelectStore,
}: {
  channelMix: ChannelMixRow[];
  storeBreakdown: StoreBreakdownRow[];
  channelMode: string;
  isStoresLoading: boolean;
  onSelectStore: (code: string) => void;
}) {
  const totalNeto = channelMix.reduce((s, c) => s + c.neto, 0);

  const chartOptions: ApexOptions = useMemo(() => ({
    chart: { type: "donut", background: "transparent", fontFamily: "Outfit, sans-serif" },
    labels: channelMix.map((c) => c.channel),
    colors: ["#465FFF", "#F59E0B"],
    legend: { position: "bottom", fontSize: "12px" },
    dataLabels: {
      enabled: true,
      formatter: (_: number, opts: { seriesIndex: number }) =>
        `${(channelMix[opts.seriesIndex]?.pct ?? 0).toFixed(1)}%`,
    },
    plotOptions: {
      pie: { donut: { size: "55%", labels: { show: true, total: { show: true, label: "Total", formatter: () => fmtGs(totalNeto) } } } },
    },
    tooltip: { y: { formatter: (val: number) => fmtGs(val) } },
  }), [channelMix, totalNeto]);

  // When channel is total → show donut + bars
  if (channelMode === "total") {
    if (channelMix.length === 0) {
      return <p className="py-8 text-center text-sm text-gray-400">Sin datos de canal</p>;
    }
    return (
      <div className="space-y-6">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
          Mix de Canal
        </h3>
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
          <div className="w-full max-w-xs">
            <Chart options={chartOptions} series={channelMix.map((c) => c.neto)} type="donut" height={280} />
          </div>
          <div className="flex-1 space-y-3">
            {channelMix.map((c) => (
              <div key={c.channel} className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-bold text-gray-900 dark:text-white">{c.channel}</span>
                  <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">{fmtPct(c.pct)}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${c.channel === "B2C" ? "bg-brand-500" : "bg-amber-500"}`}
                    style={{ width: `${Math.min(c.pct, 100)}%` }}
                  />
                </div>
                <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">{fmtGs(c.neto)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // When channel is B2B or B2C → show store breakdown table
  const isB2B = channelMode === "b2b";
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
          {isB2B ? "Zonas Mayoristas" : "Tiendas"} &mdash; Clic para ver detalle
        </h3>
        <span className="text-xs text-gray-400 dark:text-gray-500">&rarr;</span>
      </div>
      {isStoresLoading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
          ))}
        </div>
      ) : storeBreakdown.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-gray-500">Sin datos de tiendas.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700">
                {["Tienda", "Venta Neta", "Margen", "Markdown", "Tickets", "AOV", "% Canal"].map((h) => (
                  <th key={h} className="whitespace-nowrap pb-2 pr-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400 last:pr-0 dark:text-gray-500">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
              {storeBreakdown.map((row) => (
                <tr
                  key={row.storeCode}
                  className="cursor-pointer transition-colors hover:bg-brand-50 dark:hover:bg-brand-500/[0.05]"
                  onClick={() => onSelectStore(row.storeCode)}
                >
                  <td className="whitespace-nowrap py-2.5 pr-3">
                    <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">{row.storeCode}</span>
                  </td>
                  <td className="whitespace-nowrap py-2.5 pr-3 text-xs font-semibold tabular-nums text-gray-700 dark:text-gray-300">
                    {fmtGs(row.neto)}
                  </td>
                  <td className={`py-2.5 pr-3 text-xs font-semibold tabular-nums ${row.grossMargin >= 30 ? "text-success-600 dark:text-success-400" : "text-warning-600 dark:text-warning-400"}`}>
                    {fmtPct(row.grossMargin)}
                  </td>
                  <td className={`py-2.5 pr-3 text-xs font-semibold tabular-nums ${row.markdownPct > 20 ? "text-error-600 dark:text-error-400" : "text-gray-700 dark:text-gray-300"}`}>
                    {fmtPct(row.markdownPct)}
                  </td>
                  <td className="py-2.5 pr-3 text-xs tabular-nums text-gray-500 dark:text-gray-400">
                    {row.tickets > 0 ? row.tickets.toLocaleString("es-PY") : "\u2014"}
                  </td>
                  <td className="whitespace-nowrap py-2.5 pr-3 text-xs tabular-nums text-gray-500 dark:text-gray-400">
                    {row.aov > 0 ? `${fmtGs(row.aov)}` : "\u2014"}
                  </td>
                  <td className="py-2.5 text-xs tabular-nums text-gray-400 dark:text-gray-500">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-12 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                        <div className="h-1.5 rounded-full bg-brand-400 dark:bg-brand-500" style={{ width: `${Math.min(row.revenuePct, 100)}%` }} />
                      </div>
                      <span>{fmtPct(row.revenuePct)}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function BehaviorTab({ data, isLoading }: { data: DayOfWeekStat[]; isLoading: boolean }) {
  const bestDay = data.find((d) => d.isBest);

  const chartOptions: ApexOptions = useMemo(() => ({
    colors: data.map((d) => (d.isBest ? "#465FFF" : "#D1D5DB")),
    chart: { fontFamily: "Outfit, sans-serif", type: "bar", toolbar: { show: false }, animations: { enabled: false } },
    plotOptions: { bar: { distributed: true, borderRadius: 5, columnWidth: "55%", borderRadiusApplication: "end" } },
    dataLabels: { enabled: false },
    legend: { show: false },
    xaxis: {
      categories: data.map((d) => d.dayShort),
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: { style: { fontFamily: "Outfit", fontSize: "12px" } },
    },
    yaxis: {
      labels: {
        formatter: (val: number) => fmtGs(val),
        style: { fontFamily: "Outfit", fontSize: "11px" },
      },
    },
    grid: { yaxis: { lines: { show: true } }, borderColor: "#F2F4F7" },
    tooltip: { y: { formatter: (val: number) => `${fmtGs(val)}` } },
  }), [data]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
          Distribucion por Dia de la Semana
        </h3>
        {bestDay && !isLoading && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 dark:bg-brand-500/15 dark:text-brand-400">
            &#9733; Mejor dia: {bestDay.dayName}
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="flex h-32 items-end gap-2">
          {[60, 90, 75, 100, 85, 50, 40].map((h, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1">
              <div className="w-full animate-pulse rounded-t bg-gray-200 dark:bg-gray-700" style={{ height: `${h}px` }} />
              <div className="h-3 w-5 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
            </div>
          ))}
        </div>
      ) : data.every((d) => d.totalNeto === 0) ? (
        <p className="text-sm text-gray-400 dark:text-gray-500">Sin datos disponibles.</p>
      ) : (
        <>
          <Chart
            options={chartOptions}
            series={[{ name: "Ventas", data: data.map((d) => Math.round(d.totalNeto)) }]}
            type="bar"
            height={220}
          />
          {bestDay && (
            <div className="flex flex-wrap gap-6 border-t border-gray-100 pt-3 dark:border-gray-700">
              <div className="text-xs">
                <span className="text-gray-400 dark:text-gray-500">Promedio {bestDay.dayName}: </span>
                <span className="font-semibold text-gray-700 dark:text-gray-300">{fmtGs(bestDay.avgNeto)}</span>
              </div>
              <div className="text-xs">
                <span className="text-gray-400 dark:text-gray-500">Transacciones: </span>
                <span className="font-semibold text-gray-700 dark:text-gray-300">{bestDay.txCount.toLocaleString("es-PY")}</span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SkusTab({ data }: { data: TopSkuRow[] }) {
  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-gray-400">Sin datos de SKUs</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 dark:border-gray-700">
            {["#", "SKU", "MARCA", "VENTAS NETAS", "UNIDADES"].map((h) => (
              <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
          {data.map((sku, i) => {
            const colors = brandColor(sku.brand);
            return (
              <tr key={sku.sku} className="transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.02]">
                <td className="px-4 py-3 text-xs font-semibold text-gray-400">{i + 1}</td>
                <td className="px-4 py-3">
                  <span className="font-mono text-xs text-gray-900 dark:text-white">{sku.sku}</span>
                  {sku.description !== sku.sku && (
                    <p className="mt-0.5 max-w-[200px] truncate text-xs text-gray-400 dark:text-gray-500">{sku.description}</p>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${colors.bg} ${colors.text}`}>{sku.brand}</span>
                </td>
                <td className="px-4 py-3 tabular-nums text-gray-700 dark:text-gray-300">{fmtGs(sku.neto)}</td>
                <td className="px-4 py-3 tabular-nums text-gray-600 dark:text-gray-400">{Math.round(sku.units).toLocaleString("es-PY")}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Store detail view ───────────────────────────────────────────────────────

function StoreDetailView({
  store,
  onBack,
  channelLabel,
}: {
  store: StoreBreakdownRow;
  onBack: () => void;
  channelLabel: string;
}) {
  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
      >
        &larr; Volver al resumen ({channelLabel})
      </button>

      <div>
        <h3 className="text-base font-bold text-gray-900 dark:text-white">{store.storeCode}</h3>
        <p className="text-xs text-gray-400 dark:text-gray-500">Analisis de tienda</p>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl border border-gray-200 p-3 dark:border-gray-700">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Venta Neta</p>
          <p className="text-sm font-bold text-gray-900 dark:text-white">{fmtGs(store.neto)}</p>
        </div>
        <div className="rounded-xl border border-gray-200 p-3 dark:border-gray-700">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Margen Bruto</p>
          <p className={`text-sm font-bold ${store.grossMargin >= 30 ? "text-success-700 dark:text-success-400" : "text-warning-700 dark:text-warning-400"}`}>
            {fmtPct(store.grossMargin)}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 p-3 dark:border-gray-700">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">AOV</p>
          <p className="text-sm font-bold text-gray-900 dark:text-white">
            {store.aov > 0 ? fmtGs(store.aov) : "\u2014"}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 p-3 dark:border-gray-700">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Tickets</p>
          <p className="text-sm font-bold text-gray-900 dark:text-white">
            {store.tickets > 0 ? store.tickets.toLocaleString("es-PY") : "\u2014"}
          </p>
        </div>
      </div>

      {/* Additional metrics */}
      <div className="flex flex-wrap gap-4 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-xs dark:border-gray-700 dark:bg-gray-800/50">
        <div>
          <span className="text-gray-400 dark:text-gray-500">Markdown: </span>
          <span className={`font-semibold ${store.markdownPct > 20 ? "text-error-700 dark:text-error-400" : "text-gray-700 dark:text-gray-300"}`}>
            {fmtPct(store.markdownPct)}
          </span>
        </div>
        <div>
          <span className="text-gray-400 dark:text-gray-500">% del canal: </span>
          <span className="font-semibold text-gray-700 dark:text-gray-300">{fmtPct(store.revenuePct)}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function AnalyticsSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-40 rounded-2xl bg-gray-100 dark:bg-gray-800" />
        ))}
      </div>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

interface SalesAnalyticsPanelProps {
  brandBreakdown: BrandBreakdownRow[];
  channelMix: ChannelMixRow[];
  topSkus: TopSkuRow[];
  dayOfWeek: DayOfWeekStat[];
  storeBreakdown: StoreBreakdownRow[];
  isLoading: boolean;
  isDowLoading: boolean;
  isStoresLoading: boolean;
  showBrandsTab: boolean;
  channelMode: string;
}

export function SalesAnalyticsPanel({
  brandBreakdown,
  channelMix,
  topSkus,
  dayOfWeek,
  storeBreakdown,
  isLoading,
  isDowLoading,
  isStoresLoading,
  showBrandsTab,
  channelMode,
}: SalesAnalyticsPanelProps) {
  const [activeTab, setActiveTab] = useState<TabKey>(showBrandsTab ? "brands" : "channel");
  const [selectedStore, setSelectedStore] = useState<string | null>(null);

  // Build available tabs
  const tabs = useMemo((): TabDef[] => {
    const t: TabDef[] = [];
    if (showBrandsTab) t.push({ key: "brands", label: "Marcas" });
    t.push({
      key: "channel",
      label: channelMode === "total"
        ? "Canal"
        : channelMode === "b2b"
        ? "Zonas"
        : "Tiendas",
    });
    t.push({ key: "behavior", label: "Comportamiento" });
    t.push({ key: "skus", label: "SKUs" });
    return t;
  }, [showBrandsTab, channelMode]);

  // Reset tab if current is no longer available
  if (!tabs.find((t) => t.key === activeTab)) {
    setActiveTab(tabs[0]?.key ?? "channel");
  }

  // Store detail view
  const storeDetail = selectedStore
    ? storeBreakdown.find((s) => s.storeCode === selectedStore)
    : null;

  if (storeDetail) {
    return (
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <div className="p-5">
          <StoreDetailView
            store={storeDetail}
            onBack={() => setSelectedStore(null)}
            channelLabel={channelMode === "b2b" ? "B2B" : "B2C"}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      {/* Tab bar */}
      <div className="flex border-b border-gray-100 dark:border-gray-700">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`px-5 py-3 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "border-b-2 border-brand-500 text-brand-600 dark:text-brand-400"
                : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="p-5">
        {activeTab === "brands" && (
          isLoading ? <AnalyticsSkeleton /> : <BrandsTab data={brandBreakdown} />
        )}
        {activeTab === "channel" && (
          <ChannelTab
            channelMix={channelMix}
            storeBreakdown={storeBreakdown}
            channelMode={channelMode}
            isStoresLoading={isStoresLoading || isLoading}
            onSelectStore={setSelectedStore}
          />
        )}
        {activeTab === "behavior" && (
          <BehaviorTab data={dayOfWeek} isLoading={isDowLoading} />
        )}
        {activeTab === "skus" && (
          isLoading ? <AnalyticsSkeleton /> : <SkusTab data={topSkus} />
        )}
      </div>
    </div>
  );
}
