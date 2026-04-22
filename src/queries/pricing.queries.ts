/**
 * queries/pricing.queries.ts
 *
 * Query de precios + costo a nivel SKU Comercial.
 * FUENTE: mv_stock_tienda (reutiliza misma tabla que inventory).
 *   - Retorna UNA fila por sku_comercial (primer valor non-zero encontrado)
 *   - Filtrado opcional por marca canónica ("Martel" | "Wrangler" | "Lee")
 *
 * Sin lógica de negocio — solo fetch + normalización + dedup.
 */
import { dataClient } from "@/api/client";
import { toNum, trimStr, normalizeBrand } from "@/api/normalize";
import { fetchAllRows } from "@/queries/paginate";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

export interface PricingRow {
  sku:          string;   // SKU técnico ERP
  skuComercial: string;   // SKU Comercial — clave de dedup
  description:  string;
  brand:        string;
  linea:        string;
  estComercial: string;   // para isNovelty() en el render
  carryOver:    boolean;
  pvp:          number;   // precio retail
  pvm:          number;   // precio mayorista
  costo:        number;
}

/**
 * Lista de precios deduplicada por SKU Comercial.
 * - Si el mismo sku_comercial aparece en múltiples tiendas/talles,
 *   toma la primera fila con precio > 0 (precios son invariantes por tienda).
 * - Brand filter opcional (null/undefined = todas las marcas).
 */
export async function fetchPrices(brandCanonical?: string | null): Promise<PricingRow[]> {
  const data = await fetchAllRows<Row>(() => {
    let q = dataClient
      .from("mv_stock_tienda")
      .select(
        "sku, sku_comercial, description, brand, lineapr, " +
        "est_comercial, carry_over, price, price_may, cost"
      )
      .gt("units", 0);
    if (brandCanonical) q = q.eq("brand", brandCanonical);
    return q;
  });

  const byKey = new Map<string, PricingRow>();

  for (const r of data) {
    const skuComercial = trimStr(r.sku_comercial);
    const sku          = trimStr(r.sku);
    const key          = skuComercial || sku;
    if (!key) continue;

    const pvp   = toNum(r.price);
    const pvm   = toNum(r.price_may);
    const costo = toNum(r.cost);

    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, {
        sku,
        skuComercial,
        description:  trimStr(r.description) || "Sin descripción",
        brand:        normalizeBrand(r.brand),
        linea:        trimStr(r.lineapr) || "Sin línea",
        estComercial: trimStr(r.est_comercial),
        carryOver:    trimStr(r.carry_over).toUpperCase() === "SI",
        pvp, pvm, costo,
      });
    } else {
      // Upgrade sólo si el existing tiene precios en 0 y el nuevo no.
      if (existing.pvp === 0 && pvp > 0) existing.pvp = pvp;
      if (existing.pvm === 0 && pvm > 0) existing.pvm = pvm;
      if (existing.costo === 0 && costo > 0) existing.costo = costo;
    }
  }

  return Array.from(byKey.values()).sort((a, b) =>
    a.brand.localeCompare(b.brand) || a.skuComercial.localeCompare(b.skuComercial)
  );
}
