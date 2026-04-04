/**
 * features/logistics/LogisticsPage.tsx
 *
 * Logistica / ETAs de Importacion — Rediseno 360.
 *
 * Solo composicion. Logica en useLogistics, componentes en components/.
 */
import { useLogistics } from "./hooks/useLogistics";
import { useQuery } from "@tanstack/react-query";
import { logisticsKeys, STALE_5MIN, GC_60MIN } from "@/queries/keys";
import { fetchLogisticsLastLoad } from "@/queries/logistics.queries";
import { classifyFreshness } from "@/domain/freshness/classify";
import { DataFreshnessTag } from "@/features/executive/components/DataFreshnessTag";
import { PageSkeleton } from "@/components/ui/skeleton/Skeleton";
import { LogisticsStatCards } from "./components/LogisticsStatCards";
import { BrandPipelineCards } from "./components/BrandPipelineCards";
import { OriginBreakdownCard } from "./components/OriginBreakdownCard";
import { LogisticsTable } from "./components/LogisticsTable";

// Importaciones se cargan por batch — stale > 1 día es normal, > 7 días es riesgo.
const LOGISTICS_THRESHOLDS = { staleMinutes: 1440, riskMinutes: 10080 };

export default function LogisticsPage() {
  const lastLoadQ = useQuery({
    queryKey: logisticsKeys.lastLoad(),
    queryFn: fetchLogisticsLastLoad,
    staleTime: STALE_5MIN,
    gcTime: GC_60MIN,
  });
  const lastLoad = lastLoadQ.data ?? undefined;
  const logisticsStatus = lastLoad
    ? classifyFreshness(lastLoad, new Date(), LOGISTICS_THRESHOLDS)
    : "unknown" as const;

  const {
    groups,
    summary,
    pipeline,
    sections,
    showPast,
    togglePast,
    isLoading,
    error,
    hiddenPastCount,
    expanded,
    toggleGroup,
    expandAll,
    collapseAll,
  } = useLogistics();

  if (isLoading) return <PageSkeleton />;

  if (error) {
    return (
      <div className="p-4 sm:p-6">
        <div className="rounded-2xl border border-error-200 bg-error-50 p-6 dark:border-error-500/20 dark:bg-error-500/10">
          <p className="text-error-700 dark:text-error-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 p-4 sm:p-6">

      {/* ═══ TIER 1 — Contexto + Filtros ═══ */}
      <div className="exec-anim-1 flex flex-wrap items-center gap-2">
        <DataFreshnessTag
          lastDataDay={lastLoad ? lastLoad.getDate() : null}
          lastDataMonth={lastLoad ? lastLoad.getMonth() + 1 : null}
          freshnessStatus={logisticsStatus}
          refreshedAt={lastLoad}
        />
        <div className="ml-auto inline-flex overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={() => !showPast || togglePast()}
            className={`px-3 py-1.5 text-xs font-medium transition-colors duration-[var(--duration-fast)] ${
              !showPast
                ? "bg-brand-500 font-semibold text-white"
                : "bg-white text-gray-500 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
            }`}
          >
            Activos
          </button>
          <button
            type="button"
            onClick={() => showPast || togglePast()}
            className={`px-3 py-1.5 text-xs font-medium transition-colors duration-[var(--duration-fast)] ${
              showPast
                ? "bg-brand-500 font-semibold text-white"
                : "bg-white text-gray-500 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
            }`}
          >
            Todos{!showPast && hiddenPastCount > 0 && (
              <span className="ml-1 font-normal opacity-70">+{hiddenPastCount}</span>
            )}
          </button>
        </div>

      </div>

      {/* ═══ TIER 1B — StatCards ═══ */}
      <LogisticsStatCards summary={summary} />

      {/* ═══ TIER 2 — Analytics ═══ */}
      <div className="exec-anim-3 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <BrandPipelineCards pipeline={pipeline} />
        </div>
        <OriginBreakdownCard byOrigin={summary.byOrigin} />
      </div>

      {/* ═══ TIER 3 — Tabla agrupada por status ═══ */}
      <LogisticsTable
        sections={sections}
        expanded={expanded}
        onToggleGroup={toggleGroup}
        onExpandAll={expandAll}
        onCollapseAll={collapseAll}
        totalGroups={groups.length}
      />
    </div>
  );
}
