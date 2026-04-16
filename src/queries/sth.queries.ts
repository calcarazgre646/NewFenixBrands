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
