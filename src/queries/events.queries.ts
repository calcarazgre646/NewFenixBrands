/**
 * queries/events.queries.ts
 *
 * Capa de datos para el "Event Operational App" (Fase A).
 *
 * Tablas:
 *   - calendar_event_skus      — SKUs (style-color) vinculados a un evento
 *   - calendar_event_stores    — tiendas que participan del evento
 *   - allocation_proposals     — propuestas de allocation versionadas
 *
 * BD: authClient (instancia AUTH uxtzzcjimvapjpkeruwb).
 */
import { authClient } from "@/api/client";
import type {
  AllocationLine,
  AllocationProposal,
  AllocationProposalStatus,
  EventSku,
  EventSkuIntent,
  EventStore,
  EventStoreRole,
} from "@/domain/events/types";
import type {
  EventDecisionActionInput,
  EventDecisionRunInput,
} from "@/domain/events/closedLoop";

// ─── Row types (snake_case BD → camelCase domain) ────────────────────────────

interface DbEventSkuRow {
  id: string;
  event_id: string;
  sku_comercial: string;
  brand: string;
  intent: EventSkuIntent;
  notes: string | null;
  created_at: string;
}

interface DbEventStoreRow {
  id: string;
  event_id: string;
  store_code: string;
  role: EventStoreRole;
  created_at: string;
}

interface DbAllocationProposalRow {
  id: string;
  event_id: string;
  version: number;
  status: AllocationProposalStatus;
  generated_at: string;
  generated_by: string | null;
  config_version_id: string | null;
  payload: AllocationLine[];
  total_lines: number;
  total_units: number;
  readiness_pct: number | null;
  notes: string | null;
  approved_at: string | null;
  approved_by: string | null;
}

// ─── Mappers ─────────────────────────────────────────────────────────────────

function toEventSku(row: DbEventSkuRow): EventSku {
  return {
    id: row.id,
    eventId: row.event_id,
    skuComercial: row.sku_comercial,
    brand: row.brand,
    intent: row.intent,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

function toEventStore(row: DbEventStoreRow): EventStore {
  return {
    id: row.id,
    eventId: row.event_id,
    storeCode: row.store_code,
    role: row.role,
    createdAt: row.created_at,
  };
}

function toAllocationProposal(row: DbAllocationProposalRow): AllocationProposal {
  return {
    id: row.id,
    eventId: row.event_id,
    version: row.version,
    status: row.status,
    generatedAt: row.generated_at,
    generatedBy: row.generated_by,
    configVersionId: row.config_version_id,
    payload: row.payload ?? [],
    totalLines: row.total_lines,
    totalUnits: row.total_units,
    readinessPct: row.readiness_pct,
    notes: row.notes,
    approvedAt: row.approved_at,
    approvedBy: row.approved_by,
  };
}

// ─── Event SKUs ──────────────────────────────────────────────────────────────

export async function fetchEventSkus(eventId: string): Promise<EventSku[]> {
  const { data, error } = await authClient
    .from("calendar_event_skus")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Error cargando SKUs del evento: ${error.message}`);
  return (data as DbEventSkuRow[] | null)?.map(toEventSku) ?? [];
}

export interface AddEventSkuInput {
  eventId: string;
  skuComercial: string;
  brand: string;
  intent?: EventSkuIntent;
  notes?: string | null;
}

export async function addEventSkus(inputs: AddEventSkuInput[]): Promise<EventSku[]> {
  if (inputs.length === 0) return [];
  const rows = inputs.map((i) => ({
    event_id: i.eventId,
    sku_comercial: i.skuComercial,
    brand: i.brand,
    intent: i.intent ?? "sale",
    notes: i.notes ?? null,
  }));
  const { data, error } = await authClient
    .from("calendar_event_skus")
    .insert(rows)
    .select("*");
  if (error) throw new Error(`Error agregando SKUs: ${error.message}`);
  return (data as DbEventSkuRow[]).map(toEventSku);
}

export async function removeEventSku(id: string): Promise<void> {
  const { error } = await authClient.from("calendar_event_skus").delete().eq("id", id);
  if (error) throw new Error(`Error eliminando SKU: ${error.message}`);
}

// ─── Event Stores ────────────────────────────────────────────────────────────

export async function fetchEventStores(eventId: string): Promise<EventStore[]> {
  const { data, error } = await authClient
    .from("calendar_event_stores")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Error cargando tiendas del evento: ${error.message}`);
  return (data as DbEventStoreRow[] | null)?.map(toEventStore) ?? [];
}

export interface AddEventStoreInput {
  eventId: string;
  storeCode: string;
  role?: EventStoreRole;
}

export async function addEventStores(inputs: AddEventStoreInput[]): Promise<EventStore[]> {
  if (inputs.length === 0) return [];
  const rows = inputs.map((i) => ({
    event_id: i.eventId,
    store_code: i.storeCode,
    role: i.role ?? "activation",
  }));
  const { data, error } = await authClient
    .from("calendar_event_stores")
    .insert(rows)
    .select("*");
  if (error) throw new Error(`Error agregando tiendas: ${error.message}`);
  return (data as DbEventStoreRow[]).map(toEventStore);
}

export async function removeEventStore(id: string): Promise<void> {
  const { error } = await authClient.from("calendar_event_stores").delete().eq("id", id);
  if (error) throw new Error(`Error eliminando tienda: ${error.message}`);
}

// ─── Allocation Proposals ────────────────────────────────────────────────────

export async function fetchAllocationProposals(eventId: string): Promise<AllocationProposal[]> {
  const { data, error } = await authClient
    .from("allocation_proposals")
    .select("*")
    .eq("event_id", eventId)
    .order("version", { ascending: false });
  if (error) throw new Error(`Error cargando propuestas: ${error.message}`);
  return (data as DbAllocationProposalRow[] | null)?.map(toAllocationProposal) ?? [];
}

export interface CreateAllocationProposalInput {
  eventId: string;
  generatedBy: string | null;
  configVersionId?: string | null;
  payload: AllocationLine[];
  totalLines: number;
  totalUnits: number;
  readinessPct: number | null;
  notes?: string | null;
}

/**
 * Crea propuesta y devuelve la fila completa.
 * La versión se asigna client-side: max(version)+1.
 */
export async function createAllocationProposal(
  input: CreateAllocationProposalInput,
): Promise<AllocationProposal> {
  // Determinar próxima versión
  const { data: existing, error: maxErr } = await authClient
    .from("allocation_proposals")
    .select("version")
    .eq("event_id", input.eventId)
    .order("version", { ascending: false })
    .limit(1);
  if (maxErr) throw new Error(`Error consultando versión: ${maxErr.message}`);
  const nextVersion =
    ((existing as { version: number }[] | null)?.[0]?.version ?? 0) + 1;

  const { data, error } = await authClient
    .from("allocation_proposals")
    .insert({
      event_id: input.eventId,
      version: nextVersion,
      status: "draft",
      generated_by: input.generatedBy,
      config_version_id: input.configVersionId ?? null,
      payload: input.payload,
      total_lines: input.totalLines,
      total_units: input.totalUnits,
      readiness_pct: input.readinessPct,
      notes: input.notes ?? null,
    })
    .select("*")
    .single();
  if (error) throw new Error(`Error creando propuesta: ${error.message}`);
  return toAllocationProposal(data as DbAllocationProposalRow);
}

export async function approveAllocationProposal(
  id: string,
  approvedBy: string,
): Promise<AllocationProposal> {
  const nowIso = new Date().toISOString();
  const { data, error } = await authClient
    .from("allocation_proposals")
    .update({
      status: "approved" satisfies AllocationProposalStatus,
      approved_at: nowIso,
      approved_by: approvedBy,
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(`Error aprobando propuesta: ${error.message}`);
  return toAllocationProposal(data as DbAllocationProposalRow);
}

export async function rejectAllocationProposal(id: string): Promise<AllocationProposal> {
  const { data, error } = await authClient
    .from("allocation_proposals")
    .update({ status: "rejected" satisfies AllocationProposalStatus })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(`Error rechazando propuesta: ${error.message}`);
  return toAllocationProposal(data as DbAllocationProposalRow);
}

// ─── Decision history per event (Fase C) ────────────────────────────────────

export interface EventDecisionRunSummary {
  id: string;
  triggeredAt: string;
  triggeredBy: string;
  totalActions: number;
  totalImpactGs: number;
  criticalCount: number;
  proposalVersion: number | null;
  readinessPctAtApproval: number | null;
}

export interface EventDecisionActionSnapshot {
  id: string;
  rank: number;
  sku: string;
  skuComercial: string;
  talle: string;
  brand: string;
  store: string;
  targetStore: string | null;
  currentStock: number;
  suggestedUnits: number;
  waterfallLevel: string;
  actionType: string;
  recommendedAction: string;
  impactScore: number;
  risk: string;
}

interface DbDecisionRunRow {
  id: string;
  triggered_at: string;
  triggered_by: string;
  total_actions: number;
  total_impact_gs: number;
  critical_count: number;
  filters_snapshot: { eventId?: string; proposalId?: string; proposalVersion?: number } | null;
  metadata: { readinessPctAtApproval?: number | null } | null;
}

interface DbDecisionActionRow {
  id: string;
  rank: number;
  sku: string;
  sku_comercial: string;
  talle: string;
  brand: string;
  store: string;
  target_store: string | null;
  current_stock: number;
  suggested_units: number;
  waterfall_level: string;
  action_type: string;
  recommended_action: string;
  impact_score: number;
  risk: string;
}

/**
 * Trae los decision_runs de tipo event_allocation que correspondan al evento dado.
 * Filtra por filters_snapshot->>'eventId' (jsonb operator).
 */
export async function fetchEventDecisionRuns(
  eventId: string,
): Promise<EventDecisionRunSummary[]> {
  const { data, error } = await authClient
    .from("decision_runs")
    .select(
      "id, triggered_at, triggered_by, total_actions, total_impact_gs, critical_count, filters_snapshot, metadata",
    )
    .eq("run_type", "event_allocation")
    .filter("filters_snapshot->>eventId", "eq", eventId)
    .order("triggered_at", { ascending: false });
  if (error) throw new Error(`Error cargando historial de decisiones: ${error.message}`);
  return ((data as DbDecisionRunRow[] | null) ?? []).map((row) => ({
    id: row.id,
    triggeredAt: row.triggered_at,
    triggeredBy: row.triggered_by,
    totalActions: row.total_actions,
    totalImpactGs: row.total_impact_gs,
    criticalCount: row.critical_count,
    proposalVersion: row.filters_snapshot?.proposalVersion ?? null,
    readinessPctAtApproval: row.metadata?.readinessPctAtApproval ?? null,
  }));
}

/**
 * Trae las decision_actions de un run específico (snapshot detallado).
 */
export async function fetchEventDecisionActions(
  runId: string,
): Promise<EventDecisionActionSnapshot[]> {
  const { data, error } = await authClient
    .from("decision_actions")
    .select(
      "id, rank, sku, sku_comercial, talle, brand, store, target_store, current_stock, suggested_units, waterfall_level, action_type, recommended_action, impact_score, risk",
    )
    .eq("run_id", runId)
    .order("rank", { ascending: true });
  if (error) throw new Error(`Error cargando acciones del run: ${error.message}`);
  return ((data as DbDecisionActionRow[] | null) ?? []).map((row) => ({
    id: row.id,
    rank: row.rank,
    sku: row.sku,
    skuComercial: row.sku_comercial,
    talle: row.talle,
    brand: row.brand,
    store: row.store,
    targetStore: row.target_store,
    currentStock: row.current_stock,
    suggestedUnits: row.suggested_units,
    waterfallLevel: row.waterfall_level,
    actionType: row.action_type,
    recommendedAction: row.recommended_action,
    impactScore: row.impact_score,
    risk: row.risk,
  }));
}

// ─── Cross-event conflicts (Fase B) ──────────────────────────────────────────

export interface SkuConflict {
  skuComercial: string;
  conflictingEvents: { eventId: string; title: string; startDate: string; endDate: string | null }[];
}

/**
 * Para los SKUs dados, encuentra otros eventos del calendario activos (end_date >= today
 * o end_date null) que también tengan vinculados esos SKUs.
 * Excluye el eventId actual.
 */
export async function fetchSkuConflicts(
  eventId: string,
  skuComerciales: string[],
): Promise<SkuConflict[]> {
  if (skuComerciales.length === 0) return [];
  const todayIso = new Date().toISOString().slice(0, 10);

  // 1. Buscar event_skus que matcheen los skus, excluyendo el evento actual
  const { data: skuRows, error: skuErr } = await authClient
    .from("calendar_event_skus")
    .select("event_id, sku_comercial")
    .in("sku_comercial", skuComerciales)
    .neq("event_id", eventId);
  if (skuErr) throw new Error(`Error consultando conflictos SKU: ${skuErr.message}`);
  if (!skuRows || skuRows.length === 0) return [];

  const otherEventIds = Array.from(new Set((skuRows as { event_id: string }[]).map((r) => r.event_id)));

  // 2. Traer los eventos referidos, filtrar por end_date (activos o sin fecha fin)
  const { data: eventRows, error: evErr } = await authClient
    .from("calendar_events")
    .select("id, title, start_date, end_date")
    .in("id", otherEventIds);
  if (evErr) throw new Error(`Error consultando eventos: ${evErr.message}`);
  type EvRow = { id: string; title: string; start_date: string; end_date: string | null };
  const activeEvents = ((eventRows as EvRow[] | null) ?? []).filter((e) => {
    return e.end_date === null || e.end_date >= todayIso;
  });
  const activeIds = new Set(activeEvents.map((e) => e.id));
  const evById = new Map(activeEvents.map((e) => [e.id, e]));

  // 3. Agrupar por SKU
  const grouped = new Map<string, SkuConflict>();
  for (const row of skuRows as { event_id: string; sku_comercial: string }[]) {
    if (!activeIds.has(row.event_id)) continue;
    const ev = evById.get(row.event_id)!;
    const existing = grouped.get(row.sku_comercial) ?? {
      skuComercial: row.sku_comercial,
      conflictingEvents: [],
    };
    if (!existing.conflictingEvents.some((e) => e.eventId === row.event_id)) {
      existing.conflictingEvents.push({
        eventId: ev.id,
        title: ev.title,
        startDate: ev.start_date,
        endDate: ev.end_date,
      });
    }
    grouped.set(row.sku_comercial, existing);
  }

  return Array.from(grouped.values());
}

// ─── Closed-loop persistence (Fase B) ────────────────────────────────────────

/**
 * Crea un decision_run de tipo event_allocation y devuelve el id.
 * Mapea camelCase del domain a snake_case de la BD.
 */
export async function createEventDecisionRun(
  input: EventDecisionRunInput,
): Promise<string> {
  const { data, error } = await authClient
    .from("decision_runs")
    .insert({
      run_type: input.runType,
      triggered_by: input.triggeredBy,
      filters_snapshot: input.filtersSnapshot,
      total_actions: input.totalActions,
      total_gap_units: input.totalGapUnits,
      total_impact_gs: input.totalImpactGs,
      pareto_count: input.paretoCount,
      critical_count: input.criticalCount,
      metadata: input.metadata,
    })
    .select("id")
    .single();
  if (error) throw new Error(`Error creando decision_run: ${error.message}`);
  return (data as { id: string }).id;
}

/**
 * Inserta múltiples decision_actions con run_id ya conocido.
 * Mapea camelCase del domain a snake_case de la BD.
 */
export async function bulkInsertEventDecisionActions(
  runId: string,
  actions: EventDecisionActionInput[],
): Promise<void> {
  if (actions.length === 0) return;
  const rows = actions.map((a) => ({
    run_id: runId,
    rank: a.rank,
    sku: a.sku,
    sku_comercial: a.skuComercial,
    talle: a.talle,
    brand: a.brand,
    description: a.description,
    store: a.store,
    target_store: a.targetStore,
    current_stock: a.currentStock,
    suggested_units: a.suggestedUnits,
    ideal_units: a.idealUnits,
    gap_units: a.gapUnits,
    days_of_inventory: a.daysOfInventory,
    historical_avg: a.historicalAvg,
    cover_weeks: a.coverWeeks,
    current_mos: a.currentMos,
    risk: a.risk,
    waterfall_level: a.waterfallLevel,
    action_type: a.actionType,
    impact_score: a.impactScore,
    pareto_flag: a.paretoFlag,
    recommended_action: a.recommendedAction,
    status: a.status,
    reviewed_by: a.reviewedBy,
    reviewed_at: new Date().toISOString(),
    calendar_event_id: a.calendarEventId,
    allocation_proposal_id: a.allocationProposalId,
  }));
  const { error } = await authClient.from("decision_actions").insert(rows);
  if (error) throw new Error(`Error insertando decision_actions: ${error.message}`);
}
