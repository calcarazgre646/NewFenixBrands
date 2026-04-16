/**
 * domain/lifecycle/clusterRouting.ts
 *
 * Routing de transferencias respetando jerarquía de clusters.
 * Fuente: Rodrigo Aguayo, WhatsApp 01/04/2026 — "Reglas por cluster".
 *
 * - Tiendas A: prioridad novedades, si SKU no rinde → primero B, no OUT
 * - Tiendas B: absorbe SKUs con potencial de A
 * - Outlets: concentra SKUs de salida, quiebre de talla, mayor edad
 *
 * Pure function — no React, no side effects.
 */
import type { StoreCluster } from "@/domain/actionQueue/types";

export interface TransferCandidate {
  store: string;
  cluster: StoreCluster | null;
  availableUnits: number;
}

/**
 * Cluster preference for sourcing transfers.
 * A deficit store prefers to source from:
 *   - A deficit: A > B (never from OUT — outlet stock goes one-way)
 *   - B deficit: A > B (can absorb from premium if excess)
 *   - OUT deficit: A > B > OUT (outlets accept from anywhere)
 *
 * For SENDING excess (underperforming SKU in A):
 *   - A sends to B first (not OUT), per Rodrigo's rule
 *   - B sends to OUT
 *   - OUT liquidates in place
 */
const CLUSTER_RANK: Record<string, Record<string, number>> = {
  // deficit cluster → { source cluster → rank (lower = preferred) }
  A:   { A: 1, B: 2 },           // A deficit: source from A first, then B. Never OUT.
  B:   { A: 1, B: 2, OUT: 3 },   // B deficit: prefer A, then B, OUT last resort
  OUT: { A: 1, B: 2, OUT: 3 },   // OUT deficit: accept from anywhere
};

/**
 * Ranks transfer candidates by cluster compatibility with the deficit store.
 * Candidates without a matching cluster rank are pushed to the end.
 *
 * @param deficitCluster Cluster of the store needing stock
 * @param candidates Available surplus stores
 * @returns Sorted candidates (best source first)
 */
export function rankTransferCandidates(
  deficitCluster: StoreCluster | null,
  candidates: TransferCandidate[],
): TransferCandidate[] {
  if (!deficitCluster || candidates.length <= 1) return candidates;

  const rankMap = CLUSTER_RANK[deficitCluster];
  if (!rankMap) return candidates;

  return [...candidates].sort((a, b) => {
    const ra = (a.cluster && rankMap[a.cluster]) ?? 99;
    const rb = (b.cluster && rankMap[b.cluster]) ?? 99;
    if (ra !== rb) return ra - rb;
    // Same rank: prefer store with more available units
    return b.availableUnits - a.availableUnits;
  });
}

/**
 * Determines the preferred destination cluster for an underperforming SKU.
 *
 * Rodrigo's rule: "Si un SKU no rinde en A, primero corregir ejecución
 * y luego evaluar pase a tienda B" — never direct A→OUT.
 *
 * @param currentCluster Where the SKU currently is
 * @returns Next cluster in the cascade, or null if already at terminal (OUT)
 */
export function nextClusterCascade(currentCluster: StoreCluster): StoreCluster | null {
  switch (currentCluster) {
    case "A":   return "B";    // A → B (try B before OUT)
    case "B":   return "OUT";  // B → OUT (last retail stop)
    case "OUT": return null;   // OUT → nowhere (liquidate in place)
  }
}

/**
 * Checks if a transfer from source cluster to destination cluster is allowed.
 * OUT stores should not send stock back to A or B.
 */
export function isTransferAllowed(
  sourceCluster: StoreCluster | null,
  destCluster: StoreCluster | null,
): boolean {
  // OUT → A or OUT → B is not allowed (one-way flow)
  if (sourceCluster === "OUT" && (destCluster === "A" || destCluster === "B")) return false;
  return true;
}
