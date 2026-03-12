/**
 * features/sales/components/StoresTable.tsx
 *
 * Grid of store cards with sparklines, margin badges, and drill-down to StoreDetailView.
 */
import { useState, useMemo } from "react";
import type { MonthlySalesRow, DailyDetailRow } from "@/queries/sales.queries";
import type { StoreBreakdownRow } from "../hooks/useSalesAnalytics";
import { classifyMarginHealth } from "@/domain/kpis/calculations";
import { formatPYGShort, formatPYGSuffix, formatPct } from "@/utils/format";
import { Card } from "@/components/ui/card/Card";
import {
  MARGIN_TEXT,
  MARGIN_BG,
  buildStoreSparklines,
  buildStoreDailySparklines,
} from "./salesAnalytics.constants";
import { SectionLabel, MiniSparkline } from "./salesAnalytics.shared";
import { StoreDetailView } from "./StoreDetailView";

export function StoresTable({
  storeBreakdown,
  storeBreakdownB2B,
  isStoresLoading,
  channelMode,
  onSelectStore,
  onDeselectStore,
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
  onDeselectStore?: () => void;
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
    setSelectedStore(code);
    setSelectedChannel(ch ?? channelMode);
    if (onSelectStore) onSelectStore(code);
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
          onBack={() => { setSelectedStore(null); setSelectedChannel(null); if (onDeselectStore) onDeselectStore(); }}
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
                  <button
                    type="button"
                    key={row.storeCode}
                    className="group relative w-full cursor-pointer rounded-2xl border border-gray-200 bg-white p-4 text-left transition-all duration-200 hover:border-gray-300 hover:shadow-theme-sm dark:border-gray-700 dark:bg-gray-800 dark:hover:border-gray-600"
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
                  </button>
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
                  <button
                    type="button"
                    key={row.storeCode}
                    className="group relative w-full cursor-pointer rounded-2xl border border-gray-200 bg-white p-4 text-left transition-all duration-200 hover:border-gray-300 hover:shadow-theme-sm dark:border-gray-700 dark:bg-gray-800 dark:hover:border-gray-600"
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
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
