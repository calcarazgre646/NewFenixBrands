/**
 * queries/config.queries.ts
 *
 * Fetch de configuración de negocio desde Supabase.
 * Las tablas viven en authClient (BD de la app, no la operacional del ERP).
 *
 * Si la tabla no existe todavía (pre-migración SQL), retorna null
 * y el loader usa los defaults hardcoded.
 */
import { authClient } from "@/api/client";

// ─── App Params ────────────────────────────────────────────────────────────

interface AppParamRow {
  key: string;
  value: unknown; // JSONB parsed by Supabase client
}

/**
 * Fetch all app_params → Map<key, value>.
 * Returns empty Map if table doesn't exist or query fails.
 */
export async function fetchAppParams(): Promise<Map<string, unknown>> {
  const { data, error } = await authClient
    .from("app_params")
    .select("key, value");

  if (error) {
    // Table doesn't exist yet → expected during incremental migration
    if (error.code === "42P01" || error.message.includes("does not exist")) {
      return new Map();
    }
    console.warn("[config] fetchAppParams error:", error.message);
    return new Map();
  }

  const map = new Map<string, unknown>();
  for (const row of (data ?? []) as AppParamRow[]) {
    map.set(row.key, row.value);
  }
  return map;
}

// ─── Store Config ──────────────────────────────────────────────────────────

/**
 * Fetch all config_store rows.
 * Returns null if table doesn't exist.
 */
export async function fetchStoreConfig(): Promise<unknown[] | null> {
  const { data, error } = await authClient
    .from("config_store")
    .select("store_code, cluster, assortment, time_restriction, is_excluded, is_b2b");

  if (error) {
    if (error.code === "42P01" || error.message.includes("does not exist")) {
      return null;
    }
    console.warn("[config] fetchStoreConfig error:", error.message);
    return null;
  }

  // Map snake_case DB columns → camelCase for validation
  return (data ?? []).map((row: Record<string, unknown>) => ({
    storeCode: row.store_code,
    cluster: row.cluster,
    assortment: row.assortment,
    timeRestriction: row.time_restriction,
    isExcluded: row.is_excluded,
    isB2b: row.is_b2b,
  }));
}

// ─── Commission Scales ─────────────────────────────────────────────────────

/**
 * Fetch all config_commission_scale rows.
 * Returns null if table doesn't exist.
 */
export async function fetchCommissionScales(): Promise<unknown[] | null> {
  const { data, error } = await authClient
    .from("config_commission_scale")
    .select("role, channel, type, label, tiers");

  if (error) {
    if (error.code === "42P01" || error.message.includes("does not exist")) {
      return null;
    }
    console.warn("[config] fetchCommissionScales error:", error.message);
    return null;
  }

  return data ?? null;
}
