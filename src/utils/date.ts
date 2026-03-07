/**
 * utils/date.ts
 *
 * Utilidades de fecha para la app.
 * Complementa domain/period/helpers.ts (que es lógica de negocio).
 * Estas son utilidades de presentación y parsing de UI.
 */

/** Formatea Date a "3 mar 2026" */
export function formatDateShort(date: Date): string {
  return date.toLocaleDateString("es-PY", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Formatea Date a "10/09/2025" (DD/MM/YYYY estilo paraguayo) */
export function formatDateDDMMYYYY(date: Date): string {
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}

/** "hace 5 minutos", "hace 2 horas" etc. */
export function formatRelativeTime(date: Date): string {
  const diffMs  = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHr  = Math.floor(diffMin / 60);

  if (diffMin < 1)   return "ahora mismo";
  if (diffMin < 60)  return `hace ${diffMin} min`;
  if (diffHr < 24)   return `hace ${diffHr} h`;
  return formatDateShort(date);
}

/** Número de días entre dos fechas */
export function daysBetween(a: Date, b: Date): number {
  return Math.round(Math.abs(a.getTime() - b.getTime()) / 86_400_000);
}

/** Días hasta una fecha futura (ETA) */
export function daysUntil(eta: Date): number {
  return Math.ceil((eta.getTime() - Date.now()) / 86_400_000);
}
