/**
 * features/executive/components/MonthlyPerformanceTable.tsx
 *
 * Tabla de performance mensual con 3 métricas:
 *   - Ventas Netas (Gs.) + vs Presupuesto + vs Año Anterior
 *   - Margen Bruto (%)   + vs Presupuesto + vs Año Anterior
 *   - Unidades            + vs Presupuesto + vs Año Anterior
 *
 * V3: Columnas agrupadas con sub-headers. Datos recibidos ya filtrados.
 */
import { useMemo } from "react";
import { formatPYG, formatDiff, formatPct, formatNumber } from "@/utils/format";
import type { MonthlyRow } from "@/domain/executive/calcs";
import { MONTH_SHORT } from "@/domain/period/helpers";

// ─── Sub-components ──────────────────────────────────────────────────────────

function DiffBadge({ value }: { value: number }) {
  const positive = value >= 0;
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${
        positive
          ? "bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-400"
          : "bg-error-50 text-error-700 dark:bg-error-500/15 dark:text-error-400"
      }`}
    >
      {formatDiff(value)}
    </span>
  );
}

/** Diff badge for percentage points (pp) */
function PpBadge({ value }: { value: number }) {
  if (value === 0) return <span className="text-[10px] text-gray-300 dark:text-gray-600">—</span>;
  const positive = value >= 0;
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${
        positive
          ? "bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-400"
          : "bg-error-50 text-error-700 dark:bg-error-500/15 dark:text-error-400"
      }`}
    >
      {positive ? "+" : ""}{value.toFixed(1)}pp
    </span>
  );
}

function UnitsDiffBadge({ value }: { value: number }) {
  if (value === 0) return <span className="text-[10px] text-gray-300 dark:text-gray-600">—</span>;
  const positive = value >= 0;
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${
        positive
          ? "bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-400"
          : "bg-error-50 text-error-700 dark:bg-error-500/15 dark:text-error-400"
      }`}
    >
      {positive ? "+" : ""}{formatNumber(value)}
    </span>
  );
}

const DASH = <span className="text-[10px] text-gray-300 dark:text-gray-600">&mdash;</span>;

// ─── Main component ──────────────────────────────────────────────────────────

interface MonthlyPerformanceTableProps {
  rows: MonthlyRow[];
  highlightMonth?: number | null;
  lastDataDay?: number | null;
  calendarMonth?: number;
  isPartialMonth?: boolean;
}

export function MonthlyPerformanceTable({ rows, highlightMonth, lastDataDay, calendarMonth, isPartialMonth }: MonthlyPerformanceTableProps) {
  const totals = useMemo(() => {
    const withData = rows.filter((r) => r.hasRealData);
    const totalReal      = withData.reduce((s, r) => s + r.real, 0);
    const totalBudget    = withData.reduce((s, r) => s + r.budget, 0);
    const totalLastYear  = withData.reduce((s, r) => s + r.lastYear, 0);
    const totalCost      = withData.reduce((s, r) => s + (r.real - r.real * r.marginPct / 100), 0);
    const totalMarginPct = totalReal > 0 ? ((totalReal - totalCost) / totalReal) * 100 : 0;
    // Budget margin: weighted average
    const budgetMonths   = rows.filter((r) => r.budget > 0);
    const totalBudgetGm  = budgetMonths.reduce((s, r) => s + r.budget * r.marginBudgetPct / 100, 0);
    const totalBudgetMarginPct = totalBudget > 0 ? (totalBudgetGm / totalBudget) * 100 : 0;
    // PY margin
    const pyMonths       = rows.filter((r) => r.lastYear > 0 && r.marginPYPct > 0);
    const totalPYGm      = pyMonths.reduce((s, r) => s + r.lastYear * r.marginPYPct / 100, 0);
    const totalPYLY      = pyMonths.reduce((s, r) => s + r.lastYear, 0);
    const totalPYMarginPct = totalPYLY > 0 ? (totalPYGm / totalPYLY) * 100 : 0;
    // Units
    const totalUnits       = withData.reduce((s, r) => s + r.units, 0);
    const totalUnitsBudget = withData.reduce((s, r) => s + r.unitsBudget, 0);
    const totalUnitsPY     = withData.reduce((s, r) => s + r.unitsPY, 0);

    return {
      totalReal, totalBudget, totalLastYear,
      totalMarginPct, totalBudgetMarginPct, totalPYMarginPct,
      totalUnits, totalUnitsBudget, totalUnitsPY,
    };
  }, [rows]);

  const thBase = "px-3 py-2 text-right text-[9px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 whitespace-nowrap";
  const tdBase = "px-3 py-2 text-right";

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3 dark:border-gray-700">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
          Performance mensual
        </span>
        {isPartialMonth && lastDataDay != null && calendarMonth != null && (
          <span className="text-[11px] text-gray-400 dark:text-gray-500">
            Datos hasta {lastDataDay} {MONTH_SHORT[calendarMonth]}
          </span>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            {/* Group headers */}
            <tr className="border-b border-gray-100 dark:border-gray-700">
              <th rowSpan={2} className={`${thBase} text-left sticky left-0 bg-white dark:bg-gray-800 z-10`}>
                Mes
              </th>
              <th colSpan={3} className="px-3 py-1.5 text-center text-[9px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-gray-700 border-l border-gray-100 dark:border-gray-700">
                Ventas Netas
              </th>
              <th colSpan={3} className="px-3 py-1.5 text-center text-[9px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-gray-700 border-l border-gray-100 dark:border-gray-700">
                Margen Bruto
              </th>
              <th colSpan={3} className="px-3 py-1.5 text-center text-[9px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-gray-700 border-l border-gray-100 dark:border-gray-700">
                Unidades
              </th>
            </tr>
            {/* Sub-headers */}
            <tr className="border-b border-gray-200 dark:border-gray-600">
              {/* Ventas */}
              <th className={`${thBase} border-l border-gray-100 dark:border-gray-700`}>Real</th>
              <th className={thBase}>vs Presup.</th>
              <th className={thBase}>vs Año Ant.</th>
              {/* Margen */}
              <th className={`${thBase} border-l border-gray-100 dark:border-gray-700`}>Real</th>
              <th className={thBase}>vs Presup.</th>
              <th className={thBase}>vs Año Ant.</th>
              {/* Unidades */}
              <th className={`${thBase} border-l border-gray-100 dark:border-gray-700`}>Real</th>
              <th className={thBase}>vs Presup.</th>
              <th className={thBase}>vs Año Ant.</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
            {rows.map((row) => (
              <tr
                key={row.month}
                className={`transition-colors duration-[var(--duration-fast)] hover:bg-gray-25 dark:hover:bg-white/[0.02] ${
                  highlightMonth === row.month
                    ? "bg-brand-50/60 dark:bg-brand-500/10"
                    : row.hasRealData
                      ? "bg-white dark:bg-gray-800"
                      : "bg-gray-50/40 dark:bg-gray-800/50"
                } ${row.isCurrentMonth ? "border-l-[3px] border-l-warning-400" : ""}`}
              >
                {/* Mes */}
                <td className="px-3 py-2 sticky left-0 bg-inherit z-10">
                  <div className="flex items-center gap-1.5">
                    <span className={`font-semibold text-[12px] ${row.hasRealData ? "text-gray-800 dark:text-white" : "text-gray-300 dark:text-gray-600"}`}>
                      {row.monthLabel}
                    </span>
                    {row.isCurrentMonth && row.hasRealData && (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-warning-100 px-1 py-0.5 text-[8px] font-semibold text-warning-600 dark:bg-warning-500/15 dark:text-warning-400">
                        <span className="inline-block h-1 w-1 animate-pulse rounded-full bg-warning-500" />
                        en curso
                      </span>
                    )}
                  </div>
                </td>

                {/* ── Ventas Netas ─── */}
                <td className={`${tdBase} border-l border-gray-50 dark:border-gray-700/50 whitespace-nowrap tabular-nums text-gray-700 dark:text-gray-300`}>
                  {row.hasRealData ? formatPYG(row.real) : DASH}
                </td>
                <td className={tdBase}>
                  {row.hasRealData && row.budget > 0 ? <DiffBadge value={row.vsBudget} /> : DASH}
                </td>
                <td className={tdBase}>
                  {row.hasRealData && row.lastYear > 0 ? <DiffBadge value={row.vsLastYear} /> : DASH}
                </td>

                {/* ── Margen Bruto ─── */}
                <td className={`${tdBase} border-l border-gray-50 dark:border-gray-700/50 whitespace-nowrap tabular-nums text-gray-700 dark:text-gray-300`}>
                  {row.hasRealData ? formatPct(row.marginPct) : DASH}
                </td>
                <td className={tdBase}>
                  {row.hasRealData && row.marginBudgetPct > 0
                    ? <PpBadge value={row.marginPct - row.marginBudgetPct} />
                    : DASH}
                </td>
                <td className={tdBase}>
                  {row.hasRealData && row.marginPYPct > 0
                    ? <PpBadge value={row.marginPct - row.marginPYPct} />
                    : DASH}
                </td>

                {/* ── Unidades ─── */}
                <td className={`${tdBase} border-l border-gray-50 dark:border-gray-700/50 whitespace-nowrap tabular-nums text-gray-700 dark:text-gray-300`}>
                  {row.hasRealData && row.units > 0 ? formatNumber(row.units) : DASH}
                </td>
                <td className={tdBase}>
                  {row.hasRealData && row.units > 0 && row.unitsBudget > 0
                    ? <UnitsDiffBadge value={row.units - row.unitsBudget} />
                    : DASH}
                </td>
                <td className={tdBase}>
                  {row.hasRealData && row.units > 0 && row.unitsPY > 0
                    ? <UnitsDiffBadge value={row.units - row.unitsPY} />
                    : DASH}
                </td>
              </tr>
            ))}
          </tbody>

          <tfoot>
            <tr className="border-t-2 border-gray-200 bg-gray-25 dark:border-gray-600 dark:bg-gray-700/30">
              <td className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-widest text-gray-900 dark:text-white sticky left-0 bg-inherit z-10">
                Total
              </td>
              {/* Ventas totals */}
              <td className={`${tdBase} border-l border-gray-100 dark:border-gray-700 whitespace-nowrap tabular-nums font-bold text-gray-900 dark:text-white`}>
                {formatPYG(totals.totalReal)}
              </td>
              <td className={tdBase}>
                <DiffBadge value={totals.totalReal - totals.totalBudget} />
              </td>
              <td className={tdBase}>
                <DiffBadge value={totals.totalReal - totals.totalLastYear} />
              </td>
              {/* Margen totals */}
              <td className={`${tdBase} border-l border-gray-100 dark:border-gray-700 whitespace-nowrap tabular-nums font-bold text-gray-900 dark:text-white`}>
                {formatPct(totals.totalMarginPct)}
              </td>
              <td className={tdBase}>
                {totals.totalBudgetMarginPct > 0
                  ? <PpBadge value={totals.totalMarginPct - totals.totalBudgetMarginPct} />
                  : DASH}
              </td>
              <td className={tdBase}>
                {totals.totalPYMarginPct > 0
                  ? <PpBadge value={totals.totalMarginPct - totals.totalPYMarginPct} />
                  : DASH}
              </td>
              {/* Unidades totals */}
              <td className={`${tdBase} border-l border-gray-100 dark:border-gray-700 whitespace-nowrap tabular-nums font-bold text-gray-900 dark:text-white`}>
                {formatNumber(totals.totalUnits)}
              </td>
              <td className={tdBase}>
                {totals.totalUnitsBudget > 0
                  ? <UnitsDiffBadge value={totals.totalUnits - totals.totalUnitsBudget} />
                  : DASH}
              </td>
              <td className={tdBase}>
                {totals.totalUnitsPY > 0
                  ? <UnitsDiffBadge value={totals.totalUnits - totals.totalUnitsPY} />
                  : DASH}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
