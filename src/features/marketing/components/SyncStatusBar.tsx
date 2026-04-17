/**
 * features/marketing/components/SyncStatusBar.tsx
 *
 * Barra sutil de estado de sincronización.
 * Reemplaza al ETLPanel gigante — muestra estado + botón refresh discreto.
 * Cuando se está sincronizando, muestra progress.
 */
import { Spinner } from "@/components/ui/spinner/Spinner";
import type { EtlProgress } from "../hooks/useCustomerETL";

interface Props {
  isSyncing: boolean;
  progress: EtlProgress;
  lastSyncedAt: string | null;
  totalSynced: number;
  onRefresh: () => void;
}

function fmtRelative(d: string | null): string {
  if (!d) return "nunca";
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "recién";
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours}h`;
  const days = Math.floor(hours / 24);
  return `hace ${days}d`;
}

export function SyncStatusBar({ isSyncing, progress, lastSyncedAt, totalSynced, onRefresh }: Props) {
  if (isSyncing) {
    return (
      <div className="flex items-center gap-3 rounded-lg bg-brand-50 border border-brand-200 px-4 py-2.5 dark:bg-brand-500/10 dark:border-brand-500/20">
        <Spinner size="sm" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-brand-700 dark:text-brand-400">
            {progress.message || "Sincronizando datos del ERP..."}
          </p>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-brand-100 dark:bg-brand-500/20">
            <div
              className="h-full rounded-full bg-brand-500 transition-all duration-500"
              style={{ width: progressPct(progress.phase) }}
            />
          </div>
        </div>
      </div>
    );
  }

  const isError = progress.phase === "error";

  return (
    <div className={`flex items-center justify-between rounded-lg border px-4 py-2 ${
      isError
        ? "border-red-300 bg-red-50 dark:border-red-500/30 dark:bg-red-500/10"
        : "border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800"
    }`}>
      <div className="flex items-center gap-2 text-xs text-gray-500">
        {isError ? (
          <>
            <span className="inline-block h-2 w-2 rounded-full bg-red-400" />
            <span className="text-red-600 dark:text-red-400">
              Error: {progress.message}
            </span>
          </>
        ) : totalSynced === 0 ? (
          <>
            <span className="inline-block h-2 w-2 rounded-full bg-yellow-400" />
            <span>Sin datos sincronizados</span>
          </>
        ) : (
          <>
            <span className="inline-block h-2 w-2 rounded-full bg-green-400" />
            <span>
              {totalSynced.toLocaleString("es-PY")} clientes sincronizados
              <span className="text-gray-400 ml-1">· {fmtRelative(lastSyncedAt)}</span>
            </span>
          </>
        )}
      </div>
      <button
        type="button"
        onClick={onRefresh}
        className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        aria-label="Actualizar datos"
      >
        <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M14 8A6 6 0 1 1 8 2" strokeLinecap="round" />
          <path d="M14 2v6h-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {isError ? "Reintentar" : "Actualizar"}
      </button>
    </div>
  );
}

function progressPct(phase: string): string {
  switch (phase) {
    case "fetching-clim100": return "15%";
    case "fetching-transactions": return "35%";
    case "fetching-cobranzas": return "55%";
    case "processing": return "75%";
    case "upserting": return "90%";
    case "done": return "100%";
    default: return "5%";
  }
}
