/**
 * queries/filters.ts
 *
 * Funciones de filtrado local para datos WIDE cacheados.
 * Usadas por useSalesDashboard, useExecutiveData, useKpiDashboard.
 */
import type { MonthlySalesRow } from "./sales.queries";
import { brandIdToCanonical } from "@/api/normalize";

/** Filtra filas de ventas mensuales por brand/channel/store (local, sin API). */
export function filterSalesRows(
  rows: MonthlySalesRow[],
  brand: string,
  channel: string,
  store: string | null,
): MonthlySalesRow[] {
  const canonical = brand !== "total" ? brandIdToCanonical(brand) : null;
  const ch = channel !== "total" ? channel.toUpperCase() : null;
  return rows.filter((r) => {
    if (canonical && r.brand !== canonical) return false;
    if (ch && r.channel !== ch) return false;
    if (store && r.store !== store) return false;
    return true;
  });
}
