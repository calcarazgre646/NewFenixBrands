/**
 * features/commissions/CommissionsPage.tsx
 *
 * Página de Comisiones — ventas reales por vendedor de fjdhstvta1.
 * Meta de fmetasucu (nivel tienda). Escalas del pedido de Rodrigo.
 *
 * Pendiente: tabla comisiones_metas_vendedor para metas individuales.
 * Pendiente: c_cobrar para comisión de cobranza Mayorista/UTP.
 */
import { useState, useMemo } from "react";
import { formatPYGCompact } from "@/utils/format";
import { StatCard } from "@/components/ui/stat-card/StatCard";
import { CHANNEL_LABELS } from "@/domain/commissions/scales";
import { useCommissionScales } from "@/hooks/useConfig";
import type { CommissionChannel, CommissionRole } from "@/domain/commissions/types";
import { useCommissions } from "./hooks/useCommissions";
import { useFilters } from "@/context/FilterContext";
import { useAuth } from "@/context/AuthContext";
import { useDataFreshness } from "@/hooks/useDataFreshness";
import { DataFreshnessTag } from "@/features/executive/components/DataFreshnessTag";
import { PageSkeleton } from "@/components/ui/skeleton/Skeleton";
import CommissionTable from "./components/CommissionTable";
import ScalesReference from "./components/ScalesReference";

/** Roles de gerencia/liderazgo — solo visibles para super_user */
const MANAGEMENT_ROLES: CommissionRole[] = [
  "gerencia_retail",
  "gerencia_mayorista",
  "gerencia_utp",
];

const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export default function CommissionsPage() {
  const { lastDataDay, lastDataMonth, getStatus, getInfo } = useDataFreshness();
  const { filters } = useFilters();
  const { profile } = useAuth();
  const isSuperUser = profile?.role === "super_user";
  const scales = useCommissionScales();
  const allScales = Object.values(scales);
  const year = filters.year;
  const [selectedMonth, setSelectedMonth] = useState(() => {
    // Default al mes en curso (getMonth() es 0-indexed, +1 para 1-12)
    return new Date().getMonth() + 1;
  });
  const [channelFilter, setChannelFilter] = useState<CommissionChannel | "todos">("todos");
  const [showScales, setShowScales] = useState(false);

  const { results, summary, isLoading, error } = useCommissions(year, selectedMonth);

  // Filtrar roles de gerencia/liderazgo si no es super_user
  const visibleResults = useMemo(() => {
    if (isSuperUser) return results;
    return results.filter(r => !MANAGEMENT_ROLES.includes(r.rolComision));
  }, [results, isSuperUser]);

  const filtered = useMemo(() => {
    if (channelFilter === "todos") return visibleResults;
    return visibleResults.filter(r => r.canal === channelFilter);
  }, [visibleResults, channelFilter]);

  const filteredSummary = useMemo(() => {
    if (!summary) return null;
    if (channelFilter === "todos") return summary;
    // Recalculate totals for the filtered channel
    const totalGs = filtered.reduce((s, r) => s + r.comisionTotalGs, 0);
    return { ...summary, totalVendedores: filtered.length, totalComisionesGs: totalGs };
  }, [summary, filtered, channelFilter]);

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

  const s = filteredSummary;

  return (
    <div className="space-y-5 p-4 sm:p-6">

      {/* ═══ Header ═══ */}
      <div className="exec-anim-1 flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">Comisiones</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Cálculo automático por vendedor — meta vs venta real
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {/* Indicadores */}
          <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[10px] font-semibold text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400">
            Datos reales
          </span>
          <DataFreshnessTag
            lastDataDay={lastDataDay}
            lastDataMonth={lastDataMonth}
            freshnessStatus={getStatus("mv_ventas_mensual")}
            refreshedAt={getInfo("mv_ventas_mensual")?.refreshedAt}
          />
          {/* Month selector */}
          <select
            value={selectedMonth}
            onChange={e => setSelectedMonth(Number(e.target.value))}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
          >
            {MONTHS.map((m, i) => (
              <option key={i + 1} value={i + 1}>{m} {year}</option>
            ))}
          </select>
          {/* Channel filter */}
          <div className="flex rounded-lg border border-gray-200 dark:border-gray-600">
            {(["todos", "retail", "mayorista", "utp"] as const).map(ch => (
              <button
                key={ch}
                onClick={() => setChannelFilter(ch)}
                className={`px-3 py-1.5 text-[11px] font-medium transition-colors first:rounded-l-lg last:rounded-r-lg ${
                  channelFilter === ch
                    ? "bg-brand-500 text-white"
                    : "bg-white text-gray-600 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                }`}
              >
                {ch === "todos" ? "Todos" : CHANNEL_LABELS[ch] ?? ch}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ═══ KPIs ═══ */}
      <section className="exec-anim-2">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            label="Vendedores"
            value={String(s?.totalVendedores ?? 0)}
            sub={`${MONTHS[selectedMonth - 1]} ${year}`}
          />
          <StatCard
            label="Total comisiones"
            value={formatPYGCompact(s?.totalComisionesGs ?? 0)}
            sub="Gs. calculados"
            variant={(s?.totalComisionesGs ?? 0) > 0 ? "accent-positive" : "neutral"}
          />
          <StatCard
            label="Retail"
            value={formatPYGCompact(s?.byChannel.retail.totalGs ?? 0)}
            sub={`${s?.byChannel.retail.count ?? 0} vendedores`}
          />
          <StatCard
            label="Mayorista + UTP"
            value={formatPYGCompact((s?.byChannel.mayorista.totalGs ?? 0) + (s?.byChannel.utp.totalGs ?? 0))}
            sub={`${(s?.byChannel.mayorista.count ?? 0) + (s?.byChannel.utp.count ?? 0)} vendedores`}
          />
        </div>
      </section>

      {/* ═══ Tabla de comisiones ═══ */}
      <section className="exec-anim-3">
        <CommissionTable results={filtered} />
      </section>

      {/* ═══ Escalas de referencia ═══ */}
      <section className="exec-anim-4">
        <button
          onClick={() => setShowScales(!showScales)}
          className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-gray-400 transition-colors hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
        >
          <svg className={`h-3 w-3 transition-transform ${showScales ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          Escalas de referencia ({allScales.length} roles)
        </button>
        {showScales && <ScalesReference scales={allScales} />}
      </section>
    </div>
  );
}
