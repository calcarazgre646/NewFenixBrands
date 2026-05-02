/**
 * queries/sellThrough.queries.ts
 *
 * Sell-Through 30/60/90 días red-wide para el KPI Dashboard.
 *
 * FUENTE: v_sth_cohort (vista materializada)
 *   STH = units_sold / units_received por (sku, talle, store).
 *   Edad = CURRENT_DATE - first_entry_network (no se resetea por transferencias).
 *
 * Diferencia con sth.queries.ts:
 *   - fetchSthCohort: lookup exacto + fallback (motor lifecycle/waterfall).
 *   - fetchSthBySku:  agregado red-wide por SKU técnico (vista exploratoria SkusCard).
 *   - fetchSellThroughByWindow: agregado red-wide para una ventana de cohortes,
 *     usado por la KPI card "Sell-through 30/60/90".
 *
 * v_sth_cohort no tiene `brand`. El filtro por marca se aplica en JS cruzando
 * contra un mapping `sku → brand` que el caller resuelve desde mv_stock_tienda.
 */
import { dataClient } from "@/api/client";
import { fetchAllRows } from "@/queries/paginate";
import { trimStr, toNum, normalizeBrand } from "@/api/normalize";

const EXCLUDED_STORES = [
  "STOCK", "RETAILS", "FABRICA", "PRODUCTO", "LAVADO", "SERVICIOS",
  "ALMTEJIDOS", "ALMACENBATAS", "LUQ-DEP-OUT",
];

export interface SellThroughWindow {
  /** Días de la ventana de cohorte: 30, 60 o 90 */
  windowDays: 30 | 60 | 90;
  unitsReceived: number;
  unitsSold: number;
  /** Sell-through en escala 0-100 (clampeado). 0 si no hubo entradas. */
  sthPct: number;
}

export interface SellThroughResult {
  windows: SellThroughWindow[];
  /** Cantidad de SKUs únicos con cohorte en la ventana 90d (denominador útil para UI). */
  skus90d: number;
}

/**
 * Trae cohortes con cohort_age_days <= 90 desde v_sth_cohort y agrega red-wide
 * por SKU para 3 ventanas (30/60/90). Excluye stores no-retail.
 *
 * Filtro opcional por tienda en BD (cuando viene store específico) y por marca
 * en JS (cruzando contra skuBrandMap si el caller lo pasa).
 *
 * @param storeCode  cosujd de la tienda (filters.store). null/undefined → red-wide.
 * @param skuBrandMap  Mapping sku → brand canónico para filtrar por marca.
 *                     Si no se pasa o brand=null, no filtra.
 * @param brandCanonical  Marca canónica ('Martel', 'Wrangler', 'Lee', etc.) o null.
 */
export async function fetchSellThroughByWindow(
  storeCode?: string | null,
  skuBrandMap?: Map<string, string> | null,
  brandCanonical?: string | null,
): Promise<SellThroughResult> {
  const buildQuery = () => {
    let q = dataClient
      .from("v_sth_cohort")
      .select("sku, store, units_received, units_sold, cohort_age_days")
      .not("store", "in", `(${EXCLUDED_STORES.join(",")})`)
      .lte("cohort_age_days", 90);
    if (storeCode) {
      q = q.eq("store", storeCode.trim().toUpperCase());
    }
    return q;
  };

  const data = await fetchAllRows(buildQuery);

  let r30 = 0, s30 = 0;
  let r60 = 0, s60 = 0;
  let r90 = 0, s90 = 0;
  const skusIn90 = new Set<string>();

  const filterByBrand = brandCanonical && skuBrandMap;

  for (const r of data) {
    const sku = trimStr(r.sku);
    if (!sku) continue;

    if (filterByBrand) {
      const skuBrand = skuBrandMap.get(sku);
      if (!skuBrand || skuBrand !== brandCanonical) continue;
    }

    const age = toNum(r.cohort_age_days);
    const received = toNum(r.units_received);
    const sold = toNum(r.units_sold);

    if (age <= 90) {
      r90 += received;
      s90 += sold;
      skusIn90.add(sku);
    }
    if (age <= 60) {
      r60 += received;
      s60 += sold;
    }
    if (age <= 30) {
      r30 += received;
      s30 += sold;
    }
  }

  return {
    windows: [
      { windowDays: 30, unitsReceived: r30, unitsSold: s30, sthPct: pct(s30, r30) },
      { windowDays: 60, unitsReceived: r60, unitsSold: s60, sthPct: pct(s60, r60) },
      { windowDays: 90, unitsReceived: r90, unitsSold: s90, sthPct: pct(s90, r90) },
    ],
    skus90d: skusIn90.size,
  };
}

/**
 * Mapping `sku → brand canónico` desde mv_stock_tienda. Usado para filtrar
 * sell-through (y otros agregados sin brand) por marca en JS. Una sola fila por
 * SKU (la primera ganadora; brand es estable para un SKU dado).
 */
export async function fetchSkuBrandMap(): Promise<Map<string, string>> {
  const data = await fetchAllRows(() =>
    dataClient.from("mv_stock_tienda").select("sku, brand").gt("units", 0),
  );

  const map = new Map<string, string>();
  for (const r of data) {
    const sku = trimStr(r.sku);
    if (!sku || map.has(sku)) continue;
    const brand = normalizeBrand(r.brand);
    if (brand) map.set(sku, brand);
  }
  return map;
}

function pct(num: number, den: number): number {
  if (den <= 0) return 0;
  return Math.min(100, (num / den) * 100);
}
