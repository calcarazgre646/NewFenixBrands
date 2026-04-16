/**
 * domain/actionQueue/clusters.ts
 *
 * Clusters, horarios, assortment y price-mix de tiendas.
 * Fuente: imágenes de Rodrigo (tabla clusterización + tabla horarios), 03/03/2026.
 * Actualizado: 08/03/2026 — assortment, price mix, horarios completos.
 *
 * REGLA: Cuando Rodrigo actualice clusters o tiendas, solo se cambia este archivo.
 *
 * NOTA: 7 tiendas (PASEOLAMB, TOLAMB, LARURAL, MVMORRA, SHOPFUENTE,
 *       FERIA, LUQ-OUTLET) no aparecían en la tabla original de clusterización.
 *       Clusters asignados por el equipo dev — confirmado por Rodrigo (10/03/2026).
 */
import type { StoreCluster } from "./types";

/** Asignación de tiendas a clusters (A=premium, B=standard, OUT=outlet) */
export const STORE_CLUSTERS: Record<string, StoreCluster> = {
  // Cluster A — tiendas premium (100% precio normal)
  // Fuente: tabla de clusterización de tiendas (Rodrigo)
  GALERIAWRLEE:  "A",
  MARTELMCAL:    "A",
  SHOPMCAL:      "A",
  SHOPPINEDO:    "A",
  WRSSL:         "A",
  WRPINEDO:      "A",
  WRMULTIPLAZA:  "A",
  // Cluster B — tiendas standard (57% normal / 43% sale)
  CERROALTO:     "B",
  ESTRELLA:      "B",
  MARTELSSL:     "B",
  SHOPMARIANO:   "B",
  TOLUQ:         "B",
  // Asignados por el equipo dev — confirmado por Rodrigo (10/03/2026)
  PASEOLAMB:     "B",
  TOLAMB:        "B",
  LARURAL:       "B",
  MVMORRA:       "B",
  SHOPFUENTE:    "B",
  MARTELLUQUE:   "B",
  // Cluster OUT — outlets (40% sale / 60% outlet)
  TOSUR:         "OUT",
  FERIA:         "OUT",
  "LUQ-OUTLET":  "OUT",
};

/**
 * Capacidad de assortment por tienda (unidades máximas).
 * Fuente: tabla de clusterización de tiendas (Rodrigo).
 * Tiendas no listadas aquí no tienen capacidad definida por el cliente.
 */
export const STORE_ASSORTMENT: Record<string, number> = {
  MARTELMCAL:    5500,
  TOLUQ:         5500,
  TOSUR:         5500,
  SHOPPINEDO:    4000,   // Pinedo: dato combinado 4,309 — pendiente split con WRPINEDO
  WRPINEDO:      3500,
  ESTRELLA:      2997,   // Derlys 06/04/2026: capacidades_tiendas (era 3,000)
  MARTELSSL:     2960,   // Derlys 06/04/2026 (era 3,300)
  CERROALTO:     3000,
  SHOPMARIANO:   2500,
  GALERIAWRLEE:  2296,   // Derlys 06/04/2026 (era 3,000)
  WRMULTIPLAZA:  2000,
  SHOPMCAL:      1863,   // Derlys 06/04/2026 (antes sin dato)
  WRSSL:         1811,   // Derlys 06/04/2026 (era 3,000)
};

/**
 * Restricciones horarias de tiendas para recibir transferencias.
 * Fuente: "Tabla con restricciones de horario para movimientos de stock" (Rodrigo).
 */
export const STORE_TIME_RESTRICTIONS: Record<string, string> = {
  CERROALTO:     "Antes de las 10am (optimizar ruta)",
  ESTRELLA:      "Sin restricción (optimizar ruta)",
  MARTELMCAL:    "Sin restricción (optimizar ruta)",
  TOSUR:         "Sin restricción (optimizar ruta)",
  TOLUQ:         "Sin restricción (optimizar ruta)",
  GALERIAWRLEE:  "Lun–Vie antes de las 10am",
  MARTELSSL:     "Lun–Vie antes 9am; luego 12–17hs",
  SHOPMARIANO:   "Lun–Vie antes 9am; luego 12–17hs",
  WRSSL:         "Lun–Vie antes 9am; luego 12–17hs",
  SHOPMCAL:      "Lun–Vie antes 9am; luego 15–17hs",
  SHOPPINEDO:    "Lun–Vie antes 9am; luego 12–17hs",
  WRMULTIPLAZA:  "Lun–Vie antes de las 9am",
};

export function getStoreCluster(
  storeCode: string,
  clusters: Record<string, StoreCluster> = STORE_CLUSTERS,
): StoreCluster | null {
  return clusters[storeCode.trim().toUpperCase()] ?? null;
}

export function getTimeRestriction(
  storeCode: string,
  restrictions: Record<string, string> = STORE_TIME_RESTRICTIONS,
): string {
  return restrictions[storeCode.trim().toUpperCase()] ?? "—";
}

export function getStoreAssortment(
  storeCode: string,
  assortments: Record<string, number> = STORE_ASSORTMENT,
): number | null {
  return assortments[storeCode.trim().toUpperCase()] ?? null;
}

/** Marcas importadas = Tipo 2 (lead time 180d = 24 semanas de cobertura) */
export const IMPORTED_BRANDS = new Set(["wrangler", "lee"]);

/** Semanas de cobertura objetivo: 24 sem importado (Tipo 2), 12 sem nacional (Tipo 1) */
export function getCoverWeeks(brand: string): number {
  return IMPORTED_BRANDS.has(brand.toLowerCase()) ? 24 : 12;
}
