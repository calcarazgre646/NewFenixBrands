/**
 * features/marketing/components/CampaignCard.tsx
 *
 * Card de campaña SAM.
 */
import { Badge } from "@/components/ui/badge/Badge";
import type { SamCampaign, CampaignStatus } from "@/domain/marketing/types";

interface Props {
  campaign: SamCampaign;
  onEdit: (c: SamCampaign) => void;
  triggerCount?: number;
}

const STATUS_BADGE: Record<CampaignStatus, { text: string; className: string }> = {
  draft: { text: "Borrador", className: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400" },
  active: { text: "Activa", className: "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400" },
  paused: { text: "Pausada", className: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400" },
  completed: { text: "Completada", className: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400" },
};

function fmtDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-PY", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtBudget(b: number | null): string {
  if (b == null) return "—";
  return `₲ ${b.toLocaleString("es-PY")}`;
}

export function CampaignCard({ campaign, onEdit, triggerCount = 0 }: Props) {
  const statusInfo = STATUS_BADGE[campaign.status];

  return (
    <button
      type="button"
      onClick={() => onEdit(campaign)}
      className="rounded-2xl border border-gray-200 bg-white p-4 text-left transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-800 w-full"
    >
      <div className="flex items-start justify-between mb-2">
        <h4 className="text-sm font-semibold text-gray-900 dark:text-white truncate">{campaign.name}</h4>
        <Badge text={statusInfo.text} className={statusInfo.className} />
      </div>

      {campaign.description && (
        <p className="text-xs text-gray-400 line-clamp-2 mb-3">{campaign.description}</p>
      )}

      <div className="space-y-1 text-xs text-gray-500">
        <div className="flex justify-between">
          <span>Inicio</span>
          <span>{fmtDate(campaign.startDate)}</span>
        </div>
        <div className="flex justify-between">
          <span>Fin</span>
          <span>{fmtDate(campaign.endDate)}</span>
        </div>
        <div className="flex justify-between">
          <span>Presupuesto</span>
          <span className="font-medium text-gray-700 dark:text-gray-300">{fmtBudget(campaign.budget)}</span>
        </div>
        <div className="flex justify-between">
          <span>Triggers</span>
          <span className={triggerCount > 0 ? "font-medium text-brand-600 dark:text-brand-400" : ""}>
            {triggerCount} vinculado{triggerCount !== 1 ? "s" : ""}
          </span>
        </div>
      </div>
    </button>
  );
}
