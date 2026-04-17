/**
 * features/marketing/components/TriggerFormModal.tsx
 *
 * Modal para crear/editar trigger SAM.
 */
import { useState } from "react";
import { Spinner } from "@/components/ui/spinner/Spinner";
import type { SamTrigger, SamTemplate, SamCampaign, TriggerCategory, MessageChannel } from "@/domain/marketing/types";

interface Props {
  trigger: SamTrigger | null;
  templates: SamTemplate[];
  campaigns?: SamCampaign[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSave: (data: any) => Promise<any>;
  onClose: () => void;
  isSaving: boolean;
}

const CATEGORIES: { value: TriggerCategory; label: string }[] = [
  { value: "inactivity", label: "Inactividad" },
  { value: "overdue", label: "Cobranza Vencida" },
  { value: "return", label: "Devolución" },
  { value: "post_purchase", label: "Post-Compra" },
  { value: "first_purchase", label: "Primera Compra" },
  { value: "second_purchase", label: "Segunda Compra" },
  { value: "high_ticket", label: "Ticket Alto" },
  { value: "low_ticket", label: "Ticket Bajo" },
  { value: "low_stock", label: "Stock Bajo" },
];

const CHANNELS: { value: MessageChannel; label: string }[] = [
  { value: "email", label: "Email" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "sms", label: "SMS" },
];

export function TriggerFormModal({ trigger, templates, campaigns = [], onSave, onClose, isSaving }: Props) {
  const isEdit = !!trigger;
  const [name, setName] = useState(trigger?.name ?? "");
  const [category, setCategory] = useState<TriggerCategory>(trigger?.category ?? "inactivity");
  const [description, setDescription] = useState(trigger?.description ?? "");
  const [channel, setChannel] = useState<MessageChannel>(trigger?.channel ?? "email");
  const [templateId, setTemplateId] = useState(trigger?.templateId ?? "");
  const [campaignId, setCampaignId] = useState(trigger?.campaignId ?? "");
  const [frequencyCap, setFrequencyCap] = useState(trigger?.frequencyCap ?? 1);
  const [priority, setPriority] = useState(trigger?.priority ?? 5);
  const [conditionValue, setConditionValue] = useState(
    trigger?.conditions?.inactivityDays ?? trigger?.conditions?.withinDays ?? trigger?.conditions?.ticketThreshold ?? 90,
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const conditions: Record<string, number> = {};
    if (category === "inactivity") conditions.inactivityDays = conditionValue;
    if (category === "post_purchase") conditions.withinDays = conditionValue;
    if (category === "high_ticket" || category === "low_ticket") conditions.ticketThreshold = conditionValue;
    if (category === "low_stock") conditions.stockThreshold = conditionValue;

    const data = {
      ...(isEdit ? { id: trigger.id } : {}),
      name,
      category,
      description: description || null,
      channel,
      templateId: templateId || null,
      campaignId: campaignId || null,
      conditions,
      frequencyCap,
      priority,
      isActive: trigger?.isActive ?? false,
    };

    await onSave(data);
    if (!isEdit) onClose();
  }

  const conditionLabel = (() => {
    switch (category) {
      case "inactivity": return "Días de inactividad";
      case "post_purchase": return "Dentro de (días)";
      case "high_ticket": case "low_ticket": return "Umbral de ticket (Gs.)";
      case "low_stock": return "Umbral de stock (unidades)";
      default: return null;
    }
  })();

  return (
    <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/50"
      role="presentation" onClick={onClose}>
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- dialog stopPropagation is intentional */}
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 dark:bg-gray-900"
        role="dialog" aria-modal="true" aria-label={isEdit ? "Editar Trigger" : "Crear Trigger"} tabIndex={-1}
        onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
          {isEdit ? "Editar Trigger" : "Crear Trigger"}
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="trg-name" className="block text-xs font-medium text-gray-500 mb-1">Nombre</label>
            <input id="trg-name" type="text" value={name} onChange={(e) => setName(e.target.value)} required
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="trg-category" className="block text-xs font-medium text-gray-500 mb-1">Categoría</label>
              <select id="trg-category" value={category} onChange={(e) => setCategory(e.target.value as TriggerCategory)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white">
                {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="trg-channel" className="block text-xs font-medium text-gray-500 mb-1">Canal</label>
              <select id="trg-channel" value={channel} onChange={(e) => setChannel(e.target.value as MessageChannel)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white">
                {CHANNELS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="trg-desc" className="block text-xs font-medium text-gray-500 mb-1">Descripción</label>
            <textarea id="trg-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
          </div>

          <div>
            <label htmlFor="trg-template" className="block text-xs font-medium text-gray-500 mb-1">Template</label>
            <select id="trg-template" value={templateId} onChange={(e) => setTemplateId(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white">
              <option value="">Sin template</option>
              {templates.filter((t) => t.channel === channel).map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          {campaigns.length > 0 && (
            <div>
              <label htmlFor="trg-campaign" className="block text-xs font-medium text-gray-500 mb-1">Campaña</label>
              <select id="trg-campaign" value={campaignId} onChange={(e) => setCampaignId(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white">
                <option value="">Sin campaña</option>
                {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}

          {conditionLabel && (
            <div>
              <label htmlFor="trg-condition" className="block text-xs font-medium text-gray-500 mb-1">{conditionLabel}</label>
              <input id="trg-condition" type="number" value={conditionValue} onChange={(e) => setConditionValue(Number(e.target.value))} min={1}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="trg-freq" className="block text-xs font-medium text-gray-500 mb-1">Frequency Cap (días)</label>
              <input id="trg-freq" type="number" value={frequencyCap} onChange={(e) => setFrequencyCap(Number(e.target.value))} min={1}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
            </div>
            <div>
              <label htmlFor="trg-priority" className="block text-xs font-medium text-gray-500 mb-1">Prioridad (1-10)</label>
              <input id="trg-priority" type="number" value={priority} onChange={(e) => setPriority(Number(e.target.value))} min={1} max={10}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">
              Cancelar
            </button>
            <button type="submit" disabled={isSaving || !name}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50">
              {isSaving && <Spinner />}
              {isEdit ? "Guardar" : "Crear"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
