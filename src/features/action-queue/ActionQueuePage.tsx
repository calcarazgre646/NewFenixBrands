/**
 * features/action-queue/ActionQueuePage.tsx
 *
 * Centro de Acciones — shell con dos pestañas:
 *   1. Acciones: movimientos + intervenciones lifecycle (un solo motor waterfall)
 *   2. Planificación de Compra: SKUs con demanda insatisfecha (gap)
 *
 * El channel selector (B2C/B2B) es compartido — afecta el waterfall para ambas pestañas.
 * Cada pestaña maneja sus propios controles internos.
 *
 * REGLA: Sin logica de negocio. Solo layout + composicion.
 */
import { useState, useMemo } from "react";
import { useSearchParams } from "react-router";
import { useActionQueue } from "./hooks/useActionQueue";
import { useDataFreshness } from "@/hooks/useDataFreshness";
import { DataFreshnessTag } from "@/features/executive/components/DataFreshnessTag";
import { ActionsTab } from "./components/ActionsTab";
import { PurchasePlanningTab } from "./components/PurchasePlanningTab";
import { ActionQueueLoader } from "./components/ActionQueueLoader";

// ─── Types ───────────────────────────────────────────────────────────────────

type ActiveTab = "actions" | "planning";

// ─── Main component ──────────────────────────────────────────────────────────

export default function ActionQueuePage() {
  const data = useActionQueue();
  const { lastDataDay, lastDataMonth, worstStatus, getInfo } = useDataFreshness();
  const [activeTab, setActiveTab] = useState<ActiveTab>("actions");
  const [searchParams] = useSearchParams();
  const expandStore = useMemo(() => searchParams.get("store"), [searchParams]);

  if (data.isLoading) return <ActionQueueLoader progress={data.loadingProgress} />;

  if (data.error) {
    return (
      <div className="p-4 sm:p-6">
        <div className="rounded-2xl border border-error-200 bg-error-50 p-6 dark:border-error-500/20 dark:bg-error-500/10">
          <p className="text-error-700 dark:text-error-400">{data.error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ═══ TAB BAR — full width, top ═══ */}
      <div className="flex items-center justify-between border-b border-gray-200 px-4 sm:px-6 dark:border-gray-700">
        <div className="flex items-center gap-0" role="tablist">
          <TabButton
            active={activeTab === "actions"}
            onClick={() => setActiveTab("actions")}
          >
            Acciones
            {data.movementCount > 0 && (
              <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                activeTab === "actions"
                  ? "bg-brand-600 text-white"
                  : "bg-gray-200 text-gray-500 dark:bg-gray-600 dark:text-gray-400"
              }`}>
                {data.movementCount}
              </span>
            )}
            {data.lifecycleCount > 0 && (
              <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                activeTab === "actions"
                  ? "bg-violet-500 text-white"
                  : "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-400"
              }`}>
                {data.lifecycleCount}
              </span>
            )}
          </TabButton>
          <TabButton
            active={activeTab === "planning"}
            onClick={() => setActiveTab("planning")}
          >
            Planificación de Compra
            {data.totalGapUnits > 0 && (
              <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                activeTab === "planning"
                  ? "bg-error-500 text-white"
                  : "bg-error-100 text-error-700 dark:bg-error-500/20 dark:text-error-400"
              }`}>
                {data.totalGapUnits.toLocaleString("es-PY")}
              </span>
            )}
          </TabButton>
        </div>
        <DataFreshnessTag
          lastDataDay={lastDataDay}
          lastDataMonth={lastDataMonth}
          freshnessStatus={worstStatus(["mv_stock_tienda", "mv_doi_edad"])}
          refreshedAt={getInfo("mv_stock_tienda")?.refreshedAt}
        />
      </div>

      {/* ═══ TAB CONTENT ═══ */}
      <div className="px-4 sm:px-6">
      {activeTab === "actions" && (
        <ActionsTab
          items={data.items}
          storeStockMap={data.storeStockMap}
          totalItems={data.totalItems}
          channel={data.filters.channel}
          brand={data.filters.brand}
          expandStore={expandStore}
        />
      )}
      {activeTab === "planning" && (
        <PurchasePlanningTab
          items={data.items}
          avgDOI={data.avgDOI}
        />
      )}
      </div>
    </div>
  );
}

// ─── Tab button ──────────────────────────────────────────────────────────────

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-all duration-200 border-b-2 -mb-px ${
        active
          ? "border-brand-500 text-gray-900 dark:text-white"
          : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:border-gray-600"
      }`}
    >
      {children}
    </button>
  );
}
