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
  WaterfallLevel,
  WaterfallInput,
  InventoryRecord,
} from "./types";
import { getStoreCluster, getTimeRestriction, getCoverMonths } from "./clusters";

// ─── Constants ───────────────────────────────────────────────────────────────

const RETAILS_DEPOT = "RETAILS";
const STOCK_DEPOT   = "STOCK";

const LOW_STOCK_RATIO  = 0.40;
const HIGH_STOCK_RATIO = 2.50;
const MIN_STOCK_ABS    = 3;
const MIN_AVG_FOR_RATIO = 5;
const MAX_COUNTERPARTS = 3;
const MAX_ACTIONS      = 100;
const PARETO_TARGET    = 0.80;

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

let _idCounter = 0;
function nextId(): string {
  return `aq-${Date.now()}-${++_idCounter}`;
}

// ─── Types internos ──────────────────────────────────────────────────────────

interface StoreEntry {
  qty:         number;
  descrip:     string;
  brand:       string;
  linea:       string;
  categoria:   string;
  price:       number;
  cost:        number;
}

interface Classified {
  store:  string;
  qty:    number;
  need:   number;
  excess: number;
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
  mode: "b2c" | "b2b",
  brandFilter: string | null,
  lineaFilter: string | null,
  categoriaFilter: string | null,
  storeFilter: string | null,
): ActionItemFull[] {
  const { inventory, salesHistory, bestDayMap } = input;

  // -- 1. Separate rows into operational zones
  const b2cRows:    InventoryRecord[] = [];
  const b2bRows:    InventoryRecord[] = [];
  const retailRows: InventoryRecord[] = [];
  const stockRows:  InventoryRecord[] = [];

  for (const r of inventory) {
    const store = r.store.trim().toUpperCase();
    if (!store) continue;

    if (brandFilter && r.brand.toLowerCase() !== brandFilter.toLowerCase()) continue;
    if (lineaFilter && r.linea.toLowerCase() !== lineaFilter.toLowerCase()) continue;
    if (categoriaFilter && r.categoria.toLowerCase() !== categoriaFilter.toLowerCase()) continue;
    if (storeFilter && store !== storeFilter.toUpperCase()) continue;

    if (store === RETAILS_DEPOT) { retailRows.push(r); continue; }
    if (store === STOCK_DEPOT)   { stockRows.push(r);  continue; }
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
    const ex = sm.get(store);
    if (ex) {
      ex.qty += r.units;
    } else {
      sm.set(store, {
        qty: r.units,
        descrip: r.description,
        brand: r.brand,
        linea: r.linea,
        categoria: r.categoria,
        price,
        cost: r.cost,
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
  for (const r of retailRows)      addToDepotMap(retailMap, r);
  for (const r of stockRows)       addToDepotMap(stockMap, r);

  // -- 3. Generate actions
  const actions: ActionItemFull[] = [];

  for (const [key, storeMap] of skuMap) {
    const [sku, talle] = key.split("|||");
    const stores = [...storeMap.entries()];

    if (mode === "b2c" && stores.length < 1) continue;

    const firstEntry  = stores[0][1];
    const brand       = firstEntry.brand;
    const descrip     = firstEntry.descrip;
    const linea       = firstEntry.linea;
    const categoria   = firstEntry.categoria;
    const price       = Math.max(...stores.map(([, v]) => v.price), 1);
    const cost        = Math.max(...stores.map(([, v]) => v.cost), 0);
    const coverMonths = getCoverMonths(brand);

    const totalQty = stores.reduce((s, [, v]) => s + v.qty, 0);
    const avgQty   = stores.length > 0 ? totalQty / stores.length : 0;
    const depotRetails = retailMap.get(key) ?? 0;
    const depotStock   = stockMap.get(key)  ?? 0;

    // -- Per-store targets using 12m historical average
    const storeData: Classified[] = [];

    for (const [store, vals] of stores) {
      const hKey  = salesHistoryKey(store, sku);
      const hist  = salesHistory.get(hKey);
      const qty   = vals.qty;

      let need   = 0;
      let excess = 0;

      if (hist && hist > 0) {
        const targetStock = hist * coverMonths;
        if (qty < targetStock * 0.5) {
          need = Math.max(Math.ceil(targetStock - qty), MIN_STOCK_ABS);
        } else if (qty > targetStock * 2) {
          excess = Math.floor(qty - targetStock);
        }
      } else {
        if (qty === 0 || qty <= MIN_STOCK_ABS) {
          need = Math.round(Math.max(avgQty - qty, MIN_STOCK_ABS));
        } else if (qty > avgQty * HIGH_STOCK_RATIO && qty > 10) {
          excess = Math.round(qty - avgQty);
        } else if (avgQty >= MIN_AVG_FOR_RATIO && qty < avgQty * LOW_STOCK_RATIO) {
          need = Math.round(avgQty - qty);
        }
      }

      storeData.push({ store, qty, need, excess });
    }

    const deficitStores  = storeData.filter(s => s.need > 0);
    const surplusStores  = storeData.filter(s => s.excess > 0);

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
    ): ActionItemFull => {
      const bestDay = bestDayMap.get(store) ?? "—";
      return {
        id: nextId(),
        rank: 0,
        sku,
        talle,
        description: descrip,
        brand,
        linea,
        categoria,
        store,
        targetStore: counterparts.length > 0 ? counterparts[0].store : undefined,
        currentStock: storeData.find(s => s.store === store)?.qty ?? 0,
        suggestedUnits: suggested,
        historicalAvg: salesHistory.get(salesHistoryKey(store, sku)) ?? 0,
        coverMonths,
        risk,
        waterfallLevel,
        actionType,
        impactScore: calcImpactScore(units, price, cost),
        paretoFlag: false,
        storeCluster: getStoreCluster(store),
        timeRestriction: getTimeRestriction(store),
        bestDay,
        counterpartStores: counterparts,
        recommendedAction: recommended,
      };
    };

    // -- LEVEL 1: store <-> store transfers (deficit side)
    for (const deficit of deficitStores) {
      const risk: RiskLevel = deficit.qty === 0 ? "critical" : "low";

      const counterparts: CounterpartStore[] = surplusStores
        .filter(s => s.store !== deficit.store)
        .map(s => ({ store: s.store, units: Math.min(s.excess, deficit.need) }))
        .filter(c => c.units > 0)
        .slice(0, MAX_COUNTERPARTS);

      if (counterparts.length > 0) {
        const transferUnits = counterparts.reduce((s, c) => s + c.units, 0);
        actions.push(makeItem(
          deficit.store, risk, "transfer", "store_to_store",
          transferUnits, deficit.need, counterparts,
          `Mover desde ${counterparts[0].store} (${counterparts[0].units} u.) — misma zona`,
        ));
        continue;
      }

      // -- LEVEL 2: RETAILS depot -> store
      if (depotRetails > 0) {
        const unitsFromDepot = Math.min(depotRetails, deficit.need);
        if (unitsFromDepot > 0) {
          actions.push(makeItem(
            deficit.store, risk, "restock_from_depot", "depot_to_store",
            unitsFromDepot, deficit.need,
            [{ store: RETAILS_DEPOT, units: unitsFromDepot }],
            `Mover desde deposito RETAILS (${unitsFromDepot} u.)`,
          ));
        }
        continue;
      }

      // -- LEVEL 3: STOCK depot needs to supply RETAILS
      if (depotStock > 0 || depotRetails === 0) {
        const totalNeed = deficitStores.reduce((s, d) => s + d.need, 0);
        const fromStock = depotStock > 0 ? Math.min(depotStock, totalNeed) : totalNeed;

        const alreadyGenerated = actions.some(
          a => a.sku === sku && a.talle === talle && a.waterfallLevel === "central_to_depot",
        );
        if (!alreadyGenerated && fromStock > 0) {
          actions.push(makeItem(
            RETAILS_DEPOT, "critical", "resupply_depot", "central_to_depot",
            fromStock, totalNeed,
            [{ store: STOCK_DEPOT, units: fromStock }],
            `Trasladar desde STOCK → RETAILS (${fromStock} u.) para cubrir ${deficitStores.length} tiendas`,
          ));
        }
      }
    }

    // -- LEVEL 1 (OUT): surplus stores sending out
    for (const surplus of surplusStores) {
      const receivers: CounterpartStore[] = deficitStores
        .filter(d => d.store !== surplus.store)
        .map(d => ({ store: d.store, units: Math.min(Math.round(surplus.excess * 0.4), d.need) }))
        .filter(r => r.units > 0)
        .slice(0, MAX_COUNTERPARTS);

      if (receivers.length === 0) {
        const excess = Math.min(surplus.excess, Math.round(surplus.excess * 0.6));
        if (excess < 3) continue;

        actions.push(makeItem(
          surplus.store, "overstock", "transfer", "store_to_store",
          excess, excess, [],
          "Liquidar excedente. Considerar markdown progresivo.",
        ));
      } else {
        const units = receivers.reduce((s, r) => s + r.units, 0);
        actions.push(makeItem(
          surplus.store, "overstock", "transfer", "store_to_store",
          units, surplus.excess, receivers,
          `Mover a ${receivers[0].store} (${receivers[0].units} u.)`,
        ));
      }
    }

    // -- B2B: direct from STOCK (no RETAILS buffer)
    if (mode === "b2b" && deficitStores.length > 0 && surplusStores.length === 0) {
      for (const deficit of deficitStores) {
        if (deficit.need < 1) continue;
        actions.push(makeItem(
          deficit.store, deficit.qty === 0 ? "critical" : "low",
          "central_to_b2b", "central_to_b2b",
          deficit.need, deficit.need,
          [{ store: STOCK_DEPOT, units: deficit.need }],
          `Reponer desde STOCK central (${deficit.need} u.) directo a ${deficit.store}`,
        ));
      }
    }
  }

  // -- 4. Deterministic sort
  const RISK_PRIORITY: Record<RiskLevel, number> = {
    critical:  0,
    low:       1,
    overstock: 2,
    balanced:  3,
  };

  actions.sort((a, b) => {
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

  // -- 5. Pareto flagging: top items that sum to 80% of total impact
  const totalImpact = actions.reduce((s, a) => s + a.impactScore, 0);
  let cumulative = 0;
  for (const action of actions) {
    cumulative += action.impactScore;
    action.paretoFlag = totalImpact > 0 && cumulative / totalImpact <= PARETO_TARGET;
  }

  // -- 6. Assign ranks and limit
  return actions
    .slice(0, MAX_ACTIONS)
    .map((a, i) => ({ ...a, rank: i + 1 }));
}
