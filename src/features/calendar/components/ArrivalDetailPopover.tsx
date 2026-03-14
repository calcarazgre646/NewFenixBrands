/**
 * features/calendar/components/ArrivalDetailPopover.tsx
 *
 * Modal read-only que muestra detalles de una llegada de importación.
 * Se abre al hacer click en un indicador de llegada en el calendario.
 * No permite edición — solo visualización + link a logística.
 */
import { Modal } from "@/components/ui/modal";
import type { ArrivalCalendarItem } from "@/domain/logistics/calendar";
import { getBrandColor, getStatusColor } from "@/domain/logistics/calendar";
import { statusLabel } from "@/domain/logistics/arrivals";
import { formatFob } from "@/features/logistics/components/logistics.shared";

interface ArrivalDetailPopoverProps {
  item: ArrivalCalendarItem;
  onClose: () => void;
  onNavigateToLogistics: () => void;
}

export function ArrivalDetailPopover({
  item,
  onClose,
  onNavigateToLogistics,
}: ArrivalDetailPopoverProps) {
  const brandColor = getBrandColor(item.brandNorm);
  const statusColor = getStatusColor(item.status);
  const label = statusLabel(item.status, item.daysUntil);

  return (
    <Modal isOpen onClose={onClose} className="max-w-sm p-5 sm:p-6">
      {/* Header con marca y status */}
      <div className="mb-4">
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-lg text-white text-sm font-bold"
            style={{ backgroundColor: brandColor }}
          >
            {item.brand.charAt(0)}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">
              {item.brand}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {item.supplier}
            </p>
          </div>
        </div>
        <div className="mt-2.5">
          <span
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
            style={{
              backgroundColor: statusColor + "1A",
              color: statusColor,
            }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: statusColor }}
            />
            {label}
          </span>
        </div>
      </div>

      {/* Grid de datos */}
      <div className="mb-4 grid grid-cols-2 gap-3">
        <DataCell label="ETA" value={item.dateLabel} />
        <DataCell label="Unidades" value={item.totalUnits.toLocaleString("es-PY")} />
        <DataCell label="Origen" value={item.origin || "Sin dato"} />
        <DataCell label="FOB" value={formatFob(item.costUSD)} />
      </div>

      {/* Categorías */}
      {item.categories.length > 0 && (
        <div className="mb-4">
          <p className="mb-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
            Categorías
          </p>
          <div className="flex flex-wrap gap-1.5">
            {item.categories.map(cat => (
              <span
                key={cat}
                className="rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-300"
              >
                {cat}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Acciones */}
      <div className="flex items-center justify-between border-t border-gray-200 pt-3 dark:border-gray-700">
        <button
          type="button"
          onClick={onNavigateToLogistics}
          className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-brand-500 transition-colors hover:bg-brand-50 dark:hover:bg-brand-500/10"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8L22 12L18 16" />
            <path d="M2 12H22" />
          </svg>
          Ver en Logística
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg px-3 py-2 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
        >
          Cerrar
        </button>
      </div>
    </Modal>
  );
}

// ─── Internal ─────────────────────────────────────────────────────────────────

function DataCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-sm font-semibold text-gray-900 dark:text-white">{value}</p>
    </div>
  );
}
