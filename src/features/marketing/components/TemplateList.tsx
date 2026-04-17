/**
 * features/marketing/components/TemplateList.tsx
 *
 * Lista de templates agrupados por canal.
 */
import { useState } from "react";
import { Badge } from "@/components/ui/badge/Badge";
import { Spinner } from "@/components/ui/spinner/Spinner";
import { EmptyState } from "@/components/ui/empty-state/EmptyState";
import type { SamTemplate, MessageChannel } from "@/domain/marketing/types";

interface Props {
  templates: SamTemplate[];
  isLoading: boolean;
  onEdit: (t: SamTemplate) => void;
  onCreate: () => void;
}

const CHANNEL_TABS: { key: MessageChannel | "all"; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "email", label: "Email" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "sms", label: "SMS" },
];

const CHANNEL_BADGE: Record<MessageChannel, string> = {
  email: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400",
  whatsapp: "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400",
  sms: "bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400",
};

function countVariables(body: string): number {
  return (body.match(/\{\{[^}]+\}\}/g) ?? []).length;
}

export function TemplateList({ templates, isLoading, onEdit, onCreate }: Props) {
  const [channelFilter, setChannelFilter] = useState<MessageChannel | "all">("all");

  const filtered = channelFilter === "all"
    ? templates
    : templates.filter((t) => t.channel === channelFilter);

  if (isLoading) return <div className="flex justify-center py-12"><Spinner /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {CHANNEL_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setChannelFilter(tab.key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                channelFilter === tab.key
                  ? "bg-brand-500 text-white"
                  : "text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onCreate}
          className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
        >
          Crear Template
        </button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="Sin templates"
          description="Creá templates de mensaje para usar en los triggers."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onEdit(t)}
              className="rounded-2xl border border-gray-200 bg-white p-4 text-left transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
            >
              <div className="flex items-start justify-between mb-2">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white truncate">{t.name}</h4>
                <Badge text={t.channel.toUpperCase()} className={CHANNEL_BADGE[t.channel]} />
              </div>
              {t.subject && (
                <p className="text-xs text-gray-500 mb-1 truncate">Asunto: {t.subject}</p>
              )}
              <p className="text-xs text-gray-400 line-clamp-3">{t.body}</p>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-[10px] text-gray-400">
                  {countVariables(t.body)} variable{countVariables(t.body) !== 1 ? "s" : ""}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
