/**
 * domain/config/schemas.ts
 *
 * Validación de configuración. Sin dependencias externas (no Zod).
 * Cada función valida un valor y retorna { ok, value?, error? }.
 *
 * REGLA: Una función de validación por config type.
 * Si el valor es inválido, retorna error descriptivo (no throws).
 */
import type {
  WaterfallConfig,
  DepotConfig,
  FreshnessConfig,
  ExecutiveConfig,
  MarginConfig,
  StoreConfigRow,
} from "./types";
import type { FreshnessThresholds } from "@/domain/freshness/types";
import type { CommissionTier, CommissionScale } from "@/domain/commissions/types";

// ─── Result type ───────────────────────────────────────────────────────────

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

function ok<T>(value: T): ValidationResult<T> {
  return { ok: true, value };
}

function fail<T>(error: string): ValidationResult<T> {
  return { ok: false, error };
}

// ─── Primitives ────────────────────────────────────────────────────────────

function isNumber(v: unknown): v is number {
  return typeof v === "number" && !Number.isNaN(v);
}

function isPositiveInt(v: unknown): v is number {
  return isNumber(v) && Number.isInteger(v) && v > 0;
}

function isString(v: unknown): v is string {
  return typeof v === "string";
}

function isBoolean(v: unknown): v is boolean {
  return typeof v === "boolean";
}

function isObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

// ─── Shared numeric field validator ─────────────────────────────────────────

function numericField(
  v: Record<string, unknown>,
  errs: string[],
): (key: string, min: number, max: number) => number {
  return (key, min, max) => {
    const val = v[key];
    if (!isNumber(val)) { errs.push(`${key}: expected number`); return 0; }
    if (val < min || val > max) { errs.push(`${key}: out of range [${min},${max}]`); return val; }
    return val;
  };
}

// ─── Waterfall ─────────────────────────────────────────────────────────────

export function validateWaterfallConfig(v: unknown): ValidationResult<WaterfallConfig> {
  if (!isObject(v)) return fail("expected object");

  const errs: string[] = [];
  const n = numericField(v, errs);

  const result: WaterfallConfig = {
    lowStockRatio: n("lowStockRatio", 0, 10),
    highStockRatio: n("highStockRatio", 0, 100),
    minStockAbs: n("minStockAbs", 0, 1000),
    minAvgForRatio: n("minAvgForRatio", 0, 1000),
    minTransferUnits: n("minTransferUnits", 1, 1000),
    paretoTarget: n("paretoTarget", 0, 1),
    surplusLiquidateRatio: n("surplusLiquidateRatio", 0, 1),
    b2cStoreCoverWeeks: n("b2cStoreCoverWeeks", 1, 52),
    minImpactGs: n("minImpactGs", 0, 100_000_000_000),
    importedBrands: [],
    coverWeeksImported: n("coverWeeksImported", 1, 52),
    coverWeeksNational: n("coverWeeksNational", 1, 52),
  };

  // importedBrands
  if (!Array.isArray(v.importedBrands)) {
    errs.push("importedBrands: expected array");
  } else if (!v.importedBrands.every(isString)) {
    errs.push("importedBrands: expected string[]");
  } else {
    result.importedBrands = v.importedBrands as string[];
  }

  if (errs.length > 0) return fail(errs.join("; "));
  return ok(result);
}

// ─── Depot ─────────────────────────────────────────────────────────────────

export function validateDepotConfig(v: unknown): ValidationResult<DepotConfig> {
  if (!isObject(v)) return fail("expected object");

  const errs: string[] = [];
  const n = numericField(v, errs);

  const result: DepotConfig = {
    criticalWeeks: n("criticalWeeks", 1, 52),
    lowWeeks: n("lowWeeks", 1, 52),
    highWeeks: n("highWeeks", 1, 104),
    historyMonths: n("historyMonths", 1, 24),
    noveltyCoverage: n("noveltyCoverage", 0, 1),
  };

  if (result.criticalWeeks >= result.lowWeeks) {
    errs.push("criticalWeeks must be < lowWeeks");
  }
  if (result.lowWeeks >= result.highWeeks) {
    errs.push("lowWeeks must be < highWeeks");
  }

  if (errs.length > 0) return fail(errs.join("; "));
  return ok(result);
}

// ─── Freshness Thresholds ──────────────────────────────────────────────────

export function validateFreshnessThresholds(v: unknown): ValidationResult<FreshnessThresholds> {
  if (!isObject(v)) return fail("expected object");
  const stale = v.staleMinutes;
  const risk = v.riskMinutes;
  if (!isPositiveInt(stale)) return fail("staleMinutes: expected positive integer");
  if (!isPositiveInt(risk)) return fail("riskMinutes: expected positive integer");
  if (risk <= stale) return fail("riskMinutes must be > staleMinutes");
  return ok({ staleMinutes: stale, riskMinutes: risk });
}

export function validateFreshnessConfig(v: unknown): ValidationResult<FreshnessConfig> {
  if (!isObject(v)) return fail("expected object");

  const sourceThresholds: Record<string, FreshnessThresholds> = {};
  const st = v.sourceThresholds;
  if (!isObject(st)) return fail("sourceThresholds: expected object");

  for (const [key, val] of Object.entries(st)) {
    const r = validateFreshnessThresholds(val);
    if (!r.ok) return fail(`sourceThresholds.${key}: ${r.error}`);
    sourceThresholds[key] = r.value;
  }

  const dt = validateFreshnessThresholds(v.defaultThresholds);
  if (!dt.ok) return fail(`defaultThresholds: ${dt.error}`);

  return ok({ sourceThresholds, defaultThresholds: dt.value });
}

// ─── Executive ─────────────────────────────────────────────────────────────

export function validateExecutiveConfig(v: unknown): ValidationResult<ExecutiveConfig> {
  if (!isObject(v)) return fail("expected object");
  const target = v.annualTargetFallback;
  const factor = v.lyBudgetFactor;
  if (!isNumber(target) || target <= 0) return fail("annualTargetFallback: expected positive number");
  if (!isNumber(factor) || factor < 0 || factor > 1) return fail("lyBudgetFactor: expected 0-1");
  return ok({ annualTargetFallback: target, lyBudgetFactor: factor });
}

// ─── Margin ────────────────────────────────────────────────────────────────

export function validateMarginConfig(v: unknown): ValidationResult<MarginConfig> {
  if (!isObject(v)) return fail("expected object");
  const errs: string[] = [];
  const n = numericField(v, errs);

  const result: MarginConfig = {
    b2cHealthy: n("b2cHealthy", 0, 100),
    b2cModerate: n("b2cModerate", 0, 100),
    b2bHealthy: n("b2bHealthy", 0, 100),
    b2bModerate: n("b2bModerate", 0, 100),
  };

  if (result.b2cModerate >= result.b2cHealthy) errs.push("b2cModerate must be < b2cHealthy");
  if (result.b2bModerate >= result.b2bHealthy) errs.push("b2bModerate must be < b2bHealthy");

  if (errs.length > 0) return fail(errs.join("; "));
  return ok(result);
}

// ─── Store Config Row ──────────────────────────────────────────────────────

const VALID_CLUSTERS = new Set(["A", "B", "OUT"]);

export function validateStoreConfigRow(v: unknown): ValidationResult<StoreConfigRow> {
  if (!isObject(v)) return fail("expected object");

  const code = v.storeCode;
  if (!isString(code) || code.length === 0) return fail("storeCode: expected non-empty string");

  const cluster = v.cluster;
  if (!isString(cluster) || !VALID_CLUSTERS.has(cluster)) {
    return fail(`cluster: expected A, B, or OUT`);
  }

  const assortment = v.assortment;
  if (assortment !== null && assortment !== undefined) {
    if (!isNumber(assortment) || !Number.isInteger(assortment) || assortment <= 0) {
      return fail("assortment: expected positive integer or null");
    }
  }

  const timeRestriction = v.timeRestriction;
  if (timeRestriction !== null && timeRestriction !== undefined && !isString(timeRestriction)) {
    return fail("timeRestriction: expected string or null");
  }

  const isExcluded = v.isExcluded;
  if (!isBoolean(isExcluded)) return fail("isExcluded: expected boolean");

  const isB2b = v.isB2b;
  if (!isBoolean(isB2b)) return fail("isB2b: expected boolean");

  return ok({
    storeCode: code as string,
    cluster: cluster as StoreConfigRow["cluster"],
    assortment: (assortment as number | null) ?? null,
    timeRestriction: (timeRestriction as string | null) ?? null,
    isExcluded: isExcluded as boolean,
    isB2b: isB2b as boolean,
  });
}

// ─── Commission Scale ──────────────────────────────────────────────────────

const VALID_CHANNELS = new Set(["mayorista", "utp", "retail"]);
const VALID_TYPES = new Set(["percentage", "fixed"]);

export function validateCommissionTier(v: unknown): ValidationResult<CommissionTier> {
  if (!isObject(v)) return fail("expected object");

  const minPct = v.minPct;
  if (!isNumber(minPct) || minPct < 0) return fail("minPct: expected number >= 0");

  // maxPct can be Infinity or null (BD representation)
  let maxPct: number;
  if (v.maxPct === null || v.maxPct === undefined) {
    maxPct = Infinity;
  } else if (isNumber(v.maxPct) && v.maxPct > 0) {
    maxPct = v.maxPct;
  } else {
    return fail("maxPct: expected positive number or null");
  }

  if (maxPct <= minPct) return fail("maxPct must be > minPct");

  const value = v.value;
  if (!isNumber(value) || value < 0) return fail("value: expected number >= 0");

  return ok({ minPct, maxPct, value });
}

export function validateCommissionScale(v: unknown): ValidationResult<CommissionScale> {
  if (!isObject(v)) return fail("expected object");

  if (!isString(v.role) || v.role.length === 0) return fail("role: expected non-empty string");
  if (!isString(v.channel) || !VALID_CHANNELS.has(v.channel)) return fail("channel: expected mayorista, utp, or retail");
  if (!isString(v.type) || !VALID_TYPES.has(v.type)) return fail("type: expected percentage or fixed");
  if (!isString(v.label) || v.label.length === 0) return fail("label: expected non-empty string");

  if (!Array.isArray(v.tiers) || v.tiers.length < 2) return fail("tiers: expected array with >= 2 elements");

  const tiers: CommissionTier[] = [];
  for (let i = 0; i < v.tiers.length; i++) {
    const r = validateCommissionTier(v.tiers[i]);
    if (!r.ok) return fail(`tiers[${i}]: ${r.error}`);
    tiers.push(r.value);
  }

  // Tiers must be ascending
  for (let i = 1; i < tiers.length; i++) {
    if (tiers[i].minPct < tiers[i - 1].minPct) {
      return fail(`tiers: not ascending at index ${i}`);
    }
  }

  // First tier must start at 0
  if (tiers[0].minPct !== 0) return fail("tiers: first tier must start at minPct 0");

  // Last tier must go to Infinity
  if (tiers[tiers.length - 1].maxPct !== Infinity) {
    return fail("tiers: last tier maxPct must be Infinity (null in JSON)");
  }

  return ok({
    role: v.role as CommissionScale["role"],
    channel: v.channel as CommissionScale["channel"],
    type: v.type as CommissionScale["type"],
    label: v.label as string,
    tiers,
  });
}

// ─── App Param (generic key/value) ─────────────────────────────────────────

/** Validate a single numeric param from app_params */
export function validateNumericParam(
  v: unknown,
  min: number,
  max: number,
): ValidationResult<number> {
  if (!isNumber(v)) return fail("expected number");
  if (v < min || v > max) return fail(`out of range [${min},${max}]`);
  return ok(v);
}
