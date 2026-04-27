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
import { toNum, trimStr, normalizeBrand, EXCLUDED_STORES } from "@/api/normalize";
import { fetchAllRows } from "@/queries/paginate";
import { NOVELTY_STATUS } from "@/domain/depots/calculations";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

export interface PricingRow {
  sku:          string;   // SKU técnico ERP
  skuComercial: string;   // SKU Comercial — clave de dedup
  description:  string;
  brand:        string;
  linea:        string;
  estComercial: string;   // para isNovelty() en el render
  pvp:          number;   // precio retail
  pvm:          number;   // precio mayorista
  costo:        number;
}

/**
 * Lista de precios deduplicada por SKU Comercial.
 *
 * Reglas de dedup (un SKU comercial aparece en N tiendas × N talles):
 *   - Precios y costo: max observado. Precios son invariantes por SKU; el ERP
 *     a veces inserta filas con placeholders (price=1, price_may=1) que NO deben
 *     ganar sobre filas con el precio real.
 *   - estComercial: gana "lanzamiento" si aparece en ALGUNA fila. El ERP usa
 *     hasta 10 valores distintos por SKU (uniformes/outlet/muestras/lanzamiento/...);
 *     un primer-fila-gana sería no-determinístico para el badge Novedad.
 *
 * Filtro de stores (Derlys, sistemas Fenix — 27/04/2026): excluir filas de
 * ubicaciones de proceso/producción (FABRICA, LAVADO, LUQ-DEP-OUT, PRODUCTO,
 * MP, ALM-BATAS, etc.) donde aún no se asignó el precio comercial. En esas
 * filas `price` y `price_may` quedan en estados intermedios que rompen la
 * lógica PVP > PVM. Reutiliza la constante canónica `EXCLUDED_STORES`.
 *
 * Brand filter opcional (null/undefined = todas las marcas).
 */
export async function fetchPrices(brandCanonical?: string | null): Promise<PricingRow[]> {
  const excludedList = `(${[...EXCLUDED_STORES].join(",")})`;
  const data = await fetchAllRows<Row>(() => {
    let q = dataClient
      .from("mv_stock_tienda")
      .select(
        "sku, sku_comercial, description, brand, lineapr, " +
        "est_comercial, price, price_may, cost"
      )
      .gt("units", 0)
      .not("store", "in", excludedList);
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
    const est   = trimStr(r.est_comercial);

    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, {
        sku,
        skuComercial,
        description:  trimStr(r.description) || "Sin descripción",
        brand:        normalizeBrand(r.brand),
        linea:        trimStr(r.lineapr) || "Sin línea",
        estComercial: est,
        pvp, pvm, costo,
      });
    } else {
      if (pvp > existing.pvp) existing.pvp = pvp;
      if (pvm > existing.pvm) existing.pvm = pvm;
      if (costo > existing.costo) existing.costo = costo;
      // "lanzamiento" (NOVELTY_STATUS) en cualquier fila marca el SKU como novedad.
      if (est === NOVELTY_STATUS) existing.estComercial = NOVELTY_STATUS;
    }
  }

  return Array.from(byKey.values()).sort((a, b) =>
    a.brand.localeCompare(b.brand) || a.skuComercial.localeCompare(b.skuComercial)
  );
}
