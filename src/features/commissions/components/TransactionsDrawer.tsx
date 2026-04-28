/**
 * TransactionsDrawer — slide-over con las transacciones individuales que
 * componen el MTD del vendedor. Click en una fila de la tabla del Equipo →
 * abre este drawer y dispara el fetch (lazy via `useTransactionsDrawer`).
 *
 * Se construye como un overlay full-height anclado a la derecha, montado en
 * un portal para esquivar z-index issues. No usa el primitive Modal porque
 * Modal centra el contenido y no permite slide-over fácilmente.
 */
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { formatPYGCompact, formatPYG, formatNumber } from "@/utils/format";
import { useTransactionsDrawer } from "../hooks/useTransactionsDrawer";

interface Props {
  open: boolean;
  onClose: () => void;
  year: number;
  month: number;
  vendedorCodigo: number | null;
  vendedorNombre: string;
}

export default function TransactionsDrawer({
  open,
  onClose,
  year,
  month,
  vendedorCodigo,
  vendedorNombre,
}: Props) {
  const { transactions, total, units, isLoading, error } = useTransactionsDrawer({
    open, year, month, vendedorCodigo,
  });

  // Cerrar con ESC + bloquear scroll cuando está abierto
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  const sorted = [...transactions].sort((a, b) => a.día - b.día);

  return createPortal(
    <div className="fixed inset-0 z-[99999]">
      {/* Backdrop */}
      <div
        role="presentation"
        className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="transactions-drawer-title"
        className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-white shadow-2xl dark:bg-gray-900 sm:max-w-lg"
      >
        <header className="flex items-start justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-700">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
              Transacciones del mes
            </p>
            <h2 id="transactions-drawer-title" className="mt-0.5 text-base font-semibold text-gray-900 dark:text-white">
              {vendedorNombre}
            </h2>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              Período {String(month).padStart(2, "0")}/{year}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="ml-4 inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M6 18L18 6" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        {/* KPIs del drawer */}
        <div className="grid grid-cols-3 gap-px bg-gray-200/60 dark:bg-gray-700/40">
          <div className="bg-white p-3 dark:bg-gray-900">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">Tickets</p>
            <p className="mt-1 text-base font-bold tabular-nums text-gray-900 dark:text-white">{formatNumber(transactions.length)}</p>
          </div>
          <div className="bg-white p-3 dark:bg-gray-900">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">Unidades</p>
            <p className="mt-1 text-base font-bold tabular-nums text-gray-900 dark:text-white">{formatNumber(units)}</p>
          </div>
          <div className="bg-white p-3 dark:bg-gray-900">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">Total Gs.</p>
            <p className="mt-1 text-base font-bold tabular-nums text-gray-900 dark:text-white">{formatPYGCompact(total)}</p>
          </div>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto">
          {isLoading && (
            <div className="flex items-center justify-center py-10 text-xs text-gray-400">
              <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
              Cargando transacciones…
            </div>
          )}
          {error && (
            <div className="m-5 rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-xs text-error-700 dark:border-error-500/20 dark:bg-error-500/10 dark:text-error-400">
              No se pudieron cargar las transacciones: {error.message}
            </div>
          )}
          {!isLoading && !error && sorted.length === 0 && (
            <div className="flex items-center justify-center py-10 text-xs text-gray-400">
              No hay transacciones en este período
            </div>
          )}
          {!isLoading && !error && sorted.length > 0 && (
            <table className="w-full text-[12px]">
              <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-widest text-gray-400">Día</th>
                  <th className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-widest text-gray-400">Sucursal</th>
                  <th className="px-4 py-2 text-right text-[10px] font-semibold uppercase tracking-widest text-gray-400">Unid.</th>
                  <th className="px-4 py-2 text-right text-[10px] font-semibold uppercase tracking-widest text-gray-400">Venta Gs.</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((t, i) => (
                  <tr
                    key={`${t.día}-${i}`}
                    className="border-t border-gray-100 dark:border-gray-700"
                  >
                    <td className="px-4 py-2 tabular-nums text-gray-700 dark:text-gray-300">{String(t.día).padStart(2, "0")}</td>
                    <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{t.sucursal}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-gray-700 dark:text-gray-300">{formatNumber(t.unidades)}</td>
                    <td className="px-4 py-2 text-right tabular-nums font-semibold text-gray-900 dark:text-white">{formatPYG(t.ventaNeta)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
