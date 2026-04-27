/**
 * features/projections/ProjectionPage.tsx
 *
 * Proyección de ventas y comisiones por vendedor.
 * Modelo: run-rate lineal diario (venta acum hoy / días transcurridos).
 *
 * Vista gerencia/super_user: lista todos los vendedores.
 * (Vista per-vendedor llega en sprint 3 con dashboard dedicado.)
 */
import { useState, useMemo } from "react";
import { formatPYGCompact } from "@/utils/format";
import { StatCard } from "@/components/ui/stat-card/StatCard";
import { CHANNEL_LABELS } from "@/domain/commissions/scales";
import type { CommissionChannel, CommissionRole } from "@/domain/commissions/types";
import { useSellerProjections } from "./hooks/useSellerProjections";
import { useFilters } from "@/hooks/useFilters";
import { useAuth } from "@/hooks/useAuth";
import { useDataFreshness } from "@/hooks/useDataFreshness";
import { DataFreshnessTag } from "@/features/executive/components/DataFreshnessTag";
import { PageSkeleton } from "@/components/ui/skeleton/Skeleton";
import ProjectionTable from "./components/ProjectionTable";

/** Roles de gerencia/liderazgo — solo visibles para super_user */
const MANAGEMENT_ROLES: CommissionRole[] = [
  "gerencia_retail",
  "gerencia_mayorista",
  "gerencia_utp",
];

const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export default function ProjectionPage() {
  const { lastDataDay, lastDataMonth, getStatus, getInfo } = useDataFreshness();
  const { filters } = useFilters();
  const { profile } = useAuth();
  const isSuperUser = profile?.role === "super_user";
  const year = filters.year;
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth() + 1);
  const [channelFilter, setChannelFilter] = useState<CommissionChannel | "todos">("todos");

  const { projections, summary, isLoading, error } = useSellerProjections(year, selectedMonth);

  const visibleResults = useMemo(() => {
    if (isSuperUser) return projections;
    return projections.filter(r => !MANAGEMENT_ROLES.includes(r.rolComision));
  }, [projections, isSuperUser]);

  const filtered = useMemo(() => {
    if (channelFilter === "todos") return visibleResults;
    return visibleResults.filter(r => r.canal === channelFilter);
  }, [visibleResults, channelFilter]);

  const filteredSummary = useMemo(() => {
    if (!summary) return null;
    if (channelFilter === "todos") {
      return {
        ...summary,
        totalVendedores: visibleResults.length,
        totalVentaActual: visibleResults.reduce((s, r) => s + r.ventaActual, 0),
        totalVentaProyectada: visibleResults.reduce((s, r) => s + r.ventaProyectada, 0),
        totalComisionProyectadaGs: visibleResults.reduce((s, r) => s + (r.comisionProyectadaGs ?? 0), 0),
      };
    }
    const ventaActual = filtered.reduce((s, r) => s + r.ventaActual, 0);
    const ventaProy = filtered.reduce((s, r) => s + r.ventaProyectada, 0);
    const commProy = filtered.reduce((s, r) => s + (r.comisionProyectadaGs ?? 0), 0);
    return {
      ...summary,
      totalVendedores: filtered.length,
      totalVentaActual: ventaActual,
      totalVentaProyectada: ventaProy,
      totalComisionProyectadaGs: commProy,
    };
  }, [summary, filtered, visibleResults, channelFilter]);

  // Derivar contexto temporal del primer resultado (todos comparten)
  const firstWithTime = projections[0];
  const diasTranscurridos = firstWithTime?.diasTranscurridos ?? 0;
  const diasMes = firstWithTime?.diasMes ?? 30;
  const diasRestantes = firstWithTime?.diasRestantes ?? 0;
  const isMonthClosed = firstWithTime?.isMonthClosed ?? false;
  const isInProgress = firstWithTime?.isInProgress ?? false;

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
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">Proyección por Vendedor</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Ritmo de venta lineal · Cierre estimado del mes con comisiones proyectadas
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {isInProgress && (
            <span className="inline-flex items-center rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-[10px] font-semibold text-brand-700 dark:border-brand-500/20 dark:bg-brand-500/10 dark:text-brand-400">
              Día {diasTranscurridos}/{diasMes} · {diasRestantes}d restantes
            </span>
          )}
          {isMonthClosed && (
            <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-[10px] font-semibold text-gray-600 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300">
              Mes cerrado
            </span>
          )}
          <DataFreshnessTag
            lastDataDay={lastDataDay}
            lastDataMonth={lastDataMonth}
            freshnessStatus={getStatus("mv_ventas_mensual")}
            refreshedAt={getInfo("mv_ventas_mensual")?.refreshedAt}
          />
          <select
            value={selectedMonth}
            onChange={e => setSelectedMonth(Number(e.target.value))}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
          >
            {MONTHS.map((m, i) => (
              <option key={i + 1} value={i + 1}>{m} {year}</option>
            ))}
          </select>
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
            label={isMonthClosed ? "Venta del mes" : "Venta acumulada"}
            value={formatPYGCompact(s?.totalVentaActual ?? 0)}
            sub={isInProgress ? `Día ${diasTranscurridos} de ${diasMes}` : undefined}
          />
          <StatCard
            label={isMonthClosed ? "Venta del mes" : "Proyección al cierre"}
            value={formatPYGCompact(s?.totalVentaProyectada ?? 0)}
            sub={isInProgress ? "ritmo lineal" : undefined}
            variant={(s?.totalVentaProyectada ?? 0) > 0 ? "accent-positive" : "neutral"}
          />
          <StatCard
            label="Comisiones proyectadas"
            value={formatPYGCompact(s?.totalComisionProyectadaGs ?? 0)}
            sub="Gs. al cierre del mes"
            variant={(s?.totalComisionProyectadaGs ?? 0) > 0 ? "accent-positive" : "neutral"}
          />
        </div>
      </section>

      {/* ═══ Tabla ═══ */}
      <section className="exec-anim-3">
        <ProjectionTable results={filtered} />
      </section>

      {/* ═══ Notas / disclaimer ═══ */}
      <section className="exec-anim-4 text-[11px] text-gray-500 dark:text-gray-400">
        <p>
          <span className="font-semibold">Cómo se calcula:</span> ritmo diario = venta acumulada / días transcurridos del mes.
          Proyección = venta hoy + ritmo × días restantes. Cobranza Mayorista/UTP no se proyecta (datos pendientes).
        </p>
      </section>
    </div>
  );
}
