/**
 * domain/lifecycle/sequentialDecision.ts
 *
 * Motor de decisión secuencial de 5 pasos (Rodrigo, email 09/04/2026).
 *
 * Antes de recomendar una acción para un SKU en una tienda, el sistema sigue:
 *   1. Revisar tallas disponibles en la tienda
 *   2. Revisar si existen tallas en OTRAS tiendas para completar curva
 *   3a. Si HAY tallas → consolidar curva actual o mover a mejor performer
 *   3b. Si NO hay tallas → evaluar STH vs promedio de tienda
 *   4. Si STH > promedio → mantener hasta agotar
 *   5. Si STH < promedio → sugerir transferencia/markdown
 *
 * Pure function — no React, no side effects.
 */
import type { StoreCluster } from "@/domain/actionQueue/types";
import type { ProductType, LifecycleAction, ResponsibleRole } from "./types";
import type { SizeCurveAnalysis } from "./sizeCurve";
import { curveCoverage } from "./sizeCurve";
import { evaluateLinealidad } from "./linealidad";
import type { LinealidadThresholds } from "./types";
import { nextClusterCascade } from "./clusterRouting";

// ─── Types ──────────────────────────────────────────────────────────────────

export type DecisionOutcome =
  | "reposition_sizes"       // Completar curva de tallas (traer de otras tiendas)
  | "consolidate_here"       // Consolidar curva en esta tienda (traer tallas faltantes)
  | "move_to_best_performer" // Mover SKU completo a tienda con mejor STH
  | "maintain_until_sold"    // STH bueno, mantener hasta agotar
  | "transfer_cascade"       // Transferir a siguiente cluster (A→B, B→OUT)
  | "markdown"               // Markdown selectivo o liquidación
  | "no_action";             // SKU en buen estado, sin intervención

export interface SequentialDecision {
  store: string;
  sku: string;
  outcome: DecisionOutcome;
  reason: string;
  /** Lifecycle action triggered (if any) */
  lifecycleAction: LifecycleAction | null;
  /** Roles responsible for executing */
  responsibleRoles: ResponsibleRole[];
  /** Suggested destination store (for transfers) */
  suggestedDestination: string | null;
  /** Size curve coverage % in this store */
  curveCoveragePct: number;
  /** Sizes that could be sourced from other stores */
  sourcableSizes: string[];
}

interface SkuStoreContext {
  store: string;
  storeCluster: StoreCluster | null;
  productType: ProductType;
  /** STH for this SKU in this store (0-100), null if unavailable */
  storeSth: number | null;
  /** Average STH for this SKU across all stores (0-100), null if unavailable */
  networkAvgSth: number | null;
  /** Average STH across all SKUs in this store (0-100), null if unavailable */
  storeAvgSth: number | null;
  /** Cohort age in days, null if unavailable */
  ageDays: number | null;
  /** Best-performing store for this SKU (by sales), null if no data */
  bestPerformerStore?: string | null;
  /** Avg sales/month of current store for this SKU */
  currentStoreSales?: number;
  /** Avg sales/month of the best-performing store for this SKU */
  bestPerformerSales?: number;
}

// ─── Core ───────────────────────────────────────────────────────────────────

/**
 * Runs the 5-step sequential decision analysis for a single SKU in a single store.
 *
 * @param ctx Store-level context (STH, cluster, age)
 * @param sizeCurve Full size curve analysis for this SKU across network
 * @param linealidadThresholds Configurable STH thresholds per product type × age
 * @returns Decision with outcome, reason, and suggested action
 */
export function analyzeSequentially(
  ctx: SkuStoreContext,
  sizeCurve: SizeCurveAnalysis | null,
  linealidadThresholds?: LinealidadThresholds,
): SequentialDecision {
  const base: Omit<SequentialDecision, "outcome" | "reason" | "lifecycleAction" | "responsibleRoles" | "suggestedDestination"> = {
    store: ctx.store,
    sku: sizeCurve?.sku ?? "",
    curveCoveragePct: 100,
    sourcableSizes: [],
  };

  // ── Step 1-2: Size curve analysis ──────────────────────────────────────
  if (sizeCurve) {
    const storeCurve = sizeCurve.stores.find(s => s.store === ctx.store);

    if (storeCurve) {
      const coverage = curveCoverage(storeCurve, sizeCurve.networkTalles);
      base.curveCoveragePct = coverage;

      const missingTalles = sizeCurve.networkTalles.filter(
        t => !storeCurve.presentTalles.has(t),
      );

      if (missingTalles.length > 0) {
        // Find which missing sizes are available elsewhere
        const sourcable: string[] = [];
        for (const talle of missingTalles) {
          const sources = sizeCurve.gapSources.get(talle);
          if (sources && sources.has(ctx.store)) {
            sourcable.push(talle);
          }
        }
        base.sourcableSizes = sourcable;

        // ── Step 3: Sizes available elsewhere → consolidate here, move to best performer, or reposition ──
        if (sourcable.length > 0) {
          const roles: ResponsibleRole[] = ["brand_manager", "operaciones_retail", "logistica"];

          // Decide: consolidate here or move to best-performing store
          if (ctx.bestPerformerStore && ctx.bestPerformerSales && ctx.bestPerformerSales > 0) {
            const ratio = (ctx.currentStoreSales ?? 0) / ctx.bestPerformerSales;
            if (ratio >= 0.8 || ctx.store === ctx.bestPerformerStore) {
              // This store IS (or is near) the best performer → bring sizes here
              return {
                ...base,
                outcome: "consolidate_here",
                reason: `Consolidar curva aquí — mejor vendedor para este SKU. Faltan: ${sourcable.join(", ")}`,
                lifecycleAction: null,
                responsibleRoles: roles,
                suggestedDestination: null,
              };
            } else {
              // Another store sells significantly more → move SKU there
              return {
                ...base,
                outcome: "move_to_best_performer",
                reason: `Mover a ${ctx.bestPerformerStore} (vende ${ctx.bestPerformerSales.toFixed(0)}u/mes vs ${(ctx.currentStoreSales ?? 0).toFixed(0)}u/mes aquí)`,
                lifecycleAction: null,
                responsibleRoles: roles,
                suggestedDestination: ctx.bestPerformerStore,
              };
            }
          }

          // Fallback: no sales data → use stock volume from sizeCurve as proxy
          if (sizeCurve && sizeCurve.stores.length >= 2) {
            const sorted = [...sizeCurve.stores].sort((a, b) => b.totalUnits - a.totalUnits);
            const bestByVolume = sorted[0];
            if (bestByVolume.store === ctx.store || bestByVolume.totalUnits === 0) {
              return {
                ...base,
                outcome: "consolidate_here",
                reason: `Consolidar curva aquí (mayor volumen de stock). Faltan: ${sourcable.join(", ")}`,
                lifecycleAction: null,
                responsibleRoles: roles,
                suggestedDestination: null,
              };
            }
            // Check if current store has at least 50% of the volume leader
            const currentStoreData = sizeCurve.stores.find(s => s.store === ctx.store);
            const currentVolume = currentStoreData?.totalUnits ?? 0;
            if (bestByVolume.totalUnits > 0 && currentVolume / bestByVolume.totalUnits >= 0.5) {
              return {
                ...base,
                outcome: "consolidate_here",
                reason: `Consolidar curva aquí (volumen competitivo). Faltan: ${sourcable.join(", ")}`,
                lifecycleAction: null,
                responsibleRoles: roles,
                suggestedDestination: null,
              };
            }
            return {
              ...base,
              outcome: "move_to_best_performer",
              reason: `Mover a ${bestByVolume.store} (${bestByVolume.totalUnits}u vs ${currentVolume}u aquí)`,
              lifecycleAction: null,
              responsibleRoles: roles,
              suggestedDestination: bestByVolume.store,
            };
          }

          // Last fallback: no sales data, no sizeCurve context → generic reposition
          return {
            ...base,
            outcome: "reposition_sizes",
            reason: `Faltan ${sourcable.length} talla(s) (${sourcable.join(", ")}) disponibles en otras tiendas`,
            lifecycleAction: null,
            responsibleRoles: roles,
            suggestedDestination: null,
          };
        }

        // Missing sizes but none available anywhere — evaluate STH
      }
    }
  }

  // ── Step 3b-5: No size gaps (or gaps can't be filled) → STH analysis ──

  // Without STH data, we can't make STH-based decisions
  if (ctx.storeSth === null || ctx.ageDays === null) {
    return {
      ...base,
      outcome: "no_action",
      reason: "Sin datos de STH para evaluar",
      lifecycleAction: null,
      responsibleRoles: [],
      suggestedDestination: null,
    };
  }

  // Evaluate linealidad (age × STH × product type → action)
  const linealidad = evaluateLinealidad(
    ctx.productType,
    ctx.ageDays,
    ctx.storeSth,
    linealidadThresholds,
  );

  // STH is above threshold → SKU performing OK
  if (!linealidad.isBelowThreshold) {
    return {
      ...base,
      outcome: "no_action",
      reason: `STH ${ctx.storeSth.toFixed(0)}% ≥ ${linealidad.requiredSth}% (umbral ${linealidad.bracket}d)`,
      lifecycleAction: null,
      responsibleRoles: [],
      suggestedDestination: null,
    };
  }

  // ── Step 4: STH below threshold — compare vs store average ──────────

  // If STH is above the store's average (across all SKUs), maintain until sold
  // EXCEPT at 90d+ where Rodrigo mandates action regardless ("salida obligatoria")
  const avgRef = ctx.storeAvgSth ?? ctx.networkAvgSth; // prefer store avg, fallback to network
  if (linealidad.bracket < 90 && avgRef !== null && ctx.storeSth >= avgRef) {
    return {
      ...base,
      outcome: "maintain_until_sold",
      reason: `STH ${ctx.storeSth.toFixed(0)}% < umbral ${linealidad.requiredSth}% pero ≥ promedio tienda ${avgRef.toFixed(0)}%`,
      lifecycleAction: null,
      responsibleRoles: [],
      suggestedDestination: null,
    };
  }

  // ── Step 5: STH below threshold AND below network average → intervene ──

  // For A stores: cascade to B first (Rodrigo's rule)
  // A stores: cascade to B from 30d+ (after 15d "revisar exhibición"). B/OUT: from 60d+.
  const cascadeMinBracket = ctx.storeCluster === "A" ? 30 : 60;
  if (ctx.storeCluster && linealidad.bracket >= cascadeMinBracket) {
    const nextCluster = nextClusterCascade(ctx.storeCluster);
    if (nextCluster) {
      return {
        ...base,
        outcome: "transfer_cascade",
        reason: `STH ${ctx.storeSth.toFixed(0)}% < umbral ${linealidad.requiredSth}% y < promedio red → transferir a cluster ${nextCluster}`,
        lifecycleAction: linealidad.action,
        responsibleRoles: linealidad.responsibleRoles,
        suggestedDestination: null, // specific store determined by waterfall
      };
    }
  }

  // Default: apply linealidad action (markdown, commercial action, etc.)
  return {
    ...base,
    outcome: "markdown",
    reason: `STH ${ctx.storeSth.toFixed(0)}% < umbral ${linealidad.requiredSth}% en tramo ${linealidad.bracket}d`,
    lifecycleAction: linealidad.action,
    responsibleRoles: linealidad.responsibleRoles,
    suggestedDestination: null,
  };
}
