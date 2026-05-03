/**
 * features/pricing/components/MarkdownEditModal.tsx
 *
 * Modal para cargar / editar / quitar markdown de un SKU comercial.
 * Permite un solo markdown activo por SKU. Si ya hay uno, "Guardar"
 * reemplaza el anterior (audit append-only en la BD).
 */
import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import {
  validateMarkdownPct,
  MARKDOWN_PCT_MIN,
  MARKDOWN_PCT_MAX,
  applyMarkdown,
  calcMbpEffective,
  type ActiveMarkdown,
} from "@/domain/pricing/markdown";
import { calcMBP } from "@/domain/pricing/calculations";
import { formatPYGSuffix } from "@/utils/format";

interface Props {
  /** SKU comercial sobre el que se carga markdown. */
  skuComercial: string;
  /** Marca canónica — se persiste en la fila para filtros futuros. */
  brand: string;
  /** Descripción human-readable del producto (header del modal). */
  description: string;
  /** PVP base del ERP — necesario para preview del efectivo. */
  pvp: number;
  /** Costo — necesario para preview del MBP efectivo. */
  costo: number;
  /** Markdown activo si existe (modo edición). null = modo creación. */
  current: ActiveMarkdown | null;
  isSaving: boolean;
  isClearing: boolean;
  saveError: string | null;
  clearError: string | null;
  onSave: (args: { markdownPct: number; note: string | null }) => Promise<void>;
  onClear: () => Promise<void>;
  onClose: () => void;
}

export function MarkdownEditModal({
  skuComercial,
  brand,
  description,
  pvp,
  costo,
  current,
  isSaving,
  isClearing,
  saveError,
  clearError,
  onSave,
  onClear,
  onClose,
}: Props) {
  const [pctStr, setPctStr] = useState<string>(
    current ? String(current.markdownPct) : ""
  );
  const [note, setNote] = useState<string>(current?.note ?? "");

  const pctNum = pctStr.trim() === "" ? NaN : Number(pctStr);
  const validation = validateMarkdownPct(pctNum);

  const previewPvp = validation.ok ? applyMarkdown(pvp, pctNum) : null;
  const previewMbp = validation.ok ? calcMbpEffective(pvp, costo, pctNum) : null;
  const baseMbp    = calcMBP(pvp, costo);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validation.ok) return;
    await onSave({
      markdownPct: pctNum,
      note: note.trim() === "" ? null : note.trim(),
    });
  }

  const busy = isSaving || isClearing;

  return (
    <Modal isOpen onClose={onClose} className="max-w-md p-6 sm:p-7">
      <div className="mb-5">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">
          {current ? "Editar Promoción" : "Cargar Promoción"}
        </h2>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {description}
        </p>
        <p className="mt-0.5 text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500">
          {brand} · {skuComercial}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="md-pct" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Markdown (%)
          </label>
          <input
            id="md-pct"
            type="number"
            inputMode="decimal"
            min={MARKDOWN_PCT_MIN}
            max={MARKDOWN_PCT_MAX}
            step="0.01"
            value={pctStr}
            onChange={(e) => setPctStr(e.target.value)}
            placeholder="Ej. 25"
            required
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          />
          {!validation.ok && pctStr.trim() !== "" && (
            <p className="mt-1 text-[11px] text-error-600 dark:text-error-400">
              {validation.message}
            </p>
          )}
        </div>

        {/* Preview de impacto */}
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs dark:border-gray-700 dark:bg-gray-800/40">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500">PVP base</div>
              <div className="text-gray-900 dark:text-white tabular-nums">{formatPYGSuffix(pvp)}</div>
              <div className="mt-0.5 text-[10px] text-gray-400 dark:text-gray-500">MBP {baseMbp.toFixed(1)}%</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500">PVP efectivo</div>
              <div className={`tabular-nums font-semibold ${previewPvp != null ? "text-warning-700 dark:text-warning-300" : "text-gray-300 dark:text-gray-600"}`}>
                {previewPvp != null ? formatPYGSuffix(previewPvp) : "—"}
              </div>
              <div className={`mt-0.5 text-[10px] ${previewMbp != null && previewMbp < 0 ? "text-error-600 dark:text-error-400" : "text-gray-500 dark:text-gray-400"}`}>
                MBP {previewMbp != null ? `${previewMbp.toFixed(1)}%` : "—"}
              </div>
            </div>
          </div>
        </div>

        <div>
          <label htmlFor="md-note" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Motivo <span className="text-[10px] font-normal text-gray-400">(opcional)</span>
          </label>
          <input
            id="md-note"
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ej. Liquidación temporada"
            maxLength={200}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          />
        </div>

        {(saveError || clearError) && (
          <div className="rounded-lg border border-error-200 bg-error-50 px-3 py-2 text-[11px] text-error-700 dark:border-error-500/20 dark:bg-error-500/10 dark:text-error-400">
            {saveError ?? clearError}
          </div>
        )}

        <div className="flex items-center justify-between gap-2 pt-2">
          {current ? (
            <button
              type="button"
              onClick={onClear}
              disabled={busy}
              className="text-xs font-medium text-error-600 hover:text-error-700 disabled:opacity-40 dark:text-error-400 dark:hover:text-error-300"
            >
              Quitar promoción
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!validation.ok || busy}
              className="rounded-lg bg-brand-500 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isSaving ? "Guardando..." : current ? "Actualizar" : "Guardar"}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
