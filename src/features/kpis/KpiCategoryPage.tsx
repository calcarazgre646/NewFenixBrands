/**
 * features/kpis/KpiCategoryPage.tsx
 *
 * Vista de todos los KPIs de una categoría.
 * Cards live para core, cards bloqueadas (lock + grayscale) para el resto.
 * Réplica del patrón FenixBrands.
 */
import { useState } from "react";
import { useParams, Link } from "react-router";
import { EmptyState } from "@/components/ui/empty-state/EmptyState";
import { useKpiDashboard } from "./hooks/useKpiDashboard";
import { KpiCard, LockedKpiCard } from "./components/KpiCard";
import {
  getCategoryById,
  getKpisByCategory,
  getPstLabel,
  getPstBadgeClass,
} from "@/domain/kpis/categories";
import type { KpiCategory } from "@/domain/kpis/types";
import type { FenixPst } from "@/domain/kpis/fenix.catalog";
import { ExecutiveFilters } from "@/features/executive/components/ExecutiveFilters";

// ─── Filter options ──────────────────────────────────────────────────────────

const PST_OPTIONS: { value: FenixPst | "all"; label: string }[] = [
  { value: "all",     label: "Todos los estados" },
  { value: "core",    label: "Disponible" },
  { value: "next",    label: "Próximo Sprint" },
  { value: "later",   label: "Requiere Datos" },
  { value: "future",  label: "Sin Medición" },
  { value: "blocked", label: "Bloqueado" },
];

// ─── Page ────────────────────────────────────────────────────────────────────

export default function KpiCategoryPage() {
  const { categoryId } = useParams<{ categoryId: string }>();
  const category = getCategoryById(categoryId as KpiCategory);
  const { kpis: liveKpis, periodLabel } = useKpiDashboard();
  const [pstFilter, setPstFilter] = useState<FenixPst | "all">("all");

  if (!category) {
    return (
      <div className="p-4 sm:p-6">
        <EmptyState
          title="Categoría no encontrada"
          description={`La categoría "${categoryId}" no existe.`}
          action={
            <Link to="/kpis" className="text-sm font-medium text-brand-500 hover:text-brand-600">
              ← Volver al Dashboard
            </Link>
          }
        />
      </div>
    );
  }

  const allKpis = getKpisByCategory(category.id);
  const filteredKpis = pstFilter === "all"
    ? allKpis
    : allKpis.filter((k) => k.pst === pstFilter);

  const coreCount = allKpis.filter((k) => k.pst === "core").length;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Breadcrumb + Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
            <Link to="/kpis" className="hover:text-brand-500">Dashboard</Link>
            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-gray-600 dark:text-gray-400">{category.shortName}</span>
          </div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
            {category.name}
          </h1>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            {category.description}
          </p>
        </div>
        <ExecutiveFilters />
      </div>

      {/* Stats Bar + Filter */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <span className="text-gray-500 dark:text-gray-400">
            Total: <span className="font-semibold text-gray-900 dark:text-white">{allKpis.length} KPIs</span>
          </span>
          <span className="h-4 w-px bg-gray-200 dark:bg-gray-700" />
          <span className="text-gray-500 dark:text-gray-400">
            Mostrando: <span className="font-semibold text-gray-900 dark:text-white">{filteredKpis.length}</span>
          </span>
          <span className="h-4 w-px bg-gray-200 dark:bg-gray-700" />
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-green-500" />
            <span className="text-gray-600 dark:text-gray-400">{coreCount} disponibles</span>
          </span>
        </div>
        <select
          value={pstFilter}
          onChange={(e) => setPstFilter(e.target.value as FenixPst | "all")}
          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
          aria-label="Filtrar por estado"
        >
          {PST_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* KPI Grid */}
      {filteredKpis.length === 0 ? (
        <EmptyState
          title="Sin resultados"
          description="No hay KPIs que coincidan con el filtro seleccionado."
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredKpis.map((kpi) => {
            const liveCard = liveKpis.find((k) => k.id === kpi.id);

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
      )}
    </div>
  );
}
