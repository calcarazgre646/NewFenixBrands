/**
 * WhatIfSimulator — input determinístico que responde "si vendo Gs X más,
 * gano Gs Y más". Reusa `simulateAdditionalSales` para que cualquier cambio
 * de escala en Configuración se propague automáticamente.
 *
 * No hace red ni llama al backend: la fórmula es pura.
 */
import { useMemo, useState } from "react";
import { simulateAdditionalSales } from "@/domain/commissions/whatif";
import { formatPYGCompact, formatPYG } from "@/utils/format";
import { KpiTooltip } from "./KpiTooltip";
import type { CommissionScale } from "@/domain/commissions/types";
import type { SellerProjection } from "@/domain/projections/types";

interface Props {
  projection: SellerProjection;
  scale: CommissionScale;
}

const STEP = 100_000; // Gs.

export default function WhatIfSimulator({ projection, scale }: Props) {
  const [extraGs, setExtraGs] = useState(1_000_000);

  const sim = useMemo(
    () => simulateAdditionalSales(projection, scale, { additionalGs: extraGs }),
    [projection, scale, extraGs],
  );

  const daysRemaining = projection.diasRestantes;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
            What-if · Simulador
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Si vendo Gs. extra en lo que queda del mes, ¿cuánto gano de comisión?
          </p>
        </div>
      </div>

      {/* Input + slider */}
      <div className="space-y-2">
        <label htmlFor="whatif-extra-gs" className="block text-[11px] font-medium text-gray-600 dark:text-gray-300">
          Ventas adicionales (Gs.)
        </label>
        <div className="flex items-center gap-2">
          <input
            id="whatif-extra-gs"
            type="number"
            min={0}
            step={STEP}
            value={extraGs}
            onChange={(e) => setExtraGs(Math.max(0, Number(e.target.value) || 0))}
            className="w-40 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium tabular-nums text-gray-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
            aria-label="Ventas adicionales en guaraníes"
          />
          <span className="text-[11px] text-gray-400 dark:text-gray-500">
            ≈ {formatPYGCompact(extraGs)}
            {daysRemaining > 0 && ` · ${Math.round(extraGs / daysRemaining).toLocaleString("es-PY")} Gs/día restante`}
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={50_000_000}
          step={STEP}
          value={Math.min(50_000_000, extraGs)}
          onChange={(e) => setExtraGs(Number(e.target.value))}
          className="w-full accent-brand-500"
          aria-label="Slider de ventas adicionales"
        />
      </div>

      {/* Resultado */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-gray-50 px-3 py-2.5 dark:bg-gray-700/40">
          <KpiTooltip
            label="Venta simulada"
            formula="Proyección + ventas adicionales"
            className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400"
          />
          <p className="mt-1 text-base font-bold tabular-nums text-gray-900 dark:text-white">
            {formatPYGCompact(sim.ventaProyectadaSimulada)}
          </p>
        </div>
        <div className="rounded-xl bg-gray-50 px-3 py-2.5 dark:bg-gray-700/40">
          <KpiTooltip
            label="Cumplimiento"
            formula="(venta simulada / cuota) × 100"
            className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400"
          />
          <p className="mt-1 text-base font-bold tabular-nums text-gray-900 dark:text-white">
            {sim.metaPendiente ? "—" : `${sim.cumplimientoSimuladoPct.toFixed(1)}%`}
          </p>
        </div>
        <div className={`rounded-xl px-3 py-2.5 ${
          sim.metaPendiente
            ? "bg-gray-50 dark:bg-gray-700/40"
            : sim.deltaComisionGs > 0
              ? "bg-success-50 dark:bg-success-500/10"
              : "bg-gray-50 dark:bg-gray-700/40"
        }`}>
          <KpiTooltip
            label="Δ Comisión"
            formula="Comisión simulada − comisión proyectada actual"
            className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400"
          />
          <p className={`mt-1 text-base font-bold tabular-nums ${
            sim.metaPendiente
              ? "text-gray-400 dark:text-gray-500"
              : sim.deltaComisionGs > 0
                ? "text-success-700 dark:text-success-400"
                : "text-gray-700 dark:text-gray-300"
          }`}>
            {sim.metaPendiente ? "Pendiente" : `+${formatPYG(sim.deltaComisionGs)}`}
          </p>
        </div>
      </div>

      {sim.metaPendiente && (
        <p className="mt-3 text-[11px] text-gray-500 dark:text-gray-400">
          La meta del vendedor aún no está cargada en <code className="rounded bg-gray-100 px-1 dark:bg-gray-700">comisiones_metas_vendedor</code>.
          La proyección se mostrará cuando Fenix cargue los datos.
        </p>
      )}
    </div>
  );
}
