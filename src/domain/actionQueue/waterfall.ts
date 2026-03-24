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
import { getStoreCluster, getTimeRestriction, getCoverWeeks } from "./clusters";

// ─── Constants ───────────────────────────────────────────────────────────────

const RETAILS_DEPOT = "RETAILS";
const STOCK_DEPOT   = "STOCK";

const LOW_STOCK_RATIO      = 0.40;
const HIGH_STOCK_RATIO     = 2.50;
const MIN_STOCK_ABS        = 3;
const MIN_AVG_FOR_RATIO    = 5;
const MIN_TRANSFER_UNITS   = 2;   // Minimum units per source — avoids "move 1 unit from X" noise
const PARETO_TARGET        = 0.80;
const SURPLUS_LIQUIDATE_RATIO = 0.60;

/**
 * WOI objetivo para tiendas B2C: 13 semanas.
 * Actualizado por Rodrigo (17/03/2026) — antes era 3 semanas.
 *
 * El coverWeeks por marca (12/24 de getCoverWeeks) sigue usándose para:
 *   - Cálculo de cobertura de depósitos (RETAILS/STOCK abastan múltiples tiendas)
 *   - Cálculo de cobertura de tiendas B2B (12w nacional, 24w importado)
 */
const B2C_STORE_COVER_WEEKS = 13;

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

let _idCounter = 0;
function resetIdCounter(): void {
  _idCounter = 0;
}
function nextId(): string {
  return `aq-${Date.now()}-${++_idCounter}`;
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
  impactThreshold: number = MIN_IMPACT_THRESHOLD,
): ActionItemFull[] {
  resetIdCounter();
  const { inventory, salesHistory } = input;

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

  // -- 3. Generate actions
  const actions: ActionItemFull[] = [];

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
    const price       = Math.max(...stores.map(([, v]) => v.price), 1);
    const priceMay    = Math.max(...stores.map(([, v]) => v.priceMay), 1);
    const cost        = Math.max(...stores.map(([, v]) => v.cost), 0);
    // B2B uses wholesale price for impact — retail price inflates B2B priority artificially
    const effectivePrice = mode === "b2b" ? priceMay : price;
    const brandCoverWeeks = getCoverWeeks(brand);
    // B2C stores: 13 weeks target (Rodrigo 17/03/2026)
    // B2B stores: brand-based coverage (12w national, 24w imported)
    const storeCoverWeeks = mode === "b2c" ? B2C_STORE_COVER_WEEKS : brandCoverWeeks;
    const storeCoverMonths = storeCoverWeeks / 4.33;

    const totalQty = stores.reduce((s, [, v]) => s + v.qty, 0);
    const avgQty   = stores.length > 0 ? totalQty / stores.length : 0;
    const depotRetails = retailMap.get(key) ?? 0;
    const depotStock   = stockMap.get(key)  ?? 0;

    // -- Per-store targets using 6m historical average (spec cliente)
    // B2C: Target stock = avg_monthly_sales × storeCoverMonths (3 semanas)
    // MOS (Months of Stock) = current_stock / avg_monthly_sales
    const storeData: Classified[] = [];

    for (const [store, vals] of stores) {
      const hKey  = salesHistoryKey(store, sku);
      const hist  = salesHistory.get(hKey);
      const qty   = vals.qty;

      let need   = 0;
      let excess = 0;

      if (hist && hist > 0) {
        const targetStock = hist * storeCoverMonths;
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

    // Sort deficit stores by severity: critical (qty=0) first, then by need descending.
    // This ensures scarce surplus resources go to the most urgent stores first.
    const deficitStores  = storeData.filter(s => s.need > 0)
      .sort((a, b) => {
        if (a.qty === 0 && b.qty !== 0) return -1;
        if (a.qty !== 0 && b.qty === 0) return 1;
        return b.need - a.need;
      });
    // Sort surplus stores by excess descending — prefer larger donors for fewer transfers.
    const surplusStores  = storeData.filter(s => s.excess > 0)
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
      const daysOfInventory = histAvg > 0 ? (currentStock / histAvg) * 30 : 0;
      const gapUnits = Math.max(0, idealUnitsParam - suggested);
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
        storeCluster: getStoreCluster(store),
        timeRestriction: getTimeRestriction(store),
        counterpartStores: counterparts,
        recommendedAction: recommended,
      };
    };

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
      const counterparts: CounterpartStore[] = [];
      let toFill = deficit.need;

      for (const s of surplusStores) {
        if (toFill <= 0) break;
        if (s.store === deficit.store) continue;
        const avail = surplusPool.get(s.store) ?? 0;
        if (avail <= 0) continue;
        const take = Math.min(avail, toFill);
        // Skip tiny transfers — not worth the logistics unless it's the last units needed
        if (take < MIN_TRANSFER_UNITS && toFill > take) continue;
        counterparts.push({ store: s.store, units: take });
        toFill -= take;
        surplusPool.set(s.store, avail - take);
        // Record for surplus-side mirror actions
        const existing = surplusAllocations.get(s.store) ?? [];
        existing.push({ store: deficit.store, units: take });
        surplusAllocations.set(s.store, existing);
      }

      if (counterparts.length > 0) {
        const transferUnits = counterparts.reduce((s, c) => s + c.units, 0);
        actions.push(makeItem(
          deficit.store, risk, "transfer", "store_to_store",
          transferUnits, transferUnits, counterparts,
          `Mover desde ${counterparts[0].store} (${counterparts[0].units} u.)`,
          deficit.need,
        ));
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
        const liquidate = Math.min(remaining, Math.round(remaining * SURPLUS_LIQUIDATE_RATIO));
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
      if (cumulative / totalImpact >= PARETO_TARGET) break;
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
