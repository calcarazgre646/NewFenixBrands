/**
 * features/marketing/components/TriggerList.tsx
 *
 * Grid de cards de triggers con toggle, editar, eliminar, dry run.
 */
import { Badge } from "@/components/ui/badge/Badge";
import { Spinner } from "@/components/ui/spinner/Spinner";
import { EmptyState } from "@/components/ui/empty-state/EmptyState";
import {
  EyeIcon,
  PencilIcon,
  TrashBinIcon,
  MailIcon,
  ChatIcon,
} from "@/icons";
import type { SamTrigger, TriggerCategory, MessageChannel } from "@/domain/marketing/types";
import type { Recommendation } from "@/domain/marketing/recommendations";

interface Props {
  triggers: SamTrigger[];
  isLoading: boolean;
  onToggle: (id: string, isActive: boolean) => void;
  onEdit: (t: SamTrigger) => void;
  onDelete: (id: string) => void;
  onDryRun: (t: SamTrigger) => void;
  onCreate: () => void;
  /** Recomendación por trigger (solo se renderiza si existe para ese trigger) */
  recommendations?: Map<string, Recommendation | null>;
}

const CATEGORY_LABEL: Record<TriggerCategory, string> = {
  inactivity: "Inactividad",
  overdue: "Cobranza",
  return: "Devolucion",
  post_purchase: "Post-Compra",
  first_purchase: "1ra Compra",
  second_purchase: "2da Compra",
  high_ticket: "Ticket Alto",
  low_ticket: "Ticket Bajo",
  low_stock: "Stock Bajo",
};

const CATEGORY_COLOR: Record<TriggerCategory, string> = {
  inactivity: "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400",
  overdue: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400",
  return: "bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400",
  post_purchase: "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400",
  first_purchase: "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-400",
  second_purchase: "bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-400",
  high_ticket: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400",
  low_ticket: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400",
  low_stock: "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400",
};

const CHANNEL_CONFIG: Record<MessageChannel, { icon: React.ReactNode; label: string }> = {
  email:    { icon: <MailIcon />, label: "Email" },
  whatsapp: { icon: <ChatIcon />, label: "WhatsApp" },
  sms:      { icon: <MailIcon />, label: "SMS" },
};

const STRATEGY_STYLE: Record<Recommendation["strategy"], string> = {
  urgency:        "border-rose-200 bg-rose-50 dark:border-rose-500/30 dark:bg-rose-500/10",
  re_engagement:  "border-cyan-200 bg-cyan-50 dark:border-cyan-500/30 dark:bg-cyan-500/10",
  clearance:      "border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10",
};

export function TriggerList({ triggers, isLoading, onToggle, onEdit, onDelete, onDryRun, onCreate, recommendations }: Props) {
  if (isLoading) return <div className="flex justify-center py-12"><Spinner /></div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onCreate}
          className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
        >
          Crear Trigger
        </button>
      </div>

      {triggers.length === 0 ? (
        <EmptyState
          title="Sin triggers"
          description="Crea tu primer trigger para automatizar acciones de marketing."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {triggers.map((t) => {
            const ch = CHANNEL_CONFIG[t.channel];
            const rec = recommendations?.get(t.id) ?? null;
            return (
              <div key={t.id} className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white truncate">{t.name}</h4>
                    {t.description && (
                      <p className="mt-0.5 text-xs text-gray-400 line-clamp-2">{t.description}</p>
                    )}
                  </div>
                  <label className="relative inline-flex cursor-pointer items-center ml-2">
                    <input
                      type="checkbox"
                      checked={t.isActive}
                      onChange={(e) => onToggle(t.id, e.target.checked)}
                      className="peer sr-only"
                      aria-label={`Toggle ${t.name}`}
                    />
                    <div className="h-5 w-9 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all peer-checked:bg-brand-500 peer-checked:after:translate-x-full dark:bg-gray-600" />
                  </label>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 mb-3">
                  <Badge text={CATEGORY_LABEL[t.category]} className={CATEGORY_COLOR[t.category]} />
                  <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                    <span className="h-3.5 w-3.5">{ch.icon}</span>
                    {ch.label}
                  </span>
                </div>

                {rec && (
                  <div className={`mb-3 rounded-lg border px-3 py-2 ${STRATEGY_STYLE[rec.strategy]}`}>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Sugerencia · {rec.reason}
                    </p>
                    <p className="mt-0.5 text-xs font-medium text-gray-900 dark:text-white truncate" title={rec.description}>
                      {rec.description}
                    </p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                      {rec.brand} · {rec.sku} · {rec.dataPoint}
                    </p>
                  </div>
                )}

                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span>{t.fireCount} disparos</span>
                  <div className="flex gap-0.5">
                    <button
                      type="button"
                      onClick={() => onDryRun(t)}
                      className="flex items-center justify-center h-7 w-7 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      aria-label="Vista previa"
                    >
                      <EyeIcon className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onEdit(t)}
                      className="flex items-center justify-center h-7 w-7 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      aria-label="Editar"
                    >
                      <PencilIcon className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(t.id)}
                      className="flex items-center justify-center h-7 w-7 rounded-md hover:bg-red-50 dark:hover:bg-red-500/10 text-gray-400 hover:text-red-500"
                      aria-label="Eliminar"
                    >
                      <TrashBinIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
