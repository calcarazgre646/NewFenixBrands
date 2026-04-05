/**
 * domain/config/types.ts
 *
 * Interfaces de configuración por dominio.
 * Cada tipo agrupa las constantes de un subdomain que hoy viven hardcoded.
 *
 * REGLA: Solo tipos. Sin valores, sin lógica.
 */
import type { CommissionScale } from "@/domain/commissions/types";
import type { StoreCluster } from "@/domain/actionQueue/types";
import type { FreshnessThresholds } from "@/domain/freshness/types";

// ─── Waterfall ─────────────────────────────────────────────────────────────

export interface WaterfallConfig {
  lowStockRatio: number;
  highStockRatio: number;
  minStockAbs: number;
  minAvgForRatio: number;
  minTransferUnits: number;
  paretoTarget: number;
  surplusLiquidateRatio: number;
  b2cStoreCoverWeeks: number;
  minImpactGs: number;
  importedBrands: string[];
  coverWeeksImported: number;
  coverWeeksNational: number;
}

// ─── Depots ────────────────────────────────────────────────────────────────

export interface DepotConfig {
  criticalWeeks: number;
  lowWeeks: number;
  highWeeks: number;
  historyMonths: number;
  noveltyCoverage: number;
}

// ─── Freshness ─────────────────────────────────────────────────────────────

export interface FreshnessConfig {
  sourceThresholds: Record<string, FreshnessThresholds>;
  defaultThresholds: FreshnessThresholds;
}

// ─── Executive ─────────────────────────────────────────────────────────────

export interface ExecutiveConfig {
  annualTargetFallback: number;
  lyBudgetFactor: number;
}

// ─── Margin Health ─────────────────────────────────────────────────────────

export interface MarginConfig {
  b2cHealthy: number;
  b2cModerate: number;
  b2bHealthy: number;
  b2bModerate: number;
}

// ─── Store Config ──────────────────────────────────────────────────────────

export interface StoreConfigRow {
  storeCode: string;
  cluster: StoreCluster;
  assortment: number | null;
  timeRestriction: string | null;
  isExcluded: boolean;
  isB2b: boolean;
}

/** Resolved store config — lookup maps built from rows */
export interface StoreConfig {
  clusters: Record<string, StoreCluster>;
  assortments: Record<string, number>;
  timeRestrictions: Record<string, string>;
  excludedStores: Set<string>;
  b2bStores: Set<string>;
}

// ─── Commission Config ─────────────────────────────────────────────────────

/** Commission scales loaded from remote — same shape as scales.ts */
export type CommissionConfig = Record<string, CommissionScale>;
