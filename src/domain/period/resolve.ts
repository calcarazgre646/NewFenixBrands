/**
 * domain/period/resolve.ts
 *
 * UNA SOLA implementación de la lógica de resolución de períodos.
 * Esta función fue duplicada 5 veces en el proyecto anterior — aquí se unifica.
 *
 * Reglas de negocio:
 *   - ytd:             activeMonths = meses hasta hoy (≤ calendarMonth), incluyendo parcial.
 *                      closedMonths = solo meses cerrados (< calendarMonth) para YoY simétrico.
 *   - lastClosedMonth: [calendarMonth - 1] si existe en BD
 *   - currentMonth:    [calendarMonth] (puede ser parcial)
 *   - isPartial:       true si la BD ya tiene datos del mes calendario actual
 *                      (el ETL cargó datos parciales del mes en curso)
 *   - closedMonths:    subconjunto de activeMonths con meses < calendarMonth
 *                      → usados para YoY simétrico (comparar períodos equivalentes)
 *
 * HISTORIAL DE BUGS EVITADOS:
 *   - Bug Feb 2026: nunca usar la BD para determinar el mes actual
 *     → el calendarMonth siempre viene de new Date() a través de helpers.ts
 *   - Bug Mar 2026: LfL comparaba 3 días de Marzo vs Marzo completo del año anterior
 *     → closedMonths excluye el mes en curso para garantizar comparación simétrica
 */

import type { PeriodFilter } from "@/domain/filters/types";
import {
  getCalendarMonth,
  getCalendarYear,
  getCalendarDay,
  buildPeriodLabel,
} from "./helpers";

export interface ResolvedPeriod {
  /** Meses a usar en las queries de Supabase */
  activeMonths:  number[];
  /** Meses cerrados (< calendarMonth) — para YoY/LfL simétrico */
  closedMonths:  number[];
  /** true si el mes calendario actual tiene datos en BD (ETL parcial) */
  isPartial:     boolean;
  /** Label display: "Ene–Feb 2026" o "Mar 2026 ⚠" */
  label:         string;
  /** Mes del sistema (1-12), fuente de verdad del tiempo */
  calendarMonth: number;
  /** Día del sistema (1-31) */
  calendarDay:   number;
}

/**
 * Resuelve un período de filtro a meses concretos con metadatos.
 *
 * @param period      Filtro de período seleccionado por el usuario
 * @param monthsInDB  Meses con datos reales en BD para el año dado (1-indexed)
 * @param year        Año de análisis
 */
export function resolvePeriod(
  period: PeriodFilter,
  monthsInDB: number[],
  year: number
): ResolvedPeriod {
  const calendarMonth = getCalendarMonth();
  const calendarYear  = getCalendarYear();
  const calendarDay   = getCalendarDay();

  const isCurrentYear = year === calendarYear;
  // isPartial: la BD ya tiene datos del mes en curso → datos incompletos
  const isPartial = isCurrentYear && monthsInDB.includes(calendarMonth);

  const dbMonthsSorted = [...monthsInDB].sort((a, b) => a - b);

  let activeMonths: number[];
  let closedMonths: number[];

  switch (period) {
    case "ytd": {
      // activeMonths = desde Enero hasta hoy (inclusive calendarMonth) — "YTD hasta hoy".
      // closedMonths = solo meses cerrados (< calendarMonth) — para YoY/LfL simétrico
      //                con períodos equivalentes entre años.
      // Para años anteriores, todos los meses disponibles son "cerrados".
      activeMonths = isCurrentYear
        ? dbMonthsSorted.filter(m => m <= calendarMonth)
        : dbMonthsSorted;
      closedMonths = isCurrentYear
        ? dbMonthsSorted.filter(m => m < calendarMonth)
        : dbMonthsSorted;
      break;
    }

    case "lastClosedMonth": {
      // Último mes completamente cerrado
      const lastClosed = isCurrentYear
        ? calendarMonth - 1
        : Math.max(...dbMonthsSorted, 0);
      activeMonths = lastClosed > 0 && dbMonthsSorted.includes(lastClosed)
        ? [lastClosed]
        : [];
      closedMonths = activeMonths;
      break;
    }

    case "currentMonth": {
      // Mes calendario actual — puede tener datos parciales
      activeMonths = dbMonthsSorted.includes(calendarMonth)
        ? [calendarMonth]
        : [];
      // currentMonth nunca entra en closedMonths (YoY necesita período completo)
      closedMonths = [];
      break;
    }
  }

  // El ⚠ en el label solo aparece cuando se muestra el mes en curso con datos parciales
  const labelIsPartial = period === "currentMonth" && isPartial;
  const label = buildPeriodLabel(activeMonths, year, labelIsPartial);

  return {
    activeMonths,
    closedMonths,
    isPartial,
    label,
    calendarMonth,
    calendarDay,
  };
}
