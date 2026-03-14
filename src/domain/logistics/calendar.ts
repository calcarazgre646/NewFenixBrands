/**
 * domain/logistics/calendar.ts
 *
 * Funciones puras para proyectar datos de logística al calendario.
 * Convierte LogisticsGroup[] → ArrivalCalendarItem[] (read-only).
 *
 * REGLA: estos items NO son eventos del calendario (no CRUD).
 * Son una vista de lectura de las ETAs de importación.
 */
import type { ArrivalStatus, LogisticsGroup } from "./types";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ArrivalCalendarItem {
  /** ID determinístico derivado del group key */
  id: string;
  /** Fecha ISO para FullCalendar (etaKey del grupo) */
  date: string;
  /** Marca original (display) */
  brand: string;
  /** Marca normalizada (lowercase) */
  brandNorm: string;
  /** Proveedor */
  supplier: string;
  /** Unidades totales del grupo */
  totalUnits: number;
  /** Categorías de producto */
  categories: string[];
  /** Estado del arribo */
  status: ArrivalStatus;
  /** Días hasta la ETA (negativo = overdue) */
  daysUntil: number;
  /** Label formateado de la fecha */
  dateLabel: string;
  /** País de origen */
  origin: string;
  /** Valor FOB del grupo en USD */
  costUSD: number;
}

// ─── Brand colors (consistente con BrandPipelineCards) ────────────────────────

const BRAND_COLORS: Record<string, string> = {
  martel:   "#f59e0b",  // amber-500
  wrangler: "#3b82f6",  // blue-500
  lee:      "#10b981",  // emerald-500
};

const FALLBACK_COLOR = "#6b7280"; // gray-500

export function getBrandColor(brandNorm: string): string {
  return BRAND_COLORS[brandNorm] ?? FALLBACK_COLOR;
}

// ─── Status colors para indicadores del calendario ───────────────────────────

const STATUS_COLORS: Record<ArrivalStatus, string> = {
  overdue:    "#ef4444",  // red-500
  past:       "#9ca3af",  // gray-400
  this_month: "#f59e0b",  // amber-500
  next_month: "#3b82f6",  // blue-500
  upcoming:   "#10b981",  // emerald-500
};

export function getStatusColor(status: ArrivalStatus): string {
  return STATUS_COLORS[status];
}

// ─── Core transform ──────────────────────────────────────────────────────────

/**
 * Convierte grupos de logística a items visualizables en el calendario.
 *
 * Filtra grupos "past" por defecto (no ensuciar calendario con embarques viejos).
 * Agrupa múltiples grupos del mismo día en un solo item cuando comparten marca.
 *
 * @param groups — Resultado de groupArrivals()
 * @param includePast — Incluir embarques pasados (default: false)
 */
export function groupsToCalendarItems(
  groups: LogisticsGroup[],
  includePast = false,
): ArrivalCalendarItem[] {
  const filtered = includePast
    ? groups
    : groups.filter(g => g.status !== "past");

  return filtered
    .filter(g => g.key && g.dateLabel)
    .map(g => ({
      id: `arrival-${g.key}`,
      date: extractDate(g),
      brand: g.brand,
      brandNorm: g.brandNorm,
      supplier: g.supplier,
      totalUnits: g.totalUnits,
      categories: g.categories,
      status: g.status,
      daysUntil: g.daysUntil,
      dateLabel: g.dateLabel,
      origin: g.origin,
      costUSD: g.rows.reduce((s, r) => s + r.costUSD, 0),
    }));
}

/**
 * Extrae la fecha ISO del grupo para usar como start date en FullCalendar.
 * El etaKey ya es ISO (YYYY-MM-DD) cuando viene de una fecha parseada.
 * Si viene de etaLabel crudo (sin fecha parseada), se usa como fallback.
 */
function extractDate(group: LogisticsGroup): string {
  // etaKey es la tercera parte del key: "brand|||supplier|||etaKey"
  const parts = group.key.split("|||");
  return parts[2] ?? "";
}

// ─── Aggregation for year view ───────────────────────────────────────────────

export interface ArrivalDaySummary {
  date: string;
  totalUnits: number;
  brands: string[];
  groupCount: number;
  hasOverdue: boolean;
}

/**
 * Agrupa items por día para la vista de año (mini-months).
 * Retorna un Map<dateISO, ArrivalDaySummary> para lookup O(1).
 */
export function arrivalsByDay(
  items: ArrivalCalendarItem[],
): Map<string, ArrivalDaySummary> {
  const map = new Map<string, ArrivalDaySummary>();

  for (const item of items) {
    const existing = map.get(item.date);
    if (existing) {
      existing.totalUnits += item.totalUnits;
      if (!existing.brands.includes(item.brandNorm)) {
        existing.brands.push(item.brandNorm);
      }
      existing.groupCount += 1;
      if (item.status === "overdue") existing.hasOverdue = true;
    } else {
      map.set(item.date, {
        date: item.date,
        totalUnits: item.totalUnits,
        brands: [item.brandNorm],
        groupCount: 1,
        hasOverdue: item.status === "overdue",
      });
    }
  }

  return map;
}
