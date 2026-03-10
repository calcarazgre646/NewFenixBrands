/**
 * domain/executive/calcs.ts
 *
 * Funciones puras para los cálculos de la vista ejecutiva (Road to Annual Target).
 * Cero dependencias de React. Cero side effects. Testeables aisladamente.
 */
import { MONTH_SHORT, MONTH_FULL } from "@/domain/period/helpers";
import { calcGrossMargin } from "@/domain/kpis/calculations";

// ─── Tipos ──────────────────────────────────────────────────────────────────

export interface ChartPoint {
  month: number;        // 1-12
  label: string;        // "Ene"
  cumReal: number | null;
  cumForecast: number | null;
  cumTarget: number;
  cumPriorYear: number;
}

export interface MonthlyRow {
  month: number;
  monthLabel: string;
  /** Ventas netas reales (Gs.) */
  real: number;
  budget: number;
  lastYear: number;
  vsBudget: number;
  vsLastYear: number;
  /** Margen bruto real % (0-100) */
  marginPct: number;
  /** Margen bruto presupuesto % (0-100) */
  marginBudgetPct: number;
  /** Margen bruto año anterior % (0-100) */
  marginPYPct: number;
  /** Unidades vendidas reales */
  units: number;
  /** Unidades presupuesto */
  unitsBudget: number;
  /** Unidades año anterior */
  unitsPY: number;
  hasRealData: boolean;
  isCurrentMonth: boolean;
}

// ─── Constantes ─────────────────────────────────────────────────────────────

const ANNUAL_TARGET_FALLBACK = 70_000_000_000;
const LY_BUDGET_FACTOR = 0.90;
const AVG_DAYS_PER_MONTH = 365 / 12;

// ─── Cálculos ───────────────────────────────────────────────────────────────

/**
 * Calcula el objetivo anual desde metas por sucursal. Fallback a 70B si no hay datos.
 * Acepta metas pre-filtradas (por canal/tienda en el hook).
 */
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
 * @param partialProrata Factor de prorrateo del mes actual (para comparación justa)
 * @param monthlyPY      Map<month, neto> — ventas del año anterior por mes
 * @param partialMonthPY Ventas PY del mes parcial calculadas desde datos diarios (día a día exacto)
 */
export function buildCumulativeSeries(
  monthlyReal: Map<number, number>,
  monthlyBudget: Map<number, number>,
  lastRealMonth: number,
  monthlyRunRate: number,
  partialProrata?: { month: number; factor: number } | null,
  monthlyPY?: Map<number, number>,
  partialMonthPY?: number,
): ChartPoint[] {
  const points: ChartPoint[] = [];
  let cumReal = 0;
  let cumForecast = 0;
  let cumTarget = 0;
  let cumPY = 0;

  for (let m = 1; m <= 12; m++) {
    const real = monthlyReal.get(m) ?? 0;
    const budgetFull = monthlyBudget.get(m) ?? 0;
    // Prorratear presupuesto del mes parcial para comparación simétrica
    const isPartial = partialProrata != null && m === partialProrata.month;
    const budget = isPartial ? budgetFull * partialProrata.factor : budgetFull;
    cumTarget += budget;
    const pyFull = monthlyPY?.get(m) ?? 0;
    // Mes parcial: usar suma día a día exacta del PY (no prorrateo)
    cumPY += (isPartial && partialMonthPY != null) ? partialMonthPY : pyFull;

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
      cumPriorYear: cumPY,
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

export interface MonthlyRowInputs {
  monthlyReal: Map<number, number>;
  monthlyBudget: Map<number, number>;
  monthlyPY: Map<number, number>;
  monthlyCost: Map<number, number>;
  monthlyPYCost: Map<number, number>;
  monthlyBudgetGmPct: Map<number, number>;
  monthlyUnits: Map<number, number>;
  monthlyBudgetUnits: Map<number, number>;
  monthlyPYUnits: Map<number, number>;
  calendarMonth: number;
  partialProrata?: { month: number; factor: number } | null;
}

export function buildMonthlyRows(inputs: MonthlyRowInputs): MonthlyRow[] {
  const {
    monthlyReal, monthlyBudget, monthlyPY,
    monthlyCost, monthlyPYCost, monthlyBudgetGmPct,
    monthlyUnits, monthlyBudgetUnits, monthlyPYUnits,
    calendarMonth, partialProrata,
  } = inputs;

  const rows: MonthlyRow[] = [];

  for (let m = 1; m <= 12; m++) {
    const real = monthlyReal.get(m) ?? 0;
    const cost = monthlyCost.get(m) ?? 0;
    const budgetFull = monthlyBudget.get(m) ?? 0;
    const hasRealData = monthlyReal.has(m);
    const lastYearFull = monthlyPY.has(m) ? (monthlyPY.get(m) ?? 0) : budgetFull * LY_BUDGET_FACTOR;
    const lastYearCost = monthlyPYCost.get(m) ?? 0;

    // Prorratear presupuesto y año anterior en el mes parcial
    const isPartial = partialProrata != null && m === partialProrata.month;
    const budget   = isPartial ? budgetFull * partialProrata.factor : budgetFull;
    const lastYear = isPartial ? lastYearFull * partialProrata.factor : lastYearFull;

    // Margen bruto %
    const marginPct       = hasRealData ? calcGrossMargin(real, cost) : 0;
    const marginBudgetPct = monthlyBudgetGmPct.get(m) ?? 0;
    const marginPYPct     = monthlyPY.has(m) ? calcGrossMargin(lastYearFull, lastYearCost) : 0;

    // Unidades — prorrateo del presupuesto en mes parcial
    const unitsBudgetFull = monthlyBudgetUnits.get(m) ?? 0;
    const unitsPYFull     = monthlyPYUnits.get(m) ?? 0;

    rows.push({
      month: m,
      monthLabel: MONTH_FULL[m],
      real: hasRealData ? real : 0,
      budget,
      lastYear,
      vsBudget: hasRealData ? real - budget : 0,
      vsLastYear: hasRealData ? real - lastYear : 0,
      marginPct,
      marginBudgetPct,
      marginPYPct,
      units: hasRealData ? (monthlyUnits.get(m) ?? 0) : 0,
      unitsBudget: isPartial ? Math.round(unitsBudgetFull * partialProrata!.factor) : unitsBudgetFull,
      unitsPY: isPartial ? Math.round(unitsPYFull * partialProrata!.factor) : unitsPYFull,
      hasRealData,
      isCurrentMonth: m === calendarMonth,
    });
  }

  return rows;
}

// ─── Series diarias (vista de mes individual) ────────────────────────────────

export interface DailyChartPoint {
  day: number;
  label: string;       // "1", "2", ... "31"
  real: number | null;
  priorYear: number | null;
  budgetDaily: number; // budget del mes / días del mes
}

/**
 * Construye puntos diarios para un mes individual.
 * Muestra CY vs PY día a día, con línea de budget diario promedio.
 *
 * @param dailyCY   Filas diarias del año actual (ya filtradas por brand/channel)
 * @param dailyPY   Filas diarias del año anterior (ya filtradas por brand/channel)
 * @param month     Mes a graficar (1-12)
 * @param monthBudget Budget total del mes
 * @param totalDays Días del mes (28-31)
 * @param lastDay   Último día con datos reales (null = mes cerrado, mostrar todos)
 */
export function buildDailySeries(
  dailyCY: Array<{ month: number; day: number; neto: number }>,
  dailyPY: Array<{ month: number; day: number; neto: number }>,
  month: number,
  monthBudget: number,
  totalDays: number,
  lastDay: number | null,
): DailyChartPoint[] {
  // Acumular por día
  const cyByDay = new Map<number, number>();
  const pyByDay = new Map<number, number>();
  for (const r of dailyCY) {
    if (r.month === month) cyByDay.set(r.day, (cyByDay.get(r.day) ?? 0) + r.neto);
  }
  for (const r of dailyPY) {
    if (r.month === month) pyByDay.set(r.day, (pyByDay.get(r.day) ?? 0) + r.neto);
  }

  const budgetDaily = totalDays > 0 ? monthBudget / totalDays : 0;
  const maxDay = lastDay ?? totalDays;
  const points: DailyChartPoint[] = [];
  let cumReal = 0;
  let cumPY = 0;
  let cumBudget = 0;

  for (let d = 1; d <= maxDay; d++) {
    cumReal += cyByDay.get(d) ?? 0;
    cumPY += pyByDay.get(d) ?? 0;
    cumBudget += budgetDaily;

    points.push({
      day: d,
      label: String(d),
      real: cumReal,
      priorYear: cumPY,
      budgetDaily: cumBudget,
    });
  }
  return points;
}
