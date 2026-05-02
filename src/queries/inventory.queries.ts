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
import { classifyProductType } from "@/domain/lifecycle/classify";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

// ─── Tipos de resultado ───────────────────────────────────────────────────────

export interface InventoryItem {
  store:       string;
  storeType:   "b2c" | "b2b" | "excluded";
  sku:         string;      // SKU técnico ERP (ej: "7031457")
  skuComercial: string;     // SKU Comercial de Dim_maestro_comercial (ej: "MACA004428")
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
  byStore: Array<{ store: string; value: number; units: number }>;
}

// ─── Queries ──────────────────────────────────────────────────────────────────

/**
 * Inventario completo desde mv_stock_tienda (vista materializada).
 * Ya viene pre-agregado por (store, sku, talle).
 */
export async function fetchInventory(): Promise<InventoryItem[]> {
  // Try with sku_comercial first; fall back without it if column doesn't exist yet
  // (pending sql/002_sku_comercial.sql migration)
  let data: Row[];
  try {
    data = await fetchAllRows(() =>
      dataClient
        .from("mv_stock_tienda")
        .select(
          "store, sku, talle, description, rubro, brand, lineapr, tipo_articulo, " +
          "sku_comercial, units, price, price_may, cost, value, est_comercial, carry_over"
        )
        .gt("units", 0)
    ) as Row[];
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("sku_comercial")) {
      console.warn("[fetchInventory] sku_comercial column not found — run sql/002_sku_comercial.sql");
      data = await fetchAllRows(() =>
        dataClient
          .from("mv_stock_tienda")
          .select(
            "store, sku, talle, description, rubro, brand, lineapr, tipo_articulo, " +
            "units, price, price_may, cost, value, est_comercial, carry_over"
          )
          .gt("units", 0)
      ) as Row[];
    } else {
      throw e;
    }
  }

  const results: InventoryItem[] = [];
  for (const r of data as Row[]) {
    const store = trimStr(r.store);
    results.push({
      store,
      storeType:    classifyStore(store),
      sku:          trimStr(r.sku),
      skuComercial: trimStr(r.sku_comercial),
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
      .select("value, units, brand, store")
      .gt("units", 0)
  );

  let totalValue = 0;
  let totalUnits = 0;
  const byBrand = new Map<string, { value: number; units: number }>();
  const byStore = new Map<string, { value: number; units: number }>();

  for (const r of data) {
    const brand = normalizeBrand(r.brand);
    const store = trimStr(r.store).toUpperCase();
    const val   = toNum(r.value);
    const units = toNum(r.units);
    totalValue += val;
    totalUnits += units;
    const accBrand = byBrand.get(brand) ?? { value: 0, units: 0 };
    accBrand.value += val;
    accBrand.units += units;
    byBrand.set(brand, accBrand);
    if (store) {
      const accStore = byStore.get(store) ?? { value: 0, units: 0 };
      accStore.value += val;
      accStore.units += units;
      byStore.set(store, accStore);
    }
  }

  const brandList = Array.from(byBrand.entries())
    .map(([brand, v]) => ({ brand, ...v }))
    .sort((a, b) => b.value - a.value);

  const storeList = Array.from(byStore.entries())
    .map(([store, v]) => ({ store, ...v }))
    .sort((a, b) => b.value - a.value);

  return { totalValue, totalUnits, byBrand: brandList, byStore: storeList };
}

/**
 * Convierte InventoryItem a InventoryRecord (formato para el algoritmo waterfall).
 */
export function toInventoryRecord(item: InventoryItem): InventoryRecord {
  return {
    sku:          item.sku,
    skuComercial: item.skuComercial,
    talle:        item.talle,
    description:  item.description,
    brand:        item.brand,
    store:        item.store,
    storeCluster: null,
    channel:      item.storeType === "b2b" ? "b2b" : "b2c",
    units:        item.units,
    price:        item.price,
    priceMay:     item.priceMay,
    cost:         item.cost,
    linea:        item.linea,
    categoria:    item.categoria,
    estComercial: item.estComercial,
    carryOver:    item.carryOver,
    productType:  classifyProductType(item.estComercial, item.carryOver),
  };
}
