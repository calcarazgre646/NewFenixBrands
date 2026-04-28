/**
 * features/calendar/components/EventScorecard.tsx
 *
 * Scorecard del evento: readiness%, días-a-evento, counters operativos.
 */
import type { EventReadiness } from "@/domain/events/types";

interface Props {
  title: string;
  startDate: string | null;
  readiness: EventReadiness | null;
}

function readinessColor(pct: number): string {
  if (pct >= 80) return "text-success-600 dark:text-success-400";
  if (pct >= 50) return "text-warning-600 dark:text-warning-400";
  return "text-error-600 dark:text-error-400";
}

function readinessBgColor(pct: number): string {
  if (pct >= 80) return "bg-success-50 dark:bg-success-500/10";
  if (pct >= 50) return "bg-warning-50 dark:bg-warning-500/10";
  return "bg-error-50 dark:bg-error-500/10";
}

function daysLabel(days: number | null): string {
  if (days === null) return "—";
  if (days === 0) return "Hoy";
  if (days < 0) return `${Math.abs(days)}d atrás`;
  return `En ${days}d`;
}

export function EventScorecard({ title, startDate, readiness }: Props) {
  const pct = readiness?.readinessPct ?? 0;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {startDate ?? "Sin fecha"} · {daysLabel(readiness?.daysToEvent ?? null)}
          </p>
        </div>
        <div className={`rounded-xl px-4 py-2 text-right ${readinessBgColor(pct)}`}>
          <div className={`text-3xl font-bold tabular-nums ${readinessColor(pct)}`}>
            {pct.toFixed(1)}%
          </div>
          <div className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Readiness
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <ScoreStat label="SKUs" value={readiness?.totalSkus ?? 0} />
        <ScoreStat label="Tiendas" value={readiness?.totalStores ?? 0} />
        <ScoreStat
          label="Sin stock"
          value={readiness?.skusOutOfStock ?? 0}
          tone={readiness && readiness.skusOutOfStock > 0 ? "error" : "neutral"}
        />
        <ScoreStat
          label="Curva incompleta"
          value={readiness?.skusWithIncompleteCurve ?? 0}
          tone={readiness && readiness.skusWithIncompleteCurve > 0 ? "warning" : "neutral"}
        />
        <ScoreStat
          label="Listos"
          value={readiness?.skusFullyReady ?? 0}
          tone={readiness && readiness.skusFullyReady > 0 ? "success" : "neutral"}
        />
      </div>
    </div>
  );
}

function ScoreStat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "neutral" | "success" | "warning" | "error";
}) {
  const colorMap = {
    neutral: "text-gray-900 dark:text-white",
    success: "text-success-600 dark:text-success-400",
    warning: "text-warning-600 dark:text-warning-400",
    error: "text-error-600 dark:text-error-400",
  };
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-center dark:border-gray-800 dark:bg-gray-800/50">
      <div className={`text-xl font-semibold tabular-nums ${colorMap[tone]}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {label}
      </div>
    </div>
  );
}
