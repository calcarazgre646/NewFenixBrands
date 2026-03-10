/**
 * domain/actionQueue/clusters.ts
 *
 * Clusters, horarios, assortment y price-mix de tiendas.
 * Fuente: imágenes de Rodrigo (tabla clusterización + tabla horarios), 03/03/2026.
 * Actualizado: 08/03/2026 — assortment, price mix, horarios completos.
 *
 * REGLA: Cuando Rodrigo actualice clusters o tiendas, solo se cambia este archivo.
 *
 * NOTA: 8 tiendas (PASEOLAMB, TOLAMB, SHOPSANLO, LARURAL, MVMORRA, SHOPFUENTE,
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
  SHOPSANLO:     "B",
  LARURAL:       "B",
  MVMORRA:       "B",
  SHOPFUENTE:    "B",
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
  SHOPPINEDO:    4000,
  WRPINEDO:      3500,
  MARTELSSL:     3300,
  CERROALTO:     3000,
  ESTRELLA:      3000,
  GALERIAWRLEE:  3000,
  WRSSL:         3000,
  SHOPMARIANO:   2500,
  WRMULTIPLAZA:  2000,
  // SHOPMCAL: sin dato en tabla del cliente
};

/**
 * Mix de precios por cluster.
 * Fuente: tabla de clusterización de tiendas (Rodrigo).
 * A = solo precio normal. B = 57/43 normal/sale. OUT = 40/60 sale/outlet.
 */
export const CLUSTER_PRICE_MIX: Record<StoreCluster, { normal: number; sale: number; outlet: number }> = {
  A:   { normal: 1.00, sale: 0.00, outlet: 0.00 },
  B:   { normal: 0.57, sale: 0.43, outlet: 0.00 },
  OUT: { normal: 0.00, sale: 0.40, outlet: 0.60 },
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

export function getStoreCluster(storeCode: string): StoreCluster | null {
  return STORE_CLUSTERS[storeCode.trim().toUpperCase()] ?? null;
}

export function getTimeRestriction(storeCode: string): string {
  return STORE_TIME_RESTRICTIONS[storeCode.trim().toUpperCase()] ?? "—";
}

export function getStoreAssortment(storeCode: string): number | null {
  return STORE_ASSORTMENT[storeCode.trim().toUpperCase()] ?? null;
}

/** Marcas importadas = Tipo 2 (lead time 180d = 24 semanas de cobertura) */
export const IMPORTED_BRANDS = new Set(["wrangler", "lee"]);

/** Semanas de cobertura objetivo: 24 sem importado (Tipo 2), 12 sem nacional (Tipo 1) */
export function getCoverWeeks(brand: string): number {
  return IMPORTED_BRANDS.has(brand.toLowerCase()) ? 24 : 12;
}
