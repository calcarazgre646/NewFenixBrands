/**
 * features/marketing/MarketingPage.tsx
 *
 * Motor Automatizado de Marketing (SAM).
 *
 * UX: El sistema YA funciona. Los triggers están pre-cargados, los datos
 * se sincronizan automáticamente, y el dashboard muestra insights reales.
 *
 * Tabs: Resumen | Inventario | Productos | Automatizaciones | Outbound
 *
 * NOTA: La lista de clientes NO se expone en UI (decisión de Rodrigo, 27/03/2026).
 * Los datos de clientes (sam_customers) siguen alimentando el sistema: triggers
 * evaluan contra ellos, dry-run los matchea, ETL los sincroniza. Pero ningún
 * rol (ni super_user) ve el listado con datos personales.
 */
import { useState } from "react";
import { PageHeader } from "@/components/ui/page-header/PageHeader";
import { Tabs, type TabItem } from "@/components/ui/tabs/Tabs";
import { Spinner } from "@/components/ui/spinner/Spinner";
import DeclareViewFilters from "@/components/filters/DeclareViewFilters";
import { ALL_FILTERS_ENABLED } from "@/domain/filters/viewSupport";
import { MarketingStatsBar } from "./components/MarketingStatsBar";
import { SyncStatusBar } from "./components/SyncStatusBar";
import { TriggerInsights } from "./components/TriggerInsights";
import { TriggerList } from "./components/TriggerList";
import { TriggerFormModal } from "./components/TriggerFormModal";
import { DryRunPreview } from "./components/DryRunPreview";
import { OutboundTab } from "./components/OutboundTab";
import { MarketingCharts } from "./components/MarketingCharts";
import { InventoryHealth } from "./components/InventoryHealth";
import { ProductIntelligence } from "./components/ProductIntelligence";
import { CommercialInsights } from "./components/CommercialInsights";
import { ConfigurationTab } from "./components/ConfigurationTab";
import { useMarketingDashboard } from "./hooks/useMarketingDashboard";
import { useTriggers } from "./hooks/useTriggers";
import { useTriggerRecommendations } from "./hooks/useTriggerRecommendations";
import { useTemplates } from "./hooks/useTemplates";
import { useTriggerDryRun } from "./hooks/useTriggerDryRun";
import { useCampaigns } from "./hooks/useCampaigns";
import { useExecutions } from "./hooks/useExecutions";
import { useMarketingInventory } from "./hooks/useMarketingInventory";
import { useMarketingProducts } from "./hooks/useMarketingProducts";

type MarketingTab =
  | "resumen"
  | "inventario"
  | "productos"
  | "automatizaciones"
  | "outbound"
  | "config";

const TAB_ITEMS: TabItem<MarketingTab>[] = [
  { key: "resumen",           label: "Resumen" },
  { key: "inventario",        label: "Inventario" },
  { key: "productos",         label: "Productos" },
  { key: "automatizaciones",  label: "Automatizaciones" },
  { key: "outbound",          label: "Outbound" },
  { key: "config",            label: "Configuración" },
];

export default function MarketingPage() {
  const [activeTab, setActiveTab] = useState<MarketingTab>("resumen");

  const dashboard = useMarketingDashboard();
  const triggers = useTriggers();
  const templates = useTemplates();
  const dryRun = useTriggerDryRun();
  const campaigns = useCampaigns();
  const executions = useExecutions();
  const inventory = useMarketingInventory();
  const products = useMarketingProducts();
  const triggerRecommendations = useTriggerRecommendations(triggers.triggers);

  // ── First-time sync screen ──
  if (dashboard.isSyncing && dashboard.customerCount === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-6">
        <Spinner size="lg" />
        <div className="text-center">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            Preparando el Motor de Marketing
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {dashboard.syncProgress.message || "Importando datos del ERP por primera vez..."}
          </p>
          {dashboard.syncProgress.phase === "error" && (
            <p className="mt-2 text-sm font-medium text-red-600 dark:text-red-400">
              {dashboard.syncProgress.message}
            </p>
          )}
          <div className="mt-4 mx-auto w-64 h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
            <div
              className="h-full rounded-full bg-brand-500 transition-all duration-500"
              style={{ width: syncPct(dashboard.syncProgress.phase) }}
            />
          </div>
          <p className="mt-2 text-xs text-gray-400">
            Esto toma ~1 minuto. Solo pasa la primera vez.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 p-4 lg:p-6" id="main-content">
      <PageHeader
        title="Marketing"
        description="Motor Automatizado de Marketing (SAM)"
      />

      {/* Filtros globales viven en el AppHeader. Afectan Inventario y Productos.
          Clientes/Triggers son cross-channel por diseño (metadata no filtrada). */}
      <DeclareViewFilters support={ALL_FILTERS_ENABLED} />

      {/* Sync status — sutil, siempre visible */}
      <SyncStatusBar
        isSyncing={dashboard.isSyncing}
        progress={dashboard.syncProgress}
        lastSyncedAt={dashboard.etlStats.lastSyncedAt}
        totalSynced={dashboard.etlStats.totalSynced}
        onRefresh={dashboard.runETL}
      />

      <Tabs items={TAB_ITEMS} active={activeTab} onChange={setActiveTab} />

      <div className="min-h-[400px]">
        {/* ════════ RESUMEN ════════ */}
        {activeTab === "resumen" && (
          <div className="space-y-6">
            <MarketingStatsBar metrics={dashboard.metrics} />

            {/* Insights: cuántos clientes matchean cada regla */}
            <TriggerInsights
              insights={dashboard.insights}
              onToggle={triggers.toggleTrigger}
            />

            {/* Inteligencia comercial — datos de ITR + PIM */}
            <CommercialInsights
              inventory={inventory.summary}
              products={products.data}
              onNavigate={(tab) => setActiveTab(tab as MarketingTab)}
            />

            <MarketingCharts metrics={dashboard.metrics} etlStats={dashboard.etlStats} />
          </div>
        )}

        {/* ════════ INVENTARIO (ITR) ════════ */}
        {activeTab === "inventario" && (
          <InventoryHealth
            summary={inventory.summary}
            isLoading={inventory.isLoading}
          />
        )}

        {/* ════════ PRODUCTOS (PIM) ════════ */}
        {activeTab === "productos" && (
          <ProductIntelligence
            data={products.data}
            isLoading={products.isLoading}
          />
        )}

        {/* ════════ AUTOMATIZACIONES ════════ */}
        {activeTab === "automatizaciones" && (
          <div className="space-y-6">
            {/* Insights summary at top */}
            <TriggerInsights
              insights={dashboard.insights}
              onToggle={triggers.toggleTrigger}
            />

            {/* Detailed trigger management */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
                Gestión de Reglas
              </h3>
              <TriggerList
                triggers={triggers.triggers}
                isLoading={triggers.isLoading}
                onToggle={triggers.toggleTrigger}
                onEdit={triggers.openEdit}
                onDelete={triggers.deleteTrigger}
                onDryRun={dryRun.evaluate}
                onCreate={triggers.openCreate}
                recommendations={triggerRecommendations.byTrigger}
              />
            </div>

            {triggers.editingTrigger && (
              <TriggerFormModal
                trigger={triggers.editingTrigger}
                templates={templates.templates}
                campaigns={campaigns.campaigns}
                onSave={triggers.updateTrigger}
                onClose={triggers.closeEdit}
                isSaving={triggers.isUpdating}
              />
            )}
            {triggers.createModalOpen && (
              <TriggerFormModal
                trigger={null}
                templates={templates.templates}
                campaigns={campaigns.campaigns}
                onSave={triggers.createTrigger}
                onClose={triggers.closeCreate}
                isSaving={triggers.isCreating}
              />
            )}
            {dryRun.matchedCustomers.length > 0 && (
              <DryRunPreview
                customers={dryRun.matchedCustomers}
                isEvaluating={dryRun.isEvaluating}
                onClose={dryRun.clear}
              />
            )}
          </div>
        )}

        {/* ════════ OUTBOUND (Contenido + Campañas + Historial) ════════ */}
        {activeTab === "outbound" && (
          <OutboundTab
            templates={templates}
            campaigns={campaigns}
            triggers={triggers}
            executions={executions}
          />
        )}

        {/* ════════ CONFIGURACIÓN (Resend + from alias + tests) ════════ */}
        {activeTab === "config" && <ConfigurationTab />}
      </div>
    </div>
  );
}

function syncPct(phase: string): string {
  switch (phase) {
    case "fetching-clim100": return "15%";
    case "fetching-transactions": return "35%";
    case "fetching-cobranzas": return "55%";
    case "processing": return "75%";
    case "upserting": return "90%";
    case "done": return "100%";
    default: return "5%";
  }
}
