/**
 * features/projections/MyProjectionPage.tsx
 *
 * Vista personal del vendedor: SU venta del mes, ritmo, proyección y comisión.
 * Si el usuario no está mapeado a un vendedor (vendedor_codigo NULL), muestra
 * mensaje invitando a contactar al admin.
 */
import { useState, useMemo } from "react";
import { formatPYGCompact } from "@/utils/format";
import { StatCard } from "@/components/ui/stat-card/StatCard";
import { useFilters } from "@/hooks/useFilters";
import { useAuth } from "@/hooks/useAuth";
import { PageSkeleton } from "@/components/ui/skeleton/Skeleton";
import { useMyProjection } from "./hooks/useMyProjection";
import ProjectionChart from "./components/ProjectionChart";
import { ROLE_LABELS, CHANNEL_LABELS } from "@/domain/commissions/scales";
import type { DailyProjectionPoint, SellerProjection } from "@/domain/projections/types";

const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export default function MyProjectionPage() {
  const { filters } = useFilters();
  const { profile } = useAuth();
  const year = filters.year;
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth() + 1);

  const { vendedorCodigo, projection, series, isLoading, error } = useMyProjection(year, selectedMonth);

  // Si el usuario no está mapeado a un vendedor → mensaje claro
  if (vendedorCodigo == null) {
    return (
      <div className="flex min-h-[400px] items-center justify-center p-4 sm:p-6">
        <div className="max-w-md rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center dark:border-amber-500/20 dark:bg-amber-500/10">
          <h2 className="text-base font-semibold text-amber-900 dark:text-amber-300">
            Tu usuario no está vinculado a un vendedor
          </h2>
          <p className="mt-2 text-xs text-amber-800 dark:text-amber-400">
            Para ver tu proyección personal, un administrador debe asignar tu código
            de vendedor en la sección Usuarios.
          </p>
        </div>
      </div>
    );
  }

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

  if (!projection) {
    return (
      <div className="flex min-h-[400px] items-center justify-center p-4 sm:p-6">
        <div className="max-w-md rounded-2xl border border-gray-200 bg-white p-6 text-center dark:border-gray-700 dark:bg-gray-800">
          <h2 className="text-base font-semibold text-gray-800 dark:text-white">
            Sin datos para {MONTHS[selectedMonth - 1]} {year}
          </h2>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            No registramos transacciones tuyas en este mes (código {vendedorCodigo}).
          </p>
        </div>
      </div>
    );
  }

  const p = projection;
  const periodLabel = `${MONTHS[selectedMonth - 1]} ${year}`;

  return <Dashboard
    profileName={profile?.fullName ?? p.vendedorNombre}
    periodLabel={periodLabel}
    selectedMonth={selectedMonth}
    onMonthChange={setSelectedMonth}
    year={year}
    projection={p}
    series={series}
  />;
}

interface DashboardProps {
  profileName: string;
  periodLabel: string;
  selectedMonth: number;
  onMonthChange: (m: number) => void;
  year: number;
  projection: SellerProjection;
  series: DailyProjectionPoint[];
}

function Dashboard({ profileName, periodLabel, selectedMonth, onMonthChange, year, projection: p, series }: DashboardProps) {
  const cumplProy = p.cumplimientoProyectadoPct;
  const cumplActual = p.cumplimientoActualPct;
  const cumplVariant = useMemo<"accent-positive" | "accent-negative" | "neutral">(() => {
    if (cumplProy == null) return "neutral";
    if (cumplProy >= 100) return "accent-positive";
    if (cumplProy >= 80) return "neutral";
    return "accent-negative";
  }, [cumplProy]);

  return (
    <div className="space-y-5 p-4 sm:p-6">
      {/* ═══ Header ═══ */}
      <div className="exec-anim-1 flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">
            Mi Proyección
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {profileName} · {ROLE_LABELS[p.rolComision]} · {CHANNEL_LABELS[p.canal] ?? p.canal}
            {p.sucursalCodigo ? ` · ${p.sucursalCodigo}` : ""}
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {p.isInProgress && (
            <span className="inline-flex items-center rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-[10px] font-semibold text-brand-700 dark:border-brand-500/20 dark:bg-brand-500/10 dark:text-brand-400">
              Día {p.diasTranscurridos}/{p.diasMes} · {p.diasRestantes}d restantes
            </span>
          )}
          {p.isMonthClosed && (
            <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-[10px] font-semibold text-gray-600 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300">
              Mes cerrado
            </span>
          )}
          <select
            value={selectedMonth}
            onChange={e => onMonthChange(Number(e.target.value))}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
          >
            {MONTHS.map((m, i) => (
              <option key={i + 1} value={i + 1}>{m} {year}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ═══ KPIs principales ═══ */}
      <section className="exec-anim-2">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            label={p.isMonthClosed ? "Venta del mes" : "Venta hasta hoy"}
            value={formatPYGCompact(p.ventaActual)}
            sub={p.isInProgress ? `Ritmo ${formatPYGCompact(p.ritmoDiario)}/día` : periodLabel}
          />
          <StatCard
            label={p.isMonthClosed ? "Venta del mes" : "Proyección al cierre"}
            value={formatPYGCompact(p.ventaProyectada)}
            sub={p.isInProgress ? `${p.diasRestantes}d × ritmo lineal` : "Mes cerrado"}
            variant="accent-positive"
          />
          <StatCard
            label="Cumplimiento proy."
            value={cumplProy != null ? `${cumplProy.toFixed(1)}%` : "—"}
            sub={
              p.metaVentas != null
                ? `Meta ${formatPYGCompact(p.metaVentas)}`
                : "Meta pendiente"
            }
            variant={cumplVariant}
          />
          <StatCard
            label="Comisión proyectada"
            value={p.comisionProyectadaGs != null ? formatPYGCompact(p.comisionProyectadaGs) : "Pendiente"}
            sub={
              p.comisionProyectadaPct != null && p.comisionProyectadaPct > 0
                ? `${p.comisionProyectadaPct.toFixed(2)}% sobre venta`
                : "Sin tramo aplicable"
            }
            variant={p.comisionProyectadaGs != null && p.comisionProyectadaGs > 0 ? "accent-positive" : "neutral"}
          />
        </div>
      </section>

      {/* ═══ Comparativa actual ═══ */}
      {cumplActual != null && p.isInProgress && (
        <section className="exec-anim-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
              Cumplimiento actual
            </p>
            <p className="mt-1 text-xl font-bold text-gray-900 dark:text-white">
              {cumplActual.toFixed(1)}%
            </p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
              Comisión hasta hoy
            </p>
            <p className="mt-1 text-xl font-bold text-gray-900 dark:text-white">
              {p.comisionActualGs != null ? formatPYGCompact(p.comisionActualGs) : "—"}
            </p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
              Faltan para meta
            </p>
            <p className="mt-1 text-xl font-bold text-gray-900 dark:text-white">
              {p.metaVentas != null
                ? formatPYGCompact(Math.max(0, p.metaVentas - p.ventaActual))
                : "—"}
            </p>
          </div>
        </section>
      )}

      {/* ═══ Gráfico día×día ═══ */}
      <section className="exec-anim-4 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
          Curva acumulada del mes
        </h3>
        {series.length > 0
          ? <ProjectionChart series={series} height={300} />
          : <p className="py-12 text-center text-xs text-gray-400">Sin datos para graficar</p>
        }
      </section>

      {/* ═══ Disclaimer ═══ */}
      <section className="exec-anim-4 text-[11px] text-gray-500 dark:text-gray-400">
        <p>
          <span className="font-semibold">Cómo se calcula:</span> ritmo diario = venta acumulada / días transcurridos del mes.
          Proyección = venta hoy + ritmo × días restantes. La comisión proyectada es estimativa y no incluye cobranza
          (datos pendientes para Mayorista/UTP).
        </p>
      </section>
    </div>
  );
}
