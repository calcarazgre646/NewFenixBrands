/**
 * features/sales/components/salesAnalytics.constants.ts
 *
 * Shared constants, chart builders, and data-derivation helpers for SalesAnalytics cards.
 * Pure functions — no React components (avoids react-refresh warnings).
 */
import type { ApexOptions } from "apexcharts";
import type { MarginHealth } from "@/domain/kpis/calculations";
import type { MonthlySalesRow, DailyDetailRow } from "@/queries/sales.queries";
import { calcGrossMargin } from "@/domain/kpis/calculations";
import { brandIdToCanonical } from "@/api/normalize";

// ─── Margin health colors (DRY) ───────────────────────────────────────────────

export const MARGIN_TEXT: Record<MarginHealth, string> = {
  healthy: "text-success-600 dark:text-success-400",
  moderate: "text-warning-600 dark:text-warning-400",
  low: "text-error-600 dark:text-error-400",
};
export const MARGIN_BG: Record<MarginHealth, string> = {
  healthy: "bg-success-50 dark:bg-success-500/10",
  moderate: "bg-warning-50 dark:bg-warning-500/10",
  low: "bg-error-50 dark:bg-error-500/10",
};
export const MARGIN_LABEL: Record<MarginHealth, string> = {
  healthy: "Saludable",
  moderate: "Moderado",
  low: "Bajo",
};
export const MARGIN_DOT: Record<MarginHealth, string> = {
  healthy: "bg-success-500",
  moderate: "bg-warning-500",
  low: "bg-error-500",
};

// ─── Brand config ─────────────────────────────────────────────────────────────

export const BRAND_COLORS: Record<string, { bg: string; text: string; bar: string }> = {
  Martel:   { bg: "bg-emerald-50 dark:bg-emerald-500/10", text: "text-emerald-700 dark:text-emerald-400", bar: "bg-gradient-to-r from-emerald-400 to-emerald-500" },
  Wrangler: { bg: "bg-orange-50 dark:bg-orange-500/10", text: "text-orange-700 dark:text-orange-400", bar: "bg-gradient-to-r from-orange-400 to-orange-500" },
  Lee:      { bg: "bg-blue-50 dark:bg-blue-500/10",     text: "text-blue-700 dark:text-blue-400",     bar: "bg-gradient-to-r from-blue-400 to-blue-500" },
  Otras:    { bg: "bg-gray-50 dark:bg-gray-700/50",     text: "text-gray-600 dark:text-gray-400",     bar: "bg-gradient-to-r from-gray-300 to-gray-400" },
};

export const BRAND_CHART_COLOR: Record<string, string> = {
  Martel:   "#10B981",
  Wrangler: "#F97316",
  Lee:      "#3B82F6",
};

export function buildBrandRadialOptions(pct: number, brand: string): ApexOptions {
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

export function brandColor(brand: string) {
  return BRAND_COLORS[brand] ?? BRAND_COLORS.Otras;
}

// ─── Sparkline builders ──────────────────────────────────────────────────────

export function buildStoreSparklines(
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

export function buildStoreDailySparklines(
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

export function deriveStoreDaily(
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
