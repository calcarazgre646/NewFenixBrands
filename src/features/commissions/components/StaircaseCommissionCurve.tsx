/**
 * StaircaseCommissionCurve — visualiza la curva escalonada de comisiones de
 * una escala y dibuja un marker "tú estás aquí" con anotación textual del
 * delta al siguiente tramo.
 *
 * Patrón inspirado en Oracle Fusion Incentive Compensation pay-for-performance.
 *   eje X: % cumplimiento de la cuota (0–150)
 *   eje Y: valor del tramo (% comisión, o monto fijo si scale.type === "fixed")
 */
import type { ApexOptions } from "apexcharts";
import ResponsiveChart from "@/components/ui/chart/ResponsiveChart";
import { buildStaircasePoints, getDeltaToNextTier } from "@/domain/commissions/pace";
import type { CommissionScale } from "@/domain/commissions/types";
import { formatPYGCompact } from "@/utils/format";

interface Props {
  scale: CommissionScale;
  /** % cumplimiento actual (típicamente proyectado al cierre del mes). */
  cumplimientoPct: number;
  /** Venta sobre la que se calculará la curva (típicamente proyectada EOM). */
  ventaActual: number;
  /** Meta del período (Retail = tienda; B2B/UTP = vendedor). 0 si no hay. */
  meta: number;
  height?: number;
}

const X_MAX = 150;

export default function StaircaseCommissionCurve({
  scale,
  cumplimientoPct,
  ventaActual,
  meta,
  height = 260,
}: Props) {
  if (meta <= 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-xs text-gray-500 dark:border-gray-600 dark:bg-gray-800/50 dark:text-gray-400">
        Sin meta cargada — la curva de comisión no puede dibujarse.
      </div>
    );
  }

  const points = buildStaircasePoints(scale, X_MAX);
  const data = points.map((p) => ({ x: p.cumplimientoPct, y: p.value }));
  const next = getDeltaToNextTier(scale, ventaActual, meta);
  const xMarker = Math.min(X_MAX, Math.max(0, cumplimientoPct));
  const isFixed = scale.type === "fixed";

  const annotationLabel = next.nextTier
    ? `Faltan ${formatPYGCompact(next.ventasNeeded)} para llegar al ${next.nextTier.minPct}%`
    : "Tope de la escala alcanzado";

  const options: ApexOptions = {
    chart: {
      type: "line",
      toolbar: { show: false },
      zoom: { enabled: false },
      animations: { enabled: false },
      fontFamily: "inherit",
      background: "transparent",
    },
    stroke: {
      curve: "stepline",
      width: 2.5,
      colors: ["#465fff"],
    },
    grid: {
      borderColor: "rgba(107, 114, 128, 0.15)",
      strokeDashArray: 3,
    },
    xaxis: {
      type: "numeric",
      min: 0,
      max: X_MAX,
      tickAmount: 5,
      labels: {
        formatter: (val) => `${val}%`,
        style: { colors: "#9ca3af", fontSize: "10px" },
      },
      title: { text: "Cumplimiento de cuota", style: { fontSize: "10px", color: "#6b7280" } },
    },
    yaxis: {
      labels: {
        formatter: (val) => isFixed ? formatPYGCompact(val) : `${val.toFixed(2)}%`,
        style: { colors: "#9ca3af", fontSize: "10px" },
      },
      title: { text: isFixed ? "Comisión Gs." : "% comisión", style: { fontSize: "10px", color: "#6b7280" } },
    },
    tooltip: {
      theme: "dark",
      y: {
        formatter: (val) => isFixed ? formatPYGCompact(val) : `${val.toFixed(2)}%`,
      },
      x: {
        formatter: (val) => `${val}%`,
      },
    },
    annotations: {
      xaxis: [
        {
          x: xMarker,
          borderColor: "#0f172a",
          strokeDashArray: 0,
          label: {
            text: `Tú estás aquí · ${cumplimientoPct.toFixed(1)}%`,
            borderColor: "#0f172a",
            borderWidth: 0,
            offsetY: 6,
            style: {
              color: "#ffffff",
              background: "#0f172a",
              fontSize: "11px",
              fontWeight: 700,
              padding: { left: 10, right: 10, top: 5, bottom: 5 },
            },
          },
        },
      ],
      points: next.nextTier
        ? [
            {
              x: next.nextTier.minPct,
              y: next.nextTier.value,
              marker: {
                size: 6,
                fillColor: "#15803d",
                strokeColor: "#ffffff",
                strokeWidth: 2,
              },
              label: {
                text: annotationLabel,
                borderColor: "#15803d",
                borderWidth: 0,
                offsetY: -10,
                style: {
                  color: "#ffffff",
                  background: "#15803d",
                  fontSize: "11px",
                  fontWeight: 700,
                  padding: { left: 10, right: 10, top: 5, bottom: 5 },
                },
              },
            },
          ]
        : [],
    },
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-2">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
          Curva de comisión
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Escala {scale.label} · cada escalón se activa al alcanzar ese % de cuota
        </p>
      </div>
      <ResponsiveChart
        options={options}
        series={[{ name: "Comisión", data }]}
        type="line"
        height={height}
      />
    </div>
  );
}
