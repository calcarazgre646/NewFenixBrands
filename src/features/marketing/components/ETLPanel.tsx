/**
 * features/marketing/components/ETLPanel.tsx
 *
 * Panel de sincronización ETL: estado, estadísticas y botón para ejecutar.
 */
import { Spinner } from "@/components/ui/spinner/Spinner";
import type { EtlStats } from "@/domain/marketing/types";
import type { EtlProgress } from "../hooks/useCustomerETL";

interface Props {
  etlStats: EtlStats;
  isRunning: boolean;
  progress: EtlProgress;
  onRunETL: () => void;
}

function fmtDate(d: string | null): string {
  if (!d) return "Nunca";
  return new Date(d).toLocaleString("es-PY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ETLPanel({ etlStats, isRunning, progress, onRunETL }: Props) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Sincronización de Clientes</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Última sync: {fmtDate(etlStats.lastSyncedAt)}
          </p>
        </div>
        <button
          type="button"
          onClick={onRunETL}
          disabled={isRunning}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-600 disabled:opacity-50"
          aria-label="Sincronizar clientes"
        >
          {isRunning && <Spinner />}
          {isRunning ? "Sincronizando..." : "Sincronizar Ahora"}
        </button>
      </div>

      {/* Progress */}
      {isRunning && (
        <div className="mb-4 space-y-2">
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
            <div
              className="h-full rounded-full bg-brand-500 transition-all duration-500"
              style={{ width: progressPct(progress.phase) }}
            />
          </div>
          <p className="text-xs text-gray-500">{progress.message}</p>
        </div>
      )}

      {/* Stats grid */}
      {etlStats.totalSynced > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MiniStat label="Total Sincronizados" value={etlStats.totalSynced.toLocaleString("es-PY")} />
          <MiniStat label="Con Teléfono" value={etlStats.withPhone.toLocaleString("es-PY")} />
          <MiniStat label="Con Email" value={etlStats.withEmail.toLocaleString("es-PY")} />
          <MiniStat label="Con Ambos" value={etlStats.withBoth.toLocaleString("es-PY")} />
        </div>
      )}

      {/* Tier breakdown */}
      {etlStats.totalSynced > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          <TierPill label="VIP" count={etlStats.tierBreakdown.vip} color="bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400" />
          <TierPill label="Frecuente" count={etlStats.tierBreakdown.frequent} color="bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400" />
          <TierPill label="Ocasional" count={etlStats.tierBreakdown.occasional} color="bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400" />
          <TierPill label="En Riesgo" count={etlStats.tierBreakdown.at_risk} color="bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400" />
          <TierPill label="Inactivo" count={etlStats.tierBreakdown.inactive} color="bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400" />
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-900">
      <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">{label}</p>
      <p className="mt-0.5 text-sm font-bold tabular-nums text-gray-900 dark:text-white">{value}</p>
    </div>
  );
}

function TierPill({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${color}`}>
      {label}: {count.toLocaleString("es-PY")}
    </span>
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
    default: return "0%";
  }
}
