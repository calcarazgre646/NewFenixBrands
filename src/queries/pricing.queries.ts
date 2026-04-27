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
 * Stores excluidos solo de la vista de Precios (extiende la lista canónica).
 *
 * `EXCLUDED_STORES` (api/normalize.ts) ya cubre ubicaciones de proceso/producción
 * sin precio comercial asignado (FABRICA, LAVADO, LUQ-DEP-OUT, PRODUCTO, MP,
 * ALM-BATAS, etc.).
 *
 * `PASEOLAMB` se excluye SOLO acá (Derlys, sistemas Fenix — 27/04/2026).
 * Es una tienda real (cluster "B" en actionQueue/clusters.ts), por lo que
 * NO se debe agregar a la canónica — saldría de Acciones/KPIs/Depots y
 * rompería otras vistas. En esta tienda los precios se cargan inconsistentes
 * y el cliente nos pidió ocultarla en el reporte de Precios.
 */
const PRICING_ONLY_EXCLUDED = new Set<string>(["PASEOLAMB"]);

/**
 * Causa raíz documentada del ~30% residual de PVM > PVP en tiendas reales
 * tras aplicar todos los filtros (Derlys, 27/04/2026):
 *
 * El ERP da de alta DOS SKUs distintos para representar el mismo producto
 * comercial cuando una parte del lote va a mayoristas y otra a tiendas:
 *   - SKU-A → asignado a tiendas (price = precio retail)
 *   - SKU-B → asignado a mayoristas (price = precio mayorista)
 *
 * Como ambos comparten `sku_comercial`, el dedup `Math.max` de fetchPrices
 * mezcla precios de canales distintos y produce el patrón PVM > PVP.
 *
 * Sin un campo en el ERP que distinga sku-tienda vs sku-mayorista, no es
 * solucionable desde el frontend. Pendiente: que sistemas marque el SKU
 * con un flag de canal (o que separe los precios reales en otra fuente).
 */

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
 * Stores excluidos: unión de `EXCLUDED_STORES` (canónica) + `PRICING_ONLY_EXCLUDED`.
 *
 * Brand filter opcional (null/undefined = todas las marcas).
 */
export async function fetchPrices(brandCanonical?: string | null): Promise<PricingRow[]> {
  const allExcluded = [...EXCLUDED_STORES, ...PRICING_ONLY_EXCLUDED];
  const excludedList = `(${allExcluded.join(",")})`;
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
