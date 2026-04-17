/**
 * features/marketing/components/OutboundTab.tsx
 *
 * Container para la pestaña "Outbound" del SAM.
 * 3 sub-tabs: Contenido (templates) | Campañas | Historial (ejecuciones).
 *
 * Conecta componentes existentes que estaban creados pero no wired.
 */
import { useState, useMemo } from "react";
import { EmptyState } from "@/components/ui/empty-state/EmptyState";
import { TemplateList } from "./TemplateList";
import { TemplateFormModal } from "./TemplateFormModal";
import { CampaignCard } from "./CampaignCard";
import { CampaignFormModal } from "./CampaignFormModal";
import { ExecutionLog } from "./ExecutionLog";
import type { useTemplates } from "../hooks/useTemplates";
import type { useCampaigns } from "../hooks/useCampaigns";
import type { useTriggers } from "../hooks/useTriggers";
import type { useExecutions } from "../hooks/useExecutions";

type SubTab = "contenido" | "campanas" | "historial";

const SUB_TABS: { key: SubTab; label: string }[] = [
  { key: "contenido", label: "Contenido" },
  { key: "campanas", label: "Campañas" },
  { key: "historial", label: "Historial" },
];

interface Props {
  templates: ReturnType<typeof useTemplates>;
  campaigns: ReturnType<typeof useCampaigns>;
  triggers: ReturnType<typeof useTriggers>;
  executions: ReturnType<typeof useExecutions>;
}

export function OutboundTab({ templates, campaigns, triggers, executions }: Props) {
  const [subTab, setSubTab] = useState<SubTab>("contenido");

  const triggersByCampaign = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of triggers.triggers) {
      if (t.campaignId) {
        map.set(t.campaignId, (map.get(t.campaignId) ?? 0) + 1);
      }
    }
    return map;
  }, [triggers.triggers]);

  return (
    <div className="space-y-5">
      {/* Sub-tab pills */}
      <div className="flex gap-1">
        {SUB_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setSubTab(tab.key)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              subTab === tab.key
                ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
                : "text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ═══ CONTENIDO (Templates) ═══ */}
      {subTab === "contenido" && (
        <>
          <TemplateList
            templates={templates.templates}
            isLoading={templates.isLoading}
            onEdit={templates.openEdit}
            onCreate={templates.openCreate}
          />
          {templates.editingTemplate && (
            <TemplateFormModal
              template={templates.editingTemplate}
              onSave={templates.updateTemplate}
              onClose={templates.closeEdit}
              isSaving={templates.isUpdating}
            />
          )}
          {templates.createModalOpen && (
            <TemplateFormModal
              template={null}
              onSave={templates.createTemplate}
              onClose={templates.closeCreate}
              isSaving={templates.isCreating}
            />
          )}
        </>
      )}

      {/* ═══ CAMPAÑAS ═══ */}
      {subTab === "campanas" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={campaigns.openCreate}
              className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
            >
              Crear Campaña
            </button>
          </div>
          {campaigns.isLoading ? (
            <EmptyState title="Cargando campañas..." />
          ) : campaigns.campaigns.length === 0 ? (
            <EmptyState
              title="Sin campañas"
              description="Creá tu primera campaña para agrupar triggers y segmentos."
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {campaigns.campaigns.map((c) => (
                <CampaignCard
                  key={c.id}
                  campaign={c}
                  onEdit={campaigns.openEdit}
                  triggerCount={triggersByCampaign.get(c.id) ?? 0}
                />
              ))}
            </div>
          )}
          {campaigns.editingCampaign && (
            <CampaignFormModal
              campaign={campaigns.editingCampaign}
              segments={campaigns.segments}
              onSave={campaigns.updateCampaign}
              onClose={campaigns.closeEdit}
              isSaving={campaigns.isUpdating}
            />
          )}
          {campaigns.createModalOpen && (
            <CampaignFormModal
              campaign={null}
              segments={campaigns.segments}
              onSave={campaigns.createCampaign}
              onClose={campaigns.closeCreate}
              isSaving={campaigns.isCreating}
            />
          )}
        </div>
      )}

      {/* ═══ HISTORIAL (Ejecuciones) ═══ */}
      {subTab === "historial" && (
        <ExecutionLog
          executions={executions.executions}
          total={executions.total}
          isLoading={executions.isLoading}
          page={executions.page}
          onPageChange={executions.setPage}
          triggerFilter={executions.triggerFilter}
          onTriggerFilterChange={executions.setTriggerFilter}
          statusFilter={executions.statusFilter}
          onStatusFilterChange={executions.setStatusFilter}
        />
      )}
    </div>
  );
}
