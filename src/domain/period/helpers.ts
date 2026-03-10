/**
 * domain/period/helpers.ts
 *
 * UNA SOLA fuente de verdad para todo lo relacionado con períodos, meses y fechas.
 *
 * HISTORIAL DE BUGS EVITADOS:
 *   - Bug Feb 2026: resolveActiveMonths() usaba datos de BD como fuente de verdad
 *     del mes actual → cuando ETL cargó datos de Marzo 1, la app creyó que era Marzo.
 *     FIX: el mes calendario siempre viene de new Date(), NUNCA de la BD.
 *
 *   - Bug Marzo 2026: LfL comparaba 3 días de Marzo 2026 vs Marzo 2025 completo.
 *     FIX: solo comparar meses cerrados (< calendarMonth).
 */

/** Labels cortos de meses (1-indexed: MONTH_SHORT[1] = "Ene") */
export const MONTH_SHORT: Record<number, string> = {
  1: "Ene", 2: "Feb", 3: "Mar", 4: "Abr", 5: "May", 6: "Jun",
  7: "Jul", 8: "Ago", 9: "Sep", 10: "Oct", 11: "Nov", 12: "Dic",
};

/** Labels completos de meses */
export const MONTH_FULL: Record<number, string> = {
  1: "Enero", 2: "Febrero", 3: "Marzo", 4: "Abril", 5: "Mayo", 6: "Junio",
  7: "Julio", 8: "Agosto", 9: "Septiembre", 10: "Octubre", 11: "Noviembre", 12: "Diciembre",
};

/**
 * Mes calendario actual según el reloj del sistema.
 * REGLA: Esta función es la única fuente de verdad del mes actual.
 * NUNCA usar datos de la BD para determinar el mes actual.
 */
export function getCalendarMonth(): number {
  return new Date().getMonth() + 1; // 1-indexed
}

export function getCalendarYear(): number {
  return new Date().getFullYear();
}

export function getCalendarDay(): number {
  return new Date().getDate();
}

/**
 * Determina si un mes tiene datos parciales (ETL cargó datos del mes en curso).
 *
 * @param monthsWithData  Lista de meses que tienen datos en la BD (1-indexed)
 * @returns true si la BD ya tiene datos del mes calendario actual
 */
export function detectPartialMonth(monthsWithData: number[]): boolean {
  const calMonth = getCalendarMonth();
  return monthsWithData.includes(calMonth);
}

/**
 * Lista de meses cerrados para un año dado.
 * "Cerrado" = mes < mes calendario actual.
 * Si hoy es 3 de Marzo → meses cerrados = [1, 2]
 *
 * @param year    Año de análisis
 * @param maxMonthInDB  Máximo mes con datos en la BD
 */
export function getClosedMonths(year: number, maxMonthInDB: number): number[] {
  const calYear  = getCalendarYear();
  const calMonth = getCalendarMonth();

  if (year < calYear) {
    // Año anterior: todos los meses disponibles en BD son "cerrados"
    return Array.from({ length: maxMonthInDB }, (_, i) => i + 1);
  }

  // Año actual: solo meses < mes calendario
  const closed = calMonth - 1;
  if (closed <= 0) return [];
  const limit = Math.min(closed, maxMonthInDB);
  return Array.from({ length: limit }, (_, i) => i + 1);
}

/**
 * Genera label de período para display.
 * Ej: months=[1,2,3], year=2026 → "Ene–Mar 2026"
 * Ej: months=[3],     year=2026 → "Mar 2026"
 */
export function buildPeriodLabel(
  months: number[],
  year: number,
  _isPartial?: boolean   // reservado para uso futuro, no se muestra en UI
): string {
  if (months.length === 0) return `${year}`;
  const first = MONTH_SHORT[months[0]];
  const last  = MONTH_SHORT[months[months.length - 1]];
  return first === last ? `${first} ${year}` : `${first}–${last} ${year}`;
}

/**
 * Convierte número de mes y año a string para comparación con BD.
 * Ej: year=2026, month=3 → "2026", mes como number para query .eq
 */
export function monthToQueryParts(year: number, month: number) {
  return { year, month };
}

/** Días en un mes dado (1-indexed). Ej: daysInMonth(2026, 3) → 31. */
export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * Factor de prorrateo para el mes en curso del año actual.
 * Ej: 8 de Marzo 2026 → { month: 3, factor: 8/31 ≈ 0.258 }
 * Retorna null si el año analizado no es el año calendario (todos los meses son cerrados).
 */
export function currentMonthProrata(year: number): { month: number; factor: number } | null {
  const calYear = getCalendarYear();
  const calMonth = getCalendarMonth();
  const calDay = getCalendarDay();
  if (year !== calYear) return null;
  const dim = daysInMonth(year, calMonth);
  return { month: calMonth, factor: calDay / dim };
}
