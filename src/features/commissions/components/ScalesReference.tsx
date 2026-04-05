/**
 * features/commissions/components/ScalesReference.tsx
 *
 * Tablas de referencia de escalas de comisión para los 8 roles.
 */
import type { CommissionScale } from "@/domain/commissions/types";

const thCls = "px-3 py-1.5 text-[9px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500";

function ScaleTable({ scale }: { scale: CommissionScale }) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
      <div className="border-b border-gray-100 bg-gray-50/70 px-4 py-2 dark:border-gray-700 dark:bg-white/[0.02]">
        <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">
          {scale.label}
        </span>
        <span className="ml-2 text-[10px] text-gray-400 dark:text-gray-500">
          ({scale.type === "fixed" ? "Monto fijo Gs." : "% sobre ventas"})
        </span>
      </div>
      <table className="w-full text-[11px]">
        <thead>
          <tr className="border-b border-gray-100 dark:border-gray-700">
            <th className={`${thCls} text-left`}>Cumplimiento</th>
            <th className={`${thCls} text-right`}>
              {scale.type === "fixed" ? "Comisión (Gs.)" : "Comisión (%)"}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
          {scale.tiers.map((tier, i) => (
            <tr key={i}>
              <td className="px-3 py-1.5 text-gray-600 dark:text-gray-300">
                {tier.maxPct === Infinity
                  ? `${tier.minPct}% en adelante`
                  : `${tier.minPct}% a ${tier.maxPct - 0.01}%`
                }
              </td>
              <td className="px-3 py-1.5 text-right tabular-nums font-medium text-gray-800 dark:text-white">
                {scale.type === "fixed"
                  ? `Gs. ${tier.value.toLocaleString("es-PY")}`
                  : `${tier.value}%`
                }
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ScalesReference({ scales }: { scales: CommissionScale[] }) {
  return (
    <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {scales.map(scale => (
        <ScaleTable key={scale.role} scale={scale} />
      ))}
    </div>
  );
}
