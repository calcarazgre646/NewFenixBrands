/**
 * queries/dso.queries.ts
 *
 * DSO (Days Sales Outstanding) — días promedio de cobranza.
 *
 * FÓRMULA: cuentas_por_cobrar / ventas_diarias_promedio
 *
 * FUENTES:
 *   - c_cobrar.pendiente_de_pago — saldo abierto a la fecha del corte.
 *     Sumamos pendiente_de_pago > 0 con f_factura dentro del rango del período.
 *   - mv_ventas_diarias.neto — ventas diarias por (year, month, day, brand, channel).
 *     Soporta filtros por brand y channel directos en BD.
 *
 * Período: usa year/months del filtro activo (mismo patrón que el resto del
 * dashboard de KPIs). DSO se reporta como días promedio del período.
 *
 * Soporte de filtros:
 *   - brand:   true (mv_ventas_diarias tiene brand). c_cobrar NO tiene brand,
 *              así que la marca solo afecta el denominador (ventas) — el saldo
 *              CxC permanece total. Aceptamos esa asimetría: DSO con brand
 *              estima "cuántos días tarda la marca X en convertir su venta
 *              actual al saldo CxC global".
 *   - channel: true (mv_ventas_diarias tiene channel). Mismo razonamiento.
 *   - store:   false (c_cobrar no tiene store; ningún cruce confiable).
 */
import { dataClient } from "@/api/client";
import { fetchAllRows } from "@/queries/paginate";
import { toNum } from "@/api/normalize";

export interface DSOInput {
  /** Año del período (ej: 2026). */
  year: number;
  /** Meses incluidos en el período (1-indexed). Para currentMonth: [4]. Para ytd: [1,2,3,4]. */
  months: number[];
  /** Marca canónica ('Martel', 'Wrangler', 'Lee', etc.) o null para todas. */
  brand?: string | null;
  /** Canal: 'b2b', 'b2c' o null para total. */
  channel?: "b2b" | "b2c" | null;
}

export interface DSOResult {
  /** Saldo abierto a la fecha (suma de pendiente_de_pago > 0 cuyo f_factura cae en el período). */
  cuentasPorCobrar: number;
  /** Ventas netas del período. */
  ventasPeriodo: number;
  /** Días del período (suma de días calendario de los meses incluidos). */
  diasPeriodo: number;
  /** Ventas diarias promedio = ventasPeriodo / diasPeriodo. */
  ventasDiariasPromedio: number;
  /** DSO en días. 0 si no hay ventas. */
  dso: number;
}

/**
 * Calcula DSO para un período dado.
 *
 * Trae c_cobrar acotado a f_factura en [periodStart, periodEnd] con
 * pendiente_de_pago > 0 y suma. Trae mv_ventas_diarias filtrado en BD por
 * year + months + brand? + channel? y suma neto. Resuelve días del período
 * por días calendario de los meses incluidos (no por días con datos —
 * promediamos sobre el calendario del período).
 */
export async function fetchDSO(input: DSOInput): Promise<DSOResult> {
  if (input.months.length === 0) {
    return {
      cuentasPorCobrar: 0,
      ventasPeriodo: 0,
      diasPeriodo: 0,
      ventasDiariasPromedio: 0,
      dso: 0,
    };
  }

  const minMonth = Math.min(...input.months);
  const maxMonth = Math.max(...input.months);
  const periodStart = `${input.year}-${pad(minMonth)}-01`;
  const periodEnd = lastDayOfMonth(input.year, maxMonth);
  const diasPeriodo = sumCalendarDays(input.year, input.months);

  const cxcRows = await fetchAllRows(() =>
    dataClient
      .from("c_cobrar")
      .select("pendiente_de_pago")
      .gt("pendiente_de_pago", 0)
      .gte("f_factura", periodStart)
      .lte("f_factura", periodEnd),
  );

  let cuentasPorCobrar = 0;
  for (const r of cxcRows) cuentasPorCobrar += toNum(r.pendiente_de_pago);

  const ventasRows = await fetchAllRows(() => {
    let q = dataClient
      .from("mv_ventas_diarias")
      .select("neto, brand, channel, year, month")
      .eq("year", input.year)
      .in("month", input.months);
    if (input.brand) q = q.eq("brand", input.brand);
    if (input.channel) q = q.eq("channel", input.channel.toUpperCase());
    return q;
  });

  let ventasPeriodo = 0;
  for (const r of ventasRows) ventasPeriodo += toNum(r.neto);

  const ventasDiariasPromedio = diasPeriodo > 0 ? ventasPeriodo / diasPeriodo : 0;
  const dso = ventasDiariasPromedio > 0 ? cuentasPorCobrar / ventasDiariasPromedio : 0;

  return {
    cuentasPorCobrar,
    ventasPeriodo,
    diasPeriodo,
    ventasDiariasPromedio,
    dso,
  };
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function lastDayOfMonth(year: number, month: number): string {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${pad(month)}-${pad(last)}`;
}

function sumCalendarDays(year: number, months: number[]): number {
  let total = 0;
  for (const m of months) {
    total += new Date(Date.UTC(year, m, 0)).getUTCDate();
  }
  return total;
}
