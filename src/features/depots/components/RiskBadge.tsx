/**
 * features/depots/components/RiskBadge.tsx
 *
 * Badge de riesgo con colores semánticos del design system.
 */
import type { DepotRisk } from "@/domain/depots/types";

const RISK_LABELS: Record<DepotRisk, string> = {
  critico: "Crítico",
  bajo: "Bajo",
  saludable: "Saludable",
  alto: "Alto",
  sin_venta: "Sin venta",
};

const RISK_CLASSES: Record<DepotRisk, string> = {
  critico:   "bg-error-100 text-error-700 border-error-200 dark:bg-error-500/15 dark:text-error-400 dark:border-error-500/20",
  bajo:      "bg-warning-100 text-warning-700 border-warning-200 dark:bg-warning-500/15 dark:text-warning-400 dark:border-warning-500/20",
  saludable: "bg-success-100 text-success-700 border-success-200 dark:bg-success-500/15 dark:text-success-400 dark:border-success-500/20",
  alto:      "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-400 dark:border-blue-500/20",
  sin_venta: "bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:border-gray-600",
};

interface Props {
  risk: DepotRisk;
  className?: string;
}

export default function RiskBadge({ risk, className = "" }: Props) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold ${RISK_CLASSES[risk]} ${className}`}
    >
      {RISK_LABELS[risk]}
    </span>
  );
}
