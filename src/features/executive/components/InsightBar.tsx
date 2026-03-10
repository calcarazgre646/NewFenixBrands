/**
 * features/executive/components/InsightBar.tsx
 *
 * Barra de diagnóstico automático — muestra insights de performance.
 * Layout: una sola fila horizontal con bloques separados por divisores.
 * Cuando recibe `altInsights`, rota entre ambos sets con animación.
 *
 * REGLA: Sin lógica de negocio. Recibe insights pre-calculados.
 */
import { useState, useEffect } from "react";
import type { BrandInsight } from "@/domain/executive/insights";
import { formatDiff } from "@/utils/format";

interface InsightBarProps {
  insights: BrandInsight[];
  /** Set alternativo para rotación (ej: canales cuando insights muestra marcas). */
  altInsights?: BrandInsight[];
}

const LABEL_STYLES: Record<string, { bg: string; text: string }> = {
  Martel:   { bg: "bg-success-50 dark:bg-success-500/10", text: "text-success-700 dark:text-success-400" },
  Wrangler: { bg: "bg-warning-50 dark:bg-warning-500/10", text: "text-warning-700 dark:text-warning-400" },
  Lee:      { bg: "bg-error-50 dark:bg-error-500/10",     text: "text-error-700 dark:text-error-400" },
  B2C:      { bg: "bg-brand-50 dark:bg-brand-500/10",     text: "text-brand-700 dark:text-brand-400" },
  B2B:      { bg: "bg-gray-100 dark:bg-gray-700",         text: "text-gray-700 dark:text-gray-300" },
};

const ROTATE_INTERVAL = 5000;

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
  return (
    <div className={`grid ${items.length === 2 ? "grid-cols-2" : "grid-cols-3"} divide-x divide-gray-200 dark:divide-gray-700`}>
      {items.map((insight, i) => {
        const style = LABEL_STYLES[insight.label] ?? {
          bg: "bg-gray-50 dark:bg-gray-700",
          text: "text-gray-600 dark:text-gray-400",
        };
        const impactPositive = insight.impact >= 0;

        return (
          <div
            key={`${insight.label}-${i}`}
            className="flex items-center gap-2 px-4 py-3"
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

export function InsightBar({ insights, altInsights }: InsightBarProps) {
  const hasAlt = altInsights != null && altInsights.length > 0;
  const [showAlt, setShowAlt] = useState(false);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (!hasAlt) return;
    const interval = setInterval(() => {
      setFading(true);
      setTimeout(() => {
        setShowAlt((prev) => !prev);
        setFading(false);
      }, 200);
    }, ROTATE_INTERVAL);
    return () => clearInterval(interval);
  }, [hasAlt]);

  // Reset cuando cambian los datos
  useEffect(() => {
    setShowAlt(false);
    setFading(false);
  }, [insights, altInsights]);

  if (insights.length === 0) return null;

  const current = showAlt && hasAlt ? altInsights : insights;

  return (
    <div
      className={`overflow-hidden rounded-2xl border border-gray-200 bg-white transition-opacity duration-200 dark:border-gray-700 dark:bg-gray-800 ${
        fading ? "opacity-0" : "opacity-100"
      }`}
    >
      <InsightRow items={current} />
    </div>
  );
}
