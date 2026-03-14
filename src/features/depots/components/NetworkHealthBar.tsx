/**
 * features/depots/components/NetworkHealthBar.tsx
 *
 * Barra horizontal de distribucion de riesgo de tiendas + resumen ejecutivo.
 * Visualizacion rapida: "la red esta saludable" vs "hay problemas".
 */
import { Card } from "@/components/ui/card/Card";
import type { DepotData, DepotRisk, StoreNode } from "@/domain/depots/types";
import { formatWeeks } from "@/utils/format";

const RISK_ORDER: DepotRisk[] = ["critico", "bajo", "saludable", "alto", "sin_venta"];

const RISK_CONFIG: Record<DepotRisk, { label: string; bg: string; text: string }> = {
  critico:   { label: "Critico",   bg: "bg-error-400",   text: "text-error-700 dark:text-error-400" },
  bajo:      { label: "Bajo",      bg: "bg-warning-400", text: "text-warning-700 dark:text-warning-400" },
  saludable: { label: "Saludable", bg: "bg-success-400", text: "text-success-700 dark:text-success-400" },
  alto:      { label: "Exceso",    bg: "bg-blue-400",    text: "text-blue-700 dark:text-blue-400" },
  sin_venta: { label: "Sin venta", bg: "bg-gray-300 dark:bg-gray-600", text: "text-gray-500 dark:text-gray-400" },
};

function countByRisk(stores: StoreNode[]): Record<DepotRisk, number> {
  const counts: Record<DepotRisk, number> = {
    critico: 0, bajo: 0, saludable: 0, alto: 0, sin_venta: 0,
  };
  for (const s of stores) counts[s.risk]++;
  return counts;
}

interface Props {
  data: DepotData;
}

export default function NetworkHealthBar({ data }: Props) {
  const { stores, retails, stock } = data;
  const counts = countByRisk(stores);
  const total = stores.length;
  if (total === 0) return null;

  return (
    <Card padding="md">
      {/* Executive one-liner */}
      <div className="mb-3 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
        <span>
          RETAILS{" "}
          <strong className="text-gray-800 dark:text-gray-200">{formatWeeks(retails.weeksOnHand)}</strong>
        </span>
        <span>
          STOCK{" "}
          <strong className="text-gray-800 dark:text-gray-200">{formatWeeks(stock.weeksOnHand)}</strong>
          {" "}respaldo
        </span>
        <span>
          <strong className="text-gray-800 dark:text-gray-200">{total}</strong> tiendas en red
        </span>
      </div>

      {/* Stacked bar */}
      <div className="flex h-3 w-full overflow-hidden rounded-full">
        {RISK_ORDER.filter(r => counts[r] > 0).map(risk => (
          <div
            key={risk}
            className={`${RISK_CONFIG[risk].bg} transition-all duration-500`}
            style={{ width: `${(counts[risk] / total) * 100}%` }}
            title={`${RISK_CONFIG[risk].label}: ${counts[risk]}`}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {RISK_ORDER.filter(r => counts[r] > 0).map(risk => (
          <div key={risk} className="flex items-center gap-1.5">
            <span className={`inline-block h-2 w-2 rounded-full ${RISK_CONFIG[risk].bg}`} />
            <span className={`text-[11px] font-semibold ${RISK_CONFIG[risk].text}`}>
              {counts[risk]}
            </span>
            <span className="text-[10px] text-gray-400 dark:text-gray-500">
              {RISK_CONFIG[risk].label}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}
