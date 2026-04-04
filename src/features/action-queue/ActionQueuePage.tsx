/**
 * features/action-queue/ActionQueuePage.tsx
 *
 * Centro de Acciones — shell con dos pestañas:
 *   1. Acciones: grupos priorizados por waterfall
 *   2. Planificación de Compra: SKUs con demanda insatisfecha (gap)
 *
 * El channel selector (B2C/B2B) es compartido — afecta el waterfall para ambas pestañas.
 * Cada pestaña maneja sus propios controles internos.
 *
 * REGLA: Sin logica de negocio. Solo layout + composicion.
 */
import { useState } from "react";
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
    <div className="space-y-6 p-4 sm:p-6">
      {/* ═══ PAGE HEADER: Channel + Tab bar + Freshness ═══ */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <DataFreshnessTag
          lastDataDay={lastDataDay}
          lastDataMonth={lastDataMonth}
          freshnessStatus={worstStatus(["mv_stock_tienda", "mv_doi_edad"])}
          refreshedAt={getInfo("mv_stock_tienda")?.refreshedAt}
        />
        {/* Tab bar */}
        <div className="flex items-center gap-1 rounded-xl border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-gray-800" role="tablist">
          <TabButton
            active={activeTab === "actions"}
            onClick={() => setActiveTab("actions")}
          >
            Acciones
            {data.totalItems > 0 && (
              <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                activeTab === "actions"
                  ? "bg-brand-600 text-white"
                  : "bg-gray-200 text-gray-500 dark:bg-gray-600 dark:text-gray-400"
              }`}>
                {data.totalItems}
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

        {/* Channel selector (shared — affects waterfall for both tabs) */}
        <div className="inline-flex overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={() => data.setChannel("b2c")}
            className={`px-3 py-1.5 text-xs font-medium transition-colors duration-[var(--duration-fast)] ${
              data.filters.channel === "b2c"
                ? "bg-brand-500 font-semibold text-white"
                : "bg-white text-gray-500 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
            }`}
          >
            B2C
          </button>
          <button
            type="button"
            onClick={() => data.setChannel("b2b")}
            className={`px-3 py-1.5 text-xs font-medium transition-colors duration-[var(--duration-fast)] ${
              data.filters.channel === "b2b"
                ? "bg-brand-500 font-semibold text-white"
                : "bg-white text-gray-500 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
            }`}
          >
            B2B
          </button>
        </div>
      </div>

      {/* ═══ TAB CONTENT ═══ */}
      {activeTab === "actions" ? (
        <ActionsTab
          items={data.items}
          storeStockMap={data.storeStockMap}
          totalItems={data.totalItems}
          paretoCount={data.paretoCount}
          criticalCount={data.criticalCount}
          lowCount={data.lowCount}
          overstockCount={data.overstockCount}
          uniqueSkus={data.uniqueSkus}
          channel={data.filters.channel}
          brand={data.filters.brand}
          isHistoryLoading={data.isHistoryLoading}
        />
      ) : (
        <PurchasePlanningTab
          items={data.items}
          avgDOI={data.avgDOI}
        />
      )}
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
      className={`flex items-center rounded-lg px-4 py-2 text-xs font-medium transition-all duration-200 ${
        active
          ? "bg-white text-gray-900 shadow-theme-xs dark:bg-gray-700 dark:text-white"
          : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
      }`}
    >
      {children}
    </button>
  );
}
