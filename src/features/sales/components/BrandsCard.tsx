/**
 * features/sales/components/BrandsCard.tsx
 *
 * Brand breakdown cards with radial chart, YoY badge, margin & markdown.
 */
import Chart from "react-apexcharts";
import type { BrandBreakdownRow } from "@/queries/sales.queries";
import { calcGrossMargin, calcMarkdownDependency } from "@/domain/kpis/calculations";
import { formatPYGSuffix, formatPct, formatChange } from "@/utils/format";
import { buildBrandRadialOptions } from "./salesAnalytics.constants";

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
