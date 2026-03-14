/**
 * features/calendar/components/EventFormModal.tsx
 *
 * Modal para crear/editar eventos del calendario.
 * Diseño ejecutivo y minimalista.
 */
import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import type { CalendarEvent, DbCategory, EventInput, Currency } from "../hooks/useCalendar";
import { validateEventForm, parseBudgetInput } from "../hooks/useCalendar";

// ─── Types ───────────────────────────────────────────────────────────────────

interface EventFormModalProps {
  event: CalendarEvent | null;
  categories: Record<string, DbCategory>;
  saving: boolean;
  initialStartDate: string;
  initialEndDate: string;
  onSave: (input: EventInput) => Promise<void>;
  onUpdate: (id: string, input: EventInput) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onAddCategory: (label: string, color: string) => Promise<string>;
  onChangeCategoryColor: (id: string, color: string) => Promise<void>;
  onClose: () => void;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const COLOR_PALETTE = [
  "#465fff", "#12b76a", "#f04438", "#fb6514", "#eab308",
  "#a855f7", "#06b6d4", "#ec4899", "#667085", "#b45309",
];

const INPUT_CLS = "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white";
const LABEL_CLS = "mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300";

// ─── Component ───────────────────────────────────────────────────────────────

export function EventFormModal({
  event,
  categories,
  saving,
  initialStartDate,
  initialEndDate,
  onSave,
  onUpdate,
  onDelete,
  onChangeCategoryColor,
  onAddCategory,
  onClose,
}: EventFormModalProps) {
  const isEditing = !!event;
  const catList = Object.values(categories);

  const [title, setTitle] = useState(event?.title ?? "");
  const [description, setDescription] = useState(event?.extendedProps?.description ?? "");
  const [startDate, setStartDate] = useState(event?.start ?? initialStartDate);
  const [endDate, setEndDate] = useState(event?.end ?? initialEndDate);
  const [category, setCategory] = useState(event?.extendedProps?.calendar ?? "");
  const [budget, setBudget] = useState(
    event?.extendedProps?.budget != null ? String(event.extendedProps.budget) : "",
  );
  const [currency, setCurrency] = useState<Currency>(event?.extendedProps?.currency ?? "PYG");
  const [localError, setLocalError] = useState<string | null>(null);

  // New category inline
  const [addingCat, setAddingCat] = useState(false);
  const [newCatLabel, setNewCatLabel] = useState("");
  const [newCatColor, setNewCatColor] = useState("#465fff");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLocalError(null);

    const err = validateEventForm({ title, category, startDate, endDate, budgetRaw: budget });
    if (err) { setLocalError(err); return; }

    const { value: parsedBudget } = parseBudgetInput(budget);
    const input: EventInput = {
      title: title.trim(), description: description.trim(),
      startDate, endDate, category,
      budget: parsedBudget, currency,
    };

    if (isEditing) await onUpdate(event!.id!, input);
    else await onSave(input);
    onClose();
  }

  async function handleDelete() {
    if (!event?.id) return;
    await onDelete(event.id);
    onClose();
  }

  async function handleAddCategory() {
    const label = newCatLabel.trim();
    if (!label) return;
    const id = await onAddCategory(label, newCatColor);
    setCategory(id);
    setAddingCat(false);
    setNewCatLabel("");
    setNewCatColor("#465fff");
  }

  const selectedCatColor = categories[category]?.color ?? "#d0d5dd";

  return (
    <Modal isOpen onClose={onClose} className="max-w-lg p-6 sm:p-8">
      <h2 className="mb-1 text-lg font-semibold text-gray-900 dark:text-white">
        {isEditing ? "Editar Evento" : "Nuevo Evento"}
      </h2>
      <p className="mb-6 text-xs text-gray-400 dark:text-gray-500">
        Hitos del negocio: llegadas, lanzamientos, acciones comerciales.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Título */}
        <div>
          <label htmlFor="evt-title" className={LABEL_CLS}>Título</label>
          <input id="evt-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)}
            required placeholder="Ej: Llegada colección invierno" className={INPUT_CLS} />
        </div>

        {/* Descripción */}
        <div>
          <label htmlFor="evt-desc" className={LABEL_CLS}>
            Descripción <span className="font-normal text-gray-400">(opcional)</span>
          </label>
          <textarea id="evt-desc" value={description} onChange={(e) => setDescription(e.target.value)}
            placeholder="Objetivos, contexto, notas..." rows={2} className={`${INPUT_CLS}resize-none`} />
        </div>

        {/* Categoría — dropdown con dot de color */}
        <div>
          <label htmlFor="evt-cat" className={LABEL_CLS}>Categoría</label>
          {!addingCat ? (
            <div className="flex gap-2">
              <div className="relative flex-1">
                {category && (
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">
                    <span className="block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: selectedCatColor }} />
                  </span>
                )}
                <select id="evt-cat" value={category} onChange={(e) => setCategory(e.target.value)}
                  className={`${INPUT_CLS} ${category ? "pl-8" : "pl-3"} appearance-none pr-8 bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%239CA3AF%22%20stroke-width%3D%222.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M6%209l6%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:12px] bg-[right_0.75rem_center] bg-no-repeat`}>
                  <option value="">Seleccionar...</option>
                  {catList.map((c) => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
              </div>
              {/* Color edit for selected category */}
              {category && (
                <label className="flex h-[34px] w-[34px] shrink-0 cursor-pointer items-center justify-center rounded-lg border border-gray-300 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700" title="Cambiar color">
                  <span className="block h-4 w-4 rounded-full" style={{ backgroundColor: selectedCatColor }} />
                  <input type="color" value={selectedCatColor} onChange={(e) => onChangeCategoryColor(category, e.target.value)} className="sr-only" />
                </label>
              )}
              <button type="button" onClick={() => setAddingCat(true)} title="Nueva categoría"
                className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg border border-gray-300 text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-600 dark:border-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex gap-2">
                <input type="text" value={newCatLabel} onChange={(e) => setNewCatLabel(e.target.value)}
                  placeholder="Nombre de categoría" autoFocus className={`${INPUT_CLS}flex-1`} />
                <button type="button" onClick={handleAddCategory} disabled={!newCatLabel.trim()}
                  className="shrink-0 rounded-lg bg-brand-500 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-600 disabled:opacity-50">
                  Crear
                </button>
                <button type="button" onClick={() => { setAddingCat(false); setNewCatLabel(""); }}
                  className="shrink-0 rounded-lg px-3 py-2 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800">
                  Cancelar
                </button>
              </div>
              <div className="flex items-center gap-1">
                {COLOR_PALETTE.map((c) => (
                  <button key={c} type="button" onClick={() => setNewCatColor(c)}
                    className="h-5 w-5 rounded-full border-2 transition-transform hover:scale-110"
                    style={{ backgroundColor: c, borderColor: newCatColor === c ? "#344054" : "transparent" }} />
                ))}
                <label className="cursor-pointer" title="Color personalizado">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-dashed border-gray-300 text-[10px] text-gray-400 hover:border-gray-500 dark:border-gray-600">+</span>
                  <input type="color" value={newCatColor} onChange={(e) => setNewCatColor(e.target.value)} className="sr-only" />
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Fechas — lado a lado */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="evt-start" className={LABEL_CLS}>Inicio</label>
            <input id="evt-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={INPUT_CLS} />
          </div>
          <div>
            <label htmlFor="evt-end" className={LABEL_CLS}>Fin</label>
            <input id="evt-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={INPUT_CLS} />
          </div>
        </div>

        {/* Presupuesto — moneda inline + monto */}
        <div>
          <label htmlFor="evt-budget" className={LABEL_CLS}>
            Presupuesto
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
              {currency === "PYG" ? "₲" : "$"}
            </span>
            <input id="evt-budget" type="text" inputMode="numeric" value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="0"
              className={`${INPUT_CLS}pl-7 pr-20`} />
            <select value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}
              aria-label="Moneda"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md border-0 bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 focus:ring-1 focus:ring-brand-500 dark:bg-gray-700 dark:text-gray-300">
              <option value="PYG">PYG</option>
              <option value="USD">USD</option>
            </select>
          </div>
        </div>

        {/* Error */}
        {localError && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">
            {localError}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          {isEditing && (
            <button type="button" onClick={handleDelete} disabled={saving}
              className="mr-auto rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-500/10">
              {saving ? "Eliminando..." : "Eliminar"}
            </button>
          )}
          <button type="button" onClick={onClose} disabled={saving}
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800">
            Cancelar
          </button>
          <button type="submit" disabled={saving || !title.trim() || !category}
            className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-600 disabled:opacity-50">
            {saving ? "Guardando..." : isEditing ? "Guardar" : "Crear Evento"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
