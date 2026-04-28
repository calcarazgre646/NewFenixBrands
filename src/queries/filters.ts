/**
 * queries/filters.ts
 *
 * Funciones de filtrado local para datos WIDE cacheados.
 * Usadas por useSalesDashboard, useExecutiveData, useKpiDashboard.
 */
import type { MonthlySalesRow } from "./sales.queries";
import { brandIdToCanonical } from "@/api/normalize";
import type { B2bSubchannel } from "@/domain/filters/types";

/** UTP/Uniformes — ambas pseudo-sucursales cuentan como UTP a nivel comercial. */
const UTP_STORES = new Set(["UTP", "UNIFORMES"]);

/**
 * Filtra filas de ventas mensuales por brand/channel/store/b2bSub (local, sin API).
 *
 * El sub-filtro B2B sólo aplica cuando channel === "b2b" y b2bSub ≠ "all".
 * Para los demás canales se ignora silenciosamente.
 */
export function filterSalesRows(
  rows: MonthlySalesRow[],
  brand: string,
  channel: string,
  store: string | null,
  b2bSub: B2bSubchannel = "all",
): MonthlySalesRow[] {
  const canonical = brand !== "total" ? brandIdToCanonical(brand) : null;
  const ch = channel !== "total" ? channel.toUpperCase() : null;
  const subActive = ch === "B2B" && b2bSub !== "all";
  return rows.filter((r) => {
    if (canonical && r.brand !== canonical) return false;
    if (ch && r.channel !== ch) return false;
    if (store && r.store !== store) return false;
    if (subActive) {
      const isUtp = UTP_STORES.has(r.store);
      if (b2bSub === "utp" && !isUtp) return false;
      if (b2bSub === "mayorista" && isUtp) return false;
    }
    return true;
  });
}
