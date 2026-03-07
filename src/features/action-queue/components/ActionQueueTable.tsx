/**
 * features/action-queue/components/ActionQueueTable.tsx
 *
 * Table component for the action queue.
 * 13-column table with risk/level badges, counterpart stores, and Pareto flags.
 */
import type { ActionItemFull } from "@/domain/actionQueue/waterfall";
import type { RiskLevel, WaterfallLevel, ActionType, StoreCluster } from "@/domain/actionQueue/types";

// ─── Badge helpers ───────────────────────────────────────────────────────────

const RISK_STYLES: Record<RiskLevel, string> = {
  critical:  "bg-error-100 text-error-700 dark:bg-error-500/15 dark:text-error-400",
  low:       "bg-warning-100 text-warning-700 dark:bg-warning-500/15 dark:text-warning-400",
  overstock: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400",
  balanced:  "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400",
};

const RISK_LABELS: Record<RiskLevel, string> = {
  critical:  "Sin Stock",
  low:       "Stock Bajo",
  overstock: "Sobrestock",
  balanced:  "Balanceado",
};

const LEVEL_STYLES: Record<WaterfallLevel, string> = {
  store_to_store:   "bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-400",
  depot_to_store:   "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-400",
  central_to_depot: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400",
  central_to_b2b:   "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
};

const LEVEL_LABELS: Record<WaterfallLevel, string> = {
  store_to_store:   "Tienda↔Tienda",
  depot_to_store:   "Deposito→Tienda",
  central_to_depot: "Central→Deposito",
  central_to_b2b:   "Central→B2B",
};

const ACTION_LABELS: Record<ActionType, string> = {
  transfer:           "Transferir",
  restock_from_depot: "Reponer",
  resupply_depot:     "Resurtir Dep.",
  central_to_b2b:     "Envio B2B",
};

const CLUSTER_STYLES: Record<StoreCluster, string> = {
  A:   "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  B:   "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400",
  OUT: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-400",
};

function Badge({ text, className }: { text: string; className: string }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold ${className}`}>
      {text}
    </span>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

interface Props {
  items: ActionItemFull[];
  showHistory: boolean;
}

export function ActionQueueTable({ items, showHistory }: Props) {
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center dark:border-gray-700 dark:bg-gray-800">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No se encontraron acciones con los filtros actuales.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      <table className="w-full min-w-[1320px] text-left text-xs">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
            <Th>#</Th>
            <Th>Tienda</Th>
            <Th>SKU</Th>
            <Th>Talle</Th>
            <Th>Marca</Th>
            <Th>Linea</Th>
            <Th>Categoria</Th>
            <Th>Riesgo</Th>
            <Th>Nivel</Th>
            <Th>Accion</Th>
            <Th>Unidades</Th>
            {showHistory && <Th>Prom/Mes</Th>}
            <Th>Horario</Th>
            <Th>Accion Recomendada</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
          {items.map((item) => (
            <tr
              key={item.id}
              className={`transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/30 ${
                item.paretoFlag ? "bg-amber-50/50 dark:bg-amber-500/5" : ""
              }`}
            >
              {/* Rank + Pareto */}
              <td className="px-3 py-2.5">
                <span className="font-bold text-gray-900 dark:text-white">{item.rank}</span>
                {item.paretoFlag && (
                  <span className="ml-1 text-[9px] font-bold text-amber-600 dark:text-amber-400">TOP</span>
                )}
              </td>

              {/* Store + Cluster */}
              <td className="px-3 py-2.5">
                <span className="font-semibold text-gray-900 dark:text-white">{item.store}</span>
                {item.storeCluster && (
                  <Badge text={item.storeCluster} className={`ml-1 ${CLUSTER_STYLES[item.storeCluster]}`} />
                )}
              </td>

              {/* SKU + Description */}
              <td className="max-w-[180px] px-3 py-2.5">
                <span className="font-semibold text-gray-900 dark:text-white">{item.sku}</span>
                <p className="mt-0.5 truncate text-[10px] text-gray-400 dark:text-gray-500">
                  {item.description}
                </p>
              </td>

              {/* Talle */}
              <td className="px-3 py-2.5 text-gray-700 dark:text-gray-300">{item.talle}</td>

              {/* Brand */}
              <td className="px-3 py-2.5 text-gray-700 dark:text-gray-300">{item.brand}</td>

              {/* Linea */}
              <td className="px-3 py-2.5">
                {item.linea && item.linea !== "Sin linea" ? (
                  <Badge text={item.linea} className="bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400" />
                ) : (
                  <span className="text-gray-400">—</span>
                )}
              </td>

              {/* Categoria */}
              <td className="px-3 py-2.5">
                {item.categoria && item.categoria !== "Sin categoria" ? (
                  <Badge text={item.categoria} className="bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-400" />
                ) : (
                  <span className="text-gray-400">—</span>
                )}
              </td>

              {/* Risk */}
              <td className="px-3 py-2.5">
                <Badge text={RISK_LABELS[item.risk]} className={RISK_STYLES[item.risk]} />
              </td>

              {/* Waterfall Level */}
              <td className="px-3 py-2.5">
                <Badge text={LEVEL_LABELS[item.waterfallLevel]} className={LEVEL_STYLES[item.waterfallLevel]} />
              </td>

              {/* Action Type */}
              <td className="px-3 py-2.5">
                <span className="text-gray-700 dark:text-gray-300">
                  {ACTION_LABELS[item.actionType]}
                </span>
              </td>

              {/* Units */}
              <td className="px-3 py-2.5">
                <span className="font-bold text-gray-900 dark:text-white">{item.suggestedUnits}</span>
                <span className="ml-1 text-[10px] text-gray-400">
                  (stock: {item.currentStock})
                </span>
              </td>

              {/* Historical Avg */}
              {showHistory && (
                <td className="px-3 py-2.5 text-gray-600 dark:text-gray-400">
                  {item.historicalAvg > 0 ? item.historicalAvg.toFixed(1) : "—"}
                </td>
              )}

              {/* Time restriction + best day */}
              <td className="max-w-[140px] px-3 py-2.5">
                <span className="text-gray-700 dark:text-gray-300">{item.timeRestriction}</span>
                {item.bestDay !== "—" && (
                  <p className="mt-0.5 text-[10px] text-gray-400">Mejor dia: {item.bestDay}</p>
                )}
              </td>

              {/* Recommended Action */}
              <td className="max-w-[220px] px-3 py-2.5">
                <p className="text-gray-700 dark:text-gray-300">{item.recommendedAction}</p>
                {item.counterpartStores.length > 1 && (
                  <p className="mt-0.5 text-[10px] text-gray-400">
                    +{item.counterpartStores.length - 1} tiendas mas
                  </p>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
      {children}
    </th>
  );
}
