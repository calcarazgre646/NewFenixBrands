/**
 * domain/config/defaults.ts
 *
 * Valores hardcoded actuales como defaults nombrados.
 * Estos valores son la fuente de verdad HASTA que se cargue config remota.
 * Si la config remota falta o es inválida, estos se usan como fallback.
 *
 * REGLA: Importar desde las fuentes canónicas donde sea posible
 * para evitar drift silencioso entre defaults y código productivo.
 *
 * Fuentes canónicas:
 *   - clusters.ts (STORE_CLUSTERS, STORE_ASSORTMENT, STORE_TIME_RESTRICTIONS, CLUSTER_PRICE_MIX, IMPORTED_BRANDS)
 *   - freshness/classify.ts (SOURCE_THRESHOLDS, DEFAULT_THRESHOLDS via getThresholds)
 *   - depots/calculations.ts:29-34 (no exportados — valores inline aquí)
 *   - executive/calcs.ts:48-50 (no exportados — valores inline aquí)
 *   - kpis/calculations.ts:104-117 (no exportados — valores inline aquí)
 */
import type {
  WaterfallConfig,
  DepotConfig,
  FreshnessConfig,
  ExecutiveConfig,
  MarginConfig,
  StoreConfig,
} from "./types";
import {
  STORE_CLUSTERS,
  STORE_ASSORTMENT,
  STORE_TIME_RESTRICTIONS,
} from "@/domain/actionQueue/clusters";
import { SOURCE_THRESHOLDS } from "@/domain/freshness/classify";

// ─── Waterfall ─────────────────────────────────────────────────────────────

export const DEFAULT_WATERFALL_CONFIG: WaterfallConfig = {
  lowStockRatio: 0.40,
  highStockRatio: 2.50,
  minStockAbs: 3,
  minAvgForRatio: 5,
  minTransferUnits: 2,
  paretoTarget: 0.80,
  surplusLiquidateRatio: 0.60,
  b2cStoreCoverWeeks: 13,
  minImpactGs: 500_000,
  importedBrands: ["wrangler", "lee"],
  coverWeeksImported: 24,
  coverWeeksNational: 12,
};

// ─── Depots ────────────────────────────────────────────────────────────────

export const DEFAULT_DEPOT_CONFIG: DepotConfig = {
  criticalWeeks: 4,
  lowWeeks: 8,
  highWeeks: 16,
  historyMonths: 6,
  noveltyCoverage: 0.80,
};

// ─── Freshness ─────────────────────────────────────────────────────────────
// Imported from freshness/classify.ts canonical source

export const DEFAULT_FRESHNESS_CONFIG: FreshnessConfig = {
  sourceThresholds: { ...SOURCE_THRESHOLDS },
  defaultThresholds: { staleMinutes: 120, riskMinutes: 360 },
};

// ─── Executive ─────────────────────────────────────────────────────────────

export const DEFAULT_EXECUTIVE_CONFIG: ExecutiveConfig = {
  annualTargetFallback: 70_000_000_000,
  lyBudgetFactor: 0.90,
};

// ─── Margin Health ─────────────────────────────────────────────────────────

export const DEFAULT_MARGIN_CONFIG: MarginConfig = {
  b2cHealthy: 55,
  b2cModerate: 50,
  b2bHealthy: 50,
  b2bModerate: 40,
};

// ─── Store Config ──────────────────────────────────────────────────────────
// Source: clusters.ts:17-94 + depots/calculations.ts:41-47 + normalize.ts

// Imported from canonical sources — no duplication
export const DEFAULT_STORE_CONFIG: StoreConfig = {
  clusters: { ...STORE_CLUSTERS },
  assortments: { ...STORE_ASSORTMENT },
  timeRestrictions: { ...STORE_TIME_RESTRICTIONS },
  // These sets are defined here because their canonical sources
  // (depots/calculations.ts EXCLUDED_STORES, normalize.ts B2B_STORES)
  // have slightly different semantics. Kept inline until Etapa 4.
  excludedStores: new Set([
    "STOCK", "RETAILS",
    "ALM-BATAS", "FABRICA", "LAMBARE", "LAVADO", "LUQ-DEP-OUT",
    "MP", "E-COMMERCE", "PRODUCTO", "SHOPSANLO",
    "M-AGUSTIN", "M-EDGAR", "M-EMILIO", "M-GAMARRA", "M-JUAN", "M-SALABERRY", "M-SILVIO",
    "MAYORISTA", "UTP", "UNIFORMES",
  ]),
  b2bStores: new Set(["MAYORISTA", "UTP", "UNIFORMES"]),
};

// ─── Constantes compartidas (deduplicación de features) ────────────────────

/** Conversión meses→semanas. Fuente: depots/calculations.ts:29 */
export const WEEKS_PER_MONTH = 4.33;

/** Umbrales de DOI-edad (días de inventario en ubicación) para badges UI */
export const DOI_AGE_THRESHOLDS = {
  /** > criticalDays = rojo (inventario viejo) */
  criticalDays: 180,
  /** > warningDays = amarillo */
  warningDays: 90,
} as const;

/** Paginación por defecto en listas de features */
export const FEATURE_PAGE_SIZE = 20;

/** Freshness para logística — importaciones se cargan por batch, umbrales más largos */
export const DEFAULT_LOGISTICS_FRESHNESS = { staleMinutes: 1440, riskMinutes: 10080 };
