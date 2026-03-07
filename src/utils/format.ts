/**
 * utils/format.ts
 *
 * Funciones de formateo para display en la UI.
 * MONEDA: Guaraníes Paraguayos (PYG) — sin decimales, separador de miles punto.
 *
 * REGLA: Todo formateo de valores para mostrar al usuario pasa por estas funciones.
 * No hay Intl.NumberFormat ni toLocaleString dispersos en componentes.
 */

/** Formatea número entero en Guaraníes: 6263380 → "₲ 6.263.380" */
export function formatPYG(value: number): string {
  if (!isFinite(value)) return "—";
  return `₲ ${Math.round(value).toLocaleString("es-PY")}`;
}

/** Igual que formatPYG pero sin símbolo de moneda */
export function formatPYGPlain(value: number): string {
  if (!isFinite(value)) return "—";
  return Math.round(value).toLocaleString("es-PY");
}

/**
 * Formato compacto para valores grandes:
 *   1_000_000_000 → "₲ 1.000 M"
 *   100_000_000   → "₲ 100 M"
 *   6_263_380     → "₲ 6,3 M"
 *   50_000        → "₲ 50.000"
 */
export function formatPYGCompact(value: number): string {
  if (!isFinite(value)) return "—";
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000_000) return `${sign}₲ ${(abs / 1_000_000_000).toFixed(1)} B`;
  if (abs >= 1_000_000)     return `${sign}₲ ${(abs / 1_000_000).toFixed(1)} M`;
  if (abs >= 1_000)         return `${sign}₲ ${(abs / 1_000).toFixed(0)} K`;
  return formatPYG(value);
}

/** Porcentaje con 1 decimal: 64.2 → "64.2 %" */
export function formatPct(value: number, decimals = 1): string {
  if (!isFinite(value)) return "—";
  return `${value.toFixed(decimals)} %`;
}

/** Variación con signo: 12.3 → "+12.3 %", -5.1 → "-5.1 %" */
export function formatChange(value: number, decimals = 1): string {
  if (!isFinite(value)) return "—";
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(decimals)} %`;
}

/** Número con separadores de miles: 54624 → "54.624" */
export function formatNumber(value: number, decimals = 0): string {
  if (!isFinite(value)) return "—";
  return value.toLocaleString("es-PY", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** Ratio con 2 decimales: 3.14 → "3.14x" */
export function formatRatio(value: number, decimals = 2): string {
  if (!isFinite(value)) return "—";
  return `${value.toFixed(decimals)}x`;
}

/** Días: 45 → "45 días" */
export function formatDays(value: number): string {
  if (!isFinite(value)) return "—";
  const days = Math.round(value);
  return `${days} día${days === 1 ? "" : "s"}`;
}

/**
 * Formatea un valor de KPI según su unidad.
 * Centraliza el formateo para que KpiCard y KpiDetailModal usen lo mismo.
 */
export type KpiUnit = "currency" | "percent" | "number" | "ratio" | "days";

export function formatKpiValue(value: number, unit: KpiUnit): string {
  switch (unit) {
    case "currency": return formatPYG(value);
    case "percent":  return formatPct(value);
    case "number":   return formatNumber(value);
    case "ratio":    return formatRatio(value);
    case "days":     return formatDays(value);
    default:         return String(value);
  }
}
