/**
 * features/kpis/KpiDashboardPage.tsx
 *
 * Dashboard principal de KPIs — réplica de FenixBrands.
 * Stats → KPIs disponibles → 9 categorías con preview + locked cards.
 */
import { Link } from "react-router";
import { useKpiDashboard } from "./hooks/useKpiDashboard";
import { KpiCard, LockedKpiCard } from "./components/KpiCard";
import { ExecutiveFilters } from "@/features/executive/components/ExecutiveFilters";
import { FENIX_KPI_CATALOG } from "@/domain/kpis/fenix.catalog";
import {
  getOrderedCategories,
  getKpisByCategory,
  getPstLabel,
  getPstBadgeClass,
} from "@/domain/kpis/categories";

export default function KpiDashboardPage() {
  const { kpis, periodLabel } = useKpiDashboard();
  const categories = getOrderedCategories();

  const totalKpis = FENIX_KPI_CATALOG.length;
  const coreKpis = FENIX_KPI_CATALOG.filter((k) => k.pst === "core").length;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-gray-400 dark:text-gray-500">
          <span className="font-medium text-gray-500 dark:text-gray-400">{totalKpis}</span> indicadores · <span className="text-green-600 dark:text-green-400">{coreKpis} disponibles</span> · <span className="text-gray-400">{totalKpis - coreKpis} pendientes</span>
        </p>
        <ExecutiveFilters />
      </div>

      {/* KPIs disponibles */}
      <div className="space-y-3">
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            KPIs disponibles
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Indicadores con datos reales conectados
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {kpis.map((kpi) => (
            <KpiCard key={kpi.id} {...kpi} periodLabel={periodLabel} />
          ))}
        </div>
      </div>

      {/* Categorías */}
      <div className="space-y-8 pt-2">
        {categories.map((cat) => {
          const catKpis = getKpisByCategory(cat.id);
          if (catKpis.length === 0) return null;

          return (
            <div key={cat.id} className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                    {cat.name}
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {cat.description}
                  </p>
                </div>
                <Link
                  to={`/kpis/${cat.id}`}
                  className="flex shrink-0 items-center gap-1 text-xs font-medium text-brand-500 hover:text-brand-600 dark:text-brand-400"
                >
                  Ver todos ({catKpis.length})
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {catKpis.slice(0, 4).map((kpi) => {
                  const liveCard = kpis.find((k) => k.id === kpi.id);
                  if (liveCard) {
                    return <KpiCard key={kpi.id} {...liveCard} periodLabel={periodLabel} />;
                  }
                  return (
                    <LockedKpiCard
                      key={kpi.id}
                      name={kpi.name}
                      definition={kpi.definition}
                      pstLabel={getPstLabel(kpi.pst)}
                      pstClass={getPstBadgeClass(kpi.pst)}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
