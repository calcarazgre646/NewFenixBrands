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
  dailyWide: (year: number) =>
    ["sales", "dailyWide", year] as const,
};

// ─── Inventario ───────────────────────────────────────────────────────────────
export const inventoryKeys = {
  all: ["inventory"] as const,
  list: () =>
    ["inventory", "list"] as const,
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
  lastLoad: () => ["logistics", "lastLoad"] as const,
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
    ["salesHistory", "byStore", skus.length, simpleHash(skus), months] as const,
};

/** Fast hash for query key dedup — avoids 10KB+ string comparisons in TanStack Query */
function simpleHash(arr: string[]): number {
  let h = 0;
  for (const s of arr) {
    for (let i = 0; i < s.length; i++) {
      h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    }
  }
  return h;
}

// ─── DOI Edad (días de inventario en ubicación) ─────────────────────────────
export const doiAgeKeys = {
  all: ["doiAge"] as const,
  list: () => ["doiAge", "list"] as const,
};

// ─── Depósitos & Cobertura ────────────────────────────────────────────────────
export const depotKeys = {
  all: ["depots"] as const,
  coverage: () => ["depots", "coverage"] as const,
};

// ─── Usuarios (gestión) ──────────────────────────────────────────────────────
export const usersKeys = {
  all: ["users"] as const,
  list: () => ["users", "list"] as const,
};

// ─── Profile ─────────────────────────────────────────────────────────────────
export const profileKeys = {
  all: ["profile"] as const,
  detail: (userId: string) => ["profile", userId] as const,
};

// ─── Comisiones ──────────────────────────────────────────────────────────────
export const commissionKeys = {
  all: ["commissions"] as const,
  storeLevel: (year: number) =>
    ["commissions", "storeLevel", year] as const,
};

// ─── Freshness ──────────────────────────────────────────────────────────────
export const freshnessKeys = {
  all: ["freshness"] as const,
  status: () => ["freshness", "status"] as const,
};

// ─── Config (parámetros de negocio editables) ───────────────────────────────
export const configKeys = {
  all: ["config"] as const,
  params: () => ["config", "params"] as const,
  stores: () => ["config", "stores"] as const,
  commissions: () => ["config", "commissions"] as const,
};

// ─── Cache durations ──────────────────────────────────────────────────────────
// 30 min staleTime: dato cambia ~cada 6h, 30 min es conservador.
// 60 min gcTime: mantener en memoria tras unmount.
export const STALE_5MIN  =  5 * 60 * 1000;
export const STALE_10MIN = 10 * 60 * 1000;
export const STALE_30MIN = 30 * 60 * 1000;
export const GC_60MIN    = 60 * 60 * 1000;
