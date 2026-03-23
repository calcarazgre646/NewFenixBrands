/**
 * features/executive/components/InsightBar.tsx
 *
 * Barra de diagnóstico automático — muestra insights de performance por marca.
 * Desktop: fila horizontal con divisores verticales.
 * Mobile: columna vertical con divisores horizontales.
 *
 * REGLA: Sin lógica de negocio. Recibe insights pre-calculados.
 */
import type { BrandInsight } from "@/domain/executive/insights";
import { formatDiff } from "@/utils/format";

const LABEL_STYLES: Record<string, { bg: string; text: string }> = {
  Martel:   { bg: "bg-success-50 dark:bg-success-500/10", text: "text-success-700 dark:text-success-400" },
  Wrangler: { bg: "bg-warning-50 dark:bg-warning-500/10", text: "text-warning-700 dark:text-warning-400" },
  Lee:      { bg: "bg-error-50 dark:bg-error-500/10",     text: "text-error-700 dark:text-error-400" },
};

function ArrowIcon({ type }: { type: BrandInsight["type"] }) {
  if (type === "outperforming") {
    return <span className="text-xs font-bold text-success-500">&#9650;</span>;
  }
  if (type === "underperforming") {
    return <span className="text-xs font-bold text-error-500">&#9660;</span>;
  }
  return <span className="text-xs font-bold text-gray-400">&mdash;</span>;
}

function InsightRow({ items }: { items: BrandInsight[] }) {
  const cols = items.length === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3";

  return (
    <div className={`grid grid-cols-1 ${cols} divide-y sm:divide-y-0 sm:divide-x divide-gray-200 dark:divide-gray-700`}>
      {items.map((insight, i) => {
        const style = LABEL_STYLES[insight.label] ?? {
          bg: "bg-gray-50 dark:bg-gray-700",
          text: "text-gray-600 dark:text-gray-400",
        };
        const impactPositive = insight.impact >= 0;

        return (
          <div
            key={`${insight.label}-${i}`}
            className="flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-3"
          >
            <ArrowIcon type={insight.type} />
            <span
              className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold ${style.bg} ${style.text}`}
            >
              {insight.label}
            </span>
            <span className="text-[12px] text-gray-500 dark:text-gray-400">
              {insight.pacePercent.toFixed(1)}%
            </span>
            <span
              className={`ml-auto text-xs font-semibold tabular-nums ${
                impactPositive
                  ? "text-success-600 dark:text-success-400"
                  : "text-error-600 dark:text-error-400"
              }`}
            >
              {formatDiff(insight.impact)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function InsightBar({ insights }: { insights: BrandInsight[] }) {
  if (insights.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      <InsightRow items={insights} />
    </div>
  );
}
