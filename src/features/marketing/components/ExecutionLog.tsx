/**
 * features/marketing/components/ExecutionLog.tsx
 *
 * Tabla de ejecuciones SAM con filtros y paginación.
 */
import { Badge } from "@/components/ui/badge/Badge";
import { Spinner } from "@/components/ui/spinner/Spinner";
import type { SamExecution, ExecutionStatus } from "@/domain/marketing/types";

interface Props {
  executions: SamExecution[];
  total: number;
  isLoading: boolean;
  page: number;
  onPageChange: (p: number) => void;
  triggerFilter: string | null;
  onTriggerFilterChange: (v: string | null) => void;
  statusFilter: ExecutionStatus | null;
  onStatusFilterChange: (v: ExecutionStatus | null) => void;
}

const STATUS_BADGE: Record<ExecutionStatus, { text: string; className: string }> = {
  pending: { text: "Pendiente", className: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400" },
  sent: { text: "Enviado", className: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400" },
  delivered: { text: "Entregado", className: "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400" },
  opened: { text: "Abierto", className: "bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400" },
  clicked: { text: "Clic", className: "bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-400" },
  failed: { text: "Error", className: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400" },
};

const PAGE_SIZE = 50;

function fmtDate(d: string): string {
  return new Date(d).toLocaleString("es-PY", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

export function ExecutionLog({
  executions, total, isLoading, page, onPageChange,
  triggerFilter, onTriggerFilterChange,
  statusFilter, onStatusFilterChange,
}: Props) {
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={statusFilter ?? ""}
          onChange={(e) => onStatusFilterChange((e.target.value || null) as ExecutionStatus | null)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
          aria-label="Filtrar por status"
        >
          <option value="">Todos los status</option>
          {(Object.keys(STATUS_BADGE) as ExecutionStatus[]).map((s) => (
            <option key={s} value={s}>{STATUS_BADGE[s].text}</option>
          ))}
        </select>
        {triggerFilter && (
          <button type="button" onClick={() => onTriggerFilterChange(null)}
            className="text-xs text-brand-500 hover:underline">
            Limpiar filtro trigger
          </button>
        )}
        <span className="text-xs text-gray-400">{total.toLocaleString("es-PY")} ejecuciones</span>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : executions.length === 0 ? (
        <p className="py-12 text-center text-sm text-gray-400">Sin ejecuciones registradas.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Trigger</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Canal</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {executions.map((e) => {
                const statusInfo = STATUS_BADGE[e.status];
                return (
                  <tr key={e.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-600 dark:text-gray-400">{fmtDate(e.createdAt)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600 dark:text-gray-400">{e.triggerId.slice(0, 8)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600 dark:text-gray-400">{e.customerId.slice(0, 8)}</td>
                    <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400">{e.channel}</td>
                    <td className="px-4 py-3"><Badge text={statusInfo.text} className={statusInfo.className} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>Página {page + 1} de {totalPages}</span>
          <div className="flex gap-2">
            <button type="button" disabled={page === 0} onClick={() => onPageChange(page - 1)}
              className="rounded-lg border border-gray-200 px-3 py-1.5 disabled:opacity-40 hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
              aria-label="Página anterior">
              Anterior
            </button>
            <button type="button" disabled={page >= totalPages - 1} onClick={() => onPageChange(page + 1)}
              className="rounded-lg border border-gray-200 px-3 py-1.5 disabled:opacity-40 hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
              aria-label="Página siguiente">
              Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
