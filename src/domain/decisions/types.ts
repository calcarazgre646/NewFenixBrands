/**
 * domain/decisions/types.ts
 *
 * Tipos puros para el sistema de trazabilidad de decisiones.
 * Mapean 1:1 con las columnas de decision_runs, decision_actions, config_versions.
 */

// ─── Decision Runs ──────────────────────────────────────────────────────────

export interface DecisionRunInsert {
  run_type: "waterfall" | "purchase_planning" | "commissions";
  triggered_by: string;
  filters_snapshot: Record<string, unknown>;
  config_version_id?: string | null;
  total_actions: number;
  total_gap_units: number;
  total_impact_gs: number;
  pareto_count: number;
  critical_count: number;
  computation_ms?: number | null;
  inventory_row_count?: number | null;
  sales_history_row_count?: number | null;
  doi_age_row_count?: number | null;
  metadata?: Record<string, unknown> | null;
}

export interface DecisionRun extends DecisionRunInsert {
  id: string;
  triggered_at: string;
}

// ─── Decision Actions ───────────────────────────────────────────────────────

export interface DecisionActionInsert {
  run_id: string;
  rank: number;
  sku: string;
  sku_comercial?: string | null;
  talle: string;
  brand: string;
  description?: string | null;
  linea?: string | null;
  categoria?: string | null;
  store: string;
  target_store?: string | null;
  store_cluster?: string | null;
  current_stock: number;
  suggested_units: number;
  ideal_units: number;
  gap_units: number;
  days_of_inventory: number;
  historical_avg: number;
  cover_weeks: number;
  current_mos: number;
  risk: "critical" | "low" | "balanced" | "overstock";
  waterfall_level: "store_to_store" | "depot_to_store" | "central_to_depot" | "central_to_b2b";
  action_type: string;
  impact_score: number;
  pareto_flag: boolean;
  recommended_action: string;
}

export interface DecisionAction extends DecisionActionInsert {
  id: string;
  status: "pending" | "approved" | "rejected" | "executed" | "expired";
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  review_notes?: string | null;
  executed_at?: string | null;
  executed_by?: string | null;
  created_at: string;
}

// ─── Config Versions ────────────────────────────────────────────────────────

export interface ConfigVersionInsert {
  created_by: string;
  app_params_snapshot: Record<string, unknown>[];
  store_config_snapshot: Record<string, unknown>[];
  commission_snapshot: Record<string, unknown>[];
  changes_diff?: ConfigChange[] | null;
  reason?: string | null;
  is_active?: boolean;
}

export interface ConfigVersion extends ConfigVersionInsert {
  id: string;
  created_at: string;
  is_active: boolean;
}

// ─── Config Diff ────────────────────────────────────────────────────────────

export interface ConfigChange {
  table: "app_params" | "config_store" | "config_commission_scale";
  key: string;
  field: string;
  old: unknown;
  new: unknown;
}
