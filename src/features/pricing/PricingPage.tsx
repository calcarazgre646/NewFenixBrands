/**
 * features/pricing/PricingPage.tsx
 *
 * Página de Precios.
 * Lectura: PVP, PVM, Costo y márgenes MBP/MBM por SKU Comercial.
 * Filtros globales: solo Marca aplica (canal y período no, ver FILTER_REASONS).
 * Agrupación visual: Marca → SKU en la tabla.
 */
import { useMemo, useState } from "react";
import { StatCard } from "@/components/ui/stat-card/StatCard";
import { PageSkeleton } from "@/components/ui/skeleton/Skeleton";
import { useDataFreshness } from "@/hooks/useDataFreshness";
import { DataFreshnessTag } from "@/features/executive/components/DataFreshnessTag";
import { calcMBP, calcMBM, isNovelty, MIN_VALID_PRICE } from "@/domain/pricing/calculations";
import { applyMarkdown } from "@/domain/pricing/markdown";
import { usePricing } from "./hooks/usePricing";
import { useSkuMarkdowns } from "./hooks/useSkuMarkdowns";
import { PricingTable } from "./components/PricingTable";
import { MarkdownEditModal } from "./components/MarkdownEditModal";
import DeclareViewFilters from "@/components/filters/DeclareViewFilters";
import { FILTER_REASONS } from "@/domain/filters/viewSupport";
import { useAuth } from "@/hooks/useAuth";
import type { PricingRow } from "@/queries/pricing.queries";

export default function PricingPage() {
  const { lastDataDay, lastDataMonth, getStatus, getInfo } = useDataFreshness();
  const { rows, isLoading, error } = usePricing();
  const { permissions } = useAuth();
  const { bySku, upsert, clear } = useSkuMarkdowns();
  const [editingRow, setEditingRow] = useState<PricingRow | null>(null);

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
      // Para el promedio MBP usamos el PVP efectivo: si hay markdown
      // cargado, el dato útil es el margen real, no el del precio nominal.
      const md = bySku.get(r.skuComercial || r.sku);
      const pvpEffective = md ? applyMarkdown(r.pvp, md.markdownPct) : r.pvp;
      if (pvpEffective >= MIN_VALID_PRICE && costoOk) { sumMBP += calcMBP(pvpEffective, r.costo); countMBP++; }
      if (r.pvm >= MIN_VALID_PRICE && costoOk) { sumMBM += calcMBM(r.pvm, r.costo); countMBM++; }
      if (isNovelty(r.estComercial)) noveltyCount++;
      if (pvpEffective >= MIN_VALID_PRICE && costoOk && r.costo > pvpEffective) negativeMargin++;
    }
    return {
      count: rows.length,
      noveltyCount,
      avgMBP: countMBP > 0 ? sumMBP / countMBP : 0,
      avgMBM: countMBM > 0 ? sumMBM / countMBM : 0,
      negativeMargin,
    };
  }, [rows, bySku]);

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
      {/* Filtros globales viven en el AppHeader. */}
      <DeclareViewFilters
        support={{
          brand: true,
          channel: FILTER_REASONS.noChannelPricing,
          period: FILTER_REASONS.noPeriodSnapshot,
        }}
      />

      <div className="exec-anim-1 flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">Precios</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            PVP, PVM y márgenes por SKU comercial.
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
        <PricingTable
          rows={rows}
          markdownsBySku={bySku}
          canEdit={permissions.canEditPricing}
          onEditMarkdown={setEditingRow}
        />
      </section>

      {editingRow && (
        <MarkdownEditModal
          skuComercial={editingRow.skuComercial || editingRow.sku}
          brand={editingRow.brand}
          description={editingRow.description}
          pvp={editingRow.pvp}
          costo={editingRow.costo}
          current={bySku.get(editingRow.skuComercial || editingRow.sku) ?? null}
          isSaving={upsert.isPending}
          isClearing={clear.isPending}
          saveError={upsert.error ? (upsert.error as Error).message : null}
          clearError={clear.error ? (clear.error as Error).message : null}
          onSave={async ({ markdownPct, note }) => {
            await upsert.mutateAsync({
              skuComercial: editingRow.skuComercial || editingRow.sku,
              brand: editingRow.brand,
              markdownPct,
              note,
            });
            setEditingRow(null);
          }}
          onClear={async () => {
            await clear.mutateAsync(editingRow.skuComercial || editingRow.sku);
            setEditingRow(null);
          }}
          onClose={() => setEditingRow(null)}
        />
      )}
    </div>
  );
}
