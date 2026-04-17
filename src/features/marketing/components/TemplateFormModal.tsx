/**
 * features/marketing/components/TemplateFormModal.tsx
 *
 * Modal para crear/editar template de mensaje SAM.
 */
import { useState } from "react";
import { Spinner } from "@/components/ui/spinner/Spinner";
import type { SamTemplate, MessageChannel } from "@/domain/marketing/types";

interface Props {
  template: SamTemplate | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSave: (data: any) => Promise<any>;
  onClose: () => void;
  isSaving: boolean;
}

const VARIABLES = ["{{razon_social}}", "{{ruc}}", "{{last_purchase}}", "{{total_spent}}", "{{tier}}", "{{erp_code}}"];

export function TemplateFormModal({ template, onSave, onClose, isSaving }: Props) {
  const isEdit = !!template;
  const [name, setName] = useState(template?.name ?? "");
  const [channel, setChannel] = useState<MessageChannel>(template?.channel ?? "email");
  const [subject, setSubject] = useState(template?.subject ?? "");
  const [body, setBody] = useState(template?.body ?? "");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const data = {
      ...(isEdit ? { id: template.id } : {}),
      name,
      channel,
      subject: channel === "email" ? subject || null : null,
      body,
    };
    await onSave(data);
    if (!isEdit) onClose();
  }

  function insertVariable(v: string) {
    setBody((prev) => prev + v);
  }

  // Simple preview replacing variables with sample data
  const preview = body
    .replace(/\{\{razon_social\}\}/g, "Empresa SA")
    .replace(/\{\{last_purchase\}\}/g, "15 Mar 2026")
    .replace(/\{\{total_spent\}\}/g, "₲ 5.000.000")
    .replace(/\{\{tier\}\}/g, "Frecuente")
    .replace(/\{\{ruc\}\}/g, "80012345-6")
    .replace(/\{\{erp_code\}\}/g, "CLI001");

  return (
    <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/50"
      role="presentation" onClick={onClose}>
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- dialog stopPropagation is intentional */}
      <div className="w-full max-w-2xl rounded-2xl bg-white p-6 dark:bg-gray-900 max-h-[90vh] overflow-y-auto"
        role="dialog" aria-modal="true" aria-label={isEdit ? "Editar Template" : "Crear Template"} tabIndex={-1}
        onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
          {isEdit ? "Editar Template" : "Crear Template"}
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="tpl-name" className="block text-xs font-medium text-gray-500 mb-1">Nombre</label>
              <input id="tpl-name" type="text" value={name} onChange={(e) => setName(e.target.value)} required
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
            </div>
            <div>
              <label htmlFor="tpl-channel" className="block text-xs font-medium text-gray-500 mb-1">Canal</label>
              <select id="tpl-channel" value={channel} onChange={(e) => setChannel(e.target.value as MessageChannel)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white">
                <option value="email">Email</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="sms">SMS</option>
              </select>
            </div>
          </div>

          {channel === "email" && (
            <div>
              <label htmlFor="tpl-subject" className="block text-xs font-medium text-gray-500 mb-1">Asunto</label>
              <input id="tpl-subject" type="text" value={subject} onChange={(e) => setSubject(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
            </div>
          )}

          <div>
            <label htmlFor="tpl-body" className="block text-xs font-medium text-gray-500 mb-1">Cuerpo</label>
            <textarea id="tpl-body" value={body} onChange={(e) => setBody(e.target.value)} rows={6} required
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
            <div className="mt-1 flex flex-wrap gap-1">
              {VARIABLES.map((v) => (
                <button key={v} type="button" onClick={() => insertVariable(v)}
                  className="rounded-full border border-gray-200 px-2 py-0.5 text-[10px] text-gray-500 hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800">
                  {v}
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          {body && (
            <div>
              <span className="block text-xs font-medium text-gray-500 mb-1">Vista previa</span>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm whitespace-pre-wrap dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                {preview}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">
              Cancelar
            </button>
            <button type="submit" disabled={isSaving || !name || !body}
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
