/**
 * queries/doiAge.queries.ts
 *
 * Days of Inventory (Edad) — cuántos días lleva el stock en cada ubicación.
 *
 * FUENTE: mv_doi_edad (vista materializada)
 *   Decodifica movimientos_st_jde (EBCDIC) → SKU, talle, store normalizado.
 *   Calcula days_since_last_movement = CURRENT_DATE - MAX(fecha_transaccion).
 *   ~48K filas.
 *
 * Dos niveles de lookup:
 *   1. Exacto: "STORE|sku|talle" → days
 *   2. Fallback: "STORE|sku" → MIN(days) de cualquier talle
 */
import { dataClient } from "@/api/client";
import { fetchAllRows } from "@/queries/paginate";
import { trimStr, toNum } from "@/api/normalize";

/** Exact key: "STORE|sku|talle" → days */
export type DoiAgeMap = Map<string, number>;

/** Two-level lookup for DOI-edad */
export interface DoiAgeData {
  /** Exact: "STORE|sku|talle" → days */
  exact: DoiAgeMap;
  /** Fallback: "STORE|sku" → MIN(days) across all talles */
  byStoreSku: Map<string, number>;
}

export function doiAgeKey(store: string, sku: string, talle: string): string {
  return `${store}|${sku}|${talle}`;
}

export function doiStoreSkuKey(store: string, sku: string): string {
  return `${store}|${sku}`;
}

/**
 * Fetches DOI-edad from mv_doi_edad.
 * Returns two maps for exact and fallback lookup.
 */
export async function fetchDoiAge(): Promise<DoiAgeData> {
  const data = await fetchAllRows(() =>
    dataClient
      .from("mv_doi_edad")
      .select("sku, talle, store, days_since_last_movement")
  );

  const exact: DoiAgeMap = new Map();
  const byStoreSku = new Map<string, number>();

  for (const r of data) {
    const store = trimStr(r.store).toUpperCase();
    const sku   = trimStr(r.sku);
    const talle = trimStr(r.talle);
    const days  = toNum(r.days_since_last_movement);
    if (!store || !sku) continue;

    exact.set(doiAgeKey(store, sku, talle), days);

    // Fallback: keep the MIN days (most recent movement) for store+sku
    const ssKey = doiStoreSkuKey(store, sku);
    const prev = byStoreSku.get(ssKey);
    if (prev === undefined || days < prev) {
      byStoreSku.set(ssKey, days);
    }
  }

  return { exact, byStoreSku };
}
