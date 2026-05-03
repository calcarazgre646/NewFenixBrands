/**
 * features/depots/DepotsPage.tsx
 *
 * Depositos & Cobertura — Rediseno 360.
 *
 * Estructura:
 *   1. Context bar (reemplaza hero) + filtros
 *   2. KPI cards (5)
 *   3. Network health bar (distribucion de riesgo)
 *   4. Nodos centrales (STOCK + RETAILS lado a lado)
 *   5. Tiendas dependientes (accordions)
 *   6. SKU lideres (tabla responsive)
 *   7. Supuestos (collapsible footer)
 */
import { useDepots } from "./hooks/useDepots";
import DepotKpiCards from "./components/DepotKpiCards";
import NetworkHealthBar from "./components/NetworkHealthBar";
import CentralNodeCard from "./components/CentralNodeCard";
import StoreAccordion from "./components/StoreAccordion";
import SkuLeadersTable from "./components/SkuLeadersTable";
import DepotInsights from "./components/DepotInsights";
import NoveltySection from "./components/NoveltySection";
import { PageSkeleton } from "@/components/ui/skeleton/Skeleton";
import { formatNumber } from "@/utils/format";
import { useDataFreshness } from "@/hooks/useDataFreshness";
import { DataFreshnessTag } from "@/features/executive/components/DataFreshnessTag";
import DeclareViewFilters from "@/components/filters/DeclareViewFilters";
import { FILTER_REASONS } from "@/domain/filters/viewSupport";

export default function DepotsPage() {
  const { lastDataDay, lastDataMonth, getStatus, getInfo } = useDataFreshness();
  const { data, isLoading, error } = useDepots();

  if (isLoading) return <PageSkeleton />;

  if (error || !data) {
    return (
      <div className="flex min-h-[400px] items-center justify-center p-4 sm:p-6">
        <div className="rounded-2xl border border-error-200 bg-error-50 px-6 py-4 text-sm text-error-700 dark:border-error-500/20 dark:bg-error-500/10 dark:text-error-400">
          Error al cargar datos: {error?.message ?? "Sin datos"}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 p-4 sm:p-6">

      {/* Filtros globales viven en el AppHeader. */}
      <DeclareViewFilters
        support={{
          brand: true,
          channel: FILTER_REASONS.noChannelInventory,
          period: FILTER_REASONS.noPeriodDepots,
        }}
      />

      {/* ═══ Context bar ═══ */}
      <div className="exec-anim-1 flex flex-wrap items-center gap-3">
        <DataFreshnessTag
          lastDataDay={lastDataDay}
          lastDataMonth={lastDataMonth}
          freshnessStatus={getStatus("mv_stock_tienda")}
          refreshedAt={getInfo("mv_stock_tienda")?.refreshedAt}
        />
        <div className="ml-auto flex flex-wrap gap-2">
          <Chip>{data.totals.dependentStoreCount} tiendas</Chip>
          <Chip>{formatNumber(data.totals.networkUnits)} uds. en red</Chip>
        </div>
      </div>

      {/* ═══ KPIs ═══ */}
      <section className="exec-anim-2">
        <DepotKpiCards data={data} />
      </section>

      {/* ═══ Network Health ═══ */}
      <section className="exec-anim-3">
        <NetworkHealthBar data={data} />
      </section>

      {/* ═══ Nodos centrales ═══ */}
      <section className="exec-anim-4">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
          Nodos centrales
        </p>
        <div className="grid gap-3 lg:grid-cols-2">
          <CentralNodeCard node={data.stock} defaultOpen />
          <CentralNodeCard node={data.retails} defaultOpen={false} />
        </div>
      </section>

      {/* ═══ Novedades / Lanzamientos ═══ */}
      {data.novelty.totalSkus > 0 && (
        <section className="exec-anim-4b">
          <NoveltySection novelty={data.novelty} />
        </section>
      )}

      {/* ═══ Tiendas dependientes ═══ */}
      <section className="exec-anim-5">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
          Tiendas dependientes
        </p>
        <div className="flex flex-col gap-2">
          {data.stores.map((store, i) => (
            <StoreAccordion key={store.key} store={store} defaultOpen={i < 2} />
          ))}
          {data.stores.length === 0 && (
            <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center text-sm text-gray-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-500">
              No hay tiendas dependientes con datos disponibles
            </div>
          )}
        </div>
      </section>

      {/* ═══ SKU lideres ═══ */}
      <section className="exec-anim-6">
        <SkuLeadersTable rows={data.topSkuRows} />
      </section>

      {/* ═══ Supuestos (collapsible) ═══ */}
      <section className="exec-anim-7">
        <DepotInsights data={data} />
      </section>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-gray-200 bg-white px-3 py-1 text-[11px] font-semibold text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
      {children}
    </span>
  );
}
