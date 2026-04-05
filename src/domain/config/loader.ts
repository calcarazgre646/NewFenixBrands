/**
 * domain/config/loader.ts
 *
 * Resolución de configuración: remota → validación → fallback.
 * Sin React, sin I/O. Solo funciones puras de resolución.
 *
 * Patrón:
 *   1. Buscar en config remota
 *   2. Si existe, validar
 *   3. Si válido, retornar remoto
 *   4. Si inválido o ausente, retornar fallback
 *   5. Loguear warnings cuando corresponda
 */
import type { ValidationResult } from "./schemas";
import type { StoreConfig } from "./types";
import type { CommissionScale, CommissionRole } from "@/domain/commissions/types";
import { validateStoreConfigRow, validateCommissionScale } from "./schemas";

// ─── Generic param resolver ────────────────────────────────────────────────

/**
 * Resuelve un parámetro de configuración con validación y fallback.
 *
 * @param params  Map de app_params cargados (key → value parsed de JSONB)
 * @param key     Key a buscar
 * @param validate  Función de validación que retorna ValidationResult<T>
 * @param fallback  Valor hardcoded por defecto
 * @returns El valor remoto si existe y es válido, fallback si no
 */
export function resolveParam<T>(
  params: Map<string, unknown>,
  key: string,
  validate: (v: unknown) => ValidationResult<T>,
  fallback: T,
): T {
  const raw = params.get(key);

  // Key no existe en remoto — happy path durante migración incremental
  if (raw === undefined) return fallback;

  const result = validate(raw);
  if (!result.ok) {
    console.warn(`[config] Invalid "${key}": ${result.error} → using fallback`);
    return fallback;
  }

  return result.value;
}

// ─── Store config resolver ─────────────────────────────────────────────────

/**
 * Resuelve config de tiendas desde filas remotas o fallback hardcoded.
 * Filas inválidas se descartan con warning (no bloquean las válidas).
 */
export function resolveStoreConfig(
  rows: unknown[] | null,
  fallback: StoreConfig,
): StoreConfig {
  if (!rows || rows.length === 0) return fallback;

  const clusters: Record<string, StoreConfig["clusters"][string]> = {};
  const assortments: Record<string, number> = {};
  const timeRestrictions: Record<string, string> = {};
  const excludedStores = new Set<string>();
  const b2bStores = new Set<string>();

  let validCount = 0;

  for (const raw of rows) {
    const result = validateStoreConfigRow(raw);
    if (!result.ok) {
      console.warn(`[config] Invalid store row: ${result.error}`, raw);
      continue;
    }
    const row = result.value;
    validCount++;

    clusters[row.storeCode] = row.cluster;
    if (row.assortment !== null) assortments[row.storeCode] = row.assortment;
    if (row.timeRestriction !== null) timeRestrictions[row.storeCode] = row.timeRestriction;
    if (row.isExcluded) excludedStores.add(row.storeCode);
    if (row.isB2b) b2bStores.add(row.storeCode);
  }

  if (validCount === 0) {
    console.warn("[config] No valid store config rows → using fallback");
    return fallback;
  }

  return { clusters, assortments, timeRestrictions, excludedStores, b2bStores };
}

// ─── Commission scales resolver ────────────────────────────────────────────

/**
 * Resuelve escalas de comisión desde filas remotas o fallback hardcoded.
 *
 * Las filas remotas tienen tiers en JSONB. maxPct=null se transforma a Infinity
 * en la validación de CommissionTier.
 */
export function resolveCommissionScales(
  rows: unknown[] | null,
  fallback: Record<string, CommissionScale>,
): Record<CommissionRole, CommissionScale> {
  if (!rows || rows.length === 0) {
    return fallback as Record<CommissionRole, CommissionScale>;
  }

  const overrides: Record<string, CommissionScale> = {};
  let validCount = 0;

  for (const raw of rows) {
    const result = validateCommissionScale(raw);
    if (!result.ok) {
      console.warn(`[config] Invalid commission scale: ${result.error}`, raw);
      continue;
    }
    overrides[result.value.role] = result.value;
    validCount++;
  }

  if (validCount === 0) {
    console.warn("[config] No valid commission scales → using fallback");
    return fallback as Record<CommissionRole, CommissionScale>;
  }

  // Merge: remote overrides + fallback for any missing roles
  return { ...fallback, ...overrides } as Record<CommissionRole, CommissionScale>;
}
