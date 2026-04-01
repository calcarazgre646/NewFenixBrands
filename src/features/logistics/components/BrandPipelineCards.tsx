/**
 * BrandPipelineCards.tsx
 *
 * 3 cards por marca con metricas de pipeline.
 * Proporcion visual con barra CSS (width %).
 */
import { Card } from "@/components/ui/card/Card";
import type { BrandPipelineDetail } from "@/domain/logistics/types";
import { formatFob, ERP_STATUS_STYLE, erpStatusLabel } from "./logistics.shared";

interface Props {
  pipeline: BrandPipelineDetail[];
}

export function BrandPipelineCards({ pipeline }: Props) {
  if (pipeline.length === 0) return null;

  return (
    <Card padding="md">
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
        Pipeline por Marca
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {pipeline.map(b => (
          <div
            key={b.brandNorm}
            className="rounded-xl border border-gray-100 bg-gray-50/50 p-3 dark:border-gray-700 dark:bg-white/[0.02]"
          >
            <p className="text-xs font-bold text-gray-800 dark:text-gray-200">
              {b.brand}
            </p>
            <div className="mt-2 space-y-1 text-xs text-gray-500 dark:text-gray-400">
              <div className="flex justify-between">
                <span>{b.orderCount} orden{b.orderCount !== 1 ? "es" : ""}</span>
                <span className="font-semibold text-gray-700 dark:text-gray-300">
                  {b.totalUnits.toLocaleString("es-PY")} uds
                </span>
              </div>
              <div className="flex justify-between">
                <span>FOB</span>
                <span className="font-semibold text-gray-700 dark:text-gray-300">
                  {formatFob(b.fobUSD)}
                </span>
              </div>
              {b.nextEta && (
                <div className="flex justify-between">
                  <span>Prox.</span>
                  <span className="font-semibold text-brand-600 dark:text-brand-400">
                    {b.nextEta}
                  </span>
                </div>
              )}
            </div>
            {/* ERP status pills */}
            {Object.keys(b.byErpStatus).length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {Object.entries(b.byErpStatus)
                  .filter(([k]) => k !== "Sin estado")
                  .map(([status, count]) => (
                    <span
                      key={status}
                      className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium ${ERP_STATUS_STYLE[status] ?? "bg-gray-100 text-gray-500"}`}
                    >
                      {count} {erpStatusLabel(status)}
                    </span>
                  ))}
              </div>
            )}
            {/* Share bar */}
            <div className="mt-2.5">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                <div
                  className="h-full rounded-full bg-brand-500 transition-all duration-500"
                  style={{ width: `${b.sharePct}%` }}
                />
              </div>
              <p className="mt-0.5 text-right text-[10px] font-semibold text-gray-400 dark:text-gray-500">
                {b.sharePct}%
              </p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
