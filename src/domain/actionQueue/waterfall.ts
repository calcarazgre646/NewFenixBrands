/**
 * domain/actionQueue/waterfall.ts
 *
 * Algoritmo waterfall puro para la Cola de Acciones.
 * Ported from old FenixBrands actionQueueService.ts with clean architecture.
 *
 * Waterfall priority:
 *   N1: Tienda ↔ Tienda (rebalanceo lateral)
 *   N2: RETAILS depot → Tienda
 *   N3: STOCK central → RETAILS depot
 *   N4: STOCK central → B2B directo
 *
 * No React, no side effects — pure functions only.
 */
import type {
  ActionItem,
  ActionType,
  RiskLevel,
  StoreCluster,
  WaterfallLevel,
  WaterfallInput,
  InventoryRecord,
  ComputeActionQueueOptions,
} from "./types";
import type { ProductType, LifecycleAction } from "@/domain/lifecycle/types";
import { lookupSth } from "@/domain/lifecycle/sth";
import { evaluateLinealidad } from "@/domain/lifecycle/linealidad";
import { analyzeSequentially } from "@/domain/lifecycle/sequentialDecision";
import type { SequentialDecision } from "@/domain/lifecycle/sequentialDecision";
import { buildSizeCurveForSku } from "@/domain/lifecycle/sizeCurve";
import type { SizeCurveAnalysis } from "@/domain/lifecycle/sizeCurve";
import { rankTransferCandidates, isTransferAllowed, nextClusterCascade } from "@/domain/lifecycle/clusterRouting";
import { getStoreCluster, getTimeRestriction, getStoreAssortment, STORE_CLUSTERS, STORE_TIME_RESTRICTIONS } from "./clusters";
import { DEFAULT_WATERFALL_CONFIG, WEEKS_PER_MONTH } from "@/domain/config/defaults";

// ─── Constants ───────────────────────────────────────────────────────────────

const RETAILS_DEPOT = "RETAILS";
const STOCK_DEPOT   = "STOCK";

/** Map LifecycleAction → ActionType for the unified type system */
const LIFECYCLE_TO_ACTION_TYPE: Record<LifecycleAction, ActionType> = {
  revisar_exhibicion: "revisar_exhibicion",
  revisar_asignacion: "revisar_asignacion",
  accion_comercial: "accion_comercial",
  markdown_selectivo: "markdown_selectivo",
  transferencia_out: "transferencia_out_lifecycle",
  markdown_liquidacion: "markdown_liquidacion",
};


/**
 * Minimum impact score for an action to be included.
 * Actions below this threshold are noise — moving 1-3 units of cheap SKUs.
 * Gs. 500,000 ≈ $70 USD. Filters out ~60-80% of trivial actions.
 */
export const MIN_IMPACT_THRESHOLD = 500_000;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function grossMarginFactor(price: number, cost: number): number {
  if (price <= 0) return 1;
  const gm = (price - cost) / price;
  return 1 + Math.max(0, gm) * 0.3;
}

function calcImpactScore(units: number, price: number, cost: number): number {
  return units * Math.max(price, 1) * grossMarginFactor(price, cost);
}

function salesHistoryKey(store: string, sku: string): string {
  return `${store}|${sku}`;
}

/** Two-level DOI-edad lookup: exact (store+sku+talle) → fallback (store+sku, min talle) → 0 */
export function lookupDoiAge(
  doiAge: WaterfallInput["doiAge"],
  store: string,
  sku: string,
  talle: string,
): number {
  if (!doiAge) return 0;
  const s = store.toUpperCase();
  return doiAge.exact.get(`${s}|${sku}|${talle}`)
      ?? doiAge.byStoreSku.get(`${s}|${sku}`)
      ?? 0;
}

let _idCounter = 0;
function resetIdCounter(): void {
  _idCounter = 0;
}
function nextId(): string {
  return `aq-${Date.now()}-${++_idCounter}`;
}

// ─── Pre-computation helpers ────────────────────────────────────────────────

/** Build size curves once per SKU (not per sku+talle) */
function precomputeSizeCurves(records: InventoryRecord[]): Map<string, SizeCurveAnalysis | null> {
  const bySkuMap = new Map<string, InventoryRecord[]>();
  for (const r of records) {
    const list = bySkuMap.get(r.sku) ?? [];
    list.push(r);
    bySkuMap.set(r.sku, list);
  }
  const result = new Map<string, SizeCurveAnalysis | null>();
  for (const [sku, recs] of bySkuMap) {
    result.set(sku, buildSizeCurveForSku(recs));
  }
  return result;
}

/** Compute average STH per SKU across all stores */
function precomputeNetworkAvgSth(
  sthData: WaterfallInput["sthData"],
): Map<string, number> {
  const result = new Map<string, number>();
  if (!sthData) return result;
  // byStoreSku keys: "STORE|SKU" → { sth: 0-1, cohortAgeDays }
  const skuSums = new Map<string, { total: number; count: number }>();
  for (const [key, record] of sthData.byStoreSku) {
    const parts = key.split("|");
    if (parts.length < 2) continue;
    const sku = parts[1];
    const entry = skuSums.get(sku) ?? { total: 0, count: 0 };
    entry.total += record.sth * 100; // convert to 0-100
    entry.count++;
    skuSums.set(sku, entry);
  }
  for (const [sku, { total, count }] of skuSums) {
    result.set(sku, total / count);
  }
  return result;
}

/** Find the best-performing RETAIL store for each SKU (by avg sales/month).
 *  Excludes depots and B2B stores — only considers stores with a valid cluster. */
function precomputeBestPerformerBySku(
  salesHistory: Map<string, number>,
  storeClusters: Record<string, StoreCluster>,
): Map<string, { store: string; avgSales: number }> {
  const retailStores = new Set(Object.keys(storeClusters));
  const result = new Map<string, { store: string; avgSales: number }>();
  for (const [key, avgSales] of salesHistory) {
    const parts = key.split("|");
    if (parts.length < 2) continue;
    const store = parts[0];
    // Only consider retail stores (A/B/OUT) — exclude MAYORISTA, UTP, depots
    if (!retailStores.has(store)) continue;
    const sku = parts[1];
    const current = result.get(sku);
    if (!current || avgSales > current.avgSales) {
      result.set(sku, { store, avgSales });
    }
  }
  return result;
}

/** Compute average STH per store across all SKUs (Rodrigo: "promedio de la tienda") */
function precomputeStoreAvgSth(
  sthData: WaterfallInput["sthData"],
): Map<string, number> {
  const result = new Map<string, number>();
  if (!sthData) return result;
  const storeSums = new Map<string, { total: number; count: number }>();
  for (const [key, record] of sthData.byStoreSku) {
    const store = key.split("|")[0];
    if (!store) continue;
    const entry = storeSums.get(store) ?? { total: 0, count: 0 };
    entry.total += record.sth * 100; // convert to 0-100
    entry.count++;
    storeSums.set(store, entry);
  }
  for (const [store, { total, count }] of storeSums) {
    result.set(store, total / count);
  }
  return result;
}

// ─── Types internos ──────────────────────────────────────────────────────────

interface StoreEntry {
  qty:           number;
  descrip:       string;
  brand:         string;
  skuComercial:  string;
  linea:         string;
  categoria:     string;
  price:         number;
  priceMay:      number;
  cost:          number;
  productType:   ProductType;
}

interface Classified {
  store:  string;
  qty:    number;
  need:   number;
  excess: number;
  isLifecycleSurplus: boolean;
}

export interface CounterpartStore {
  store: string;
  units: number;
}

export interface ActionItemFull extends ActionItem {
  rank:               number;
  counterpartStores:  CounterpartStore[];
  recommendedAction:  string;
  linea:              string;
  categoria:          string;
}

// ─── Core Algorithm ──────────────────────────────────────────────────────────

export function computeActionQueue(
  input: WaterfallInput,
  options: ComputeActionQueueOptions,
): ActionItemFull[] {
  const {
    mode,
    brandFilter = null,
    lineaFilter = null,
    categoriaFilter = null,
    storeFilter = null,
    impactThreshold = MIN_IMPACT_THRESHOLD,
    storeClusters = STORE_CLUSTERS,
    storeTimeRestrictions = STORE_TIME_RESTRICTIONS,
    waterfallConfig = DEFAULT_WATERFALL_CONFIG,
  } = options;
  resetIdCounter();
  const { inventory, salesHistory, doiAge, sthData } = input;
  const {
    lowStockRatio, highStockRatio, minStockAbs, minAvgForRatio,
    minTransferUnits, paretoTarget, surplusLiquidateRatio,
    b2cStoreCoverWeeks, importedBrands, coverWeeksImported, coverWeeksNational,
  } = waterfallConfig;

  // -- 1. Separate rows into operational zones
  const b2cRows:    InventoryRecord[] = [];
  const b2bRows:    InventoryRecord[] = [];
  const retailRows: InventoryRecord[] = [];
  const stockRows:  InventoryRecord[] = [];

  for (const r of inventory) {
    const store = r.store.trim().toUpperCase();
    if (!store) continue;
    // Guard: skip rows with NaN/undefined units (corrupt ERP data)
    if (!Number.isFinite(r.units)) continue;

    // Depot stores must always pass — they provide context for N2/N3 regardless of filters
    if (store === RETAILS_DEPOT) { retailRows.push(r); continue; }
    if (store === STOCK_DEPOT)   { stockRows.push(r);  continue; }

    if (brandFilter && r.brand.toLowerCase() !== brandFilter.toLowerCase()) continue;
    if (lineaFilter && r.linea.toLowerCase() !== lineaFilter.toLowerCase()) continue;
    if (categoriaFilter && r.categoria.toLowerCase() !== categoriaFilter.toLowerCase()) continue;
    if (storeFilter && store !== storeFilter.toUpperCase()) continue;
    if (r.channel === "b2b")     { b2bRows.push(r);    continue; }
    b2cRows.push(r);
  }

  const operationalRows = mode === "b2b" ? b2bRows : b2cRows;

  // -- 2. Group by (sku, talle) across operational + depot stores
  const skuMap    = new Map<string, Map<string, StoreEntry>>();
  const retailMap = new Map<string, number>();
  const stockMap  = new Map<string, number>();

  const addToSkuMap = (r: InventoryRecord) => {
    const sku   = r.sku.trim();
    const talle = r.talle.trim() || "S/T";
    const store = r.store.trim().toUpperCase();
    if (!sku || !store) return;

    const key = `${sku}|||${talle}`;
    if (!skuMap.has(key)) skuMap.set(key, new Map());
    const sm = skuMap.get(key)!;
    const price = r.price > 0 ? r.price : r.cost * 2;
    const priceMay = r.priceMay > 0 ? r.priceMay : price;
    const ex = sm.get(store);
    if (ex) {
      ex.qty += r.units;
    } else {
      sm.set(store, {
        qty: r.units,
        descrip: r.description,
        brand: r.brand,
        skuComercial: r.skuComercial,
        linea: r.linea,
        categoria: r.categoria,
        price,
        priceMay,
        cost: r.cost,
        productType: r.productType,
      });
    }
  };

  const addToDepotMap = (target: Map<string, number>, r: InventoryRecord) => {
    const sku   = r.sku.trim();
    const talle = r.talle.trim() || "S/T";
    if (!sku) return;
    const key = `${sku}|||${talle}`;
    target.set(key, (target.get(key) ?? 0) + r.units);
  };

  for (const r of operationalRows) addToSkuMap(r);
  // RETAILS depot solo aplica a B2C (es depósito de tiendas retail, no mayorista)
  if (mode === "b2c") {
    for (const r of retailRows) addToDepotMap(retailMap, r);
  }
  for (const r of stockRows)       addToDepotMap(stockMap, r);

  // -- 2b. Pre-compute network data for sequential analysis
  const sizeCurveMap = precomputeSizeCurves(operationalRows);
  const networkAvgSthMap = precomputeNetworkAvgSth(sthData);
  const storeAvgSthMap = precomputeStoreAvgSth(sthData);
  const bestPerformerMap = precomputeBestPerformerBySku(salesHistory, storeClusters);
  // Pre-compute cohort age by SKU for O(1) fallback lookup (avoids O(n*m) scan)
  const skuCohortAge = new Map<string, number>();
  if (sthData) {
    for (const [key, rec] of sthData.byStoreSku) {
      const sku = key.split("|")[1];
      if (sku && rec.cohortAgeDays > 0 && !skuCohortAge.has(sku)) {
        skuCohortAge.set(sku, rec.cohortAgeDays);
      }
    }
  }

  // -- 2b2. Pre-compute total stock per store (for capacity checks)
  const storeStockTotals = new Map<string, number>();
  for (const r of operationalRows) {
    const store = r.store.trim().toUpperCase();
    if (!store || store === RETAILS_DEPOT || store === STOCK_DEPOT) continue;
    storeStockTotals.set(store, (storeStockTotals.get(store) ?? 0) + r.units);
  }

  // -- 2c. Lifecycle pre-evaluation per (sku, store) — BEFORE talle loop
  // Evaluates analyzeSequentially ONCE per unique (sku, store) pair.
  // Decisions drive the talle loop: excluded stores don't get restocked,
  // lifecycle surplus doesn't enter the N1 redistribution pool.
  const lifecycleDecisions = new Map<string, SequentialDecision>();
  const lifecycleExcluded = new Set<string>();    // "STORE|sku" → don't restock
  const lifecycleSurplusSet = new Set<string>();  // "STORE|sku" → surplus goes to OUT only

  {
    // Build unique (sku, store) contexts + total qty per (sku, store) for WOI fallback
    const skuStoreCtx = new Map<string, { store: string; sku: string; storeCluster: StoreCluster | null; productType: ProductType }>();
    const skuStoreQty = new Map<string, number>();
    for (const r of operationalRows) {
      const store = r.store.trim().toUpperCase();
      const sku = r.sku.trim();
      if (!store || !sku || store === RETAILS_DEPOT || store === STOCK_DEPOT) continue;
      if (r.channel !== mode) continue;
      const key = `${store}|${sku}`;
      if (!skuStoreCtx.has(key)) {
        skuStoreCtx.set(key, { store, sku, storeCluster: getStoreCluster(store, storeClusters), productType: r.productType });
      }
      skuStoreQty.set(key, (skuStoreQty.get(key) ?? 0) + r.units);
    }

    for (const [key, ctx] of skuStoreCtx) {
      const sthRecord = sthData?.byStoreSku.get(key) ?? null;
      // Priority: (1) cohort age from this store, (2) cohort age from ANY store for this SKU,
      // (3) DOI age (last movement — less accurate but better than nothing)
      let ageDays = sthRecord?.cohortAgeDays ?? 0;
      if (ageDays <= 0) {
        // Cohort age is network-level — use pre-computed O(1) lookup
        ageDays = skuCohortAge.get(ctx.sku) ?? 0;
      }
      if (ageDays <= 0) ageDays = doiAge?.byStoreSku.get(key) ?? 0;

      // Fallback: if no age data but product has extreme WOI, estimate age from coverage
      if (ageDays <= 0) {
        const hist = salesHistory.get(salesHistoryKey(ctx.store, ctx.sku)) ?? 0;
        if (hist > 0) {
          const totalQtyForSku = skuStoreQty.get(key) ?? 0;
          if (totalQtyForSku > 0) {
            const woi = (totalQtyForSku / hist) * WEEKS_PER_MONTH;
            if (woi > b2cStoreCoverWeeks * 4) {
              ageDays = Math.round(woi * 7);
            }
          }
        }
      }
      if (ageDays <= 0) continue;

      const sth = sthRecord ? sthRecord.sth * 100 : 0;
      const decision = analyzeSequentially(
        {
          store: ctx.store, storeCluster: ctx.storeCluster, productType: ctx.productType,
          storeSth: sthRecord ? sth : null,
          networkAvgSth: networkAvgSthMap.get(ctx.sku) ?? null,
          storeAvgSth: storeAvgSthMap.get(ctx.store) ?? null,
          ageDays,
          bestPerformerStore: bestPerformerMap.get(ctx.sku)?.store ?? null,
          currentStoreSales: salesHistory.get(salesHistoryKey(ctx.store, ctx.sku)) ?? 0,
          bestPerformerSales: bestPerformerMap.get(ctx.sku)?.avgSales ?? 0,
        },
        sizeCurveMap.get(ctx.sku) ?? null,
      );

      lifecycleDecisions.set(key, decision);

      switch (decision.outcome) {
        case "move_to_best_performer":
        case "transfer_cascade":
          lifecycleExcluded.add(key);
          lifecycleSurplusSet.add(key);
          break;
        case "markdown":
          lifecycleExcluded.add(key);
          if (decision.lifecycleAction === "transferencia_out") lifecycleSurplusSet.add(key);
          break;
        case "maintain_until_sold":
          lifecycleExcluded.add(key);
          break;
      }
    }
  }

  // -- 3. Generate actions
  const actions: ActionItemFull[] = [];
  const lifecycleActionsEmitted = new Set<string>();
  const importedSet = new Set(importedBrands.map(b => b.toLowerCase()));

  for (const [key, storeMap] of skuMap) {
    const [sku, talle] = key.split("|||");
    const stores = [...storeMap.entries()];

    if (stores.length < 1) continue;

    const firstEntry  = stores[0][1];
    const brand        = firstEntry.brand;
    const skuComercial = firstEntry.skuComercial;
    const descrip      = firstEntry.descrip;
    const linea        = firstEntry.linea;
    const categoria    = firstEntry.categoria;
    const productType  = firstEntry.productType;
    const price       = Math.max(...stores.map(([, v]) => v.price), 1);
    const priceMay    = Math.max(...stores.map(([, v]) => v.priceMay), 1);
    const cost        = Math.max(...stores.map(([, v]) => v.cost), 0);
    // B2B uses wholesale price for impact — retail price inflates B2B priority artificially
    const effectivePrice = mode === "b2b" ? priceMay : price;
    const brandCoverWeeks = importedSet.has(brand.toLowerCase()) ? coverWeeksImported : coverWeeksNational;
    // B2C stores: configurable weeks target (default 13, Rodrigo 17/03/2026)
    // B2B stores: brand-based coverage (national/imported from config)
    const storeCoverWeeks = mode === "b2c" ? b2cStoreCoverWeeks : brandCoverWeeks;
    const storeCoverMonths = storeCoverWeeks / 4.33;

    const totalQty = stores.reduce((s, [, v]) => s + v.qty, 0);
    const avgQty   = stores.length > 0 ? totalQty / stores.length : 0;
    const depotRetails = retailMap.get(key) ?? 0;
    const depotStock   = stockMap.get(key)  ?? 0;

    // -- Per-store targets using 6m historical average (spec cliente)
    // B2C: Target stock = avg_monthly_sales × storeCoverMonths (3 semanas)
    // MOS (Months of Stock) = current_stock / avg_monthly_sales
    const storeData: Classified[] = [];
    const sizeCurve = sizeCurveMap.get(sku) ?? null;

    for (const [store, vals] of stores) {
      const hKey  = salesHistoryKey(store, sku);
      const hist  = salesHistory.get(hKey);
      const qty   = vals.qty;

      let need   = 0;
      let excess = 0;

      if (hist && hist > 0) {
        const targetStock = hist * storeCoverMonths;
        if (qty < targetStock * 0.5) {
          need = Math.max(Math.ceil(targetStock - qty), minStockAbs);
        } else if (qty > targetStock * 2) {
          excess = Math.floor(qty - targetStock);
        }
      } else {
        if (qty === 0 || qty <= minStockAbs) {
          need = Math.round(Math.max(avgQty - qty, minStockAbs));
        } else if (qty > avgQty * highStockRatio && qty > 10) {
          excess = Math.round(qty - avgQty);
        } else if (avgQty >= minAvgForRatio && qty < avgQty * lowStockRatio) {
          need = Math.round(avgQty - qty);
        }
      }

      // ── Consult pre-computed lifecycle decision (per sku×store) ──
      const lcKey = `${store}|${sku}`;
      const decision = lifecycleDecisions.get(lcKey);
      let isLifecycleSurplus = false;

      if (decision) {
        switch (decision.outcome) {
          case "reposition_sizes":
            if (need > 0) need = 0;
            break;
          case "consolidate_here":
            excess = 0;
            break;
          case "move_to_best_performer":
          case "transfer_cascade":
            if (need > 0) need = 0;
            if (qty > 0) excess = qty;
            isLifecycleSurplus = true;
            break;
          case "maintain_until_sold":
            if (need > 0) need = 0;
            excess = 0;
            break;
          case "markdown":
            if (need > 0) need = 0;
            if (decision.lifecycleAction === "transferencia_out" && qty > 0) {
              excess = qty;
              isLifecycleSurplus = true;
            }
            break;
          // "no_action": keep need/excess as computed
        }
      }

      storeData.push({ store, qty, need, excess, isLifecycleSurplus });
    }

    // Sort deficit stores: exclude lifecycle-excluded and at-capacity stores
    const deficitStores  = storeData.filter(s => {
      if (s.need <= 0) return false;
      if (lifecycleExcluded.has(`${s.store}|${sku}`)) return false;
      // Capacity check: don't restock stores already at or over capacity
      const assortment = getStoreAssortment(s.store) ?? 0;
      if (assortment > 0) {
        const totalStock = storeStockTotals.get(s.store) ?? 0;
        if (totalStock >= assortment) return false;
      }
      return true;
    }).sort((a, b) => {
        if (a.qty === 0 && b.qty !== 0) return -1;
        if (a.qty !== 0 && b.qty === 0) return 1;
        return b.need - a.need;
      });
    // Surplus: EXCLUDE lifecycle surplus from N1 pool (goes to OUT only via lifecycle actions)
    const surplusStores  = storeData.filter(s => s.excess > 0 && !s.isLifecycleSurplus)
      .sort((a, b) => b.excess - a.excess);

    // Helper to create action item
    const makeItem = (
      store: string,
      risk: RiskLevel,
      actionType: ActionType,
      waterfallLevel: WaterfallLevel,
      units: number,
      suggested: number,
      counterparts: CounterpartStore[],
      recommended: string,
      idealUnitsParam: number = 0,
    ): ActionItemFull => {
      const isDepot = store === RETAILS_DEPOT || store === STOCK_DEPOT;
      const currentStock = isDepot
        ? (store === RETAILS_DEPOT ? depotRetails : depotStock)
        : (storeData.find(s => s.store === store)?.qty ?? 0);

      // Para depósitos: demanda = suma de avg mensual de todas las tiendas que abastece
      // Para tiendas: demanda = avg mensual de esa tienda
      let histAvg: number;
      if (isDepot) {
        let totalDemand = 0;
        for (const sd of storeData) {
          totalDemand += salesHistory.get(salesHistoryKey(sd.store, sku)) ?? 0;
        }
        histAvg = totalDemand;
      } else {
        histAvg = salesHistory.get(salesHistoryKey(store, sku)) ?? 0;
      }
      const currentMOS = histAvg > 0 ? currentStock / histAvg : 0;
      // DOI-edad: días desde último movimiento de stock a esta ubicación.
      // Fuente: mv_doi_edad (movimientos_st_jde).
      // Lookup: exact (store+sku+talle) → fallback store+sku (any talle) → 0
      const daysOfInventory = lookupDoiAge(doiAge, store, sku, talle);
      // STH cohort data: sell-through rate + cohort age (optional, from mv_sth_cohort)
      const sthLookup = lookupSth(sthData, store, sku, talle);
      const gapUnits = Math.max(0, idealUnitsParam - suggested);
      // Evaluate linealidad for this action's store (enriches movements with lifecycle context)
      const itemSth = sthLookup ? sthLookup.sth * 100 : 0;
      const itemAge = sthLookup?.cohortAgeDays ?? daysOfInventory;
      const itemLinealidad = itemAge > 0
        ? evaluateLinealidad(productType, itemAge, itemSth)
        : undefined;

      return {
        id: nextId(),
        rank: 0,
        sku,
        skuComercial,
        talle,
        description: descrip,
        brand,
        linea,
        categoria,
        store,
        targetStore: counterparts.length > 0 ? counterparts[0].store : undefined,
        currentStock,
        suggestedUnits: suggested,
        idealUnits: idealUnitsParam,
        gapUnits,
        daysOfInventory,
        historicalAvg: histAvg,
        coverWeeks: isDepot ? brandCoverWeeks : storeCoverWeeks,
        currentMOS,
        risk,
        waterfallLevel,
        actionType,
        impactScore: calcImpactScore(units, effectivePrice, cost),
        paretoFlag: false,
        storeCluster: getStoreCluster(store, storeClusters),
        timeRestriction: getTimeRestriction(store, storeTimeRestrictions),
        counterpartStores: counterparts,
        recommendedAction: recommended,
        productType,
        category: "movement",
        responsibleRoles: itemLinealidad?.isBelowThreshold ? itemLinealidad.responsibleRoles : [],
        lifecycleEvaluation: itemLinealidad,
        lifecycleAction: itemLinealidad?.isBelowThreshold ? itemLinealidad.action ?? undefined : undefined,
        sth: sthLookup ? sthLookup.sth * 100 : undefined,
        cohortAgeDays: sthLookup ? sthLookup.cohortAgeDays : undefined,
      };
    };

    // -- Generate lifecycle actions from pre-computed decisions (one per sku×store)
    for (const store of stores.map(([s]) => s)) {
      const lcKey = `${store}|${sku}`;
      if (lifecycleActionsEmitted.has(lcKey)) continue;
      const decision = lifecycleDecisions.get(lcKey);
      if (!decision || decision.outcome === "no_action" || decision.outcome === "maintain_until_sold") continue;

      lifecycleActionsEmitted.add(lcKey);
      const storeQty = storeData.find(s => s.store === store)?.qty ?? 0;
      const lifecycleImpact = calcImpactScore(storeQty > 0 ? storeQty : 1, effectivePrice, cost);

      let actionType: ActionType;
      let risk: RiskLevel;
      let recommended: string;

      switch (decision.outcome) {
        case "reposition_sizes": {
          actionType = "reposicion_tallas";
          risk = "low";
          const talleDetails: string[] = [];
          let totalRepos = 0;
          for (const t of decision.sourcableSizes) {
            const sources = sizeCurve?.gapSources.get(t)?.get(store);
            if (sources && sources.length > 0) {
              const src = sources[0];
              const srcStore = sizeCurve?.stores.find(s => s.store === src);
              const available = srcStore?.sizes.find(s => s.talle === t)?.units ?? 0;
              const toMove = Math.max(1, available);
              totalRepos += toMove;
              talleDetails.push(`${t} (${toMove}u) ← ${src}`);
            } else {
              talleDetails.push(`${t} (sin stock)`);
            }
          }
          recommended = `Completar curva (${totalRepos}u): ${talleDetails.join(" | ")}`;
          break;
        }
        case "consolidate_here": {
          actionType = "consolidar_curva";
          risk = "balanced";
          const consTalleDetails: string[] = [];
          let totalToMove = 0;
          for (const t of decision.sourcableSizes) {
            const sources = sizeCurve?.gapSources.get(t)?.get(store);
            if (sources && sources.length > 0) {
              const src = sources[0];
              const srcStore = sizeCurve?.stores.find(s => s.store === src);
              const available = srcStore?.sizes.find(s => s.talle === t)?.units ?? 0;
              const toMove = Math.min(available, Math.max(1, available)); // all available (at least 1)
              totalToMove += toMove;
              consTalleDetails.push(`${t} (${toMove}u) ← ${src}`);
            } else {
              consTalleDetails.push(`${t} (sin stock en red)`);
            }
          }
          recommended = consTalleDetails.length > 0
            ? `Traer ${totalToMove}u: ${consTalleDetails.join(" | ")} (cobertura ${decision.curveCoveragePct.toFixed(0)}%)`
            : `Consolidar tallas aquí — cobertura ${decision.curveCoveragePct.toFixed(0)}%`;
          break;
        }
        case "move_to_best_performer": {
          actionType = "transfer";
          risk = "low";
          const moveTalleDetails: string[] = [];
          for (const t of decision.sourcableSizes) {
            moveTalleDetails.push(t);
          }
          const talleInfo = moveTalleDetails.length > 0 ? ` (faltan: ${moveTalleDetails.join(", ")})` : "";
          recommended = decision.suggestedDestination
            ? `Mover a ${decision.suggestedDestination}${talleInfo} — ${decision.reason}`
            : decision.reason;
          break;
        }
        case "transfer_cascade": {
          // Determine destination cluster via cascade: A→B, B→OUT
          const sourceCluster = getStoreCluster(store, storeClusters);
          const destCluster = sourceCluster ? nextClusterCascade(sourceCluster) : "OUT";
          actionType = destCluster === "OUT" ? "transferencia_out_lifecycle" : "transferencia_lifecycle";
          risk = destCluster === "OUT" ? "critical" : "low";
          // Find best destination store in cluster: prefer most capacity headroom
          const destStores = Object.entries(storeClusters)
            .filter(([, c]) => c === destCluster)
            .map(([s]) => ({
              store: s,
              headroom: (getStoreAssortment(s) ?? Infinity) - (storeStockTotals.get(s) ?? 0),
            }))
            .filter(s => s.store !== store) // don't cascade to self
            .sort((a, b) => b.headroom - a.headroom); // most headroom first
          const cascadeDest = destStores.length > 0 ? destStores[0].store : null;
          if (cascadeDest) {
            recommended = `Transferir ${storeQty}u a ${cascadeDest} (cluster ${destCluster}) — ${decision.reason}`;
            // Track inflow to cascade destination for capacity-aware routing
            storeStockTotals.set(cascadeDest, (storeStockTotals.get(cascadeDest) ?? 0) + storeQty);
          } else {
            recommended = decision.reason;
          }
          break;
        }
        case "markdown":
          if (decision.lifecycleAction) {
            actionType = LIFECYCLE_TO_ACTION_TYPE[decision.lifecycleAction];
          } else {
            actionType = "markdown_selectivo";
          }
          risk = decision.lifecycleAction === "markdown_liquidacion" || decision.lifecycleAction === "transferencia_out"
            ? "critical" : "low";
          recommended = decision.reason;
          break;
        default:
          continue;
      }

      if (risk === "critical" || lifecycleImpact >= impactThreshold) {
        actions.push({
          ...makeItem(
            store, risk, actionType, "store_to_store",
            storeQty > 0 ? storeQty : 1, 0, [], recommended,
          ),
          category: "lifecycle",
          responsibleRoles: decision.responsibleRoles,
          lifecycleAction: decision.lifecycleAction ?? undefined,
          sequentialOutcome: decision.outcome,
          sizeCurveCoverage: decision.curveCoveragePct,
          sourcableSizes: decision.sourcableSizes.length > 0 ? decision.sourcableSizes : undefined,
          presentSizes: sizeCurve ? (sizeCurve.stores.find(s => s.store === store)?.presentTalles ? [...sizeCurve.stores.find(s => s.store === store)!.presentTalles] : undefined) : undefined,
          networkSizes: sizeCurve?.networkTalles,
          sizeUnits: sizeCurve ? (() => {
            const storeData = sizeCurve.stores.find(s => s.store === store);
            if (!storeData) return undefined;
            const units: Record<string, number> = {};
            for (const t of sizeCurve.networkTalles) {
              const found = storeData.sizes.find(s => s.talle === t);
              units[t] = found?.units ?? 0;
            }
            return units;
          })() : undefined,
        });
      }
    }

    // -- Mutable resource tracking: each unit assigned exactly once
    const surplusPool = new Map<string, number>();
    for (const s of surplusStores) surplusPool.set(s.store, s.excess);
    let remainingDepot = depotRetails;
    let unmetDeficit = 0;
    // Track deficit-side allocations so surplus side can create mirror "send" actions
    const surplusAllocations = new Map<string, CounterpartStore[]>();

    // -- LEVEL 1 + 2: Deficit stores seek supply (cascade with resource tracking)
    for (const deficit of deficitStores) {
      const risk: RiskLevel = deficit.qty === 0 ? "critical" : "low";

      // N1: Try lateral transfers from surplus stores (greedy, consuming pool)
      // Cluster-aware: rank surplus stores by compatibility with deficit store's cluster
      const deficitCluster = getStoreCluster(deficit.store, storeClusters);
      const rankedSurplus = rankTransferCandidates(
        deficitCluster,
        surplusStores.map(s => ({
          store: s.store,
          cluster: getStoreCluster(s.store, storeClusters),
          availableUnits: surplusPool.get(s.store) ?? 0,
        })),
      );
      const counterparts: CounterpartStore[] = [];
      let toFill = deficit.need;

      for (const candidate of rankedSurplus) {
        if (toFill <= 0) break;
        if (candidate.store === deficit.store) continue;
        // Block reverse flow: OUT stores should not send stock back to A/B
        if (!isTransferAllowed(candidate.cluster, deficitCluster)) continue;
        const avail = surplusPool.get(candidate.store) ?? 0;
        if (avail <= 0) continue;
        const take = Math.min(avail, toFill);
        // Skip tiny transfers — not worth the logistics unless it's the last units needed
        if (take < minTransferUnits && toFill > take) continue;
        counterparts.push({ store: candidate.store, units: take });
        toFill -= take;
        surplusPool.set(candidate.store, avail - take);
        // Record for surplus-side mirror actions
        const existing = surplusAllocations.get(candidate.store) ?? [];
        existing.push({ store: deficit.store, units: take });
        surplusAllocations.set(candidate.store, existing);
      }

      if (counterparts.length > 0) {
        const transferUnits = counterparts.reduce((s, c) => s + c.units, 0);
        actions.push(makeItem(
          deficit.store, risk, "transfer", "store_to_store",
          transferUnits, transferUnits, counterparts,
          `Mover desde ${counterparts[0].store} (${counterparts[0].units} u.)`,
          deficit.need,
        ));
        // Track cumulative inflow for capacity check
        storeStockTotals.set(deficit.store, (storeStockTotals.get(deficit.store) ?? 0) + transferUnits);
        // N1 partially filled — cascade remainder to N2 (RETAILS depot)
        if (toFill > 0 && remainingDepot > 0) {
          const fromDepot = Math.min(remainingDepot, toFill);
          remainingDepot -= fromDepot;
          actions.push(makeItem(
            deficit.store, risk, "restock_from_depot", "depot_to_store",
            fromDepot, fromDepot,
            [{ store: RETAILS_DEPOT, units: fromDepot }],
            `Mover desde deposito RETAILS (${fromDepot} u.)`,
            toFill, // idealUnits = lo que quedaba pendiente post-N1
          ));
          storeStockTotals.set(deficit.store, (storeStockTotals.get(deficit.store) ?? 0) + fromDepot);
          toFill -= fromDepot;
        }
        if (toFill > 0) unmetDeficit += toFill;
        continue;
      }

      // N2: RETAILS depot -> store (consuming shared depot pool)
      if (remainingDepot > 0) {
        const fromDepot = Math.min(remainingDepot, deficit.need);
        remainingDepot -= fromDepot;
        actions.push(makeItem(
          deficit.store, risk, "restock_from_depot", "depot_to_store",
          fromDepot, fromDepot,
          [{ store: RETAILS_DEPOT, units: fromDepot }],
          `Mover desde deposito RETAILS (${fromDepot} u.)`,
          deficit.need,
        ));
        storeStockTotals.set(deficit.store, (storeStockTotals.get(deficit.store) ?? 0) + fromDepot);
        const unfilled = deficit.need - fromDepot;
        if (unfilled > 0) unmetDeficit += unfilled;
        continue;
      }

      // Neither N1 nor N2 could help — accumulate for N3
      unmetDeficit += deficit.need;
    }

    // -- LEVEL 3: STOCK central → RETAILS (one action per SKU, only unmet deficit)
    // Solo aplica a B2C — en B2B el flujo es directo STOCK → B2B (N4)
    if (mode === "b2c" && unmetDeficit > 0 && depotStock > 0) {
      const fromStock = Math.min(depotStock, unmetDeficit);
      const item = makeItem(
        RETAILS_DEPOT, "critical", "resupply_depot", "central_to_depot",
        fromStock, fromStock,
        [{ store: STOCK_DEPOT, units: fromStock }],
        `Trasladar desde STOCK → RETAILS (${fromStock} u.) para cubrir ${deficitStores.length} tiendas`,
        unmetDeficit,
      );
      actions.push(item);
    }

    // -- SURPLUS: redistribution + liquidation (using tracked allocations)
    for (const surplus of surplusStores) {
      const sentTo = surplusAllocations.get(surplus.store) ?? [];
      const remaining = surplusPool.get(surplus.store) ?? 0;

      // Mirror action: what this surplus store sent to deficit stores in N1
      if (sentTo.length > 0) {
        const totalSent = sentTo.reduce((s, c) => s + c.units, 0);
        actions.push(makeItem(
          surplus.store, "overstock", "transfer", "store_to_store",
          totalSent, totalSent, sentTo,
          `Mover a ${sentTo[0].store} (${sentTo[0].units} u.)`,
        ));
      }

      // Liquidation for remaining unsent excess
      if (remaining >= 3) {
        const liquidate = Math.min(remaining, Math.round(remaining * surplusLiquidateRatio));
        if (liquidate >= 3) {
          actions.push(makeItem(
            surplus.store, "overstock", "transfer", "store_to_store",
            liquidate, liquidate, [],
            "Liquidar excedente. Considerar markdown progresivo.",
          ));
        }
      }
    }

    // -- B2B: direct from STOCK (no RETAILS buffer) — with pool tracking
    // When STOCK has inventory, cap allocations so total doesn't exceed available.
    // When STOCK has 0 (or no data), still generate recommendations uncapped.
    if (mode === "b2b" && deficitStores.length > 0 && surplusStores.length === 0) {
      let remainingStock = depotStock > 0 ? depotStock : Infinity;
      for (const deficit of deficitStores) {
        if (deficit.need < 1) continue;
        const units = Math.min(deficit.need, remainingStock);
        if (units < 1) continue;
        if (remainingStock !== Infinity) remainingStock -= units;
        actions.push(makeItem(
          deficit.store, deficit.qty === 0 ? "critical" : "low",
          "central_to_b2b", "central_to_b2b",
          units, units,
          [{ store: STOCK_DEPOT, units }],
          `Reponer desde STOCK central (${units} u.) directo a ${deficit.store}`,
          deficit.need,
        ));
      }
    }
  }

  // -- 4. Filter out noise: actions below minimum impact threshold.
  //    Critical risk actions are always kept regardless of impact (safety net).
  if (typeof window !== "undefined" && import.meta.env.DEV) {
    const movements = actions.filter(a => a.category === "movement").length;
    const lifecycle = actions.filter(a => a.category === "lifecycle").length;
    console.info(
      `[waterfall-lifecycle] pre-filter: ${actions.length} total (${movements} movements, ${lifecycle} lifecycle). STH data: ${sthData ? "YES" : "NO"}, DOI data: ${doiAge ? "YES" : "NO"}`,
    );
  }
  const filtered = actions.filter(
    a => a.risk === "critical" || a.impactScore >= impactThreshold,
  );

  // -- 5. Deterministic sort
  const RISK_PRIORITY: Record<RiskLevel, number> = {
    critical:  0,
    low:       1,
    overstock: 2,
    balanced:  3,
  };

  filtered.sort((a, b) => {
    const rp = RISK_PRIORITY[a.risk] - RISK_PRIORITY[b.risk];
    if (rp !== 0) return rp;
    const ud = b.suggestedUnits - a.suggestedUnits;
    if (ud !== 0) return ud;
    const id = b.impactScore - a.impactScore;
    if (id !== 0) return id;
    if (a.sku   !== b.sku)   return a.sku   < b.sku   ? -1 : 1;
    if (a.talle !== b.talle) return a.talle < b.talle ? -1 : 1;
    return a.store < b.store ? -1 : 1;
  });

  // -- 6. Pareto flagging: top items BY IMPACT that sum to 80% of total impact.
  //    The Pareto 20/80 principle: flag the HIGHEST-IMPACT items whose cumulative
  //    impact accounts for 80% of the total. This is independent of risk sort order.
  const totalImpact = filtered.reduce((s, a) => s + a.impactScore, 0);
  if (totalImpact > 0) {
    // Sort a COPY by impact descending to identify the top items
    const byImpact = [...filtered].sort((a, b) => b.impactScore - a.impactScore);
    const paretoIds = new Set<string>();
    let cumulative = 0;
    for (const action of byImpact) {
      if (cumulative / totalImpact >= paretoTarget) break;
      cumulative += action.impactScore;
      paretoIds.add(action.id);
    }
    // Map flags back to the risk-sorted original
    for (const action of filtered) {
      action.paretoFlag = paretoIds.has(action.id);
    }
  }

  // -- 7. Assign ranks (no artificial limit — show all actionable items)
  return filtered.map((a, i) => ({ ...a, rank: i + 1 }));
}
