/**
 * queries/dso.queries.ts
 *
 * DSO (Days Sales Outstanding) — días promedio de cobranza.
 *
 * FÓRMULA CORRECTA: saldo CxC abierto a la fecha de corte / ventas diarias
 *                   promedio del período.
 *
 * El numerador es un SNAPSHOT del saldo abierto, no un acumulado del período.
 * El denominador sí depende del período.
 *
 *   saldo_abierto = SUM(pendiente_de_pago > 0) WHERE f_factura <= cutoff
 *   ventas_diarias = ventas_neto_periodo / dias_periodo
 *   dso = saldo_abierto / ventas_diarias
 *
 * NOTAS:
 *   - El cutoff `f_factura <= periodEnd` excluye facturas con fecha futura
 *     (hay datos sucios con f_factura hasta 2027 que distorsionan el saldo).
 *   - c_cobrar NO tiene marca/canal/tienda → DSO solo es coherente a nivel
 *     total. Por eso el catálogo declara supportedFilters: false en las 3.
 *   - Si mv_ventas_diarias no tiene datos del período (ej: currentMonth con
 *     ETL atrasado), retornamos dataAvailable=false para que la UI muestre
 *     un error didáctico en vez de un número absurdo.
 *
 * FUENTES:
 *   - c_cobrar.pendiente_de_pago — saldo abierto.
 *   - mv_ventas_diarias.neto — ventas netas diarias.
 */
import { dataClient } from "@/api/client";
import { fetchAllRows } from "@/queries/paginate";
import { toNum } from "@/api/normalize";

export interface DSOInput {
  /** Año del período (ej: 2026). */
  year: number;
  /** Meses incluidos en el período (1-indexed). */
  months: number[];
}

export interface DSOResult {
  /** Saldo abierto total a la fecha (suma de pendiente_de_pago > 0 con f_factura <= periodEnd). */
  cuentasPorCobrar: number;
  /** Ventas netas del período usado (suma de neto en mv_ventas_diarias). */
  ventasPeriodo: number;
  /** Días con datos reales en mv_ventas_diarias dentro del período. */
  diasConDatos: number;
  /** Ventas diarias promedio = ventasPeriodo / diasConDatos. 0 si no hay datos. */
  ventasDiariasPromedio: number;
  /** DSO en días. 0 cuando dataAvailable=false. */
  dso: number;
  /**
   * false cuando ni el período pedido ni el fallback al último mes con datos
   * tienen ventas. El consumidor debe mostrar error en este caso.
   */
  dataAvailable: boolean;
  /**
   * Año-mes efectivamente usado para calcular ventas. Cuando hay fallback
   * (período pedido vacío), refleja el último mes con datos. La UI puede
   * mostrarlo como sub-label cuando difiere del período pedido.
   */
  actualPeriod: { year: number; months: number[] };
  /** true si actualPeriod difiere del input (hubo fallback al último mes con datos). */
  fallbackApplied: boolean;
}

export async function fetchDSO(input: DSOInput): Promise<DSOResult> {
  if (input.months.length === 0) {
    return emptyResult({ year: input.year, months: [] }, false);
  }

  // Intento 1: período pedido por el usuario.
  const primary = await fetchDSOForPeriod(input.year, input.months);
  if (primary.dataAvailable) return { ...primary, fallbackApplied: false };

  // Intento 2: fallback al último mes con datos en mv_ventas_diarias.
  // Usado típicamente cuando filters.period='currentMonth' y el ETL viene
  // con un día de retraso. El saldo CxC se recalcula también con el cutoff
  // de ese mes (snapshot a esa fecha).
  const lastMonth = await findLastMonthWithData();
  if (!lastMonth) return { ...primary, fallbackApplied: false }; // sin datos en ningún mes

  const fallback = await fetchDSOForPeriod(lastMonth.year, [lastMonth.month]);
  return { ...fallback, fallbackApplied: true };
}

async function fetchDSOForPeriod(
  year: number,
  months: number[],
): Promise<Omit<DSOResult, "fallbackApplied">> {
  const minMonth = Math.min(...months);
  const maxMonth = Math.max(...months);
  const periodEnd = lastDayOfMonth(year, maxMonth);

  // Saldo abierto a la fecha de corte. NO filtramos por f_factura inicial:
  // el saldo es un snapshot acumulado, no un flujo del período.
  const cxcRows = await fetchAllRows(() =>
    dataClient
      .from("c_cobrar")
      .select("pendiente_de_pago")
      .gt("pendiente_de_pago", 0)
      .lte("f_factura", periodEnd),
  );

  let cuentasPorCobrar = 0;
  for (const r of cxcRows) cuentasPorCobrar += toNum(r.pendiente_de_pago);

  const ventasRows = await fetchAllRows(() =>
    dataClient
      .from("mv_ventas_diarias")
      .select("neto, year, month, day")
      .eq("year", year)
      .gte("month", minMonth)
      .lte("month", maxMonth),
  );

  let ventasPeriodo = 0;
  const diasUnicos = new Set<string>();
  for (const r of ventasRows) {
    if (!months.includes(r.month as number)) continue;
    ventasPeriodo += toNum(r.neto);
    diasUnicos.add(`${r.year}-${r.month}-${r.day}`);
  }

  const diasConDatos = diasUnicos.size;
  const dataAvailable = diasConDatos > 0 && ventasPeriodo > 0;
  const ventasDiariasPromedio = dataAvailable ? ventasPeriodo / diasConDatos : 0;
  const dso = dataAvailable ? cuentasPorCobrar / ventasDiariasPromedio : 0;

  return {
    cuentasPorCobrar,
    ventasPeriodo,
    diasConDatos,
    ventasDiariasPromedio,
    dso,
    dataAvailable,
    actualPeriod: { year, months: [...months].sort((a, b) => a - b) },
  };
}

/** Encuentra el último (year, month) con al menos una fila en mv_ventas_diarias. */
async function findLastMonthWithData(): Promise<{ year: number; month: number } | null> {
  const rows = await fetchAllRows<{ year: number; month: number }>(() =>
    dataClient
      .from("mv_ventas_diarias")
      .select("year, month")
      .order("year", { ascending: false })
      .order("month", { ascending: false })
      .limit(50),
  );
  if (rows.length === 0) return null;
  return { year: rows[0].year, month: rows[0].month };
}

function emptyResult(period: { year: number; months: number[] }, fallbackApplied: boolean): DSOResult {
  return {
    cuentasPorCobrar: 0,
    ventasPeriodo: 0,
    diasConDatos: 0,
    ventasDiariasPromedio: 0,
    dso: 0,
    dataAvailable: false,
    actualPeriod: period,
    fallbackApplied,
  };
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function lastDayOfMonth(year: number, month: number): string {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${pad(month)}-${pad(last)}`;
}
