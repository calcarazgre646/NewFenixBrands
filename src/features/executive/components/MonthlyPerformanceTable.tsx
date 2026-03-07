/**
 * features/executive/components/MonthlyPerformanceTable.tsx
 *
 * Tabla colapsable de performance mensual: Real vs Presupuesto vs Ano Anterior.
 * Selector de 6 vistas: Total / B2B / B2C / Martel / Wrangler / Lee.
 *
 * REGLA: Sin logica de negocio. Filtrado via getRowsForView (datos WIDE cacheados).
 * Cambio de vista = re-render instantaneo, sin API call.
 */
import { useState, useMemo } from "react";
import { ChevronDownIcon, ChevronUpIcon } from "@/icons";
import type { MonthlyRow } from "@/domain/executive/calcs";

// ─── View definitions ────────────────────────────────────────────────────────

type ViewKey = "all" | "b2b" | "b2c" | "martel" | "wrangler" | "lee";

interface ViewOption {
  key: ViewKey;
  label: string;
  brand: string;    // filter key for getRowsForView
  channel: string;  // filter key for getRowsForView
  color: string;
}

const VIEW_OPTIONS: ViewOption[] = [
  { key: "all",      label: "Total Fenix", brand: "total",    channel: "total", color: "#465FFF" },
  { key: "b2b",      label: "B2B",         brand: "total",    channel: "b2b",   color: "#8B5CF6" },
  { key: "b2c",      label: "B2C",         brand: "total",    channel: "b2c",   color: "#06B6D4" },
  { key: "martel",   label: "Martel",      brand: "martel",   channel: "total", color: "#10B981" },
  { key: "wrangler", label: "Wrangler",    brand: "wrangler", channel: "total", color: "#F59E0B" },
  { key: "lee",      label: "Lee",         brand: "lee",      channel: "total", color: "#EF4444" },
];

// ─── Format helpers ──────────────────────────────────────────────────────────

function fmt(value: number): string {
  return `${Math.round(value).toLocaleString("es-PY")} Gs.`;
}

function fmtDiff(value: number): string {
  const abs = Math.abs(value);
  const sign = value >= 0 ? "+" : "-";
  if (abs >= 1_000_000_000) return `${sign}${(abs / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000)     return `${sign}${(abs / 1_000_000).toFixed(0)}M`;
  if (abs >= 1_000)         return `${sign}${(abs / 1_000).toFixed(0)}K`;
  return `${sign}${abs.toFixed(0)}`;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function DiffBadge({ value }: { value: number }) {
  const positive = value >= 0;
  return (
    <span
      className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
        positive
          ? "bg-success-100 dark:bg-success-500/15 text-success-700 dark:text-success-400"
          : "bg-error-100 dark:bg-error-500/15 text-error-700 dark:text-error-400"
      }`}
    >
      {fmtDiff(value)}
    </span>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

interface MonthlyPerformanceTableProps {
  rows: MonthlyRow[];
  getRowsForView: (brand: string, channel: string) => MonthlyRow[];
}

export function MonthlyPerformanceTable({ rows, getRowsForView }: MonthlyPerformanceTableProps) {
  const [open, setOpen] = useState(false);
  const [activeView, setActiveView] = useState<ViewKey>("all");

  const activeOption = VIEW_OPTIONS.find((v) => v.key === activeView)!;

  const displayRows = useMemo(() => {
    if (activeView === "all") return rows;
    return getRowsForView(activeOption.brand, activeOption.channel);
  }, [activeView, rows, getRowsForView, activeOption.brand, activeOption.channel]);

  const totals = useMemo(() => {
    const totalReal     = displayRows.reduce((s, r) => s + r.real, 0);
    const totalBudget   = displayRows.reduce((s, r) => s + r.budget, 0);
    const totalLastYear = displayRows.reduce((s, r) => s + r.lastYear, 0);
    return { totalReal, totalBudget, totalLastYear };
  }, [displayRows]);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 overflow-hidden">
      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-gray-100 px-6 py-4 dark:border-gray-700 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="group flex items-start gap-3 text-left"
        >
          <div className="mt-0.5">
            {open ? (
              <ChevronUpIcon className="h-5 w-5 text-gray-400 transition-colors group-hover:text-gray-600 dark:group-hover:text-gray-300" />
            ) : (
              <ChevronDownIcon className="h-5 w-5 text-gray-400 transition-colors group-hover:text-gray-600 dark:group-hover:text-gray-300" />
            )}
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              Performance Mensual
            </h2>
            <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
              Real vs Presupuesto vs Ano Anterior &middot; Vista:{" "}
              <strong>{activeOption.label}</strong>
            </p>
          </div>
        </button>

        {/* View selector */}
        <div className="flex flex-wrap shrink-0 overflow-hidden rounded-lg border border-gray-200 text-xs font-medium dark:border-gray-700">
          {VIEW_OPTIONS.map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => setActiveView(v.key)}
              style={activeView === v.key ? { backgroundColor: v.color, color: "#fff" } : {}}
              className={`px-3 py-1.5 transition-colors ${
                activeView === v.key
                  ? "font-semibold"
                  : "bg-white text-gray-500 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table body — only when open */}
      {open && (
        <div className="border-t border-gray-100 dark:border-gray-700">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700">
                  {["MES", "REAL", "PRESUPUESTO", "VS PRESUPUESTO", "ANO ANTERIOR", "VS ANO ANT."].map(
                    (h) => (
                      <th
                        key={h}
                        className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500"
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                {displayRows.map((row) => (
                  <tr
                    key={row.month}
                    className={`transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.02] ${
                      row.hasRealData
                        ? "bg-white dark:bg-gray-800"
                        : "bg-gray-50/50 dark:bg-gray-800/50"
                    }`}
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-semibold ${
                            row.hasRealData
                              ? "text-gray-900 dark:text-white"
                              : "text-gray-400 dark:text-gray-500"
                          }`}
                        >
                          {row.monthLabel}
                        </span>
                        {row.isCurrentMonth && row.hasRealData && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-warning-100 px-1.5 py-0.5 text-[10px] font-medium text-warning-700 dark:bg-warning-500/15 dark:text-warning-400">
                            <span className="inline-block h-1 w-1 animate-pulse rounded-full bg-warning-500" />
                            en curso
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 tabular-nums text-gray-700 dark:text-gray-300">
                      {row.hasRealData ? (
                        fmt(row.real)
                      ) : (
                        <span className="text-gray-300 dark:text-gray-600">&mdash;</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 tabular-nums text-gray-600 dark:text-gray-400">
                      {row.budget > 0 ? (
                        fmt(row.budget)
                      ) : (
                        <span className="text-gray-300 dark:text-gray-600">&mdash;</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      {row.hasRealData && row.budget > 0 ? (
                        <DiffBadge value={row.vsBudget} />
                      ) : (
                        <span className="text-xs text-gray-300 dark:text-gray-600">&mdash;</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 tabular-nums italic text-gray-500 dark:text-gray-500">
                      {row.lastYear > 0 ? (
                        fmt(row.lastYear)
                      ) : (
                        <span className="text-gray-300 dark:text-gray-600">&mdash;</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      {row.hasRealData && row.lastYear > 0 ? (
                        <DiffBadge value={row.vsLastYear} />
                      ) : (
                        <span className="text-xs text-gray-300 dark:text-gray-600">&mdash;</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>

              {/* Totals */}
              <tfoot>
                <tr className="border-t-2 border-gray-200 bg-gray-50 dark:border-gray-600 dark:bg-gray-700/30">
                  <td className="px-5 py-3.5 text-xs font-bold uppercase tracking-wider text-gray-900 dark:text-white">
                    Total
                  </td>
                  <td className="px-5 py-3.5 tabular-nums font-bold text-gray-900 dark:text-white">
                    {fmt(totals.totalReal)}
                  </td>
                  <td className="px-5 py-3.5 tabular-nums font-semibold text-gray-600 dark:text-gray-400">
                    {fmt(totals.totalBudget)}
                  </td>
                  <td className="px-5 py-3.5">
                    <DiffBadge value={totals.totalReal - totals.totalBudget} />
                  </td>
                  <td className="px-5 py-3.5 tabular-nums font-semibold italic text-gray-500 dark:text-gray-500">
                    {fmt(totals.totalLastYear)}
                  </td>
                  <td className="px-5 py-3.5">
                    <DiffBadge value={totals.totalReal - totals.totalLastYear} />
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
