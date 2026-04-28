/**
 * EventHistoryWidget — Historial de decisiones tomadas en el evento.
 *
 * Cada propuesta aprobada genera un decision_run + N decision_actions con
 * snapshot de stock al momento. Esta vista cierra visualmente el closed-loop
 * Palantir-style: "qué decidimos, cuándo, con qué información".
 */
import { useState } from "react";
import {
  useEventDecisionRuns,
  useEventDecisionActions,
} from "../../hooks/useEventDecisionHistory";

interface Props {
  eventId: string | null | undefined;
}

const RISK_CLS: Record<string, string> = {
  critical:  "bg-error-100 text-error-700 dark:bg-error-500/20 dark:text-error-400",
  low:       "bg-warning-100 text-warning-700 dark:bg-warning-500/20 dark:text-warning-400",
  balanced:  "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
  overstock: "bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300",
};

const LEVEL_LABEL: Record<string, string> = {
  store_to_store:   "Tienda → Tienda",
  depot_to_store:   "Depósito → Tienda",
  central_to_depot: "Central → Depósito",
  central_to_b2b:   "Central → B2B",
};

function formatGs(n: number): string {
  return `₲ ${Math.round(n).toLocaleString("es-PY")}`;
}

export function EventHistoryWidget({ eventId }: Props) {
  const runsQ = useEventDecisionRuns(eventId);
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="border-b border-gray-100 px-4 py-3 dark:border-gray-800">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          Historial de decisiones
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Cada aprobación queda registrada con snapshot del stock al momento.
        </p>
      </div>

      {runsQ.isLoading ? (
        <div className="px-4 py-6 text-center text-sm text-gray-400">Cargando...</div>
      ) : runsQ.error ? (
        <div className="px-4 py-6 text-center text-sm text-error-600">
          {runsQ.error instanceof Error ? runsQ.error.message : "Error"}
        </div>
      ) : !runsQ.data || runsQ.data.length === 0 ? (
        <div className="px-4 py-6 text-center text-sm text-gray-400">
          Sin decisiones registradas. Aprobá una propuesta para verla acá.
        </div>
      ) : (
        <ul className="divide-y divide-gray-100 dark:divide-gray-700">
          {runsQ.data.map((run) => {
            const isExpanded = expandedRunId === run.id;
            return (
              <li key={run.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-full bg-success-100 px-2 py-0.5 text-xs font-medium text-success-700 dark:bg-success-500/20 dark:text-success-300">
                    Aprobada
                  </span>
                  {run.proposalVersion !== null && (
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">
                      v{run.proposalVersion}
                    </span>
                  )}
                  <span className="text-xs text-gray-500">
                    {run.totalActions} líneas · {formatGs(run.totalImpactGs)}
                  </span>
                  {run.criticalCount > 0 && (
                    <span className="text-xs text-error-600 dark:text-error-400">
                      ⚠ {run.criticalCount} crítica{run.criticalCount === 1 ? "" : "s"}
                    </span>
                  )}
                  {run.readinessPctAtApproval !== null && (
                    <span className="text-xs text-gray-500">
                      Readiness al aprobar: {run.readinessPctAtApproval.toFixed(1)}%
                    </span>
                  )}
                  <span className="ml-auto text-xs text-gray-400">
                    {new Date(run.triggeredAt).toLocaleString("es-PY")}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setExpandedRunId(isExpanded ? null : run.id)}
                  className="mt-2 text-xs text-brand-600 hover:underline"
                >
                  {isExpanded ? "Ocultar snapshot" : "Ver snapshot de decisiones"}
                </button>

                {isExpanded && <ActionsTable runId={run.id} />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ActionsTable({ runId }: { runId: string }) {
  const actionsQ = useEventDecisionActions(runId);

  if (actionsQ.isLoading) {
    return <div className="mt-2 px-3 py-2 text-xs text-gray-400">Cargando snapshot...</div>;
  }
  if (actionsQ.error || !actionsQ.data) {
    return <div className="mt-2 px-3 py-2 text-xs text-error-600">Error cargando snapshot.</div>;
  }
  if (actionsQ.data.length === 0) {
    return <div className="mt-2 px-3 py-2 text-xs text-gray-400">Sin acciones en este run.</div>;
  }

  return (
    <div className="mt-2 max-h-80 overflow-y-auto rounded-lg border border-gray-100 dark:border-gray-700">
      <table className="w-full text-xs">
        <thead className="bg-gray-50 text-[10px] uppercase tracking-wide text-gray-500 dark:bg-gray-800 dark:text-gray-400">
          <tr>
            <th className="px-2 py-1 text-left">SKU · Talle</th>
            <th className="px-2 py-1 text-left">Ruta</th>
            <th className="px-2 py-1 text-left">Tipo</th>
            <th className="px-2 py-1 text-right">Stock al momento</th>
            <th className="px-2 py-1 text-right">Mover</th>
            <th className="px-2 py-1 text-left">Riesgo</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
          {actionsQ.data.map((a) => (
            <tr key={a.id}>
              <td className="px-2 py-1 font-mono text-gray-700 dark:text-gray-300">
                {a.skuComercial} · {a.talle}
              </td>
              <td className="px-2 py-1 text-gray-600 dark:text-gray-400">
                {a.targetStore ?? "—"} → {a.store}
              </td>
              <td className="px-2 py-1 text-gray-600 dark:text-gray-400">
                {LEVEL_LABEL[a.waterfallLevel] ?? a.waterfallLevel}
              </td>
              <td className="px-2 py-1 text-right tabular-nums text-gray-700 dark:text-gray-300">
                {a.currentStock}
              </td>
              <td className="px-2 py-1 text-right tabular-nums text-gray-900 dark:text-white">
                {a.suggestedUnits}
              </td>
              <td className="px-2 py-1">
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${RISK_CLS[a.risk] ?? RISK_CLS.balanced}`}
                >
                  {a.risk}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
