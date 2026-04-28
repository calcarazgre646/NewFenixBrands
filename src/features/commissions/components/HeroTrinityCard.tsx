/**
 * HeroTrinityCard — la tarjeta hero de la nueva sección de Comisiones.
 *
 * Tres columnas leíbles en un solo vistazo (~3 segundos):
 *   1. Actual MTD: venta hasta hoy + comisión devengada.
 *   2. Proyectado EOM: venta esperada al cierre + comisión proyectada.
 *   3. Cuota: meta del mes + cumplimiento (actual y proyectado).
 *
 * Patrón sacado de CaptivateIQ + Xactly Incent: "trinidad lagging+leading+benchmark"
 * — la pregunta operativa "¿cómo voy?" se responde sin navegar.
 */
import { formatPYGCompact } from "@/utils/format";
import { getDeltaToNextTier, getPaceBand } from "@/domain/commissions/pace";
import { ROLE_LABELS, CHANNEL_LABELS } from "@/domain/commissions/scales";
import { KpiTooltip } from "./KpiTooltip";
import type {
  CommissionScale,
  CommissionResult,
} from "@/domain/commissions/types";
import type { SellerProjection } from "@/domain/projections/types";

interface HeroTrinityCardProps {
  projection: SellerProjection;
  result: CommissionResult;
  scale: CommissionScale;
  /** Modo "team" muestra "Equipo" en el header en lugar del nombre del vendedor. */
  audience?: "self" | "team";
  /** Cuando audience=team, este es el conteo total (e.g., "33 vendedores"). */
  teamCount?: number;
}

const F_VENTA = "Suma de v_vtasimpu del mes hasta hoy";
const F_PROY  = "Acumulado hoy + (ritmo diario × días restantes)";
const F_CUOTA = "Meta de la tienda (Retail) o del vendedor (B2B/UTP)";
const F_CUMP  = "(venta proyectada / cuota) × 100";

export default function HeroTrinityCard({
  projection,
  result,
  scale,
  audience = "self",
  teamCount,
}: HeroTrinityCardProps) {
  const { metaVentas, ventaActual, ventaProyectada } = projection;
  const cumplProy = projection.cumplimientoProyectadoPct ?? 0;
  const meta = metaVentas ?? 0;
  const band = getPaceBand(cumplProy);
  const next = getDeltaToNextTier(scale, ventaProyectada, meta);

  const cumplActual = projection.cumplimientoActualPct ?? 0;

  const headerLabel = audience === "self"
    ? projection.vendedorNombre
    : `Equipo · ${teamCount ?? 0} vendedores`;

  const subLabel = audience === "self"
    ? `${ROLE_LABELS[projection.rolComision]} · ${CHANNEL_LABELS[projection.canal] ?? projection.canal}`
    : "Resumen del mes";

  // ─── Estado visual de la banda ───
  const bandStyle =
    band === "ahead" ? "border-success-200 bg-success-50 dark:border-success-500/20 dark:bg-success-500/10" :
    band === "on-track" ? "border-warning-200 bg-warning-50 dark:border-warning-500/20 dark:bg-warning-500/10" :
    "border-error-200 bg-error-50 dark:border-error-500/20 dark:bg-error-500/10";

  return (
    <div className={`overflow-hidden rounded-2xl border ${bandStyle}`}>
      {/* Header */}
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-200/60 bg-white/60 px-5 py-3 dark:border-gray-700/60 dark:bg-gray-900/40">
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-white">{headerLabel}</p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">{subLabel}</p>
        </div>
        {audience === "self" && (
          <span className={`ml-auto inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold ${
            band === "ahead" ? "bg-success-100 text-success-700 dark:bg-success-500/15 dark:text-success-400" :
            band === "on-track" ? "bg-warning-100 text-warning-700 dark:bg-warning-500/15 dark:text-warning-400" :
            "bg-error-100 text-error-700 dark:bg-error-500/15 dark:text-error-400"
          }`}>
            {band === "ahead" ? "Sobre cuota" : band === "on-track" ? "En camino" : "Por debajo"}
          </span>
        )}
      </div>

      {/* Trinidad: 3 columnas */}
      <div className="grid grid-cols-1 gap-px bg-gray-200/50 dark:bg-gray-700/40 sm:grid-cols-3">
        {/* Col 1 — Actual MTD */}
        <div className="bg-white/90 p-5 dark:bg-gray-900/40">
          <KpiTooltip
            label="Actual MTD"
            formula={F_VENTA}
            className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400"
          />
          <p className="mt-2 text-2xl font-bold tabular-nums text-gray-900 dark:text-white">
            {formatPYGCompact(ventaActual)}
          </p>
          <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
            Comisión hasta hoy: <span className="font-semibold text-gray-700 dark:text-gray-300">{formatPYGCompact(result.comisionTotalGs)}</span>
          </p>
          <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">
            Cumplimiento {cumplActual.toFixed(1)}%
          </p>
        </div>

        {/* Col 2 — Proyectado EOM */}
        <div className="bg-white/90 p-5 dark:bg-gray-900/40">
          <KpiTooltip
            label="Proyectado EOM"
            formula={F_PROY}
            className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400"
          />
          <p className="mt-2 text-2xl font-bold tabular-nums text-gray-900 dark:text-white">
            {formatPYGCompact(ventaProyectada)}
          </p>
          <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
            Comisión proyectada: <span className="font-semibold text-gray-700 dark:text-gray-300">
              {projection.comisionProyectadaGs != null ? formatPYGCompact(projection.comisionProyectadaGs) : "Pendiente"}
            </span>
          </p>
          <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">
            Cumplimiento {cumplProy.toFixed(1)}%
          </p>
        </div>

        {/* Col 3 — Cuota */}
        <div className="bg-white/90 p-5 dark:bg-gray-900/40">
          <KpiTooltip
            label="Cuota"
            formula={F_CUOTA}
            className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400"
          />
          <p className="mt-2 text-2xl font-bold tabular-nums text-gray-900 dark:text-white">
            {meta > 0 ? formatPYGCompact(meta) : "Pendiente"}
          </p>
          {meta > 0 && (
            <>
              {next.nextTier ? (
                <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                  Para subir a <span className="font-semibold tabular-nums text-gray-700 dark:text-gray-300">{next.nextTier.minPct}%</span>:
                  <br />
                  faltan <span className="font-semibold tabular-nums text-gray-700 dark:text-gray-300">{formatPYGCompact(next.ventasNeeded)}</span>
                </p>
              ) : (
                <p className="mt-1 text-[11px] text-success-700 dark:text-success-400 font-semibold">
                  Tope de la escala alcanzado
                </p>
              )}
              <KpiTooltip
                label={`Cumplimiento proyectado ${cumplProy.toFixed(1)}%`}
                formula={F_CUMP}
                className="mt-1.5 inline-flex text-[11px] text-gray-400 dark:text-gray-500"
              />
            </>
          )}
        </div>
      </div>

      {/* Barra inferior de progreso */}
      {meta > 0 && (
        <div className="px-5 py-3">
          <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
            {/* venta actual */}
            <div
              className="absolute left-0 top-0 h-full bg-brand-500"
              style={{ width: `${Math.min(100, (ventaActual / meta) * 100)}%` }}
              aria-label={`Actual ${cumplActual.toFixed(0)}%`}
            />
            {/* venta proyectada (overlay translúcido) */}
            <div
              className="absolute left-0 top-0 h-full bg-brand-500/30"
              style={{ width: `${Math.min(100, (ventaProyectada / meta) * 100)}%` }}
              aria-label={`Proyectado ${cumplProy.toFixed(0)}%`}
            />
            {/* línea de meta (100%) */}
            <div className="absolute right-0 top-0 h-full w-0.5 bg-gray-700 dark:bg-gray-300" />
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[10px] text-gray-500 dark:text-gray-400">
            <span>0</span>
            <span className="font-semibold">Meta · {formatPYGCompact(meta)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
