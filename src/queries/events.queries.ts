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
