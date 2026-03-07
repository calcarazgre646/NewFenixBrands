/**
 * domain/executive/calcs.ts
 *
 * Funciones puras para los cálculos de la vista ejecutiva (Road to Annual Target).
 * Cero dependencias de React. Cero side effects. Testeables aisladamente.
 */

// ─── Tipos ──────────────────────────────────────────────────────────────────

export interface ChartPoint {
  month: number;        // 1-12
  label: string;        // "Ene"
  cumReal: number | null;
  cumForecast: number | null;
  cumTarget: number;
}

export interface MonthlyRow {
  month: number;
  monthLabel: string;
  real: number;
  budget: number;
  lastYear: number;
  vsBudget: number;
  vsLastYear: number;
  hasRealData: boolean;
  isCurrentMonth: boolean;
}

// ─── Constantes ─────────────────────────────────────────────────────────────

const ANNUAL_TARGET_FALLBACK = 70_000_000_000;
const LY_BUDGET_FACTOR = 0.90;
const AVG_DAYS_PER_MONTH = 365 / 12;

const MONTH_SHORT: Record<number, string> = {
  1: "Ene", 2: "Feb", 3: "Mar", 4: "Abr", 5: "May", 6: "Jun",
  7: "Jul", 8: "Ago", 9: "Sep", 10: "Oct", 11: "Nov", 12: "Dic",
};
const MONTH_FULL: Record<number, string> = {
  1: "Enero", 2: "Febrero", 3: "Marzo", 4: "Abril", 5: "Mayo", 6: "Junio",
  7: "Julio", 8: "Agosto", 9: "Septiembre", 10: "Octubre", 11: "Noviembre", 12: "Diciembre",
};

// ─── Cálculos ───────────────────────────────────────────────────────────────

/** Calcula el objetivo anual desde metas por sucursal. Fallback a 70B si no hay datos. */
export function calcAnnualTarget(goals: Array<{ goal: number }>): number {
  if (goals.length === 0) return ANNUAL_TARGET_FALLBACK;
  const total = goals.reduce((s, g) => s + g.goal, 0);
  return total > 0 ? total : ANNUAL_TARGET_FALLBACK;
}

/** Día del año (1-365). Ej: 3 de Marzo → ~62. */
export function dayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export function calcForecast(ytd: number, calendarDaysElapsed: number, daysInYear: number): number {
  if (calendarDaysElapsed <= 0) return ytd;
  const dailyRunRate = ytd / calendarDaysElapsed;
  const daysRemaining = daysInYear - calendarDaysElapsed;
  return ytd + dailyRunRate * Math.max(0, daysRemaining);
}

export function calcRequiredMonthlyRunRate(target: number, ytd: number, daysRemaining: number): number {
  const monthsRemaining = Math.max(1, Math.round(daysRemaining / AVG_DAYS_PER_MONTH));
  const gap = target - ytd;
  return gap > 0 ? gap / monthsRemaining : 0;
}

export function calcLinearPaceGap(target: number, ytd: number, calendarDaysElapsed: number, daysInYear: number): number {
  const linearIdeal = target * (calendarDaysElapsed / daysInYear);
  return linearIdeal - ytd;
}

// ─── Series acumulativas ────────────────────────────────────────────────────

/**
 * Construye 12 puntos acumulativos para el gráfico.
 *
 * @param monthlyReal    Map<month, neto> — ventas reales por mes
 * @param monthlyBudget  Map<month, revenue> — presupuesto por mes
 * @param lastRealMonth  Último mes con datos reales (1-12)
 * @param monthlyRunRate Run-rate mensual para proyección de meses futuros
 */
export function buildCumulativeSeries(
  monthlyReal: Map<number, number>,
  monthlyBudget: Map<number, number>,
  lastRealMonth: number,
  monthlyRunRate: number,
): ChartPoint[] {
  const points: ChartPoint[] = [];
  let cumReal = 0;
  let cumForecast = 0;
  let cumTarget = 0;

  for (let m = 1; m <= 12; m++) {
    const real = monthlyReal.get(m) ?? 0;
    const budget = monthlyBudget.get(m) ?? 0;
    cumTarget += budget;

    const hasReal = monthlyReal.has(m) && m <= lastRealMonth;
    if (hasReal) {
      cumReal += real;
      cumForecast = cumReal;
    }

    points.push({
      month: m,
      label: MONTH_SHORT[m],
      cumReal: hasReal ? cumReal : null,
      cumForecast: m > lastRealMonth ? (cumForecast += monthlyRunRate) : null,
      cumTarget,
    });
  }

  // Connect forecast line to last real point
  if (lastRealMonth >= 1 && lastRealMonth < 12) {
    const pt = points[lastRealMonth - 1];
    points[lastRealMonth - 1] = { ...pt, cumForecast: pt.cumReal };
  }

  return points;
}

// ─── Filas de tabla mensual ─────────────────────────────────────────────────

export function buildMonthlyRows(
  monthlyReal: Map<number, number>,
  monthlyBudget: Map<number, number>,
  monthlyPY: Map<number, number>,
  calendarMonth: number,
): MonthlyRow[] {
  const rows: MonthlyRow[] = [];

  for (let m = 1; m <= 12; m++) {
    const real = monthlyReal.get(m) ?? 0;
    const budget = monthlyBudget.get(m) ?? 0;
    const hasRealData = monthlyReal.has(m);
    const lastYear = monthlyPY.has(m) ? (monthlyPY.get(m) ?? 0) : budget * LY_BUDGET_FACTOR;

    rows.push({
      month: m,
      monthLabel: MONTH_FULL[m],
      real: hasRealData ? real : 0,
      budget,
      lastYear,
      vsBudget: hasRealData ? real - budget : 0,
      vsLastYear: hasRealData ? real - lastYear : 0,
      hasRealData,
      isCurrentMonth: m === calendarMonth,
    });
  }

  return rows;
}
