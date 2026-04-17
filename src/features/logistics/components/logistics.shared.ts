/**
 * logistics.shared.ts
 *
 * Constantes y helpers extraidos de LogisticsPage para reutilizar en componentes.
 */
import type { ArrivalStatus, LogisticsArrival } from "@/domain/logistics/types";

// ─── Status badge styles ─────────────────────────────────────────────────────

export const STATUS_STYLE: Record<ArrivalStatus, string> = {
  overdue:    "bg-error-100 dark:bg-error-500/15 text-error-700 dark:text-error-400",
  past:       "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400",
  this_month: "bg-warning-100 dark:bg-warning-500/15 text-warning-700 dark:text-warning-400",
  next_month: "bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400",
  upcoming:   "bg-success-100 dark:bg-success-500/15 text-success-700 dark:text-success-400",
};

/** Border-left accent para section headers (patron ActionQueue) */
export const STATUS_ACCENT: Record<ArrivalStatus, string> = {
  overdue:    "border-l-error-400",
  past:       "border-l-gray-300 dark:border-l-gray-600",
  this_month: "border-l-warning-400",
  next_month: "border-l-blue-400",
  upcoming:   "border-l-success-400",
};

// ─── ERP Status (pipeline) styles ────────────────────────────────────────────

export const ERP_STATUS_STYLE: Record<string, string> = {
  "PEDIDO":       "bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400",
  "EN TRANSITO":  "bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400",
  "EN STOCK":     "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
};

export const ERP_STATUS_LABEL: Record<string, string> = {
  "PEDIDO":       "Pedido",
  "EN TRANSITO":  "En Tránsito",
  "EN STOCK":     "En Stock",
};

export function erpStatusLabel(status: string | null): string {
  if (!status) return "—";
  return ERP_STATUS_LABEL[status] ?? status;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function pvpRange(rows: LogisticsArrival[]): string {
  const vals = rows.map(r => r.pvpB2C).filter(v => v > 0);
  if (vals.length === 0) return "—";
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  if (min === max) return min.toLocaleString("es-PY");
  return `${min.toLocaleString("es-PY")}–${max.toLocaleString("es-PY")}`;
}

export function marginRange(rows: LogisticsArrival[]): { label: string; value: number } {
  const vals = rows.map(r => r.marginB2C).filter(v => v > 0);
  if (vals.length === 0) return { label: "—", value: 0 };
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
  if (min === max) return { label: `${min}%`, value: min };
  return { label: `${min}–${max}%`, value: avg };
}

export function formatFob(usd: number): string {
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(1)}M`;
  if (usd >= 1_000) return `$${(usd / 1_000).toFixed(1)}K`;
  return `$${usd.toLocaleString("en-US")}`;
}
