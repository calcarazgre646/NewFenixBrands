/**
 * features/marketing/components/CampaignFormModal.tsx
 *
 * Modal para crear/editar campaña SAM.
 */
import { useState } from "react";
import { Spinner } from "@/components/ui/spinner/Spinner";
import type { SamCampaign, SamSegment, CampaignStatus } from "@/domain/marketing/types";

interface Props {
  campaign: SamCampaign | null;
  segments: SamSegment[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSave: (data: any) => Promise<any>;
  onClose: () => void;
  isSaving: boolean;
}

const STATUSES: { value: CampaignStatus; label: string }[] = [
  { value: "draft", label: "Borrador" },
  { value: "active", label: "Activa" },
  { value: "paused", label: "Pausada" },
  { value: "completed", label: "Completada" },
];

export function CampaignFormModal({ campaign, segments, onSave, onClose, isSaving }: Props) {
  const isEdit = !!campaign;
  const [name, setName] = useState(campaign?.name ?? "");
  const [description, setDescription] = useState(campaign?.description ?? "");
  const [status, setStatus] = useState<CampaignStatus>(campaign?.status ?? "draft");
  const [segmentId, setSegmentId] = useState(campaign?.segmentId ?? "");
  const [startDate, setStartDate] = useState(campaign?.startDate?.slice(0, 10) ?? "");
  const [endDate, setEndDate] = useState(campaign?.endDate?.slice(0, 10) ?? "");
  const [budget, setBudget] = useState(campaign?.budget?.toString() ?? "");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const data = {
      ...(isEdit ? { id: campaign.id } : {}),
      name,
      description: description || null,
      status,
      segmentId: segmentId || null,
      startDate: startDate ? new Date(startDate).toISOString() : null,
      endDate: endDate ? new Date(endDate).toISOString() : null,
      budget: budget ? Number(budget) : null,
    };
    await onSave(data);
    if (!isEdit) onClose();
  }

  return (
    <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/50"
      role="presentation" onClick={onClose}>
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- dialog stopPropagation is intentional */}
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 dark:bg-gray-900"
        role="dialog" aria-modal="true" aria-label={isEdit ? "Editar Campaña" : "Crear Campaña"} tabIndex={-1}
        onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
          {isEdit ? "Editar Campaña" : "Crear Campaña"}
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="camp-name" className="block text-xs font-medium text-gray-500 mb-1">Nombre</label>
            <input id="camp-name" type="text" value={name} onChange={(e) => setName(e.target.value)} required
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
          </div>

          <div>
            <label htmlFor="camp-desc" className="block text-xs font-medium text-gray-500 mb-1">Descripción</label>
            <textarea id="camp-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="camp-status" className="block text-xs font-medium text-gray-500 mb-1">Estado</label>
              <select id="camp-status" value={status} onChange={(e) => setStatus(e.target.value as CampaignStatus)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white">
                {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="camp-segment" className="block text-xs font-medium text-gray-500 mb-1">Segmento</label>
              <select id="camp-segment" value={segmentId} onChange={(e) => setSegmentId(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white">
                <option value="">Sin segmento</option>
                {segments.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="camp-start" className="block text-xs font-medium text-gray-500 mb-1">Fecha inicio</label>
              <input id="camp-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
            </div>
            <div>
              <label htmlFor="camp-end" className="block text-xs font-medium text-gray-500 mb-1">Fecha fin</label>
              <input id="camp-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
            </div>
          </div>

          <div>
            <label htmlFor="camp-budget" className="block text-xs font-medium text-gray-500 mb-1">Presupuesto (Gs.)</label>
            <input id="camp-budget" type="number" value={budget} onChange={(e) => setBudget(e.target.value)} min={0}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
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
