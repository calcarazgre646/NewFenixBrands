/**
 * KpiTooltip — pequeño wrapper sobre el Tooltip estándar para los KPIs de
 * compensación. Muestra un ícono "?" al lado del label que, al hover,
 * despliega la fórmula con la que se calculó el número.
 */
import type { ReactNode } from "react";
import { Tooltip } from "@/components/ui/tooltip/Tooltip";

interface KpiTooltipProps {
  /** Texto del label del KPI (display normal). */
  label: string;
  /** Fórmula o explicación corta (mostrada en el tooltip). */
  formula: string;
  /** className opcional para el contenedor (espaciado, etc.). */
  className?: string;
  /** Children opcional (ícono custom). Por defecto muestra un "?" gris. */
  children?: ReactNode;
}

export function KpiTooltip({ label, formula, className = "", children }: KpiTooltipProps) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span>{label}</span>
      <Tooltip content={formula} position="top">
        <span
          aria-label={`Fórmula: ${formula}`}
          className="inline-flex h-3.5 w-3.5 cursor-help items-center justify-center rounded-full border border-gray-300 text-[8px] font-bold text-gray-400 transition-colors hover:border-gray-400 hover:text-gray-600 dark:border-gray-600 dark:text-gray-500 dark:hover:border-gray-500 dark:hover:text-gray-300"
        >
          {children ?? "?"}
        </span>
      </Tooltip>
    </span>
  );
}
