/**
 * queries/salesHistory.queries.ts
 *
 * Historial de ventas para la Cola de Acciones.
 *
 * FUENTE: mv_ventas_12m_por_tienda_sku (vista materializada)
 *   Pre-agrega ventas por (store, sku, year, month) desde fjdhstvta1.
 *   ~8K-20K filas vs 252K en fjdhstvta1 crudo.
 *
 * PERIODO: 6 meses hacia atras (spec cliente reunion 10/02/2026).
 *   La vista tiene 12 meses pero solo usamos los ultimos 6.
 *
 * HISTORIAL:
 *   - Antes (03/03): fjdhstvta1 directo en batches de 100 SKUs × 12 meses (lento, 100+ requests)
 *   - Ahora (07/03): mv_ventas_12m_por_tienda_sku (rapido, 10-20 requests max)
 *   - Ahora (08/03): Cambiado a 6 meses por spec cliente
 */
import { dataClient } from "@/api/client";
import { toNum, trimStr } from "@/api/normalize";
import { fetchAllRows } from "@/queries/paginate";
import { getCalendarMonth, getCalendarYear } from "@/domain/period/helpers";

export type SalesHistoryMap = Map<string, number>; // "STORE|sku" → avg units/month

/** Meses de historial a considerar (spec cliente: 6 meses hacia atras) */
const HISTORY_MONTHS = 6;

/**
 * Calcula el promedio mensual de ventas por (tienda, SKU) en los ultimos 6 meses.
 * Usa la vista materializada mv_ventas_12m_por_tienda_sku (filtrando solo 6m).
 * Store ya viene en UPPERCASE desde la vista.
 */
export async function fetchSalesHistory(skus: string[]): Promise<SalesHistoryMap> {
  if (skus.length === 0) return new Map();

  const calYear  = getCalendarYear();
  const calMonth = getCalendarMonth();

  // Construir filtros de year/month para los ultimos 6 meses
  const validPeriods: Array<{ year: number; month: number }> = [];
  for (let i = 0; i < HISTORY_MONTHS; i++) {
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

  // Fetch en batches de SKUs, parallelizando por year-group dentro de cada batch.
  // Antes: BATCH × byYear.size requests SECUENCIALES (~30 requests).
  // Ahora: BATCH requests secuenciales × byYear.size en PARALELO (~15 requests).
  const BATCH = 200;
  for (let i = 0; i < skus.length; i += BATCH) {
    const batch = skus.slice(i, i + BATCH);

    // Parallelize year-group fetches within each batch
    const yearEntries = [...byYear.entries()];
    const yearResults = await Promise.all(
      yearEntries.map(([year, months]) =>
        fetchAllRows(() =>
          dataClient
            .from("mv_ventas_12m_por_tienda_sku")
            .select("store, sku, year, month, total_units")
            .eq("year", year)
            .in("month", months)
            .in("sku", batch)
        )
      )
    );

    for (let yi = 0; yi < yearResults.length; yi++) {
      const year = yearEntries[yi][0];
      for (const r of yearResults[yi]) {
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

  // Calcular promedio mensual sobre TODOS los meses del período (6),
  // no solo los meses con ventas. Dividir por meses con ventas inflaba
  // los targets del waterfall para SKUs con ventas esporádicas.
  const result: SalesHistoryMap = new Map();
  acc.forEach(({ total }, key) => {
    result.set(key, total / HISTORY_MONTHS);
  });

  return result;
}
