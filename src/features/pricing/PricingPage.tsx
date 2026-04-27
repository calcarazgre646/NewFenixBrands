/**
 * features/pricing/PricingPage.tsx
 *
 * Página de Precios.
 * Lectura: PVP, PVM, Costo y márgenes MBP/MBM por SKU Comercial.
 * Filtro de marca: global vía header (useFilters).
 * Agrupación visual: Marca → SKU en la tabla.
 */
import { useMemo } from "react";
import { StatCard } from "@/components/ui/stat-card/StatCard";
import { PageSkeleton } from "@/components/ui/skeleton/Skeleton";
import { useDataFreshness } from "@/hooks/useDataFreshness";
import { DataFreshnessTag } from "@/features/executive/components/DataFreshnessTag";
import { calcMBP, calcMBM, isNovelty, MIN_VALID_PRICE } from "@/domain/pricing/calculations";
import { usePricing } from "./hooks/usePricing";
import { PricingTable } from "./components/PricingTable";

export default function PricingPage() {
  const { lastDataDay, lastDataMonth, getStatus, getInfo } = useDataFreshness();
  const { rows, isLoading, error } = usePricing();

  const stats = useMemo(() => {
    if (rows.length === 0) {
      return { count: 0, noveltyCount: 0, avgMBP: 0, avgMBM: 0, negativeMargin: 0 };
    }
    let sumMBP = 0, sumMBM = 0, countMBP = 0, countMBM = 0, noveltyCount = 0, negativeMargin = 0;
    for (const r of rows) {
      // Solo cuenta SKUs con precio Y costo reales (≥ MIN_VALID_PRICE) —
      // los placeholders ERP (0 ó 1) en cualquiera de los dos lados rompen
      // el promedio (precios ridículos producen márgenes de ±10⁷ %; costos
      // ridículos producen márgenes falsos cercanos a 100%).
      const costoOk = r.costo >= MIN_VALID_PRICE;
      if (r.pvp >= MIN_VALID_PRICE && costoOk) { sumMBP += calcMBP(r.pvp, r.costo); countMBP++; }
      if (r.pvm >= MIN_VALID_PRICE && costoOk) { sumMBM += calcMBM(r.pvm, r.costo); countMBM++; }
      if (isNovelty(r.estComercial)) noveltyCount++;
      if (r.pvp >= MIN_VALID_PRICE && costoOk && r.costo > r.pvp) negativeMargin++;
    }
    return {
      count: rows.length,
      noveltyCount,
      avgMBP: countMBP > 0 ? sumMBP / countMBP : 0,
      avgMBM: countMBM > 0 ? sumMBM / countMBM : 0,
      negativeMargin,
    };
  }, [rows]);

  if (isLoading) return <PageSkeleton />;

  if (error) {
    return (
      <div className="flex min-h-[400px] items-center justify-center p-4 sm:p-6">
        <div className="rounded-2xl border border-error-200 bg-error-50 px-6 py-4 text-sm text-error-700 dark:border-error-500/20 dark:bg-error-500/10 dark:text-error-400">
          Error al cargar datos: {error.message}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div className="exec-anim-1 flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">Precios</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            PVP, PVM y márgenes por SKU comercial. Filtrá por marca desde el header.
          </p>
        </div>
        <div className="ml-auto">
          <DataFreshnessTag
            lastDataDay={lastDataDay}
            lastDataMonth={lastDataMonth}
            freshnessStatus={getStatus("mv_stock_tienda")}
            refreshedAt={getInfo("mv_stock_tienda")?.refreshedAt}
          />
        </div>
      </div>

      <section className="exec-anim-2">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="SKUs" value={String(stats.count)} sub="Únicos con stock" />
          <StatCard label="MBP promedio" value={`${stats.avgMBP.toFixed(1)}%`} sub="Retail" />
          <StatCard label="MBM promedio" value={`${stats.avgMBM.toFixed(1)}%`} sub="Mayorista" />
          <StatCard
            label="Margen negativo"
            value={String(stats.negativeMargin)}
            sub="SKUs con costo > PVP"
            variant={stats.negativeMargin > 0 ? "negative" : "neutral"}
          />
        </div>
      </section>

      <section>
        <PricingTable rows={rows} />
      </section>
    </div>
  );
}
