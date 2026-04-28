/**
 * PaceChart — bullet chart compacto en SVG (sin ApexCharts, vive cómodo
 * dentro de una celda de tabla). Tres bandas semánticas:
 *
 *   rojo   < 80  %  cumplimiento
 *   ámbar  80-100 %
 *   verde  ≥ 100 %
 *
 * Renderiza dos marcadores:
 *   - Barra horizontal de la altura completa = `actualPct` (estado de hoy).
 *   - Línea vertical fina = `projectedPct` (proyección al cierre).
 */
import { getPaceBand } from "@/domain/commissions/pace";

interface PaceChartProps {
  /** % cumplimiento actual (0-150+). */
  actualPct: number;
  /** % cumplimiento proyectado al cierre del mes. Opcional. */
  projectedPct?: number;
  /** Tamaño visual. */
  size?: "sm" | "md";
  /** Texto adicional (a11y). */
  ariaLabel?: string;
}

const SIZES = {
  sm: { width: 100, height: 12 },
  md: { width: 140, height: 16 },
} as const;

const X_MAX = 150; // dominio del eje X (% cumplimiento)

export default function PaceChart({
  actualPct,
  projectedPct,
  size = "sm",
  ariaLabel,
}: PaceChartProps) {
  const { width, height } = SIZES[size];

  const xOf = (pct: number) => Math.max(0, Math.min(width, (pct / X_MAX) * width));
  const band = getPaceBand(actualPct);

  // Anchos de bandas: 0-80, 80-100, 100-150
  const w80 = xOf(80);
  const w100 = xOf(100) - w80;
  const wRest = width - w80 - w100;

  const barFill =
    band === "ahead" ? "#16a34a" :
    band === "on-track" ? "#d97706" :
    "#dc2626";

  const actualX = xOf(actualPct);
  const projX = projectedPct != null ? xOf(projectedPct) : null;

  return (
    <svg
      width={width}
      height={height}
      role="img"
      aria-label={ariaLabel ?? `Pace: actual ${actualPct.toFixed(0)}%${projectedPct != null ? `, proyectado ${projectedPct.toFixed(0)}%` : ""}`}
      className="overflow-visible"
    >
      {/* Bandas de fondo */}
      <rect x={0}        y={0} width={w80}  height={height} fill="#fee2e2" />
      <rect x={w80}      y={0} width={w100} height={height} fill="#fef3c7" />
      <rect x={w80+w100} y={0} width={wRest} height={height} fill="#dcfce7" />

      {/* Línea de "100%" — referencia */}
      <line x1={w80+w100} y1={0} x2={w80+w100} y2={height} stroke="#6b7280" strokeWidth={1} strokeDasharray="2 2" opacity={0.6} />

      {/* Barra del actual */}
      <rect x={0} y={height * 0.25} width={actualX} height={height * 0.5} fill={barFill} />

      {/* Marker de proyección */}
      {projX != null && (
        <line
          x1={projX}
          y1={-2}
          x2={projX}
          y2={height + 2}
          stroke="#111827"
          strokeWidth={2}
        />
      )}
    </svg>
  );
}
