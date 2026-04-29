/**
 * CommissionsPage — sección unificada de Comisiones.
 *
 * Vive en `/comisiones` y absorbe a las antiguas `/proyeccion-vendedor` y
 * `/mi-proyeccion` (que redirigen aquí). El contenido se ajusta al scope
 * del usuario:
 *
 *   - super_user / gerencia → tabs Resumen + Equipo + Histórico
 *   - vendedor              → tabs Resumen + Histórico (sin Equipo)
 *
 * Layout: header (título + filtros mes/canal + freshness + tabs) →
 * contenido por tab.
 */
import { useMemo, useState } from "react";
import { Tabs, type TabItem } from "@/components/ui/tabs/Tabs";
import { DataFreshnessTag } from "@/features/executive/components/DataFreshnessTag";
import { CHANNEL_LABELS } from "@/domain/commissions/scales";
import { useFilters } from "@/hooks/useFilters";
import { useDataFreshness } from "@/hooks/useDataFreshness";
import { useCompensation } from "./hooks/useCompensation";
import { buildCompensationSummary } from "./hooks/derive";
import ResumenTab from "./components/tabs/ResumenTab";
import EquipoTab from "./components/tabs/EquipoTab";
import HistoricoTab from "./components/tabs/HistoricoTab";
import CommissionsLoader from "./components/CommissionsLoader";
import type { CommissionChannel } from "@/domain/commissions/types";

type TabKey = "resumen" | "equipo" | "historico";

const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export default function CommissionsPage() {
  const { lastDataDay, lastDataMonth, getStatus, getInfo } = useDataFreshness();
  const { filters } = useFilters();
  const year = filters.year;
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth() + 1);
  const [channelFilter, setChannelFilter] = useState<CommissionChannel | "todos">("todos");
  const [activeTab, setActiveTab] = useState<TabKey>("resumen");

  const data = useCompensation(year, selectedMonth);

  // Filtro por canal — aplica a rows. self queda intacto (un único vendedor).
  const filteredData = useMemo(() => {
    if (channelFilter === "todos") return data;
    const filtered = data.rows.filter((r) => r.projection.canal === channelFilter);
    return {
      ...data,
      rows: filtered,
      summary: buildCompensationSummary(filtered),
    };
  }, [data, channelFilter]);

  const tabs = useMemo<TabItem<TabKey>[]>(() => {
    const base: TabItem<TabKey>[] = [
      { key: "resumen", label: "Resumen" },
    ];
    if (data.scope === "team") {
      base.push({ key: "equipo", label: "Equipo", badge: data.rows.length });
    }
    base.push({ key: "historico", label: "Histórico" });
    return base;
  }, [data.scope, data.rows.length]);

  if (data.isLoading) return <CommissionsLoader scope={data.scope} />;

  if (data.error) {
    return (
      <div className="flex min-h-[400px] items-center justify-center p-4 sm:p-6">
        <div className="rounded-2xl border border-error-200 bg-error-50 px-6 py-4 text-sm text-error-700 dark:border-error-500/20 dark:bg-error-500/10 dark:text-error-400">
          Error al cargar datos: {data.error.message}
        </div>
      </div>
    );
  }

  const { time } = data;

  return (
    <div className="space-y-5 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">Comisiones</h1>
          <DataFreshnessTag
            lastDataDay={lastDataDay}
            lastDataMonth={lastDataMonth}
            freshnessStatus={getStatus("mv_ventas_mensual")}
            refreshedAt={getInfo("mv_ventas_mensual")?.refreshedAt}
          />
          {data.scope === "self" && (
            <p className="basis-full text-xs text-gray-500 dark:text-gray-400">
              Tu desempeño y proyección personal
            </p>
          )}
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {time.isMonthClosed && (
            <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-[10px] font-semibold text-gray-600 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300">
              Mes cerrado
            </span>
          )}

          <div className="relative">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="appearance-none rounded-lg border border-gray-200 bg-white py-1.5 pl-3 pr-8 text-xs font-medium text-gray-700 cursor-pointer dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
            >
              {MONTHS.map((m, i) => (
                <option key={i + 1} value={i + 1}>{m} {year}</option>
              ))}
            </select>
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              fill="none"
              className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400 dark:text-gray-500"
            >
              <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          {data.scope === "team" && (
            <div className="flex rounded-lg border border-gray-200 dark:border-gray-600">
              {(["todos", "retail", "mayorista", "utp"] as const).map((ch) => (
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
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs items={tabs} active={activeTab} onChange={setActiveTab} size="md" />

      {/* Contenido por tab */}
      <div>
        {activeTab === "resumen" && <ResumenTab data={filteredData} />}
        {activeTab === "equipo" && data.scope === "team" && (
          <EquipoTab data={filteredData} year={year} month={selectedMonth} />
        )}
        {activeTab === "historico" && <HistoricoTab data={filteredData} />}
      </div>
    </div>
  );
}
