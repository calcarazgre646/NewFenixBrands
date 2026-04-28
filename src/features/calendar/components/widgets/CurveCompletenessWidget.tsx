/**
 * CurveCompletenessWidget — Heatmap (sku × store) de cobertura de curva.
 *
 * Color por % cobertura: verde (≥80), ámbar (50-79), rojo (<50).
 * Tooltip con detalle de talles faltantes.
 */
import { useMemo } from "react";
import type { CurveCoverage } from "@/domain/events/types";

interface Props {
  coverages: CurveCoverage[];
  coverageBySku: Map<string, { avgCoveragePct: number; storesComplete: number; storesIncomplete: number }>;
}

function pctColor(pct: number): string {
  if (pct >= 80) return "bg-success-100 text-success-800 dark:bg-success-500/20 dark:text-success-300";
  if (pct >= 50) return "bg-warning-100 text-warning-800 dark:bg-warning-500/20 dark:text-warning-300";
  return "bg-error-100 text-error-800 dark:bg-error-500/20 dark:text-error-300";
}

export function CurveCompletenessWidget({ coverages, coverageBySku }: Props) {
  const { skus, stores, byKey } = useMemo(() => {
    const skuSet = new Set<string>();
    const storeSet = new Set<string>();
    const map = new Map<string, CurveCoverage>();
    for (const c of coverages) {
      skuSet.add(c.skuComercial);
      storeSet.add(c.store);
      map.set(`${c.skuComercial}|${c.store}`, c);
    }
    return {
      skus: Array.from(skuSet).sort(),
      stores: Array.from(storeSet).sort(),
      byKey: map,
    };
  }, [coverages]);

  if (coverages.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <h3 className="mb-1 text-sm font-semibold text-gray-900 dark:text-white">
          Cobertura de curva
        </h3>
        <div className="px-4 py-6 text-center text-sm text-gray-400">
          Agregá SKUs y tiendas para ver la cobertura.
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="border-b border-gray-100 px-4 py-3 dark:border-gray-800">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          Cobertura de curva
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          % de talles cubiertos por (SKU × tienda). El tooltip muestra qué talles faltan.
        </p>
      </div>
      <div className="overflow-x-auto p-2">
        <table className="w-full text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 bg-white px-2 py-1 text-left text-[10px] uppercase tracking-wide text-gray-500 dark:bg-gray-900">
                SKU
              </th>
              <th className="px-2 py-1 text-right text-[10px] uppercase tracking-wide text-gray-500">
                Avg
              </th>
              {stores.map((st) => (
                <th
                  key={st}
                  className="px-2 py-1 text-center text-[10px] font-mono uppercase text-gray-500"
                >
                  {st}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {skus.map((sku) => {
              const summary = coverageBySku.get(sku);
              return (
                <tr key={sku}>
                  <td className="sticky left-0 bg-white px-2 py-1 font-mono text-[11px] text-gray-700 dark:bg-gray-900 dark:text-gray-300">
                    {sku}
                  </td>
                  <td className="px-2 py-1 text-right tabular-nums text-gray-600 dark:text-gray-400">
                    {summary ? `${summary.avgCoveragePct.toFixed(0)}%` : "—"}
                  </td>
                  {stores.map((st) => {
                    const cell = byKey.get(`${sku}|${st}`);
                    if (!cell) {
                      return <td key={st} className="px-1 py-1 text-center text-gray-300">—</td>;
                    }
                    const tooltip = cell.isComplete
                      ? `Curva completa (${cell.presentTalles.length} talles)`
                      : `Faltan ${cell.missingTalles.length}: ${cell.missingTalles.join(", ") || "(SKU sin stock en la red)"}`;
                    return (
                      <td key={st} className="px-1 py-1 text-center">
                        <span
                          title={tooltip}
                          className={`inline-flex min-w-[3rem] justify-center rounded-md px-2 py-0.5 text-[11px] font-medium ${pctColor(cell.coveragePct)}`}
                        >
                          {cell.coveragePct.toFixed(0)}%
                        </span>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
