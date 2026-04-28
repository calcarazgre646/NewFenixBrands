/**
 * domain/commissions/classify.ts
 *
 * Clasificación de un vendedor en rol de comisión + canal según el canal de venta
 * y el tipo de venta del ERP. Fuente única de verdad — antes vivía duplicada en
 * useCommissions y useSellerProjections.
 */
import type { CommissionRole, CommissionChannel } from "./types";

export interface SellerClassification {
  role: CommissionRole;
  channel: CommissionChannel;
}

/**
 * Clasifica un vendedor en rol + canal a partir del canal de venta y tipo de venta del ERP.
 *
 * - canal "B2B" + tipoVenta "uniforme" → vendedor_utp / utp
 * - canal "B2B" + cualquier otro tipo  → vendedor_mayorista / mayorista
 * - cualquier otro canal               → vendedor_tienda / retail
 */
export function classifySellerRole(canal: string, tipoVenta: string): SellerClassification {
  if (canal === "B2B") {
    if (tipoVenta === "uniforme") return { role: "vendedor_utp", channel: "utp" };
    return { role: "vendedor_mayorista", channel: "mayorista" };
  }
  return { role: "vendedor_tienda", channel: "retail" };
}
