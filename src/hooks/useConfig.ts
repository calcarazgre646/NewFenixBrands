/**
 * hooks/useConfig.ts
 *
 * Hooks de configuración de negocio. Cargan config remota de Supabase
 * con fallback a defaults hardcoded.
 *
 * Patrón:
 *   1. TanStack Query fetchea de Supabase (staleTime: 10min)
 *   2. Loader valida y resuelve con fallback
 *   3. El consumer recibe config resuelta — nunca undefined, nunca inválida
 *
 * Si las tablas no existen todavía, todo retorna defaults (0 cambio de comportamiento).
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { configKeys, STALE_10MIN, GC_60MIN } from "@/queries/keys";
import {
  fetchAppParams,
  fetchStoreConfig,
  fetchCommissionScales,
} from "@/queries/config.queries";
import { resolveParam, resolveStoreConfig, resolveCommissionScales } from "@/domain/config/loader";
import {
  validateFreshnessConfig,
  validateDepotConfig,
  validateMarginConfig,
  validateNumericParam,
} from "@/domain/config/schemas";
import type {
  WaterfallConfig,
  DepotConfig,
  FreshnessConfig,
  ExecutiveConfig,
  MarginConfig,
  StoreConfig,
  CommissionConfig,
} from "@/domain/config/types";
import {
  DEFAULT_WATERFALL_CONFIG,
  DEFAULT_DEPOT_CONFIG,
  DEFAULT_FRESHNESS_CONFIG,
  DEFAULT_EXECUTIVE_CONFIG,
  DEFAULT_MARGIN_CONFIG,
  DEFAULT_STORE_CONFIG,
} from "@/domain/config/defaults";
import { SCALE_BY_ROLE } from "@/domain/commissions/scales";

// ─── Raw data hooks (internal) ─────────────────────────────────────────────

function useAppParamsQuery() {
  return useQuery({
    queryKey: configKeys.params(),
    queryFn: fetchAppParams,
    staleTime: STALE_10MIN,
    gcTime: GC_60MIN,
    retry: 1,
  });
}

function useStoreConfigQuery() {
  return useQuery({
    queryKey: configKeys.stores(),
    queryFn: fetchStoreConfig,
    staleTime: STALE_10MIN,
    gcTime: GC_60MIN,
    retry: 1,
  });
}

function useCommissionScalesQuery() {
  return useQuery({
    queryKey: configKeys.commissions(),
    queryFn: fetchCommissionScales,
    staleTime: STALE_10MIN,
    gcTime: GC_60MIN,
    retry: 1,
  });
}

// ─── Resolved config hooks (public API) ────────────────────────────────────

/** Config del algoritmo waterfall. Fallback: valores actuales de waterfall.ts */
export function useWaterfallConfig(): WaterfallConfig {
  const { data: params } = useAppParamsQuery();
  return useMemo(() => {
    if (!params || params.size === 0) return DEFAULT_WATERFALL_CONFIG;

    // Build config from individual params, each with own fallback
    const result: WaterfallConfig = {
      lowStockRatio: resolveParam(params, "waterfall.low_stock_ratio",
        v => validateNumericParam(v, 0, 10), DEFAULT_WATERFALL_CONFIG.lowStockRatio),
      highStockRatio: resolveParam(params, "waterfall.high_stock_ratio",
        v => validateNumericParam(v, 0, 100), DEFAULT_WATERFALL_CONFIG.highStockRatio),
      minStockAbs: resolveParam(params, "waterfall.min_stock_abs",
        v => validateNumericParam(v, 0, 1000), DEFAULT_WATERFALL_CONFIG.minStockAbs),
      minAvgForRatio: resolveParam(params, "waterfall.min_avg_for_ratio",
        v => validateNumericParam(v, 0, 1000), DEFAULT_WATERFALL_CONFIG.minAvgForRatio),
      minTransferUnits: resolveParam(params, "waterfall.min_transfer_units",
        v => validateNumericParam(v, 1, 1000), DEFAULT_WATERFALL_CONFIG.minTransferUnits),
      paretoTarget: resolveParam(params, "waterfall.pareto_target",
        v => validateNumericParam(v, 0, 1), DEFAULT_WATERFALL_CONFIG.paretoTarget),
      surplusLiquidateRatio: resolveParam(params, "waterfall.surplus_liquidate_ratio",
        v => validateNumericParam(v, 0, 1), DEFAULT_WATERFALL_CONFIG.surplusLiquidateRatio),
      b2cStoreCoverWeeks: resolveParam(params, "waterfall.b2c_cover_weeks",
        v => validateNumericParam(v, 1, 52), DEFAULT_WATERFALL_CONFIG.b2cStoreCoverWeeks),
      minImpactGs: resolveParam(params, "waterfall.min_impact_gs",
        v => validateNumericParam(v, 0, 100_000_000_000), DEFAULT_WATERFALL_CONFIG.minImpactGs),
      importedBrands: DEFAULT_WATERFALL_CONFIG.importedBrands, // resolved below
      coverWeeksImported: resolveParam(params, "waterfall.cover_weeks_imported",
        v => validateNumericParam(v, 1, 52), DEFAULT_WATERFALL_CONFIG.coverWeeksImported),
      coverWeeksNational: resolveParam(params, "waterfall.cover_weeks_national",
        v => validateNumericParam(v, 1, 52), DEFAULT_WATERFALL_CONFIG.coverWeeksNational),
      doiStaleThreshold: resolveParam(params, "waterfall.doi_stale_threshold",
        v => validateNumericParam(v, 1, 365), DEFAULT_WATERFALL_CONFIG.doiStaleThreshold),
      doiDeadThreshold: resolveParam(params, "waterfall.doi_dead_threshold",
        v => validateNumericParam(v, 1, 730), DEFAULT_WATERFALL_CONFIG.doiDeadThreshold),
    };

    // importedBrands: array of strings
    const brandsRaw = params.get("waterfall.imported_brands");
    if (Array.isArray(brandsRaw) && brandsRaw.every(b => typeof b === "string")) {
      result.importedBrands = brandsRaw as string[];
    }

    return result;
  }, [params]);
}

/** Config de depósitos. Fallback: valores actuales de depots/calculations.ts */
export function useDepotConfig(): DepotConfig {
  const { data: params } = useAppParamsQuery();
  return useMemo(() => {
    if (!params || params.size === 0) return DEFAULT_DEPOT_CONFIG;

    const assembled = {
      criticalWeeks: resolveParam(params, "depots.critical_weeks",
        v => validateNumericParam(v, 1, 52), DEFAULT_DEPOT_CONFIG.criticalWeeks),
      lowWeeks: resolveParam(params, "depots.low_weeks",
        v => validateNumericParam(v, 1, 52), DEFAULT_DEPOT_CONFIG.lowWeeks),
      highWeeks: resolveParam(params, "depots.high_weeks",
        v => validateNumericParam(v, 1, 104), DEFAULT_DEPOT_CONFIG.highWeeks),
      historyMonths: resolveParam(params, "depots.history_months",
        v => validateNumericParam(v, 1, 24), DEFAULT_DEPOT_CONFIG.historyMonths),
      noveltyCoverage: resolveParam(params, "depots.novelty_coverage",
        v => validateNumericParam(v, 0, 1), DEFAULT_DEPOT_CONFIG.noveltyCoverage),
    };

    // Cross-field validation: criticalWeeks < lowWeeks < highWeeks
    const check = validateDepotConfig(assembled);
    if (!check.ok) {
      console.warn(`[config] Depot cross-field invalid: ${check.error} → using fallback`);
      return DEFAULT_DEPOT_CONFIG;
    }
    return assembled;
  }, [params]);
}

/** Config de freshness. Fallback: valores actuales de freshness/classify.ts */
export function useFreshnessConfig(): FreshnessConfig {
  const { data: params } = useAppParamsQuery();
  return useMemo(() => {
    if (!params || params.size === 0) return DEFAULT_FRESHNESS_CONFIG;
    return resolveParam(params, "freshness.config",
      validateFreshnessConfig, DEFAULT_FRESHNESS_CONFIG);
  }, [params]);
}

/** Config ejecutivo. Fallback: valores actuales de executive/calcs.ts */
export function useExecutiveConfig(): ExecutiveConfig {
  const { data: params } = useAppParamsQuery();
  return useMemo(() => {
    if (!params || params.size === 0) return DEFAULT_EXECUTIVE_CONFIG;

    return {
      annualTargetFallback: resolveParam(params, "executive.annual_target_fallback",
        v => validateNumericParam(v, 0, 1_000_000_000_000), DEFAULT_EXECUTIVE_CONFIG.annualTargetFallback),
      lyBudgetFactor: resolveParam(params, "executive.ly_budget_factor",
        v => validateNumericParam(v, 0, 1), DEFAULT_EXECUTIVE_CONFIG.lyBudgetFactor),
    };
  }, [params]);
}

/** Config de márgenes. Fallback: valores actuales de kpis/calculations.ts */
export function useMarginConfig(): MarginConfig {
  const { data: params } = useAppParamsQuery();
  return useMemo(() => {
    if (!params || params.size === 0) return DEFAULT_MARGIN_CONFIG;

    const assembled = {
      b2cHealthy: resolveParam(params, "margin.b2c_healthy",
        v => validateNumericParam(v, 0, 100), DEFAULT_MARGIN_CONFIG.b2cHealthy),
      b2cModerate: resolveParam(params, "margin.b2c_moderate",
        v => validateNumericParam(v, 0, 100), DEFAULT_MARGIN_CONFIG.b2cModerate),
      b2bHealthy: resolveParam(params, "margin.b2b_healthy",
        v => validateNumericParam(v, 0, 100), DEFAULT_MARGIN_CONFIG.b2bHealthy),
      b2bModerate: resolveParam(params, "margin.b2b_moderate",
        v => validateNumericParam(v, 0, 100), DEFAULT_MARGIN_CONFIG.b2bModerate),
    };

    // Cross-field: moderate must be < healthy
    const check = validateMarginConfig(assembled);
    if (!check.ok) {
      console.warn(`[config] Margin cross-field invalid: ${check.error} → using fallback`);
      return DEFAULT_MARGIN_CONFIG;
    }
    return assembled;
  }, [params]);
}

/** Config de tiendas (clusters, assortment, horarios, exclusiones). */
export function useStoreConfig(): StoreConfig {
  const { data: rows } = useStoreConfigQuery();
  return useMemo(
    () => resolveStoreConfig(rows ?? null, DEFAULT_STORE_CONFIG),
    [rows],
  );
}

/** Escalas de comisión. Fallback: scales.ts actual. */
export function useCommissionScales(): CommissionConfig {
  const { data: rows } = useCommissionScalesQuery();
  return useMemo(
    () => resolveCommissionScales(rows ?? null, SCALE_BY_ROLE),
    [rows],
  );
}

