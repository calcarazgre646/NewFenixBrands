/**
 * queries/sth.queries.ts
 *
 * Sell-Through Rate (STH) por cohorte desde mv_sth_cohort.
 *
 * FUENTE: mv_sth_cohort (vista materializada)
 *   Calcula STH = units_sold / units_received por (sku, talle, store).
 *   Edad = CURRENT_DATE - first_entry_network (no se resetea por transferencias).
 *
 * Dos niveles de lookup (patrón idéntico a doiAge.queries.ts):
 *   1. Exacto: "STORE|sku|talle" → SthRecord
 *   2. Fallback: "STORE|sku" → SthRecord con mejor STH de cualquier talle
 */
import { dataClient } from "@/api/client";
import { fetchAllRows } from "@/queries/paginate";
import { trimStr, toNum } from "@/api/normalize";

export interface SthRecord {
  sth: number;              // 0-1 scale (sell-through rate)
  cohortAgeDays: number;    // days since first entry to network
  unitsReceived: number;
  unitsSold: number;
}

export interface SthCohortData {
  /** Exact: "STORE|sku|talle" → SthRecord */
  exact: Map<string, SthRecord>;
  /** Fallback: "STORE|sku" → SthRecord with best STH across talles */
  byStoreSku: Map<string, SthRecord>;
}

export function sthKey(store: string, sku: string, talle: string): string {
  return `${store}|${sku}|${talle}`;
}

export function sthStoreSkuKey(store: string, sku: string): string {
  return `${store}|${sku}`;
}

/**
 * Fetches STH cohort data from mv_sth_cohort.
 * Returns two maps for exact and fallback lookup.
 */
// Stores excluded from lifecycle analysis (depots, internal, non-retail)
// Only exclude internal/non-retail locations. FERIA (OUT) and MARTELLUQUE (B)
// are real retail stores that need lifecycle evaluation.
const EXCLUDED_STORES = [
  "STOCK", "RETAILS", "FABRICA", "PRODUCTO", "LAVADO", "SERVICIOS",
  "ALMTEJIDOS", "ALMACENBATAS", "LUQ-DEP-OUT",
];

export async function fetchSthCohort(): Promise<SthCohortData> {
  const data = await fetchAllRows(() =>
    dataClient
      .from("v_sth_cohort")
      .select("sku, talle, store, sth, cohort_age_days, units_received, units_sold")
      .not("store", "in", `(${EXCLUDED_STORES.join(",")})`)
      .gt("cohort_age_days", 14)  // Only SKUs old enough for lifecycle evaluation (15d+)
  );

  const exact = new Map<string, SthRecord>();
  const byStoreSku = new Map<string, SthRecord>();

  for (const r of data) {
    const store = trimStr(r.store).toUpperCase();
    const sku   = trimStr(r.sku);
    const talle = trimStr(r.talle);
    if (!store || !sku) continue;

    const record: SthRecord = {
      sth: toNum(r.sth),
      cohortAgeDays: toNum(r.cohort_age_days),
      unitsReceived: toNum(r.units_received),
      unitsSold: toNum(r.units_sold),
    };

    exact.set(sthKey(store, sku, talle), record);

    // Fallback: keep record with highest STH for store+sku (best-performing talle)
    const ssKey = sthStoreSkuKey(store, sku);
    const prev = byStoreSku.get(ssKey);
    if (!prev || record.sth > prev.sth) {
      byStoreSku.set(ssKey, record);
    }
  }

  return { exact, byStoreSku };
}

// ─── Agregado red-wide por SKU (para ranking de performance) ───────────────

export interface SkuSthAggregate {
  /** SKU técnico ERP (ej: "7031457") */
  sku: string;
  /** Suma de unidades recibidas en toda la red de venta (excluye depósitos/almacenes) */
  unitsReceived: number;
  /** Suma de unidades vendidas en toda la red */
  unitsSold: number;
  /** Sell-through agregado en escala 0-100 (clampeado a 100). 0 si no hubo entradas. */
  sthPct: number;
}

/**
 * STH agregado red-wide por SKU técnico.
 *
 * Agrega TODAS las filas de mv_sth_cohort por SKU (suma todas las talles y todas
 * las tiendas no-almacén). Sirve para ranking de productos por velocidad de venta:
 * "qué porcentaje del inventario inicial ya se vendió".
 *
 * Diferencia con fetchSthCohort: ese hace lookups exactos (sku+talle+store) o
 * fallback (mejor talle por sku+store), apunta al motor de lifecycle/waterfall.
 * Este agrega red-wide, apunta a vistas exploratorias (SkusCard).
 *
 * @param storeCode  Si se pasa, restringe el agregado a esa tienda (formato cosujd).
 *                   Si no, suma todas las tiendas no-almacén.
 */
export async function fetchSthBySku(storeCode?: string | null): Promise<Map<string, SkuSthAggregate>> {
  const buildQuery = () => {
    let q = dataClient
      .from("v_sth_cohort")
      .select("sku, store, units_received, units_sold")
      .not("store", "in", `(${EXCLUDED_STORES.join(",")})`);
    if (storeCode) {
      q = q.eq("store", storeCode.trim().toUpperCase());
    }
    return q;
  };

  const data = await fetchAllRows(buildQuery);

  const acc = new Map<string, SkuSthAggregate>();
  for (const r of data) {
    const sku = trimStr(r.sku);
    if (!sku) continue;
    const received = toNum(r.units_received);
    const sold = toNum(r.units_sold);
    const prev = acc.get(sku);
    if (prev) {
      prev.unitsReceived += received;
      prev.unitsSold += sold;
    } else {
      acc.set(sku, { sku, unitsReceived: received, unitsSold: sold, sthPct: 0 });
    }
  }

  for (const row of acc.values()) {
    row.sthPct = row.unitsReceived > 0
      ? Math.min(100, (row.unitsSold / row.unitsReceived) * 100)
      : 0;
  }

  return acc;
}
