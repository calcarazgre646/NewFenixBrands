/**
 * domain/depots/calculations.ts
 *
 * Funciones puras para la vista de Depósitos & Cobertura.
 * Calcula WOI (Weeks of Inventory), clasifica riesgo, y agrega por nodo.
 *
 * REGLA: Sin I/O, sin React, sin Supabase. Solo funciones puras.
 */
import type { InventoryItem } from "@/queries/inventory.queries";
import type { SalesHistoryMap } from "@/queries/salesHistory.queries";
import type {
  DepotRisk,
  GroupBreakdown,
  DepotSkuRow,
  CentralNode,
  StoreNode,
  NetworkTotals,
  SalesWindow,
  DepotData,
  NoveltyDistributionStatus,
  NoveltySkuSummary,
  NoveltyData,
} from "./types";
import { getCalendarMonth, getCalendarYear, MONTH_SHORT } from "@/domain/period/helpers";
import { getStoreCluster } from "@/domain/actionQueue/clusters";

// ─── Constantes ──────────────────────────────────────────────────────────────

const WEEKS_PER_MONTH = 4.33;
const CRITICAL_WEEKS = 4;
const LOW_WEEKS = 8;
const HIGH_WEEKS = 16;
const HISTORY_MONTHS = 6;
const TOP_SKU_LIMIT = 15;

/** Depósitos centrales (no son tiendas retail) */
const STOCK_KEY = "STOCK";
const RETAILS_KEY = "RETAILS";

/** Tiendas excluidas del análisis de red retail */
const EXCLUDED_STORES = new Set([
  "STOCK", "RETAILS",
  "ALM-BATAS", "FABRICA", "LAMBARE", "LAVADO", "LUQ-DEP-OUT",
  "MP", "E-COMMERCE", "PRODUCTO", "SHOPSANLO",
  "M-AGUSTIN", "M-EDGAR", "M-EMILIO", "M-GAMARRA", "M-JUAN", "M-SALABERRY", "M-SILVIO",
  "MAYORISTA", "UTP", "UNIFORMES",
]);

// ─── Helpers puros ───────────────────────────────────────────────────────────

/** Semanas de cobertura: stock / demanda semanal. Null si sin ventas. */
export function computeWOI(units: number, avgMonthlySales: number): number | null {
  if (avgMonthlySales <= 0) return null;
  const weeklySales = avgMonthlySales / WEEKS_PER_MONTH;
  if (weeklySales <= 0) return null;
  return units / weeklySales;
}

/** Ventas semanales desde promedio mensual */
export function monthlyToWeekly(monthly: number): number {
  return monthly / WEEKS_PER_MONTH;
}

/** Clasifica riesgo por semanas de cobertura */
export function classifyDepotRisk(weeksOnHand: number | null): DepotRisk {
  if (weeksOnHand === null) return "sin_venta";
  if (weeksOnHand < CRITICAL_WEEKS) return "critico";
  if (weeksOnHand < LOW_WEEKS) return "bajo";
  if (weeksOnHand > HIGH_WEEKS) return "alto";
  return "saludable";
}

/** Agrega items por un campo string, devuelve top N por valor descendente.
 *  Calcula WOI del grupo usando demanda de salesHistory para el storeKey dado. */
function aggregateByField(
  items: InventoryItem[],
  field: "brand" | "categoria",
  salesHistory?: SalesHistoryMap,
  storeKey?: string,
): GroupBreakdown[] {
  const map = new Map<string, { units: number; value: number; monthlyDemand: number }>();
  for (const item of items) {
    const label = item[field];
    const acc = map.get(label) ?? { units: 0, value: 0, monthlyDemand: 0 };
    acc.units += item.units;
    acc.value += item.value;
    if (salesHistory && storeKey) {
      acc.monthlyDemand += salesHistory.get(`${storeKey}|${item.sku}`) ?? 0;
    }
    map.set(label, acc);
  }
  return Array.from(map.entries())
    .map(([label, v]) => ({
      label,
      units: v.units,
      value: v.value,
      woi: computeWOI(v.units, v.monthlyDemand),
    }))
    .sort((a, b) => b.value - a.value);
}

/**
 * Agrega items de un nodo central por campo, con WOI basado en demanda de RED.
 * Para STOCK/RETAILS: WOI por marca = unidades de esa marca en el nodo / demanda semanal
 * de esa marca en TODAS las tiendas dependientes.
 */
function aggregateByFieldCentral(
  nodeItems: InventoryItem[],
  field: "brand" | "categoria",
  dependentItems: InventoryItem[],
  salesHistory: SalesHistoryMap,
): GroupBreakdown[] {
  // Unidades y valor del nodo por grupo
  const nodeMap = new Map<string, { units: number; value: number }>();
  for (const item of nodeItems) {
    const label = item[field];
    const acc = nodeMap.get(label) ?? { units: 0, value: 0 };
    acc.units += item.units;
    acc.value += item.value;
    nodeMap.set(label, acc);
  }

  // Demanda mensual de la red por grupo (sum de todas las tiendas)
  const demandMap = new Map<string, number>();
  for (const item of dependentItems) {
    const label = item[field];
    const store = item.store?.trim().toUpperCase() ?? "";
    const histKey = `${store}|${item.sku}`;
    const avg = salesHistory.get(histKey) ?? 0;
    demandMap.set(label, (demandMap.get(label) ?? 0) + avg);
  }

  return Array.from(nodeMap.entries())
    .map(([label, v]) => {
      const monthlyDemand = demandMap.get(label) ?? 0;
      return {
        label,
        units: v.units,
        value: v.value,
        woi: computeWOI(v.units, monthlyDemand),
      };
    })
    .sort((a, b) => b.value - a.value);
}

/** Construye filas de SKU con WOI para un nodo */
function buildSkuRows(
  items: InventoryItem[],
  salesHistory: SalesHistoryMap,
  storeKey: string,
): DepotSkuRow[] {
  return items.map((item) => {
    const histKey = `${storeKey}|${item.sku}`;
    const avgMonthlySales = salesHistory.get(histKey) ?? 0;
    const weeklySales = monthlyToWeekly(avgMonthlySales);
    const weeksOnHand = computeWOI(item.units, avgMonthlySales);

    return {
      store:           storeKey,
      sku:             item.sku,
      skuComercial:    item.skuComercial,
      talle:           item.talle,
      description:     item.description,
      brand:           item.brand,
      categoria:       item.categoria,
      estado:          item.estComercial,
      carryOver:       item.carryOver,
      isNovelty:       item.estComercial === NOVELTY_STATUS,
      units:           item.units,
      value:           item.value,
      avgMonthlySales: Math.round(avgMonthlySales),
      weeklySales:     Math.round(weeklySales),
      weeksOnHand,
    };
  }).sort((a, b) => b.value - a.value);
}

/** Calcula demanda mensual total para un conjunto de tiendas */
function computeNetworkDemand(
  storeKeys: string[],
  salesHistory: SalesHistoryMap,
): number {
  // Sumar todas las ventas promedio de SKUs que pertenecen a las tiendas de la red
  const storeSet = new Set(storeKeys);
  let total = 0;
  salesHistory.forEach((avg, key) => {
    const store = key.split("|")[0];
    if (storeSet.has(store)) {
      total += avg;
    }
  });
  return total;
}

/** Construye la ventana de ventas (últimos 6 meses) */
function buildSalesWindow(): SalesWindow {
  const calYear = getCalendarYear();
  const calMonth = getCalendarMonth();

  const periodLabels: string[] = [];
  for (let i = HISTORY_MONTHS - 1; i >= 0; i--) {
    let m = calMonth - i;
    let y = calYear;
    if (m <= 0) { m += 12; y -= 1; }
    periodLabels.push(`${y}-${String(m).padStart(2, "0")}`);
  }

  return {
    latestLabel: `${MONTH_SHORT[calMonth]} ${calYear}`,
    periodLabels,
  };
}

/** Umbral de cobertura para considerar un producto "cargado en tiendas" */
const NOVELTY_COVERAGE_THRESHOLD = 0.80;
const NOVELTY_STATUS = "lanzamiento";

/** Es una tienda dependiente de RETAILS (B2C activa) */
export function isDependentStore(storeCode: string): boolean {
  return !EXCLUDED_STORES.has(storeCode.toUpperCase());
}

/** Clasifica el estado de distribución de un producto de lanzamiento */
export function classifyNoveltyDistribution(
  storeCount: number,
  totalStores: number,
): NoveltyDistributionStatus {
  if (storeCount === 0) return "en_deposito";
  if (totalStores > 0 && storeCount / totalStores >= NOVELTY_COVERAGE_THRESHOLD) return "cargado";
  return "en_distribucion";
}

/** Construye datos de novedades a partir del inventario completo */
export function buildNoveltyData(
  inventory: InventoryItem[],
  dependentStoreCount: number,
): NoveltyData {
  // Filtrar solo lanzamientos
  const noveltyItems = inventory.filter(i => i.estComercial === NOVELTY_STATUS);

  if (noveltyItems.length === 0) {
    return {
      totalSkus: 0, totalUnits: 0, totalValue: 0,
      byStatus: { en_deposito: 0, en_distribucion: 0, cargado: 0 },
      skus: [],
    };
  }

  // Agrupar por SKU (sin talle — distribución es a nivel producto)
  const skuMap = new Map<string, {
    skuComercial: string; description: string; brand: string; categoria: string;
    totalUnits: number; totalValue: number;
    stockUnits: number; retailsUnits: number;
    dependentStores: Set<string>;
  }>();

  for (const item of noveltyItems) {
    const key = item.sku;
    const acc = skuMap.get(key) ?? {
      skuComercial: item.skuComercial, description: item.description,
      brand: item.brand, categoria: item.categoria,
      totalUnits: 0, totalValue: 0,
      stockUnits: 0, retailsUnits: 0,
      dependentStores: new Set<string>(),
    };

    acc.totalUnits += item.units;
    acc.totalValue += item.value;

    const store = item.store.toUpperCase();
    if (store === "STOCK") {
      acc.stockUnits += item.units;
    } else if (store === "RETAILS") {
      acc.retailsUnits += item.units;
    } else if (isDependentStore(store)) {
      acc.dependentStores.add(store);
    }

    skuMap.set(key, acc);
  }

  // Construir resúmenes por SKU
  let totalUnits = 0;
  let totalValue = 0;
  const byStatus: Record<NoveltyDistributionStatus, number> = {
    en_deposito: 0, en_distribucion: 0, cargado: 0,
  };

  const skus: NoveltySkuSummary[] = [];
  for (const [sku, data] of skuMap) {
    const storeCount = data.dependentStores.size;
    const coveragePct = dependentStoreCount > 0
      ? Math.round(storeCount / dependentStoreCount * 100)
      : 0;
    const status = classifyNoveltyDistribution(storeCount, dependentStoreCount);

    totalUnits += data.totalUnits;
    totalValue += data.totalValue;
    byStatus[status]++;

    skus.push({
      sku,
      skuComercial: data.skuComercial,
      description: data.description,
      brand: data.brand,
      categoria: data.categoria,
      totalUnits: data.totalUnits,
      totalValue: data.totalValue,
      stockUnits: data.stockUnits,
      retailsUnits: data.retailsUnits,
      storeCount,
      totalDependentStores: dependentStoreCount,
      coveragePct,
      distributionStatus: status,
    });
  }

  // Ordenar: menos distribuidos primero (en_deposito → en_distribucion → cargado), luego por units desc
  const statusOrder: Record<NoveltyDistributionStatus, number> = {
    en_deposito: 0, en_distribucion: 1, cargado: 2,
  };
  skus.sort((a, b) => {
    const so = statusOrder[a.distributionStatus] - statusOrder[b.distributionStatus];
    if (so !== 0) return so;
    return b.totalUnits - a.totalUnits;
  });

  return { totalSkus: skuMap.size, totalUnits, totalValue, byStatus, skus };
}

// ─── Función principal ───────────────────────────────────────────────────────

/**
 * Construye los datos completos de la vista Depósitos & Cobertura.
 *
 * @param inventory    Inventario completo de mv_stock_tienda
 * @param salesHistory Promedio mensual 6m por "store|sku"
 * @returns            DepotData listo para renderizar
 */
export function buildDepotData(
  inventory: InventoryItem[],
  salesHistory: SalesHistoryMap,
): DepotData {
  // ── 1. Separar inventario por nodo ─────────────────────────────────────────
  const stockItems: InventoryItem[] = [];
  const retailsItems: InventoryItem[] = [];
  const storeMap = new Map<string, InventoryItem[]>();

  for (const item of inventory) {
    const store = item.store.toUpperCase();
    if (store === STOCK_KEY) {
      stockItems.push(item);
    } else if (store === RETAILS_KEY) {
      retailsItems.push(item);
    } else if (isDependentStore(store)) {
      const list = storeMap.get(item.store) ?? [];
      list.push(item);
      storeMap.set(item.store, list);
    }
  }

  // Incluir tiendas con 0 inventario pero con ventas históricas
  const storeKeysFromHistory = new Set<string>();
  salesHistory.forEach((_, key) => {
    const store = key.split("|")[0];
    if (isDependentStore(store) && !storeMap.has(store)) {
      storeKeysFromHistory.add(store);
    }
  });
  for (const store of storeKeysFromHistory) {
    storeMap.set(store, []);
  }

  const dependentStoreKeys = Array.from(storeMap.keys());
  const scopeCandidates = [...dependentStoreKeys].sort();

  // ── 2. Demanda de red (solo tiendas dependientes) ─────────────────────────
  const networkMonthlyDemand = computeNetworkDemand(dependentStoreKeys, salesHistory);
  const networkWeeklyDemand = monthlyToWeekly(networkMonthlyDemand);

  // Items de todas las tiendas dependientes (para calcular demanda de red por marca/categoría)
  const allDependentItems: InventoryItem[] = [];
  for (const items of storeMap.values()) allDependentItems.push(...items);

  // ── 3. Construir nodos centrales ──────────────────────────────────────────
  const stockUnits = stockItems.reduce((s, i) => s + i.units, 0);
  const stockValue = stockItems.reduce((s, i) => s + i.value, 0);
  const stockWOI = networkWeeklyDemand > 0 ? stockUnits / networkWeeklyDemand : 0;

  const retailsUnits = retailsItems.reduce((s, i) => s + i.units, 0);
  const retailsValue = retailsItems.reduce((s, i) => s + i.value, 0);
  const retailsWOI = networkWeeklyDemand > 0 ? retailsUnits / networkWeeklyDemand : 0;

  // Unique SKU/talle combinations
  const stockSkuCount = new Set(stockItems.map(i => `${i.sku}|${i.talle}`)).size;
  const retailsSkuCount = new Set(retailsItems.map(i => `${i.sku}|${i.talle}`)).size;

  const stock: CentralNode = {
    key: STOCK_KEY,
    label: "STOCK",
    subtitle: "Cobertura aguas arriba contra toda la red retail dependiente",
    type: "central",
    units: stockUnits,
    value: stockValue,
    monthlyDemand: networkMonthlyDemand,
    weeklyDemand: networkWeeklyDemand,
    weeksOnHand: Math.round(stockWOI * 10) / 10,
    risk: classifyDepotRisk(stockWOI),
    skuCount: stockSkuCount,
    topBrands: aggregateByFieldCentral(stockItems, "brand", allDependentItems, salesHistory),
    topCategories: aggregateByFieldCentral(stockItems, "categoria", allDependentItems, salesHistory),
    topSkuRows: buildSkuRows(stockItems, salesHistory, STOCK_KEY).slice(0, TOP_SKU_LIMIT),
  };

  const retails: CentralNode = {
    key: RETAILS_KEY,
    label: "RETAILS",
    subtitle: "Cobertura del depósito operativo que abastece a la red retail",
    type: "central",
    units: retailsUnits,
    value: retailsValue,
    monthlyDemand: networkMonthlyDemand,
    weeklyDemand: networkWeeklyDemand,
    weeksOnHand: Math.round(retailsWOI * 10) / 10,
    risk: classifyDepotRisk(retailsWOI),
    skuCount: retailsSkuCount,
    topBrands: aggregateByFieldCentral(retailsItems, "brand", allDependentItems, salesHistory),
    topCategories: aggregateByFieldCentral(retailsItems, "categoria", allDependentItems, salesHistory),
    topSkuRows: buildSkuRows(retailsItems, salesHistory, RETAILS_KEY).slice(0, TOP_SKU_LIMIT),
  };

  // ── 4. Construir nodos de tiendas ─────────────────────────────────────────
  let criticalCount = 0;
  let totalNetworkUnits = 0;
  let totalNetworkValue = 0;

  const stores: StoreNode[] = dependentStoreKeys.map((storeKey) => {
    const items = storeMap.get(storeKey) ?? [];
    const units = items.reduce((s, i) => s + i.units, 0);
    const value = items.reduce((s, i) => s + i.value, 0);

    // Demanda de esta tienda específica
    let storeMonthlyDemand = 0;
    salesHistory.forEach((avg, key) => {
      if (key.startsWith(`${storeKey}|`)) {
        storeMonthlyDemand += avg;
      }
    });
    const storeWeeklyDemand = monthlyToWeekly(storeMonthlyDemand);
    const woi = storeWeeklyDemand > 0 ? units / storeWeeklyDemand : 0;
    const risk = storeMonthlyDemand > 0 ? classifyDepotRisk(woi) : "sin_venta";

    if (risk === "critico") criticalCount++;
    totalNetworkUnits += units;
    totalNetworkValue += value;

    const skuCount = new Set(items.map(i => `${i.sku}|${i.talle}`)).size;

    return {
      key: storeKey,
      label: storeKey,
      type: "store" as const,
      cluster: getStoreCluster(storeKey),
      units,
      value,
      monthlyDemand: Math.round(storeMonthlyDemand * 100) / 100,
      weeklyDemand: Math.round(storeWeeklyDemand * 100) / 100,
      weeksOnHand: Math.round(woi * 10) / 10,
      risk,
      skuCount,
      topBrands: aggregateByField(items, "brand", salesHistory, storeKey),
      topCategories: aggregateByField(items, "categoria", salesHistory, storeKey),
      skuRows: buildSkuRows(items, salesHistory, storeKey),
    };
  });

  // Ordenar tiendas: por cluster (A→B→OUT→sin cluster), luego WOI ascendente
  const clusterOrder: Record<string, number> = { A: 0, B: 1, OUT: 2 };
  stores.sort((a, b) => {
    const ca = a.cluster ? (clusterOrder[a.cluster] ?? 3) : 3;
    const cb = b.cluster ? (clusterOrder[b.cluster] ?? 3) : 3;
    if (ca !== cb) return ca - cb;
    return a.weeksOnHand - b.weeksOnHand;
  });

  // ── 5. Top SKU consolidado (todos los nodos) ─────────────────────────────
  const allSkuRows = [
    ...stock.topSkuRows,
    ...retails.topSkuRows,
    ...stores.flatMap(s => s.skuRows.slice(0, 5)),
  ].sort((a, b) => b.value - a.value).slice(0, 30);

  // ── 6. Totales ────────────────────────────────────────────────────────────
  const totals: NetworkTotals = {
    dependentStoreCount: dependentStoreKeys.length,
    networkUnits: totalNetworkUnits + stockUnits + retailsUnits,
    networkValue: totalNetworkValue + stockValue + retailsValue,
    networkMonthlyDemand: Math.round(networkMonthlyDemand * 100) / 100,
    networkWeeklyDemand: Math.round(networkWeeklyDemand * 100) / 100,
    criticalStoreCount: criticalCount,
  };

  // ── 7. Novedades / Lanzamientos ──────────────────────────────────────────
  const novelty = buildNoveltyData(inventory, dependentStoreKeys.length);

  return {
    salesWindow: buildSalesWindow(),
    scopeCandidates,
    stock,
    retails,
    stores,
    topSkuRows: allSkuRows,
    totals,
    novelty,
  };
}
