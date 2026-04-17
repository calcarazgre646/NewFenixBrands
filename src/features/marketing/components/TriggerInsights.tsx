/**
 * features/marketing/components/TriggerInsights.tsx
 *
 * Vista principal de insights: por cada trigger activo, muestra cuántos
 * clientes matchean la condición. Esto es lo que el equipo de marketing ve.
 */
import { Badge } from "@/components/ui/badge/Badge";
import {
  TimeIcon,
  DollarLineIcon,
  ShootingStarIcon,
  CheckCircleIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  BoxIcon,
  AlertIcon,
} from "@/icons";
import type { TriggerInsight, TriggerCategory, MessageChannel } from "@/domain/marketing/types";

interface Props {
  insights: TriggerInsight[];
  onToggle: (id: string, isActive: boolean) => void;
}

const CATEGORY_CONFIG: Record<TriggerCategory, { icon: React.ReactNode; color: string; bgColor: string }> = {
  inactivity:      { icon: <TimeIcon />,          color: "text-orange-600 dark:text-orange-400", bgColor: "bg-orange-50 dark:bg-orange-500/10 border-orange-200 dark:border-orange-500/20" },
  overdue:         { icon: <DollarLineIcon />,    color: "text-red-600 dark:text-red-400",       bgColor: "bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20" },
  post_purchase:   { icon: <CheckCircleIcon />,   color: "text-green-600 dark:text-green-400",   bgColor: "bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/20" },
  first_purchase:  { icon: <ShootingStarIcon />,  color: "text-cyan-600 dark:text-cyan-400",     bgColor: "bg-cyan-50 dark:bg-cyan-500/10 border-cyan-200 dark:border-cyan-500/20" },
  second_purchase: { icon: <ArrowRightIcon />,    color: "text-teal-600 dark:text-teal-400",     bgColor: "bg-teal-50 dark:bg-teal-500/10 border-teal-200 dark:border-teal-500/20" },
  high_ticket:     { icon: <ArrowUpIcon />,       color: "text-amber-600 dark:text-amber-400",   bgColor: "bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20" },
  low_ticket:      { icon: <ArrowDownIcon />,     color: "text-blue-600 dark:text-blue-400",     bgColor: "bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20" },
  low_stock:       { icon: <BoxIcon />,           color: "text-rose-600 dark:text-rose-400",     bgColor: "bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20" },
  return:          { icon: <AlertIcon />,         color: "text-purple-600 dark:text-purple-400", bgColor: "bg-purple-50 dark:bg-purple-500/10 border-purple-200 dark:border-purple-500/20" },
};

const CHANNEL_LABEL: Record<MessageChannel, string> = {
  email: "Email",
  whatsapp: "WhatsApp",
  sms: "SMS",
};

const CHANNEL_COLOR: Record<MessageChannel, string> = {
  email: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400",
  whatsapp: "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400",
  sms: "bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400",
};

function fmt(n: number): string {
  return n.toLocaleString("es-PY");
}

export function TriggerInsights({ insights, onToggle }: Props) {
  if (insights.length === 0) return null;

  // Sort: active first, then by match count desc
  const sorted = [...insights].sort((a, b) => {
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
    return b.matchCount - a.matchCount;
  });

  const totalReach = sorted
    .filter((i) => i.isActive && i.matchCount > 0)
    .reduce((sum, i) => sum + i.matchCount, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            Reglas Activas del Motor
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">
            {fmt(totalReach)} oportunidades de contacto detectadas
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map((insight) => {
          const config = CATEGORY_CONFIG[insight.category];
          return (
            <div
              key={insight.triggerId}
              className={`rounded-xl border p-4 transition-all ${
                insight.isActive
                  ? config.bgColor
                  : "border-gray-200 bg-gray-50 opacity-60 dark:border-gray-700 dark:bg-gray-800/50"
              }`}
            >
              {/* Header: icon + name + toggle */}
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`h-5 w-5 shrink-0 ${config.color}`}>{config.icon}</span>
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                    {insight.triggerName}
                  </h4>
                </div>
                <label className="relative inline-flex cursor-pointer items-center ml-2 shrink-0">
                  <input
                    type="checkbox"
                    checked={insight.isActive}
                    onChange={(e) => onToggle(insight.triggerId, e.target.checked)}
                    className="peer sr-only"
                    aria-label={`Activar ${insight.triggerName}`}
                  />
                  <div className="h-5 w-9 rounded-full bg-gray-300 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all peer-checked:bg-brand-500 peer-checked:after:translate-x-full dark:bg-gray-600" />
                </label>
              </div>

              {/* Description */}
              {insight.description && (
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-3 line-clamp-2">
                  {insight.description}
                </p>
              )}

              {/* Count + channel */}
              <div className="flex items-center justify-between">
                <span className={`text-2xl font-bold tabular-nums ${config.color}`}>
                  {fmt(insight.matchCount)}
                </span>
                <Badge
                  text={CHANNEL_LABEL[insight.channel]}
                  className={CHANNEL_COLOR[insight.channel]}
                />
              </div>
              <p className="text-[10px] text-gray-400 mt-0.5">
                clientes que cumplen esta condicion
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
