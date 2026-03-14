/**
 * features/depots/components/DepotInsights.tsx
 *
 * Supuestos del calculo — collapsible disclosure al final de la pagina.
 * La "lectura ejecutiva" anterior era 100% redundante con los KPI cards.
 * Esto solo muestra la metodologia cuando el usuario la necesita.
 */
import { useState } from "react";
import type { DepotData } from "@/domain/depots/types";

interface Props {
  data: DepotData;
}

export default function DepotInsights({ data }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const { salesWindow, totals, scopeCandidates } = data;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-white/[0.03]">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between px-5 py-3 text-left transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.02] sm:px-6"
      >
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
          Supuestos del calculo
        </span>
        <svg
          className={`h-3 w-3 shrink-0 text-gray-400 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="border-t border-gray-100 px-5 py-4 dark:border-gray-700 sm:px-6">
          <div className="grid gap-3 text-xs text-gray-500 dark:text-gray-400 sm:grid-cols-2">
            <div>
              <p className="font-semibold text-gray-700 dark:text-gray-300">Ventana de ventas</p>
              <p className="mt-0.5">{salesWindow.periodLabels.join(", ")}. Ultimo: {salesWindow.latestLabel}.</p>
            </div>
            <div>
              <p className="font-semibold text-gray-700 dark:text-gray-300">Cobertura RETAILS</p>
              <p className="mt-0.5">Inventario actual / demanda semanal de la red retail.</p>
            </div>
            <div>
              <p className="font-semibold text-gray-700 dark:text-gray-300">Cobertura STOCK</p>
              <p className="mt-0.5">Inventario actual / misma demanda semanal (respaldo aguas arriba).</p>
            </div>
            <div>
              <p className="font-semibold text-gray-700 dark:text-gray-300">Tiendas incluidas ({totals.dependentStoreCount})</p>
              <p className="mt-0.5 break-words">{scopeCandidates.join(", ")}.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
