/**
 * queries/inventory.queries.ts
 *
 * Queries de inventario.
 *
 * FUENTE: mv_stock_tienda (vista materializada)
 *   Inventario pre-agregado por (store, sku, talle) con dos clasificaciones:
 *     - linea: agrupacion amplia (Camiseria, Vaqueria, Pantalaneria...)
 *     - categoria: tipo especifico (camisa, jean, bermuda, remera...)
 *   ~5K-10K filas vs 54K en fjdexisemp.
 */
import { dataClient } from "@/api/client";
import { toNum, trimStr, normalizeBrand, classifyStore } from "@/api/normalize";
import { fetchAllRows } from "@/queries/paginate";
import type { InventoryRecord } from "@/domain/actionQueue/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

// ─── Tipos de resultado ───────────────────────────────────────────────────────

export interface InventoryItem {
  store:       string;
  storeType:   "b2c" | "b2b" | "excluded";
  sku:         string;
  talle:       string;
  description: string;
  brand:       string;
  linea:       string;   // agrupacion amplia: Camiseria, Vaqueria, etc.
  categoria:   string;   // tipo especifico: camisa, jean, bermuda, etc.
  units:       number;
  price:       number;
  priceMay:    number;
  cost:        number;
  value:       number;
  estComercial: string;
  carryOver:   boolean;
}

export interface InventoryValueSummary {
  totalValue: number;
  totalUnits: number;
  byBrand: Array<{ brand: string; value: number; units: number }>;
}

// ─── Queries ──────────────────────────────────────────────────────────────────

/**
 * Inventario completo desde mv_stock_tienda (vista materializada).
 * Ya viene pre-agregado por (store, sku, talle).
 */
export async function fetchInventory(): Promise<InventoryItem[]> {
  const data = await fetchAllRows(() =>
    dataClient
      .from("mv_stock_tienda")
      .select(
        "store, sku, talle, description, rubro, brand, lineapr, tipo_articulo, " +
        "units, price, price_may, cost, value, est_comercial, carry_over"
      )
      .gt("units", 0)
  );

  const results: InventoryItem[] = [];
  for (const r of data as Row[]) {
    const store = trimStr(r.store);
    results.push({
      store,
      storeType:    classifyStore(store),
      sku:          trimStr(r.sku),
      talle:        trimStr(r.talle),
      description:  trimStr(r.description) || "Sin descripcion",
      brand:        normalizeBrand(r.brand),
      linea:        trimStr(r.lineapr) || "Sin linea",
      categoria:    trimStr(r.tipo_articulo) || "Sin categoria",
      units:        toNum(r.units),
      price:        toNum(r.price),
      priceMay:     toNum(r.price_may),
      cost:         toNum(r.cost),
      value:        toNum(r.value),
      estComercial: trimStr(r.est_comercial),
      carryOver:    trimStr(r.carry_over).toUpperCase() === "SI",
    });
  }

  return results;
}

/**
 * Valor total del inventario (para GMROI y rotacion).
 */
export async function fetchInventoryValue(): Promise<InventoryValueSummary> {
  const data = await fetchAllRows(() =>
    dataClient
      .from("mv_stock_tienda")
      .select("value, units, brand")
      .gt("units", 0)
  );

  let totalValue = 0;
  let totalUnits = 0;
  const byBrand = new Map<string, { value: number; units: number }>();

  for (const r of data) {
    const brand = normalizeBrand(r.brand);
    const val   = toNum(r.value);
    const units = toNum(r.units);
    totalValue += val;
    totalUnits += units;
    const acc = byBrand.get(brand) ?? { value: 0, units: 0 };
    acc.value += val;
    acc.units += units;
    byBrand.set(brand, acc);
  }

  const brandList = Array.from(byBrand.entries())
    .map(([brand, v]) => ({ brand, ...v }))
    .sort((a, b) => b.value - a.value);

  return { totalValue, totalUnits, byBrand: brandList };
}

/**
 * Convierte InventoryItem a InventoryRecord (formato para el algoritmo waterfall).
 */
export function toInventoryRecord(item: InventoryItem): InventoryRecord {
  return {
    sku:          item.sku,
    talle:        item.talle,
    description:  item.description,
    brand:        item.brand,
    store:        item.store,
    storeCluster: null,
    channel:      item.storeType === "b2b" ? "b2b" : "b2c",
    units:        item.units,
    price:        item.price,
    cost:         item.cost,
    linea:        item.linea,
    categoria:    item.categoria,
  };
}
