/**
 * ResumenTab — pestaña por defecto de la nueva sección de Comisiones.
 *
 * Vista vendedor (scope=self):
 *   Hero (mi situación) + Staircase (mi escala) + DailyCurveChart (mi mes
 *   día×día) + WhatIf (mi simulador).
 *
 * Vista gerencia (scope=team):
 *   Hero del equipo + Staircase de la escala "vendedor_tienda" como
 *   referencia + un mini-listado de los 5 mejores y los 5 que más rezagados
 *   van.
 */
import { useMemo } from "react";
import { formatPYGCompact } from "@/utils/format";
import { StatCard } from "@/components/ui/stat-card/StatCard";
import HeroTrinityCard from "../HeroTrinityCard";
import StaircaseCommissionCurve from "../StaircaseCommissionCurve";
import WhatIfSimulator from "../WhatIfSimulator";
import PaceChart from "../PaceChart";
import { KpiTooltip } from "../KpiTooltip";
import DailyCurveChart from "../DailyCurveChart";
import { buildTopBottoms } from "../../hooks/derive";
import type { UseCompensationResult } from "../../hooks/useCompensation";

interface Props {
  data: UseCompensationResult;
}

const F_TOTAL_PROY  = "Suma de la proyección al cierre de cada vendedor";
const F_TOTAL_COMM  = "Suma de la comisión proyectada de cada vendedor";

export default function ResumenTab({ data }: Props) {
  const { scope, self, rows, summary, scales } = data;

  // Hooks van siempre antes de returns condicionales (Rules of Hooks).
  const { topAhead, topBehind } = useMemo(() => buildTopBottoms(rows), [rows]);

  if (scope === "self") {
    if (!self) {
      return (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400">
          Tu usuario aún no está vinculado a un código de vendedor. Pedile al
          administrador que cargue el código en tu perfil para ver tu
          proyección y comisión personal.
        </div>
      );
    }

    const scale = scales[self.projection.rolComision];

    return (
      <div className="space-y-5">
        <HeroTrinityCard
          projection={self.projection}
          result={self.result}
          scale={scale}
          audience="self"
        />

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <StaircaseCommissionCurve
            scale={scale}
            cumplimientoPct={self.projection.cumplimientoProyectadoPct ?? 0}
            ventaActual={self.projection.ventaProyectada}
            meta={self.projection.metaVentas ?? 0}
          />
          <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
              Tu mes día por día
            </p>
            <DailyCurveChart series={self.series} height={260} />
          </div>
        </div>

        <WhatIfSimulator projection={self.projection} scale={scale} />
      </div>
    );
  }

  // scope === "team"
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Vendedores"
          value={String(summary.totalVendedores)}
          sub="con datos del mes"
        />
        <StatCard
          label="Venta acumulada"
          value={formatPYGCompact(summary.totalVentaActual)}
          sub="al día de hoy"
        />
        <StatCard
          label="Proyectado al cierre"
          value={formatPYGCompact(summary.totalVentaProyectada)}
          sub="ritmo lineal"
          variant={summary.totalVentaProyectada > 0 ? "accent-positive" : "neutral"}
        />
        <StatCard
          label="Comisión proyectada"
          value={formatPYGCompact(summary.totalComisionProyectadaGs)}
          sub="Gs. al cierre"
          variant={summary.totalComisionProyectadaGs > 0 ? "accent-positive" : "neutral"}
        />
      </div>

      {/* Tooltips de fórmula (banda inferior) */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 px-1 text-[10px] text-gray-400 dark:text-gray-500">
        <KpiTooltip label="¿Cómo se proyecta?" formula={F_TOTAL_PROY} />
        <KpiTooltip label="¿Cómo se calcula la comisión total?" formula={F_TOTAL_COMM} />
      </div>

      {/* Curva de referencia — fila completa */}
      <StaircaseCommissionCurve
        scale={scales["vendedor_tienda"]}
        cumplimientoPct={pct(summary.totalVentaProyectada, totalMetaForTeam(rows))}
        ventaActual={summary.totalVentaProyectada}
        meta={totalMetaForTeam(rows)}
      />

      {/* Top + Bottom mini — una columna cada uno */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <MiniSellerList title="Top — sobre cuota" rows={topAhead} variant="ahead" />
        <MiniSellerList title="Atención — debajo de cuota" rows={topBehind} variant="behind" />
      </div>
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function pct(num: number, den: number): number {
  if (den <= 0) return 0;
  return (num / den) * 100;
}

function totalMetaForTeam(rows: UseCompensationResult["rows"]): number {
  let total = 0;
  for (const r of rows) total += r.projection.metaVentas ?? 0;
  return total;
}

interface MiniListProps {
  title: string;
  rows: UseCompensationResult["rows"];
  variant: "ahead" | "behind";
}

function MiniSellerList({ title, rows, variant }: MiniListProps) {
  const accent = variant === "ahead"
    ? "border-success-200 dark:border-success-500/20"
    : "border-error-200 dark:border-error-500/20";

  return (
    <div className={`rounded-2xl border bg-white p-4 dark:bg-gray-800 ${accent}`}>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
        {title}
      </p>
      <ul className="divide-y divide-gray-100 dark:divide-gray-700/50">
        {rows.length === 0 && (
          <li className="py-3 text-xs text-gray-400">Sin datos</li>
        )}
        {rows.map(({ projection: p }) => (
          <li key={`${p.vendedorCodigo}-${p.canal}`} className="flex items-center gap-3 py-2">
            <div className="flex-1 truncate">
              <p className="truncate text-[12px] font-medium text-gray-800 dark:text-white">{p.vendedorNombre}</p>
              <p className="text-[10px] text-gray-400 dark:text-gray-500">
                {p.sucursalCodigo ?? "—"} · {formatPYGCompact(p.ventaProyectada)} proy.
              </p>
            </div>
            <PaceChart actualPct={p.cumplimientoActualPct ?? 0} projectedPct={p.cumplimientoProyectadoPct ?? 0} size="sm" />
            <span className="w-12 text-right text-[11px] font-semibold tabular-nums text-gray-700 dark:text-gray-200">
              {(p.cumplimientoProyectadoPct ?? 0).toFixed(0)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
