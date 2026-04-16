/**
 * queries/decisions.queries.ts
 *
 * Persistencia de decision runs y actions en authClient.
 * Fire-and-forget: si falla, la UI sigue funcionando.
 *
 * REGLA: Solo fetch + persistencia, sin lógica de negocio.
 */
import { authClient } from "@/api/client";
import type {
  DecisionRunInsert,
  DecisionRun,
  DecisionAction,
  ConfigVersion,
  ConfigChange,
} from "@/domain/decisions/types";
import { computeConfigDiff } from "@/domain/decisions/diff";
import type { ActionItemFull } from "@/domain/actionQueue/waterfall";

// ─── Decision Runs ──────────────────────────────────────────────────────────

/**
 * Persist a decision run and return the generated runId.
 */
export async function persistDecisionRun(
  params: DecisionRunInsert,
): Promise<string> {
  const { data, error } = await authClient
    .from("decision_runs")
    .insert(params)
    .select("id")
    .single();

  if (error) throw new Error(`[decision-persist] run insert failed: ${error.message}`);
  return data.id as string;
}

// ─── Decision Actions ───────────────────────────────────────────────────────

const BATCH_SIZE = 100;

/**
 * Persist decision actions in batches of 100.
 * Maps ActionItemFull → decision_actions row.
 */
export async function persistDecisionActions(
  runId: string,
  actions: ActionItemFull[],
): Promise<void> {
  const rows = actions.map((item) => ({
    run_id: runId,
    rank: item.rank,
    sku: item.sku,
    sku_comercial: item.skuComercial || null,
    talle: item.talle,
    brand: item.brand,
    description: item.description || null,
    linea: item.linea || null,
    categoria: item.categoria || null,
    store: item.store,
    target_store: item.targetStore || null,
    store_cluster: item.storeCluster || null,
    current_stock: item.currentStock,
    suggested_units: item.suggestedUnits,
    ideal_units: item.idealUnits,
    gap_units: item.gapUnits,
    days_of_inventory: item.daysOfInventory,
    historical_avg: item.historicalAvg,
    cover_weeks: item.coverWeeks,
    current_mos: item.currentMOS,
    risk: item.risk,
    waterfall_level: item.waterfallLevel,
    action_type: item.actionType,
    impact_score: item.impactScore,
    pareto_flag: item.paretoFlag,
    recommended_action: item.recommendedAction,
  }));

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await authClient
      .from("decision_actions")
      .insert(batch);

    if (error) {
      throw new Error(`[decision-persist] actions batch ${i / BATCH_SIZE} failed: ${error.message}`);
    }
  }
}

// ─── Config Versions ────────────────────────────────────────────────────────

/**
 * Fetch the currently active config version (most recent with is_active=true).
 */
export async function fetchActiveConfigVersion(): Promise<ConfigVersion | null> {
  const { data, error } = await authClient
    .from("config_versions")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn("[decision-persist] fetchActiveConfigVersion error:", error.message);
    return null;
  }
  return data as ConfigVersion | null;
}

/**
 * Snapshot the current config state, compute diff vs previous version,
 * deactivate previous, and insert the new version.
 * Returns the new version ID.
 */
export async function snapshotCurrentConfig(
  userId: string,
  reason?: string,
): Promise<string> {
  // Fetch current config from the 3 tables
  const [appParamsRes, storeConfigRes, commissionRes] = await Promise.all([
    authClient.from("app_params").select("*"),
    authClient.from("config_store").select("*"),
    authClient.from("config_commission_scale").select("*"),
  ]);

  const appParams = (appParamsRes.data ?? []) as Record<string, unknown>[];
  const storeConfig = (storeConfigRes.data ?? []) as Record<string, unknown>[];
  const commissionConfig = (commissionRes.data ?? []) as Record<string, unknown>[];

  // Compute diff vs previous active version
  let changesDiff: ConfigChange[] | null = null;
  const previous = await fetchActiveConfigVersion();
  if (previous) {
    changesDiff = computeConfigDiff(
      {
        appParams: previous.app_params_snapshot as unknown as Record<string, unknown>[],
        storeConfig: previous.store_config_snapshot as unknown as Record<string, unknown>[],
        commissionConfig: previous.commission_snapshot as unknown as Record<string, unknown>[],
      },
      { appParams, storeConfig, commissionConfig },
    );

    // Deactivate previous version
    await authClient
      .from("config_versions")
      .update({ is_active: false })
      .eq("id", previous.id);
  }

  // Insert new version
  const { data, error } = await authClient
    .from("config_versions")
    .insert({
      created_by: userId,
      app_params_snapshot: appParams,
      store_config_snapshot: storeConfig,
      commission_snapshot: commissionConfig,
      changes_diff: changesDiff,
      reason: reason ?? null,
      is_active: true,
    })
    .select("id")
    .single();

  if (error) throw new Error(`[decision-persist] config version insert failed: ${error.message}`);
  return data.id as string;
}

// ─── Read queries (for Fase D) ──────────────────────────────────────────────

/**
 * Fetch recent decision runs, newest first.
 */
export async function fetchDecisionRuns(limit = 50): Promise<DecisionRun[]> {
  const { data, error } = await authClient
    .from("decision_runs")
    .select("*")
    .order("triggered_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.warn("[decision-persist] fetchDecisionRuns error:", error.message);
    return [];
  }
  return (data ?? []) as DecisionRun[];
}

/**
 * Fetch all actions for a given run.
 */
export async function fetchDecisionActions(runId: string): Promise<DecisionAction[]> {
  const { data, error } = await authClient
    .from("decision_actions")
    .select("*")
    .eq("run_id", runId)
    .order("rank", { ascending: true });

  if (error) {
    console.warn("[decision-persist] fetchDecisionActions error:", error.message);
    return [];
  }
  return (data ?? []) as DecisionAction[];
}
