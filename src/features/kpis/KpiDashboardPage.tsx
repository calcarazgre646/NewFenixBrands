/**
 * features/kpis/KpiDashboardPage.tsx
 *
 * Dashboard principal de KPIs — 9 KPIs core con datos reales.
 *
 * REGLA: Sin lógica de negocio. Solo layout + composición de componentes.
 * Cada KpiCard sabe su propio estado de loading/error (viene del hook).
 */
import { useKpiDashboard } from "./hooks/useKpiDashboard";
import { KpiCard } from "./components/KpiCard";

export default function KpiDashboardPage() {
  const { kpis, periodLabel } = useKpiDashboard();

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
          KPIs
        </h1>
        {periodLabel && (
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            Resumen del período seleccionado — {periodLabel}
          </p>
        )}
      </div>

      {/* KPI Grid — 9 cards: 4 col xl / 2 col sm / 1 col xs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <KpiCard
            key={kpi.id}
            {...kpi}
            periodLabel={periodLabel}
          />
        ))}
      </div>
    </div>
  );
}
