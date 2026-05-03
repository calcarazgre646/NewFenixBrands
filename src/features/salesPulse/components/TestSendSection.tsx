/**
 * features/salesPulse/components/TestSendSection.tsx
 *
 * Pruebas: dry-run (preview HTML inline) + envío real a un email puntual.
 */
import { useState } from "react";
import type { TriggerTestSendInput, TriggerTestSendResult } from "@/queries/salesPulse.queries";

interface Props {
  isPending: boolean;
  onTrigger: (input: TriggerTestSendInput) => Promise<TriggerTestSendResult>;
}

export function TestSendSection({ isPending, onTrigger }: Props) {
  const [recipient, setRecipient] = useState("");
  const [weekStart, setWeekStart] = useState("");
  const [result, setResult]   = useState<TriggerTestSendResult | null>(null);
  const [error, setError]     = useState<string | null>(null);

  const reset = () => { setResult(null); setError(null); };

  const buildInput = (dryRun: boolean): TriggerTestSendInput => {
    const input: TriggerTestSendInput = { dryRun };
    if (recipient.trim()) input.recipients = [recipient.trim()];
    if (weekStart) input.weekStart = weekStart;
    return input;
  };

  const handlePreview = async () => {
    reset();
    try {
      setResult(await onTrigger(buildInput(true)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error en preview");
    }
  };

  const handleSend = async () => {
    reset();
    if (!recipient.trim()) {
      setError("Para enviar real, especificá un email destinatario.");
      return;
    }
    if (!confirm(`¿Enviar Sales Pulse real a ${recipient.trim()}?`)) return;
    try {
      setResult(await onTrigger(buildInput(false)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error en envío");
    }
  };

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <header className="mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Pruebas y envío manual</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Dry-run muestra el HTML que se enviaría sin tocar Resend. Envío real registra en historial.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <input
            type="email"
            placeholder="Email destinatario (opcional para preview)"
            value={recipient}
            onChange={e => setRecipient(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          />
          <input
            type="date"
            value={weekStart}
            onChange={e => setWeekStart(e.target.value)}
            placeholder="Lunes (default: anterior)"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handlePreview}
            disabled={isPending}
            className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Vista previa
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={isPending}
            className="inline-flex items-center justify-center rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
          >
            Enviar prueba real
          </button>
        </div>
      </div>

      {isPending && (
        <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">Procesando…</p>
      )}

      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">
          {error}
        </p>
      )}

      {result && (
        <div className="mt-4 space-y-3">
          <div className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-700 dark:bg-gray-800/50 dark:text-gray-300">
            <strong>Status:</strong> {result.status}
            {" · "}
            <strong>Semana:</strong> {result.weekStart} → {result.weekEnd}
            {result.subject && <>{" · "}<strong>Subject:</strong> {result.subject}</>}
            {typeof result.sentCount === "number" && <>{" · "}<strong>Enviados:</strong> {result.sentCount}/{result.recipientsCount ?? "?"}</>}
          </div>

          {result.errors && result.errors.length > 0 && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-500/10 dark:text-red-400">
              <strong>Errores:</strong>
              <ul className="mt-1 list-disc pl-5">
                {result.errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}

          {result.htmlPreview && (
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Vista previa del email
              </div>
              <iframe
                title="Vista previa Sales Pulse"
                srcDoc={result.htmlPreview}
                className="h-[640px] w-full rounded-lg border border-gray-200 bg-white dark:border-gray-700"
                sandbox=""
              />
            </div>
          )}
        </div>
      )}
    </section>
  );
}
