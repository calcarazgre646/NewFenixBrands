/**
 * domain/projections/calculations.ts
 *
 * Funciones puras para proyección de ventas por vendedor.
 *
 * REGLA: Sin I/O, sin React, sin Supabase. Solo funciones puras.
 *
 * Modelo: run-rate lineal diario.
 *   ritmoDiario = ventaAcumulada / díasTranscurridos
 *   ventaProyectada = ventaAcumulada + ritmoDiario × díasRestantes
 *
 * Reusa el motor de comisiones (calcCommission) para estimar la comisión
 * proyectada con cobranzaReal = 0.
 */
import { daysInMonth } from "@/domain/period/helpers";
import { calcCommission, calcCumplimiento } from "@/domain/commissions/calculations";
import { SCALE_BY_ROLE } from "@/domain/commissions/scales";
import type { CommissionScale, SellerGoal } from "@/domain/commissions/types";
import type {
  BuildProjectionInput,
  DailyProjectionPoint,
  DailySalePoint,
  SellerProjection,
} from "./types";

// ─── Núcleo: run-rate y proyección ─────────────────────────────────────────

/** Ritmo diario = ventaAcumulada / díasTranscurridos. 0 si no hay días. */
export function calcDailyRunRate(ventaAcumulada: number, diasTranscurridos: number): number {
  if (diasTranscurridos <= 0) return 0;
  return ventaAcumulada / diasTranscurridos;
}

/**
 * Proyecta la venta al cierre del mes asumiendo ritmo lineal.
 * ventaProyectada = ventaAcumulada + ritmoDiario × max(0, díasRestantes)
 */
export function projectMonthEnd(
  ventaAcumulada: number,
  ritmoDiario: number,
  diasRestantes: number,
): number {
  return ventaAcumulada + ritmoDiario * Math.max(0, diasRestantes);
}

// ─── Resolución de tiempo del mes ──────────────────────────────────────────

export interface MonthTime {
  diasMes: number;
  diasTranscurridos: number;
  diasRestantes: number;
  isMonthClosed: boolean;
  isInProgress: boolean;
}

/**
 * Resuelve el tiempo del mes según relación con la fecha calendario.
 *
 * - Mes pasado (año<hoy o año=hoy y mes<calMonth): cerrado, transcurridos = diasMes
 * - Mes en curso (año=hoy y mes=calMonth): transcurridos = calendarDay
 * - Mes futuro: transcurridos = 0, restantes = diasMes
 */
export function resolveMonthTime(
  año: number,
  mes: number,
  calendarDay: number,
  calendarMonth: number,
  calendarYear: number,
): MonthTime {
  const diasMes = daysInMonth(año, mes);

  // Mes futuro
  if (año > calendarYear || (año === calendarYear && mes > calendarMonth)) {
    return {
      diasMes,
      diasTranscurridos: 0,
      diasRestantes: diasMes,
      isMonthClosed: false,
      isInProgress: false,
    };
  }

  // Mes pasado (cerrado)
  if (año < calendarYear || (año === calendarYear && mes < calendarMonth)) {
    return {
      diasMes,
      diasTranscurridos: diasMes,
      diasRestantes: 0,
      isMonthClosed: true,
      isInProgress: false,
    };
  }

  // Mes en curso: calendarDay clampeado a diasMes
  const diasTranscurridos = Math.min(calendarDay, diasMes);
  const diasRestantes = diasMes - diasTranscurridos;
  return {
    diasMes,
    diasTranscurridos,
    diasRestantes,
    isMonthClosed: diasRestantes === 0,
    isInProgress: diasTranscurridos > 0 && diasRestantes > 0,
  };
}

// ─── Builder principal ─────────────────────────────────────────────────────

/**
 * Construye la proyección completa de un vendedor para un mes.
 *
 * Si hay meta cargada → cumplimientos y comisiones (actual + proyectada) calculados.
 * Si no hay meta → cumplimientos y comisiones quedan en null (UI muestra "pendiente").
 */
export function buildSellerProjection(
  input: BuildProjectionInput,
  scales: Record<string, CommissionScale> = SCALE_BY_ROLE,
): SellerProjection {
  const { seller, daily, año, mes, metaVentas, calendarDay, calendarMonth, calendarYear } = input;

  const time = resolveMonthTime(año, mes, calendarDay, calendarMonth, calendarYear);

  // Sumar venta acumulada hasta `diasTranscurridos` (inclusive)
  // Día sin registro = 0. Días futuros NO suman (clamp por day <= diasTranscurridos).
  let ventaActual = 0;
  for (const p of daily) {
    if (p.day >= 1 && p.day <= time.diasTranscurridos) {
      ventaActual += p.ventaNeta;
    }
  }

  const ritmoDiario = calcDailyRunRate(ventaActual, time.diasTranscurridos);
  const ventaProyectada = projectMonthEnd(ventaActual, ritmoDiario, time.diasRestantes);

  const hasMeta = metaVentas != null && metaVentas > 0;
  let cumplimientoActualPct: number | null = null;
  let cumplimientoProyectadoPct: number | null = null;
  let comisionActualGs: number | null = null;
  let comisionProyectadaGs: number | null = null;
  let comisionProyectadaPct: number | null = null;

  if (hasMeta) {
    cumplimientoActualPct = round2(calcCumplimiento(ventaActual, metaVentas));
    cumplimientoProyectadoPct = round2(calcCumplimiento(ventaProyectada, metaVentas));

    const goal: SellerGoal = {
      vendedorCodigo: seller.vendedorCodigo,
      vendedorNombre: seller.vendedorNombre,
      rolComision: seller.rolComision,
      canal: seller.canal,
      año,
      mes,
      trimestre: Math.ceil(mes / 3),
      metaVentas: metaVentas,
      metaCobranza: 0, // cobranza no se proyecta (c_cobrar vacía)
      sucursalCodigo: seller.sucursalCodigo,
    };

    const actual = calcCommission(goal, ventaActual, 0, scales);
    const proyectada = calcCommission(goal, ventaProyectada, 0, scales);

    comisionActualGs = actual.comisionVentasGs;
    comisionProyectadaGs = proyectada.comisionVentasGs;
    comisionProyectadaPct = proyectada.comisionVentasPct;
  }

  return {
    vendedorCodigo: seller.vendedorCodigo,
    vendedorNombre: seller.vendedorNombre,
    rolComision: seller.rolComision,
    canal: seller.canal,
    sucursalCodigo: seller.sucursalCodigo,
    año,
    mes,
    diasTranscurridos: time.diasTranscurridos,
    diasMes: time.diasMes,
    diasRestantes: time.diasRestantes,
    ventaActual,
    ritmoDiario,
    ventaProyectada,
    metaVentas: hasMeta ? metaVentas : null,
    cumplimientoActualPct,
    cumplimientoProyectadoPct,
    comisionActualGs,
    comisionProyectadaGs,
    comisionProyectadaPct,
    hasMeta,
    isMonthClosed: time.isMonthClosed,
    isInProgress: time.isInProgress,
  };
}

// ─── Serie diaria para gráfico acumulado ───────────────────────────────────

/**
 * Construye N puntos diarios (N = diasMes) para el gráfico.
 *
 * - Días <= diasTranscurridos: ventaDia + ventaAcumReal (datos reales)
 * - Días > diasTranscurridos: ventaDia=null, ventaAcumReal=null, sólo proyección
 * - ventaAcumProyectada: real hasta hoy, lineal después (acum + ritmo × dayOffset)
 * - ventaAcumMeta: si hay meta → meta/diasMes × day. Si no → null
 */
export function buildDailyProjectionSeries(
  daily: DailySalePoint[],
  año: number,
  mes: number,
  calendarDay: number,
  calendarMonth: number,
  calendarYear: number,
  metaVentas: number | null,
): DailyProjectionPoint[] {
  const time = resolveMonthTime(año, mes, calendarDay, calendarMonth, calendarYear);

  // Mapa por día para lookup O(1)
  const byDay = new Map<number, number>();
  for (const p of daily) {
    byDay.set(p.day, (byDay.get(p.day) ?? 0) + p.ventaNeta);
  }

  // Acumulado real al cierre de día `diasTranscurridos`
  let ventaAcumRealHoy = 0;
  for (let d = 1; d <= time.diasTranscurridos; d++) {
    ventaAcumRealHoy += byDay.get(d) ?? 0;
  }
  const ritmoDiario = calcDailyRunRate(ventaAcumRealHoy, time.diasTranscurridos);
  const metaDiaria = metaVentas != null && time.diasMes > 0 ? metaVentas / time.diasMes : null;

  const isCurrentMonth = año === calendarYear && mes === calendarMonth;
  const points: DailyProjectionPoint[] = [];
  let cumReal = 0;

  for (let d = 1; d <= time.diasMes; d++) {
    const ventaDia = byDay.get(d);
    const isPastOrToday = d <= time.diasTranscurridos;

    let ventaAcumReal: number | null = null;
    let ventaDiaOut: number | null = null;
    let ventaAcumProyectada: number;

    if (isPastOrToday) {
      cumReal += ventaDia ?? 0;
      ventaAcumReal = cumReal;
      ventaDiaOut = ventaDia ?? 0;
      ventaAcumProyectada = cumReal;
    } else {
      const dayOffset = d - time.diasTranscurridos;
      ventaAcumProyectada = ventaAcumRealHoy + ritmoDiario * dayOffset;
    }

    points.push({
      day: d,
      label: String(d),
      ventaDia: ventaDiaOut,
      ventaAcumReal,
      ventaAcumProyectada,
      ventaAcumMeta: metaDiaria != null ? metaDiaria * d : null,
      isToday: isCurrentMonth && d === time.diasTranscurridos,
    });
  }

  return points;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
