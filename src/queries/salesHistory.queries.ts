/**
 * queries/salesHistory.queries.ts
 *
 * Historial de ventas para la Cola de Acciones.
 *
 * FUENTE: mv_ventas_12m_por_tienda_sku (vista materializada)
 *   Pre-agrega ventas por (store, sku, year, month) desde fjdhstvta1.
 *   ~8K-20K filas vs 252K en fjdhstvta1 crudo.
 *
 * HISTORIAL:
 *   - Antes (03/03): fjdhstvta1 directo en batches de 100 SKUs × 12 meses (lento, 100+ requests)
 *   - Ahora (07/03): mv_ventas_12m_por_tienda_sku (rapido, 10-20 requests max)
 */
import { dataClient } from "@/api/client";
import { toNum, trimStr } from "@/api/normalize";
import { fetchAllRows } from "@/queries/paginate";
import { getCalendarMonth, getCalendarYear } from "@/domain/period/helpers";

export type SalesHistoryMap = Map<string, number>; // "STORE|sku" → avg units/month

/**
 * Calcula el promedio mensual de ventas por (tienda, SKU) en los ultimos 12 meses.
 * Usa la vista materializada mv_ventas_12m_por_tienda_sku.
 * Store ya viene en UPPERCASE desde la vista.
 */
export async function fetchSalesHistory(skus: string[]): Promise<SalesHistoryMap> {
  if (skus.length === 0) return new Map();

  const calYear  = getCalendarYear();
  const calMonth = getCalendarMonth();

  // Construir filtros de year/month para los ultimos 12 meses
  const validPeriods: Array<{ year: number; month: number }> = [];
  for (let i = 0; i < 12; i++) {
    let m = calMonth - i;
    let y = calYear;
    if (m <= 0) { m += 12; y -= 1; }
    validPeriods.push({ year: y, month: m });
  }

  const byYear = new Map<number, number[]>();
  for (const { year, month } of validPeriods) {
    if (!byYear.has(year)) byYear.set(year, []);
    byYear.get(year)!.push(month);
  }

  // Acumulador: "STORE|sku" → { totalUnits, uniqueMonths }
  const acc = new Map<string, { total: number; monthsWithSales: Set<string> }>();

  // Fetch en batches de SKUs (la vista tiene ~8K-20K filas, mucho menos que fjdhstvta1)
  const BATCH = 200;
  for (let i = 0; i < skus.length; i += BATCH) {
    const batch = skus.slice(i, i + BATCH);

    for (const [year, months] of byYear) {
      const data = await fetchAllRows(() =>
        dataClient
          .from("mv_ventas_12m_por_tienda_sku")
          .select("store, sku, month, total_units")
          .eq("year", year)
          .in("month", months)
          .in("sku", batch)
      );

      for (const r of data) {
        const store = trimStr(r.store);
        const sku   = trimStr(r.sku);
        const key   = `${store}|${sku}`;
        const monthKey = `${year}-${r.month}`;

        const entry = acc.get(key) ?? { total: 0, monthsWithSales: new Set() };
        entry.total += toNum(r.total_units);
        entry.monthsWithSales.add(monthKey);
        acc.set(key, entry);
      }
    }
  }

  // Calcular promedio mensual
  const result: SalesHistoryMap = new Map();
  acc.forEach(({ total, monthsWithSales }, key) => {
    const months = Math.max(monthsWithSales.size, 1);
    result.set(key, total / months);
  });

  return result;
}
