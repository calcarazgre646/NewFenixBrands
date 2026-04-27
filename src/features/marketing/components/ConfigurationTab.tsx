/**
 * features/marketing/components/ConfigurationTab.tsx
 *
 * Tab "Configuración" dentro de MarketingPage.
 * 4 secciones:
 *   1. Estado del remitente / dominio Resend
 *   2. From alias (from_email, from_name, reply_to) — editable solo super_user
 *   3. Destinatarios de prueba (chips)
 *   4. Historial de tests (últimos 20 envíos con is_test=true)
 */
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Spinner } from "@/components/ui/spinner/Spinner";
import { useEmailConfig, useTestExecutions } from "../hooks/useEmailConfig";
import type { SamEmailConfig, ExecutionWithEvents } from "@/domain/marketing/types";

export function ConfigurationTab() {
  const { permissions } = useAuth();
  const canEdit = permissions.canConfigureEmailSender;
  const { config, isLoading, updateConfig, isUpdating, error } = useEmailConfig();
  const { data: testExecs = [], isLoading: isLoadingExecs } = useTestExecutions(20);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
        Error cargando configuración: {error}
      </div>
    );
  }

  if (!config) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
        No hay configuración de email activa. Correr migration{" "}
        <code>sql/021_resend_integration.sql</code> en Supabase.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ResendStatusCard config={config} />
      <FromAliasForm
        config={config}
        canEdit={canEdit}
        onSave={(patch) => updateConfig({ id: config.id, patch })}
        isSaving={isUpdating}
      />
      <TestRecipientsManager
        config={config}
        canEdit={canEdit}
        onSave={(recipients) => updateConfig({ id: config.id, patch: { testRecipients: recipients } })}
        isSaving={isUpdating}
      />
      <TestHistoryTable executions={testExecs} isLoading={isLoadingExecs} />
    </div>
  );
}

// ─── 1. Estado de Resend ────────────────────────────────────────────────────

function ResendStatusCard({ config }: { config: SamEmailConfig }) {
  const domain = config.fromEmail.split("@")[1] ?? "—";
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Estado del remitente</h3>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Integración con Resend. El dominio debe estar verificado en Resend para que lleguen los
            emails.
          </p>
        </div>
        <a
          href="https://resend.com/domains"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-brand-500 hover:underline"
        >
          Abrir Resend →
        </a>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        <Stat label="Dominio" value={domain} />
        <Stat label="From" value={config.fromEmail} />
        <Stat label="Reply-to" value={config.replyTo ?? "—"} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
      <div className="text-[10px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {label}
      </div>
      <div className="mt-0.5 break-all text-sm text-gray-900 dark:text-white">{value}</div>
    </div>
  );
}

// ─── 2. From alias ──────────────────────────────────────────────────────────

function FromAliasForm({
  config,
  canEdit,
  onSave,
  isSaving,
}: {
  config: SamEmailConfig;
  canEdit: boolean;
  onSave: (patch: Partial<SamEmailConfig>) => Promise<void>;
  isSaving: boolean;
}) {
  const [fromEmail, setFromEmail] = useState(config.fromEmail);
  const [fromName, setFromName] = useState(config.fromName);
  const [replyTo, setReplyTo] = useState(config.replyTo ?? "");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setFromEmail(config.fromEmail);
    setFromName(config.fromName);
    setReplyTo(config.replyTo ?? "");
  }, [config.fromEmail, config.fromName, config.replyTo]);

  const isDirty =
    fromEmail !== config.fromEmail ||
    fromName !== config.fromName ||
    (replyTo || "") !== (config.replyTo ?? "");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await onSave({
      fromEmail: fromEmail.trim(),
      fromName: fromName.trim(),
      replyTo: replyTo.trim() || null,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Remitente</h3>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          El email y nombre que verán los destinatarios. Debe pertenecer a un dominio verificado en
          Resend.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label htmlFor="from-email" className="mb-1 block text-xs font-medium text-gray-500">
              From Email
            </label>
            <input
              id="from-email"
              type="email"
              value={fromEmail}
              onChange={(e) => setFromEmail(e.target.value)}
              disabled={!canEdit}
              required
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:disabled:bg-gray-800/50"
            />
          </div>
          <div>
            <label htmlFor="from-name" className="mb-1 block text-xs font-medium text-gray-500">
              Nombre a mostrar
            </label>
            <input
              id="from-name"
              type="text"
              value={fromName}
              onChange={(e) => setFromName(e.target.value)}
              disabled={!canEdit}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:disabled:bg-gray-800/50"
            />
          </div>
        </div>

        <div>
          <label htmlFor="reply-to" className="mb-1 block text-xs font-medium text-gray-500">
            Reply-to (opcional)
          </label>
          <input
            id="reply-to"
            type="email"
            value={replyTo}
            onChange={(e) => setReplyTo(e.target.value)}
            disabled={!canEdit}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:disabled:bg-gray-800/50"
          />
        </div>

        {canEdit && (
          <div className="flex items-center justify-end gap-3">
            {saved && <span className="text-xs text-emerald-600">Guardado ✓</span>}
            <button
              type="submit"
              disabled={!isDirty || isSaving}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
            >
              {isSaving && <Spinner />}
              Guardar
            </button>
          </div>
        )}

        {!canEdit && (
          <p className="text-xs text-gray-500">
            Solo <b>super_user</b> puede editar el remitente.
          </p>
        )}
      </form>
    </div>
  );
}

// ─── 3. Destinatarios de prueba ─────────────────────────────────────────────

function TestRecipientsManager({
  config,
  canEdit,
  onSave,
  isSaving,
}: {
  config: SamEmailConfig;
  canEdit: boolean;
  onSave: (recipients: string[]) => Promise<void>;
  isSaving: boolean;
}) {
  const [recipients, setRecipients] = useState<string[]>(config.testRecipients);
  const [input, setInput] = useState("");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setRecipients(config.testRecipients);
  }, [config.testRecipients]);

  function addRecipient() {
    const v = input.trim().toLowerCase();
    if (!v) return;
    if (!v.includes("@") || v.length < 5) {
      setErr("Email inválido");
      return;
    }
    if (recipients.includes(v)) {
      setErr("Ya está en la lista");
      return;
    }
    const next = [...recipients, v];
    setRecipients(next);
    setInput("");
    setErr(null);
    onSave(next);
  }

  function removeRecipient(email: string) {
    const next = recipients.filter((r) => r !== email);
    setRecipients(next);
    onSave(next);
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          Destinatarios de prueba
        </h3>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Emails internos a los que se pueden mandar tests desde los templates. No se usan en
          envíos automáticos.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {recipients.length === 0 && (
          <span className="text-xs text-gray-400 italic">Sin destinatarios configurados</span>
        )}
        {recipients.map((r) => (
          <span
            key={r}
            className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-300"
          >
            {r}
            {canEdit && (
              <button
                type="button"
                onClick={() => removeRecipient(r)}
                disabled={isSaving}
                aria-label={`Quitar ${r}`}
                className="text-gray-400 hover:text-red-500"
              >
                ×
              </button>
            )}
          </span>
        ))}
      </div>

      {canEdit && (
        <div className="mt-3 flex gap-2">
          <input
            type="email"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setErr(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addRecipient();
              }
            }}
            placeholder="test@fenixbrands.com.py"
            className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          />
          <button
            type="button"
            onClick={addRecipient}
            disabled={!input || isSaving}
            className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-black disabled:opacity-50 dark:bg-gray-200 dark:text-gray-900 dark:hover:bg-white"
          >
            Agregar
          </button>
        </div>
      )}
      {err && <p className="mt-1 text-xs text-red-500">{err}</p>}
    </div>
  );
}

// ─── 4. Historial de tests ──────────────────────────────────────────────────

function TestHistoryTable({
  executions,
  isLoading,
}: {
  executions: ExecutionWithEvents[];
  isLoading: boolean;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Historial de tests</h3>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Últimos 20 envíos de prueba con tracking del webhook de Resend.
        </p>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-6">
          <Spinner />
        </div>
      )}

      {!isLoading && executions.length === 0 && (
        <div className="py-6 text-center text-sm text-gray-400">
          Sin envíos aún. Mandá una prueba desde cualquier template.
        </div>
      )}

      {!isLoading && executions.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500 dark:border-gray-700">
                <th className="py-2 pr-3 font-medium">Fecha</th>
                <th className="py-2 pr-3 font-medium">Destinatario</th>
                <th className="py-2 pr-3 font-medium">Asunto</th>
                <th className="py-2 pr-3 font-medium">Estado</th>
                <th className="py-2 pr-3 font-medium">Eventos</th>
              </tr>
            </thead>
            <tbody>
              {executions.map((x) => (
                <tr key={x.execution.id} className="border-b border-gray-100 dark:border-gray-800">
                  <td className="py-2 pr-3 text-gray-700 dark:text-gray-300">
                    {formatDateTime(x.execution.createdAt)}
                  </td>
                  <td className="py-2 pr-3 break-all text-gray-700 dark:text-gray-300">
                    {x.execution.toEmail ?? "—"}
                  </td>
                  <td className="py-2 pr-3 text-gray-700 dark:text-gray-300">
                    {x.execution.subjectSnapshot ?? "—"}
                  </td>
                  <td className="py-2 pr-3">
                    <StatusBadge status={x.execution.status} bounceReason={x.execution.bounceReason} />
                  </td>
                  <td className="py-2 pr-3 text-gray-500 dark:text-gray-400">
                    {x.events.length === 0
                      ? "—"
                      : x.events.map((e) => shortenEvent(e.eventType)).join(", ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status, bounceReason }: { status: string; bounceReason: string | null }) {
  const map: Record<string, string> = {
    pending: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
    sent: "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300",
    delivered: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300",
    opened: "bg-violet-50 text-violet-700 dark:bg-violet-900/20 dark:text-violet-300",
    clicked: "bg-violet-50 text-violet-700 dark:bg-violet-900/20 dark:text-violet-300",
    failed: "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300",
  };
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${map[status] ?? map.pending}`}
      title={bounceReason ?? undefined}
    >
      {status}
      {bounceReason && status === "failed" ? ` · ${bounceReason}` : ""}
    </span>
  );
}

function formatDateTime(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("es-PY", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function shortenEvent(evType: string): string {
  return evType.replace(/^email\./, "");
}
