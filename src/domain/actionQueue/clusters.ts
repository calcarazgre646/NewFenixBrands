/**
 * domain/actionQueue/clusters.ts
 *
 * Clusters y restricciones horarias de tiendas.
 * Fuente: imágenes de Rodrigo, implementado 03/03/2026.
 *
 * REGLA: Cuando Rodrigo actualice clusters o tiendas, solo se cambia este archivo.
 */
import type { StoreCluster } from "./types";

/** Asignación de tiendas a clusters (A=premium, B=standard, OUT=outlet) */
export const STORE_CLUSTERS: Record<string, StoreCluster> = {
  // Cluster A — tiendas premium
  GALERIAWRLEE:  "A",
  MARTELMCAL:    "A",
  SHOPMCAL:      "A",
  SHOPPINEDO:    "A",
  WRSSL:         "A",
  WRPINEDO:      "A",
  // Cluster B — tiendas standard
  CERROALTO:     "B",
  ESTRELLA:      "B",
  MARTELSSL:     "B",
  SHOPMARIANO:   "B",
  TOLUQ:         "B",
  WRMULTIPLAZA:  "B",
  PASEOLAMB:     "B",
  TOLAMB:        "B",
  SHOPSANLO:     "B",
  LARURAL:       "B",
  MVMORRA:       "B",
  SHOPFUENTE:    "B",
  // Cluster OUT — outlets
  TOSUR:         "OUT",
  FERIA:         "OUT",
  "LUQ-OUTLET":  "OUT",
};

/** Restricciones horarias de tiendas para recibir transferencias */
export const STORE_TIME_RESTRICTIONS: Record<string, string> = {
  CERROALTO:     "Antes de las 10am",
  ESTRELLA:      "Sin restricción",
  MARTELMCAL:    "Sin restricción",
  TOSUR:         "Sin restricción",
  TOLUQ:         "Sin restricción",
  GALERIAWRLEE:  "Lun–Vie 10am",
  MARTELSSL:     "Lun–Vie 9am / 12–17hs",
  SHOPMARIANO:   "Lun–Vie 9am / 12–17hs",
  WRSSL:         "Lun–Vie 9am / 12–17hs",
  SHOPMCAL:      "Lun–Vie 9am / 15–17hs",
  SHOPPINEDO:    "Lun–Vie 9am / 15–17hs",
  WRMULTIPLAZA:  "Lun–Vie 9am",
};

export function getStoreCluster(storeCode: string): StoreCluster | null {
  return STORE_CLUSTERS[storeCode.trim().toUpperCase()] ?? null;
}

export function getTimeRestriction(storeCode: string): string {
  return STORE_TIME_RESTRICTIONS[storeCode.trim().toUpperCase()] ?? "—";
}

/** Marcas importadas (lead time 180d = 6 meses de cobertura) */
export const IMPORTED_BRANDS = new Set(["wrangler", "lee"]);

export function getCoverMonths(brand: string): number {
  return IMPORTED_BRANDS.has(brand.toLowerCase()) ? 6 : 3;
}
