/**
 * queries/keys.ts
 *
 * Query key factories para TanStack Query.
 *
 * REGLA: Todas las query keys de la app se definen aquí.
 * Nunca hardcodear strings de keys en los hooks.
 *
 * Los filtros son parte de la key → cuando cambia un filtro,
 * TanStack Query invalida automáticamente y refetch.
 *
 * Patrón: [dominio, sub-recurso, filtros]
 */
import type { AppFilters } from "@/domain/filters/types";

// ─── Ventas ───────────────────────────────────────────────────────────────────
export const salesKeys = {
  all: ["sales"] as const,
  monthly: (f: AppFilters) =>
    ["sales", "monthly", f.brand, f.channel, f.store, f.year] as const,
  dailyDetail: (f: AppFilters) =>
    ["sales", "daily", f.brand, f.channel, f.store, f.year] as const,
  brandBreakdown: (f: AppFilters) =>
    ["sales", "brands", f.channel, f.store, f.year] as const,
  channelMix: (f: AppFilters) =>
    ["sales", "channels", f.brand, f.store, f.year] as const,
  storeBreakdown: (f: AppFilters) =>
    ["sales", "stores", f.brand, f.channel, f.year] as const,
  topSkus: (f: AppFilters) =>
    ["sales", "topSkus", f.brand, f.channel, f.store, f.year] as const,
  dayOfWeek: (f: AppFilters) =>
    ["sales", "dow", f.brand, f.channel, f.store, f.year] as const,
  priorYear: (f: AppFilters) =>
    ["sales", "priorYear", f.brand, f.channel, f.store, f.year] as const,
  priorYearToDate: (f: AppFilters, toDay: number) =>
    ["sales", "priorYearToDate", f.brand, f.channel, f.store, f.year, toDay] as const,

  // ── Wide keys (fetch-once, filter-local — sin filtros de usuario) ──────────
  monthlyWide: (year: number) =>
    ["sales", "monthlyWide", year] as const,
  priorYearWide: (year: number) =>
    ["sales", "priorYearWide", year] as const,
  priorYearMTDWide: (calYear: number, calMonth: number, calDay: number) =>
    ["sales", "priorYearMTDWide", calYear, calMonth, calDay] as const,
};

// ─── Inventario ───────────────────────────────────────────────────────────────
export const inventoryKeys = {
  all: ["inventory"] as const,
  list: (channel?: string, brand?: string) =>
    ["inventory", "list", channel ?? "all", brand ?? "all"] as const,
  value: () =>
    ["inventory", "value"] as const,
};

// ─── Presupuesto ──────────────────────────────────────────────────────────────
export const budgetKeys = {
  all: ["budget"] as const,
  annual: (year: number, brand?: string, channel?: string) =>
    ["budget", "annual", year, brand ?? "all", channel ?? "all"] as const,
};

// ─── Tickets / AOV ───────────────────────────────────────────────────────────
export const ticketKeys = {
  all: ["tickets"] as const,
  monthly: (f: AppFilters) =>
    ["tickets", "monthly", f.channel, f.store, f.year] as const,
  priorYear: (f: AppFilters) =>
    ["tickets", "priorYear", f.channel, f.store, f.year] as const,
};

// ─── Tiendas ──────────────────────────────────────────────────────────────────
export const storeKeys = {
  all: ["stores"] as const,
  list: () => ["stores", "list"] as const,
  goals: (year: number) => ["stores", "goals", year] as const,
};

// ─── Logística ────────────────────────────────────────────────────────────────
export const logisticsKeys = {
  all: ["logistics"] as const,
  imports: (brand?: string) => ["logistics", "imports", brand ?? "all"] as const,
};

// ─── Calendario ───────────────────────────────────────────────────────────────
export const calendarKeys = {
  all: ["calendar"] as const,
  events: (year: number, month?: number) =>
    ["calendar", "events", year, month ?? "all"] as const,
  categories: () => ["calendar", "categories"] as const,
};

// ─── Historial de ventas (para Cola de Acciones) ─────────────────────────────
export const salesHistoryKeys = {
  all: ["salesHistory"] as const,
  byStore: (skus: string[], months: number) =>
    ["salesHistory", "byStore", skus.sort().join(","), months] as const,
};
