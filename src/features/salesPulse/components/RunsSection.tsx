/**
 * features/salesPulse/components/RunsSection.tsx
 *
 * Audit log: últimos 12 envíos (cron + manuales). Status, recipients,
 * errores, link Resend del primer email.
 */
import { useState } from "react";
import type { SalesPulseRun } from "@/queries/salesPulse.queries";

interface Props {
  runs: SalesPulseRun[];
  isLoading: boolean;
  error: Error | null;
}

const STATUS_STYLES: Record<string, string> = {
  sent:    "bg-green-50 text-green-700 ring-green-600/20 dark:bg-green-500/10 dark:text-green-400",
  partial: "bg-amber-50 text-amber-800 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-400",
  failed:  "bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-500/10 dark:text-red-400",
  pending: "bg-gray-50 text-gray-700 ring-gray-600/20 dark:bg-gray-700/40 dark:text-gray-300",
};

export function RunsSection({ runs, isLoading, error }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <header className="mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Historial de envíos</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400">Últimos 12 disparos (cron + manuales).</p>
      </header>

      {isLoading ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Cargando…</p>
      ) : error ? (
        <p className="text-sm text-red-600 dark:text-red-400">Error: {error.message}</p>
      ) : runs.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Aún no hubo envíos.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-100 dark:border-gray-800">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500 dark:bg-gray-800 dark:text-gray-400">
              <tr>
                <th className="px-3 py-2 font-medium">Fecha</th>
                <th className="px-3 py-2 font-medium">Semana</th>
                <th className="px-3 py-2 font-medium">Origen</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 text-right font-medium">Enviados</th>
                <th className="px-3 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {runs.map(r => {
                const isOpen = expanded === r.id;
                const dateLabel = new Date(r.scheduledAt).toLocaleString("es-PY", {
                  day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
                });
                return (
                  <RunRow key={r.id} run={r} dateLabel={dateLabel} isOpen={isOpen}
                          onToggle={() => setExpanded(isOpen ? null : r.id)} />
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function RunRow({ run, dateLabel, isOpen, onToggle }: {
  run: SalesPulseRun; dateLabel: string; isOpen: boolean; onToggle: () => void;
}) {
  const styleCls = STATUS_STYLES[run.status] ?? STATUS_STYLES.pending;
  return (
    <>
      <tr className="bg-white dark:bg-gray-900">
        <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{dateLabel}</td>
        <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{run.weekStart} → {run.weekEnd}</td>
        <td className="px-3 py-2 text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {run.triggeredBy}{run.isTest ? " · prueba" : ""}
        </td>
        <td className="px-3 py-2">
          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${styleCls}`}>
            {run.status}
          </span>
        </td>
        <td className="px-3 py-2 text-right tabular-nums text-gray-700 dark:text-gray-300">
          {run.recipients.length}
        </td>
        <td className="px-3 py-2 text-right">
          <button onClick={onToggle} className="text-xs text-brand-600 hover:underline dark:text-brand-400">
            {isOpen ? "Ocultar" : "Ver"}
          </button>
        </td>
      </tr>
      {isOpen && (
        <tr>
          <td colSpan={6} className="bg-gray-50 px-3 py-3 dark:bg-gray-800/40">
            <div className="grid gap-3 text-xs sm:grid-cols-2">
              <div>
                <div className="font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Destinatarios</div>
                <div className="mt-1 text-gray-700 dark:text-gray-300">
                  {run.recipients.length === 0 ? "—" : run.recipients.join(", ")}
                </div>
              </div>
              <div>
                <div className="font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Resend IDs</div>
                <div className="mt-1 break-all text-gray-700 dark:text-gray-300">
                  {run.resendIds.length === 0 ? "—" : run.resendIds.join(", ")}
                </div>
              </div>
              {run.errorMsg && (
                <div className="sm:col-span-2">
                  <div className="font-semibold uppercase tracking-wide text-red-600 dark:text-red-400">Errores</div>
                  <div className="mt-1 whitespace-pre-wrap break-words text-red-700 dark:text-red-300">{run.errorMsg}</div>
                </div>
              )}
              {!!run.payload && (
                <div className="sm:col-span-2">
                  <div className="font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Payload (snapshot)</div>
                  <pre className="mt-1 max-h-60 overflow-auto rounded bg-white p-2 text-[10px] leading-tight text-gray-700 dark:bg-gray-900 dark:text-gray-300">
{JSON.stringify(run.payload, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
