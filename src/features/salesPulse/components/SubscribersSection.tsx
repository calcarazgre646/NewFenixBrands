/**
 * features/salesPulse/components/SubscribersSection.tsx
 *
 * Lista subscribers + form inline para agregar + toggle active + remove.
 */
import { useState } from "react";
import type { SalesPulseSubscriber } from "@/queries/salesPulse.queries";
import { PlusIcon, TrashBinIcon } from "@/icons";

interface Props {
  subscribers: SalesPulseSubscriber[];
  isLoading: boolean;
  error: Error | null;
  onAdd: (input: { email: string; name?: string | null }) => Promise<unknown>;
  onToggleActive: (id: string, active: boolean) => void;
  onRemove: (id: string) => void;
}

export function SubscribersSection({
  subscribers, isLoading, error,
  onAdd, onToggleActive, onRemove,
}: Props) {
  const [email, setEmail] = useState("");
  const [name, setName]   = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!email.trim()) {
      setFormError("Email requerido");
      return;
    }
    setSubmitting(true);
    try {
      await onAdd({ email: email.trim(), name: name.trim() || null });
      setEmail("");
      setName("");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Error al agregar");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Destinatarios</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Estos correos reciben el Sales Pulse cada lunes 8:30 AM PYT.
          </p>
        </div>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {subscribers.filter(s => s.active).length} activos / {subscribers.length} total
        </span>
      </header>

      <form onSubmit={handleAdd} className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-[2fr_1.5fr_auto]">
        <input
          type="email"
          required
          placeholder="email@empresa.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
        />
        <input
          type="text"
          placeholder="Nombre (opcional)"
          value={name}
          onChange={e => setName(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
        />
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center justify-center gap-1 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
        >
          <PlusIcon className="h-4 w-4" /> Agregar
        </button>
      </form>
      {formError && (
        <p className="mb-3 text-xs text-red-600 dark:text-red-400">{formError}</p>
      )}

      {isLoading ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Cargando…</p>
      ) : error ? (
        <p className="text-sm text-red-600 dark:text-red-400">Error: {error.message}</p>
      ) : subscribers.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Sin destinatarios cargados.</p>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-100 dark:divide-gray-800 dark:border-gray-800">
          {subscribers.map(s => (
            <li key={s.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className={`inline-block h-2 w-2 rounded-full ${s.active ? "bg-green-500" : "bg-gray-400"}`} />
                  <span className="truncate text-sm font-medium text-gray-900 dark:text-white">{s.email}</span>
                </div>
                {s.name && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">{s.name}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                  <input
                    type="checkbox"
                    checked={s.active}
                    onChange={e => onToggleActive(s.id, e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500"
                  />
                  Activo
                </label>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`¿Quitar a ${s.email} de la lista?`)) onRemove(s.id);
                  }}
                  aria-label={`Eliminar ${s.email}`}
                  className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-600 dark:hover:bg-gray-800"
                >
                  <TrashBinIcon className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
