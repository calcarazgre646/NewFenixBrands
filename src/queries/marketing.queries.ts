/**
 * queries/marketing.queries.ts
 *
 * Fetch + CRUD para las tablas SAM (Motor de Marketing).
 *
 * Lectura CLIENT DB (dataClient, read-only): CLIM100, transacciones, cobranzas.
 * Lectura/Escritura AUTH DB (authClient): sam_customers, sam_triggers, etc.
 *
 * REGLA: Solo fetch + normalización. Sin lógica de negocio.
 */
import { dataClient, authClient } from "@/api/client";
import { trimStr, toNum } from "@/api/normalize";
import { fetchAllRows } from "@/queries/paginate";
import type {
  SamCustomer,
  SamTrigger,
  SamTemplate,
  SamExecution,
  SamSegment,
  SamCampaign,
  MessageChannel,
  MarketingMetrics,
  CustomerTier,
  TriggerCategory,
  TriggerCondition,
  TriggerInsight,
  EtlStats,
  ExecutionStatus,
  CampaignStatus,
  SegmentFilter,
  SamEmailConfig,
  SamEmailEvent,
  ExecutionWithEvents,
  SendTestEmailInput,
  SendTestEmailResult,
} from "@/domain/marketing/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

/** Convert "DD/MM/YYYY" → "YYYY-MM-DD" (ISO). Falls back to raw string. */
function parseDdMmYyyy(raw: string): string {
  const parts = raw.split("/");
  if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
  return raw;
}

// ─── CLIENT DB (read-only) — CRM ─────────────────────────────────────────────

/**
 * Fetch all CLIM100 rows (82K+ clientes).
 *
 * Columnas reales de la tabla (docs/SUPABASE_SCHEMA.md):
 *   Codigo, RUC, Razon_social, Telefono1, Correo, Tipo_cliente, Fecha_ingreso
 *
 * Los datos tienen padding (espacios al final) — se limpian con trimStr.
 */
export async function fetchAllClim100(): Promise<Row[]> {
  const data = await fetchAllRows<Row>(() =>
    dataClient
      .from("CLIM100")
      .select("Codigo, RUC, Razon_social, Telefono1, Correo, Tipo_cliente, Fecha_ingreso"),
  );
  return data.map((r) => ({
    c_codigo: trimStr(r.Codigo),
    c_ruc: trimStr(r.RUC),
    c_razsoc: trimStr(r.Razon_social),
    c_telefo: trimStr(r.Telefono1),
    c_email: trimStr(r.Correo),
    c_tipocl: trimStr(r.Tipo_cliente),
    c_fecing: r.Fecha_ingreso ? String(r.Fecha_ingreso) : "",
  }));
}

/**
 * Fetch transactions for ETL aggregation.
 *
 * Fuente: v_transacciones_dwh — tabla preparada para DWH pero actualmente VACÍA (0 filas).
 * Columnas reales: ruc, importe_neto, fecha_formateada, ano
 *
 * NOTA: Si la tabla está vacía, retorna [] silenciosamente.
 * Cuando Derlys cargue datos, esta función empezará a funcionar sin cambios.
 */
export async function fetchTransactionsForETL(
  year: number,
): Promise<Array<{ customerCode: string; monto: number; fecha: string }>> {
  try {
    const data = await fetchAllRows<Row>(() =>
      dataClient
        .from("v_transacciones_dwh")
        .select("ruc, importe_neto, fecha_formateada, año")
        .eq("año", String(year)),
    );
    return data.map((r) => ({
      customerCode: trimStr(r.ruc),
      monto: toNum(r.importe_neto),
      fecha: parseDdMmYyyy(trimStr(r.fecha_formateada)),
    }));
  } catch {
    // Table might be empty or have schema issues — fail gracefully
    return [];
  }
}

/**
 * Fetch pending cobranzas.
 *
 * NOTA: La tabla c_cobrar NO existe actualmente en el schema del cliente.
 * Esta función retorna [] hasta que la tabla exista.
 * Cuando el cliente la agregue, empezará a funcionar sin cambios.
 */
export async function fetchCobranzasPending(): Promise<
  Array<{ customerCode: string; pendingAmount: number }>
> {
  try {
    const data = await fetchAllRows<Row>(() =>
      dataClient
        .from("c_cobrar")
        .select("Codigo, pendiente_de_pago")
        .gt("pendiente_de_pago", 0),
    );
    return data.map((r) => ({
      customerCode: trimStr(r.Codigo),
      pendingAmount: toNum(r.pendiente_de_pago),
    }));
  } catch {
    // Table doesn't exist yet — fail gracefully
    return [];
  }
}

/**
 * Fetch returns for a year.
 *
 * NOTA: fjdhstvta1 NO tiene columna de RUC/código de cliente.
 * Solo tiene producto + sucursal + montos. No podemos cruzar devoluciones
 * con clientes individuales desde esta tabla.
 *
 * Cuando v_transacciones_dwh tenga datos (incluye ruc), se podrá cruzar.
 * Por ahora retorna [].
 */
export async function fetchReturns(
  _year: number,
): Promise<Array<{ customerCode: string; fecha: string }>> {
  // fjdhstvta1 no tiene campo de cliente — no podemos cruzar
  return [];
}

// ─── CLIENT DB (read-only) — ITR (Inventario) ───────────────────────────────

export interface MarketingInventoryItem {
  sku: string;
  description: string;
  brand: string;
  categoria: string;
  store: string;
  units: number;
  price: number;
  cost: number;
  value: number;
}

export interface InventoryHealthSummary {
  totalSkus: number;
  totalUnits: number;
  totalValue: number;
  lowStockCount: number;
  overstockCount: number;
  lowStockItems: MarketingInventoryItem[];
  overstockItems: MarketingInventoryItem[];
  byBrand: Array<{ brand: string; units: number; value: number; skuCount: number }>;
}

/**
 * Fetch inventory health for marketing decisions.
 * Uses mv_stock_tienda (same as Depots page — TanStack Query deduplicates).
 *
 * Low stock: units < 5 (candidate for "ultimas unidades" campaign)
 * Overstock: units > 100 (candidate for clearance campaign)
 */
export async function fetchInventoryForMarketing(
  brandCanonical?: string | null,
): Promise<InventoryHealthSummary> {
  const data = await fetchAllRows<Row>(() => {
    let q = dataClient
      .from("mv_stock_tienda")
      .select("store, sku, description, brand, tipo_articulo, units, price, cost, value")
      .gt("units", 0);
    if (brandCanonical) q = q.eq("brand", brandCanonical);
    return q;
  });

  const LOW_THRESHOLD = 5;
  const HIGH_THRESHOLD = 100;

  const lowStockItems: MarketingInventoryItem[] = [];
  const overstockItems: MarketingInventoryItem[] = [];
  const brandMap = new Map<string, { units: number; value: number; skus: Set<string> }>();
  let totalUnits = 0;
  let totalValue = 0;
  const skuSet = new Set<string>();

  for (const r of data) {
    const item: MarketingInventoryItem = {
      sku: trimStr(r.sku),
      description: trimStr(r.description) || "Sin descripcion",
      brand: trimStr(r.brand),
      categoria: trimStr(r.tipo_articulo) || "Sin categoria",
      store: trimStr(r.store),
      units: toNum(r.units),
      price: toNum(r.price),
      cost: toNum(r.cost),
      value: toNum(r.value),
    };

    skuSet.add(item.sku);
    totalUnits += item.units;
    totalValue += item.value;

    if (item.units <= LOW_THRESHOLD) lowStockItems.push(item);
    if (item.units >= HIGH_THRESHOLD) overstockItems.push(item);

    const b = brandMap.get(item.brand) ?? { units: 0, value: 0, skus: new Set<string>() };
    b.units += item.units;
    b.value += item.value;
    b.skus.add(item.sku);
    brandMap.set(item.brand, b);
  }

  const byBrand = Array.from(brandMap.entries())
    .map(([brand, v]) => ({ brand, units: v.units, value: v.value, skuCount: v.skus.size }))
    .sort((a, b) => b.value - a.value);

  return {
    totalSkus: skuSet.size,
    totalUnits,
    totalValue,
    lowStockCount: lowStockItems.length,
    overstockCount: overstockItems.length,
    lowStockItems: lowStockItems.sort((a, b) => a.units - b.units).slice(0, 50),
    overstockItems: overstockItems.sort((a, b) => b.units - a.units).slice(0, 50),
    byBrand,
  };
}

// ─── CLIENT DB (read-only) — PIM (Productos) + Sales Velocity ───────────────

export interface ProductPerformance {
  sku: string;
  description: string;
  brand: string;
  neto: number;
  units: number;
  weightPct: number;
}

export interface PimSummary {
  topSellers: ProductPerformance[];
  slowMovers: ProductPerformance[];
  totalProducts: number;
  byBrand: Array<{ brand: string; count: number }>;
  byType: Array<{ type: string; count: number }>;
}

/**
 * Fetch product performance for marketing decisions.
 * Crosses sales data (fjdhstvta1) with product catalog (Dim_maestro_comercial).
 *
 * Top sellers: highest revenue SKUs → promote more
 * Slow movers: lowest revenue SKUs that have stock → candidates for promotion
 */
export async function fetchProductPerformance(opts?: {
  year?: number;
  months?: number[];
  channel?: "total" | "b2c" | "b2b";
  brandCanonical?: string | null;
}): Promise<PimSummary> {
  const year = opts?.year ?? new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const months = opts?.months ?? Array.from({ length: currentMonth }, (_, i) => i + 1);
  const channels = opts?.channel === "b2c" ? ["B2C"]
    : opts?.channel === "b2b" ? ["B2B"]
    : ["B2B", "B2C"];

  // 1. Sales by SKU in the period
  const salesData = await fetchAllRows<Row>(() => {
    let q = dataClient
      .from("fjdhstvta1")
      .select("v_sku, v_descrip, v_marca, v_vtasimpu, v_cantvend")
      .eq("v_año", year)
      .in("v_mes", months)
      .in("v_canal_venta", channels);
    if (opts?.brandCanonical) q = q.eq("v_marca", opts.brandCanonical);
    return q;
  });

  // Aggregate by SKU
  const skuMap = new Map<string, { description: string; brand: string; neto: number; units: number }>();
  let totalNeto = 0;

  for (const r of salesData) {
    const sku = trimStr(r.v_sku);
    if (!sku) continue;
    const neto = toNum(r.v_vtasimpu);
    const units = toNum(r.v_cantvend);
    totalNeto += neto;

    const existing = skuMap.get(sku);
    if (existing) {
      existing.neto += neto;
      existing.units += units;
    } else {
      skuMap.set(sku, {
        description: trimStr(r.v_descrip) || "Sin descripcion",
        brand: trimStr(r.v_marca),
        neto,
        units,
      });
    }
  }

  // Build ranked list
  const allProducts: ProductPerformance[] = Array.from(skuMap.entries())
    .map(([sku, v]) => ({
      sku,
      description: v.description,
      brand: v.brand,
      neto: v.neto,
      units: v.units,
      weightPct: totalNeto > 0 ? (v.neto / totalNeto) * 100 : 0,
    }))
    .sort((a, b) => b.neto - a.neto);

  const topSellers = allProducts.slice(0, 20);
  const slowMovers = allProducts.filter((p) => p.units > 0).slice(-20).reverse();

  // 2. Product catalog summary from Dim_maestro_comercial
  let totalProducts = 0;
  const brandCount = new Map<string, number>();
  const typeCount = new Map<string, number>();

  try {
    const catalogData = await fetchAllRows<Row>(() =>
      dataClient
        .from("Dim_maestro_comercial")
        .select("codigo_unico_final, tipo_articulo"),
    );

    const seen = new Set<string>();
    for (const r of catalogData) {
      const code = trimStr(r.codigo_unico_final);
      if (!code || seen.has(code)) continue;
      seen.add(code);
      totalProducts++;
      const tipo = trimStr(r.tipo_articulo) || "Sin tipo";
      typeCount.set(tipo, (typeCount.get(tipo) ?? 0) + 1);
    }
  } catch {
    totalProducts = allProducts.length;
  }

  // Brand count from sales (more useful than catalog)
  for (const p of allProducts) {
    brandCount.set(p.brand, (brandCount.get(p.brand) ?? 0) + 1);
  }

  return {
    topSellers,
    slowMovers,
    totalProducts,
    byBrand: Array.from(brandCount.entries())
      .map(([brand, count]) => ({ brand, count }))
      .sort((a, b) => b.count - a.count),
    byType: Array.from(typeCount.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15),
  };
}

// ─── AUTH DB — sam_customers ────────────────────────────────────────────────

function mapCustomerRow(r: Row): SamCustomer {
  return {
    id: r.id,
    erpCode: r.erp_code ?? "",
    ruc: r.ruc ?? "",
    razonSocial: r.razon_social ?? "",
    phone: r.phone ?? null,
    email: r.email ?? null,
    tipoCliente: r.tipo_cliente ?? null,
    tier: (r.tier as CustomerTier) ?? "inactive",
    totalSpent: toNum(r.total_spent),
    purchaseCount: r.purchase_count ?? 0,
    avgTicket: toNum(r.avg_ticket),
    lastPurchase: r.last_purchase ?? null,
    hasPendingDebt: r.has_pending_debt ?? false,
    pendingAmount: toNum(r.pending_amount),
    fechaIngreso: r.fecha_ingreso ?? null,
    codeCount: r.code_count ?? 1,
    syncedAt: r.synced_at ?? "",
    createdAt: r.created_at ?? "",
    updatedAt: r.updated_at ?? "",
  };
}

export async function fetchSamCustomers(filters?: {
  search?: string;
  tier?: CustomerTier;
  page?: number;
  pageSize?: number;
}): Promise<{ data: SamCustomer[]; total: number }> {
  const page = filters?.page ?? 0;
  const pageSize = filters?.pageSize ?? 50;
  const from = page * pageSize;
  const to = from + pageSize - 1;

  let query = authClient
    .from("sam_customers")
    .select("*", { count: "exact" });

  if (filters?.search) {
    query = query.or(
      `razon_social.ilike.%${filters.search}%,ruc.ilike.%${filters.search}%,erp_code.ilike.%${filters.search}%`,
    );
  }
  if (filters?.tier) {
    query = query.eq("tier", filters.tier);
  }

  const { data, error, count } = await query
    .order("razon_social")
    .range(from, to);

  if (error) throw new Error(`fetchSamCustomers: ${error.message}`);

  return {
    data: (data ?? []).map(mapCustomerRow),
    total: count ?? 0,
  };
}

export async function upsertSamCustomers(
  customers: Array<Omit<SamCustomer, "id" | "syncedAt" | "createdAt" | "updatedAt">>,
): Promise<void> {
  const BATCH_SIZE = 500;

  for (let i = 0; i < customers.length; i += BATCH_SIZE) {
    const batch = customers.slice(i, i + BATCH_SIZE).map((c) => ({
      erp_code: c.erpCode,
      ruc: c.ruc,
      razon_social: c.razonSocial,
      phone: c.phone,
      email: c.email,
      tipo_cliente: c.tipoCliente,
      tier: c.tier,
      total_spent: c.totalSpent,
      purchase_count: c.purchaseCount,
      avg_ticket: c.avgTicket,
      last_purchase: c.lastPurchase,
      has_pending_debt: c.hasPendingDebt,
      pending_amount: c.pendingAmount,
      fecha_ingreso: c.fechaIngreso,
      code_count: c.codeCount,
      synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    const { error } = await authClient
      .from("sam_customers")
      .upsert(batch, { onConflict: "ruc" });

    if (error) {
      console.error(`[SAM] upsert batch ${i} error:`, error.message, error.details, error.hint);
      throw new Error(`upsertSamCustomers batch ${i}: ${error.message}`);
    }
    console.info(`[SAM] upsert batch ${i}–${i + batch.length} OK`);
  }
  console.info(`[SAM] upsert complete: ${customers.length} customers`);
}

// ─── AUTH DB — sam_triggers ─────────────────────────────────────────────────

function mapTriggerRow(r: Row): SamTrigger {
  return {
    id: r.id,
    name: r.name ?? "",
    category: (r.category as TriggerCategory) ?? "inactivity",
    description: r.description ?? null,
    channel: (r.channel as MessageChannel) ?? "email",
    templateId: r.template_id ?? null,
    campaignId: r.campaign_id ?? null,
    conditions: (r.conditions as TriggerCondition) ?? {},
    frequencyCap: r.frequency_cap ?? 1,
    priority: r.priority ?? 5,
    isActive: r.is_active ?? false,
    fireCount: r.fire_count ?? 0,
    lastFiredAt: r.last_fired_at ?? null,
    createdAt: r.created_at ?? "",
    updatedAt: r.updated_at ?? "",
  };
}

export async function fetchSamTriggers(): Promise<SamTrigger[]> {
  const { data, error } = await authClient
    .from("sam_triggers")
    .select("*")
    .order("priority")
    .order("name");

  if (error) throw new Error(`fetchSamTriggers: ${error.message}`);
  return (data ?? []).map(mapTriggerRow);
}

export async function createSamTrigger(
  trigger: Omit<SamTrigger, "id" | "fireCount" | "lastFiredAt" | "createdAt" | "updatedAt">,
): Promise<SamTrigger> {
  const { data, error } = await authClient
    .from("sam_triggers")
    .insert({
      name: trigger.name,
      category: trigger.category,
      description: trigger.description,
      channel: trigger.channel,
      template_id: trigger.templateId,
      campaign_id: trigger.campaignId,
      conditions: trigger.conditions,
      frequency_cap: trigger.frequencyCap,
      priority: trigger.priority,
      is_active: trigger.isActive,
    })
    .select()
    .single();

  if (error) throw new Error(`createSamTrigger: ${error.message}`);
  return mapTriggerRow(data);
}

export async function updateSamTrigger(
  id: string,
  updates: Partial<Omit<SamTrigger, "id" | "createdAt" | "updatedAt">>,
): Promise<void> {
  const dbUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.category !== undefined) dbUpdates.category = updates.category;
  if (updates.description !== undefined) dbUpdates.description = updates.description;
  if (updates.channel !== undefined) dbUpdates.channel = updates.channel;
  if (updates.templateId !== undefined) dbUpdates.template_id = updates.templateId;
  if (updates.campaignId !== undefined) dbUpdates.campaign_id = updates.campaignId;
  if (updates.conditions !== undefined) dbUpdates.conditions = updates.conditions;
  if (updates.frequencyCap !== undefined) dbUpdates.frequency_cap = updates.frequencyCap;
  if (updates.priority !== undefined) dbUpdates.priority = updates.priority;
  if (updates.isActive !== undefined) dbUpdates.is_active = updates.isActive;
  if (updates.fireCount !== undefined) dbUpdates.fire_count = updates.fireCount;
  if (updates.lastFiredAt !== undefined) dbUpdates.last_fired_at = updates.lastFiredAt;

  const { error } = await authClient
    .from("sam_triggers")
    .update(dbUpdates)
    .eq("id", id);

  if (error) throw new Error(`updateSamTrigger: ${error.message}`);
}

export async function deleteSamTrigger(id: string): Promise<void> {
  const { error } = await authClient
    .from("sam_triggers")
    .delete()
    .eq("id", id);

  if (error) throw new Error(`deleteSamTrigger: ${error.message}`);
}

// ─── AUTH DB — sam_templates ────────────────────────────────────────────────

function mapTemplateRow(r: Row): SamTemplate {
  return {
    id: r.id,
    name: r.name ?? "",
    channel: (r.channel as MessageChannel) ?? "email",
    subject: r.subject ?? null,
    body: r.body ?? "",
    createdAt: r.created_at ?? "",
    updatedAt: r.updated_at ?? "",
  };
}

export async function fetchSamTemplates(channel?: MessageChannel): Promise<SamTemplate[]> {
  let query = authClient
    .from("sam_templates")
    .select("*");

  if (channel) {
    query = query.eq("channel", channel);
  }

  const { data, error } = await query.order("name");

  if (error) throw new Error(`fetchSamTemplates: ${error.message}`);
  return (data ?? []).map(mapTemplateRow);
}

export async function createSamTemplate(
  template: Omit<SamTemplate, "id" | "createdAt" | "updatedAt">,
): Promise<SamTemplate> {
  const { data, error } = await authClient
    .from("sam_templates")
    .insert({
      name: template.name,
      channel: template.channel,
      subject: template.subject,
      body: template.body,
    })
    .select()
    .single();

  if (error) throw new Error(`createSamTemplate: ${error.message}`);
  return mapTemplateRow(data);
}

export async function updateSamTemplate(
  id: string,
  updates: Partial<Omit<SamTemplate, "id" | "createdAt" | "updatedAt">>,
): Promise<void> {
  const dbUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.channel !== undefined) dbUpdates.channel = updates.channel;
  if (updates.subject !== undefined) dbUpdates.subject = updates.subject;
  if (updates.body !== undefined) dbUpdates.body = updates.body;

  const { error } = await authClient
    .from("sam_templates")
    .update(dbUpdates)
    .eq("id", id);

  if (error) throw new Error(`updateSamTemplate: ${error.message}`);
}

// ─── AUTH DB — sam_executions ───────────────────────────────────────────────

function mapExecutionRow(r: Row): SamExecution {
  return {
    id: r.id,
    triggerId: r.trigger_id ?? "",
    customerId: r.customer_id ?? "",
    campaignId: r.campaign_id ?? null,
    channel: (r.channel as MessageChannel) ?? "email",
    status: (r.status as ExecutionStatus) ?? "pending",
    sentAt: r.sent_at ?? null,
    deliveredAt: r.delivered_at ?? null,
    openedAt: r.opened_at ?? null,
    clickedAt: r.clicked_at ?? null,
    errorMsg: r.error_msg ?? null,
    createdAt: r.created_at ?? "",
  };
}

export async function fetchSamExecutions(filters?: {
  triggerId?: string;
  status?: ExecutionStatus;
  page?: number;
  pageSize?: number;
}): Promise<{ data: SamExecution[]; total: number }> {
  const page = filters?.page ?? 0;
  const pageSize = filters?.pageSize ?? 50;
  const from = page * pageSize;
  const to = from + pageSize - 1;

  let query = authClient
    .from("sam_executions")
    .select("*", { count: "exact" });

  if (filters?.triggerId) {
    query = query.eq("trigger_id", filters.triggerId);
  }
  if (filters?.status) {
    query = query.eq("status", filters.status);
  }

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) throw new Error(`fetchSamExecutions: ${error.message}`);

  return {
    data: (data ?? []).map(mapExecutionRow),
    total: count ?? 0,
  };
}

export async function createSamExecution(
  execution: Omit<SamExecution, "id" | "createdAt">,
): Promise<SamExecution> {
  const { data, error } = await authClient
    .from("sam_executions")
    .insert({
      trigger_id: execution.triggerId,
      customer_id: execution.customerId,
      campaign_id: execution.campaignId,
      channel: execution.channel,
      status: execution.status,
      sent_at: execution.sentAt,
      delivered_at: execution.deliveredAt,
      opened_at: execution.openedAt,
      clicked_at: execution.clickedAt,
      error_msg: execution.errorMsg,
    })
    .select()
    .single();

  if (error) throw new Error(`createSamExecution: ${error.message}`);
  return mapExecutionRow(data);
}

// ─── AUTH DB — sam_segments ─────────────────────────────────────────────────

function mapSegmentRow(r: Row): SamSegment {
  return {
    id: r.id,
    name: r.name ?? "",
    description: r.description ?? null,
    filters: (r.filters as SegmentFilter) ?? {},
    createdAt: r.created_at ?? "",
    updatedAt: r.updated_at ?? "",
  };
}

export async function fetchSamSegments(): Promise<SamSegment[]> {
  const { data, error } = await authClient
    .from("sam_segments")
    .select("*")
    .order("name");

  if (error) throw new Error(`fetchSamSegments: ${error.message}`);
  return (data ?? []).map(mapSegmentRow);
}

export async function createSamSegment(
  segment: Omit<SamSegment, "id" | "createdAt" | "updatedAt">,
): Promise<SamSegment> {
  const { data, error } = await authClient
    .from("sam_segments")
    .insert({
      name: segment.name,
      description: segment.description,
      filters: segment.filters,
    })
    .select()
    .single();

  if (error) throw new Error(`createSamSegment: ${error.message}`);
  return mapSegmentRow(data);
}

export async function updateSamSegment(
  id: string,
  updates: Partial<Omit<SamSegment, "id" | "createdAt" | "updatedAt">>,
): Promise<void> {
  const dbUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.description !== undefined) dbUpdates.description = updates.description;
  if (updates.filters !== undefined) dbUpdates.filters = updates.filters;

  const { error } = await authClient
    .from("sam_segments")
    .update(dbUpdates)
    .eq("id", id);

  if (error) throw new Error(`updateSamSegment: ${error.message}`);
}

// ─── AUTH DB — sam_campaigns ────────────────────────────────────────────────

function mapCampaignRow(r: Row): SamCampaign {
  return {
    id: r.id,
    name: r.name ?? "",
    description: r.description ?? null,
    status: (r.status as CampaignStatus) ?? "draft",
    segmentId: r.segment_id ?? null,
    startDate: r.start_date ?? null,
    endDate: r.end_date ?? null,
    budget: r.budget != null ? toNum(r.budget) : null,
    createdAt: r.created_at ?? "",
    updatedAt: r.updated_at ?? "",
  };
}

export async function fetchSamCampaigns(): Promise<SamCampaign[]> {
  const { data, error } = await authClient
    .from("sam_campaigns")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(`fetchSamCampaigns: ${error.message}`);
  return (data ?? []).map(mapCampaignRow);
}

export async function createSamCampaign(
  campaign: Omit<SamCampaign, "id" | "createdAt" | "updatedAt">,
): Promise<SamCampaign> {
  const { data, error } = await authClient
    .from("sam_campaigns")
    .insert({
      name: campaign.name,
      description: campaign.description,
      status: campaign.status,
      segment_id: campaign.segmentId,
      start_date: campaign.startDate,
      end_date: campaign.endDate,
      budget: campaign.budget,
    })
    .select()
    .single();

  if (error) throw new Error(`createSamCampaign: ${error.message}`);
  return mapCampaignRow(data);
}

export async function updateSamCampaign(
  id: string,
  updates: Partial<Omit<SamCampaign, "id" | "createdAt" | "updatedAt">>,
): Promise<void> {
  const dbUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.description !== undefined) dbUpdates.description = updates.description;
  if (updates.status !== undefined) dbUpdates.status = updates.status;
  if (updates.segmentId !== undefined) dbUpdates.segment_id = updates.segmentId;
  if (updates.startDate !== undefined) dbUpdates.start_date = updates.startDate;
  if (updates.endDate !== undefined) dbUpdates.end_date = updates.endDate;
  if (updates.budget !== undefined) dbUpdates.budget = updates.budget;

  const { error } = await authClient
    .from("sam_campaigns")
    .update(dbUpdates)
    .eq("id", id);

  if (error) throw new Error(`updateSamCampaign: ${error.message}`);
}

// ─── Dashboard metrics ──────────────────────────────────────────────────────

export async function fetchMarketingDashboardMetrics(): Promise<MarketingMetrics> {
  // Total customers
  const { count: totalCustomers, error: e1 } = await authClient
    .from("sam_customers")
    .select("*", { count: "exact", head: true });
  if (e1) {
    console.error("[SAM] dashboard metrics error:", e1.message, e1.details, e1.hint);
    throw new Error(`fetchMarketingDashboardMetrics (customers): ${e1.message}`);
  }
  console.info("[SAM] dashboard totalCustomers:", totalCustomers);

  // Reachable email
  const { count: reachableEmail, error: e2 } = await authClient
    .from("sam_customers")
    .select("*", { count: "exact", head: true })
    .not("email", "is", null);
  if (e2) throw new Error(`fetchMarketingDashboardMetrics (email): ${e2.message}`);

  // Reachable whatsapp
  const { count: reachableWhatsapp, error: e3 } = await authClient
    .from("sam_customers")
    .select("*", { count: "exact", head: true })
    .not("phone", "is", null);
  if (e3) throw new Error(`fetchMarketingDashboardMetrics (whatsapp): ${e3.message}`);

  // Active triggers
  const { count: activeTriggers, error: e4 } = await authClient
    .from("sam_triggers")
    .select("*", { count: "exact", head: true })
    .eq("is_active", true);
  if (e4) throw new Error(`fetchMarketingDashboardMetrics (triggers): ${e4.message}`);

  // Total executions
  const { count: totalExecutions, error: e5 } = await authClient
    .from("sam_executions")
    .select("*", { count: "exact", head: true });
  if (e5) throw new Error(`fetchMarketingDashboardMetrics (executions): ${e5.message}`);

  // Opened executions (for open rate)
  const { count: openedExecutions, error: e6 } = await authClient
    .from("sam_executions")
    .select("*", { count: "exact", head: true })
    .eq("status", "opened");
  if (e6) throw new Error(`fetchMarketingDashboardMetrics (opened): ${e6.message}`);

  // Delivered executions
  const { count: deliveredExecutions, error: e7 } = await authClient
    .from("sam_executions")
    .select("*", { count: "exact", head: true })
    .in("status", ["delivered", "opened", "clicked"]);
  if (e7) throw new Error(`fetchMarketingDashboardMetrics (delivered): ${e7.message}`);

  const delivered = (deliveredExecutions ?? 0) + (openedExecutions ?? 0);
  const openRate = delivered > 0 ? ((openedExecutions ?? 0) / delivered) * 100 : 0;

  return {
    totalCustomers: totalCustomers ?? 0,
    reachableEmail: reachableEmail ?? 0,
    reachableWhatsapp: reachableWhatsapp ?? 0,
    activeTriggers: activeTriggers ?? 0,
    totalExecutions: totalExecutions ?? 0,
    openRate,
  };
}

// ─── Trigger Insights (cuántos clientes matchean cada trigger) ──────────────

/**
 * Para cada trigger, cuenta cuántos clientes matchean la condición.
 * Usa queries de count directo a la BD (más eficiente que traer 82K rows).
 */
export async function fetchTriggerInsights(): Promise<TriggerInsight[]> {
  // 1. Fetch all triggers
  const triggers = await fetchSamTriggers();

  // 2. For each trigger, count matching customers
  const insights: TriggerInsight[] = [];

  for (const t of triggers) {
    let count = 0;

    try {
      switch (t.category) {
        case "inactivity": {
          const days = t.conditions.inactivityDays ?? 90;
          const cutoff = new Date();
          cutoff.setDate(cutoff.getDate() - days);
          // Customers with last_purchase before cutoff OR null (never purchased)
          const { count: c1 } = await authClient
            .from("sam_customers")
            .select("*", { count: "exact", head: true })
            .lt("last_purchase", cutoff.toISOString());
          const { count: c2 } = await authClient
            .from("sam_customers")
            .select("*", { count: "exact", head: true })
            .is("last_purchase", null);
          count = (c1 ?? 0) + (c2 ?? 0);
          break;
        }
        case "overdue": {
          const { count: c } = await authClient
            .from("sam_customers")
            .select("*", { count: "exact", head: true })
            .eq("has_pending_debt", true)
            .gt("pending_amount", 0);
          count = c ?? 0;
          break;
        }
        case "first_purchase": {
          const { count: c } = await authClient
            .from("sam_customers")
            .select("*", { count: "exact", head: true })
            .eq("purchase_count", 1);
          count = c ?? 0;
          break;
        }
        case "second_purchase": {
          const { count: c } = await authClient
            .from("sam_customers")
            .select("*", { count: "exact", head: true })
            .eq("purchase_count", 2);
          count = c ?? 0;
          break;
        }
        case "post_purchase": {
          const days = t.conditions.withinDays ?? 7;
          const cutoff = new Date();
          cutoff.setDate(cutoff.getDate() - days);
          const { count: c } = await authClient
            .from("sam_customers")
            .select("*", { count: "exact", head: true })
            .gte("last_purchase", cutoff.toISOString());
          count = c ?? 0;
          break;
        }
        case "high_ticket": {
          const threshold = t.conditions.ticketThreshold ?? 500000;
          const { count: c } = await authClient
            .from("sam_customers")
            .select("*", { count: "exact", head: true })
            .gt("avg_ticket", threshold);
          count = c ?? 0;
          break;
        }
        case "low_ticket": {
          const threshold = t.conditions.ticketThreshold ?? 500000;
          const { count: c } = await authClient
            .from("sam_customers")
            .select("*", { count: "exact", head: true })
            .gt("purchase_count", 0)
            .lt("avg_ticket", threshold * 0.5);
          count = c ?? 0;
          break;
        }
        case "low_stock": {
          // ITR integration: count distinct SKUs (not rows) with low stock.
          // This is a product-level metric, shown as "X productos" in UI.
          // Must use fetchAllRows — mv_stock_tienda has 50K+ rows, Supabase max_rows=1000.
          const stockThreshold = t.conditions.stockThreshold ?? 10;
          try {
            const lowStockData = await fetchAllRows<Row>(() =>
              dataClient
                .from("mv_stock_tienda")
                .select("sku")
                .gt("units", 0)
                .lte("units", stockThreshold),
            );
            const uniqueSkus = new Set(lowStockData.map((r) => r.sku));
            count = uniqueSkus.size;
          } catch {
            // mv_stock_tienda might not be available
          }
          break;
        }
        default:
          // return requires transaction-level data not yet available
          break;
      }
    } catch {
      // If a count query fails, just leave count at 0
    }

    insights.push({
      triggerId: t.id,
      triggerName: t.name,
      category: t.category,
      channel: t.channel,
      description: t.description,
      isActive: t.isActive,
      matchCount: count,
    });
  }

  return insights;
}

/** ETL stats computed via count queries (no need to fetch all 82K rows) */
export async function fetchEtlStats(): Promise<EtlStats> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function countWhere(...buildSteps: Array<(q: any) => any>): Promise<number> {
    let q = authClient.from("sam_customers").select("*", { count: "exact", head: true });
    for (const step of buildSteps) q = step(q);
    const { count: c } = await q;
    return c ?? 0;
  }

  const [total, withPhone, withEmail, withBoth, vip, frequent, occasional, atRisk, inactive] =
    await Promise.all([
      countWhere(),
      countWhere((q) => q.not("phone", "is", null)),
      countWhere((q) => q.not("email", "is", null)),
      countWhere((q) => q.not("phone", "is", null).not("email", "is", null)),
      countWhere((q) => q.eq("tier", "vip")),
      countWhere((q) => q.eq("tier", "frequent")),
      countWhere((q) => q.eq("tier", "occasional")),
      countWhere((q) => q.eq("tier", "at_risk")),
      countWhere((q) => q.eq("tier", "inactive")),
    ]);

  // Get latest synced_at
  const { data: latest } = await authClient
    .from("sam_customers")
    .select("synced_at")
    .order("synced_at", { ascending: false })
    .limit(1);

  return {
    totalSynced: total,
    withPhone,
    withEmail,
    withBoth,
    tierBreakdown: { vip, frequent, occasional, at_risk: atRisk, inactive },
    lastSyncedAt: latest?.[0]?.synced_at ?? null,
  };
}

/** Quick check if sam_customers has any data (for auto-sync decision) */
export async function fetchSamCustomerCount(): Promise<number> {
  const { count, error } = await authClient
    .from("sam_customers")
    .select("*", { count: "exact", head: true });
  if (error) {
    console.error("[SAM] fetchSamCustomerCount error:", error.message, error.details, error.hint);
    return 0;
  }
  console.info("[SAM] customerCount:", count);
  return count ?? 0;
}

// ─── AUTH DB — sam_email_config ─────────────────────────────────────────────

function mapEmailConfigRow(r: Row): SamEmailConfig {
  return {
    id: r.id,
    fromEmail: r.from_email ?? "",
    fromName: r.from_name ?? "",
    replyTo: r.reply_to ?? null,
    testRecipients: Array.isArray(r.test_recipients) ? r.test_recipients : [],
    isActive: !!r.is_active,
    updatedBy: r.updated_by ?? null,
    createdAt: r.created_at ?? "",
    updatedAt: r.updated_at ?? "",
  };
}

export async function fetchEmailConfig(): Promise<SamEmailConfig | null> {
  const { data, error } = await authClient
    .from("sam_email_config")
    .select("*")
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw new Error(`fetchEmailConfig: ${error.message}`);
  return data ? mapEmailConfigRow(data) : null;
}

export async function updateEmailConfig(
  id: string,
  patch: Partial<Omit<SamEmailConfig, "id" | "createdAt" | "updatedAt">>,
): Promise<void> {
  const dbPatch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.fromEmail !== undefined) dbPatch.from_email = patch.fromEmail;
  if (patch.fromName !== undefined) dbPatch.from_name = patch.fromName;
  if (patch.replyTo !== undefined) dbPatch.reply_to = patch.replyTo;
  if (patch.testRecipients !== undefined) dbPatch.test_recipients = patch.testRecipients;
  if (patch.isActive !== undefined) dbPatch.is_active = patch.isActive;

  const { error } = await authClient
    .from("sam_email_config")
    .update(dbPatch)
    .eq("id", id);

  if (error) throw new Error(`updateEmailConfig: ${error.message}`);
}

// ─── Edge Function — send-email ─────────────────────────────────────────────

export async function sendTestEmail(input: SendTestEmailInput): Promise<SendTestEmailResult> {
  const { data, error } = await authClient.functions.invoke("send-email", {
    body: {
      template_id: input.templateId,
      to_email: input.toEmail,
      customer_id: input.customerId ?? null,
      is_test: true,
      override_subject: input.overrideSubject ?? null,
      override_body: input.overrideBody ?? null,
    },
  });

  if (error) {
    // functions.invoke devuelve FunctionsHttpError con el body del error
    const msg = (error as { message?: string }).message ?? "Error invocando send-email";
    throw new Error(msg);
  }
  if (!data) throw new Error("send-email no devolvió respuesta");
  if (data.error) throw new Error(data.error);

  return {
    executionId: data.execution_id ?? null,
    resendEmailId: data.resend_email_id,
    status: data.status,
  };
}

// ─── AUTH DB — sam_email_events ─────────────────────────────────────────────

function mapEmailEventRow(r: Row): SamEmailEvent {
  return {
    id: r.id,
    executionId: r.execution_id,
    eventType: r.event_type ?? "",
    payload: (r.payload ?? {}) as Record<string, unknown>,
    createdAt: r.created_at ?? "",
  };
}

/**
 * Fetch de executions + eventos asociados. Útil para la tabla
 * de historial de tests en la pestaña Configuración.
 */
export async function fetchExecutionsWithEvents(filter?: {
  isTest?: boolean;
  limit?: number;
}): Promise<ExecutionWithEvents[]> {
  const limit = filter?.limit ?? 20;

  let q = authClient
    .from("sam_executions")
    .select(`
      id, trigger_id, customer_id, campaign_id, channel, status,
      sent_at, delivered_at, opened_at, clicked_at, error_msg, created_at,
      to_email, from_email, subject_snapshot, is_test, resend_email_id, bounce_reason
    `)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (filter?.isTest !== undefined) {
    q = q.eq("is_test", filter.isTest);
  }

  const { data: execRows, error } = await q;
  if (error) throw new Error(`fetchExecutionsWithEvents: ${error.message}`);
  if (!execRows || execRows.length === 0) return [];

  const ids = execRows.map((r) => r.id);
  const { data: eventRows, error: evErr } = await authClient
    .from("sam_email_events")
    .select("*")
    .in("execution_id", ids)
    .order("created_at", { ascending: true });

  if (evErr) throw new Error(`fetchExecutionsWithEvents events: ${evErr.message}`);

  const eventsByExec = new Map<string, SamEmailEvent[]>();
  for (const r of eventRows ?? []) {
    const ev = mapEmailEventRow(r);
    const arr = eventsByExec.get(ev.executionId) ?? [];
    arr.push(ev);
    eventsByExec.set(ev.executionId, arr);
  }

  return execRows.map((r) => ({
    execution: {
      id: r.id,
      triggerId: r.trigger_id ?? "",
      customerId: r.customer_id ?? "",
      campaignId: r.campaign_id ?? null,
      channel: (r.channel as MessageChannel) ?? "email",
      status: (r.status as ExecutionStatus) ?? "pending",
      sentAt: r.sent_at ?? null,
      deliveredAt: r.delivered_at ?? null,
      openedAt: r.opened_at ?? null,
      clickedAt: r.clicked_at ?? null,
      errorMsg: r.error_msg ?? null,
      createdAt: r.created_at ?? "",
      toEmail: r.to_email ?? null,
      fromEmail: r.from_email ?? null,
      subjectSnapshot: r.subject_snapshot ?? null,
      isTest: !!r.is_test,
      resendEmailId: r.resend_email_id ?? null,
      bounceReason: r.bounce_reason ?? null,
    },
    events: eventsByExec.get(r.id) ?? [],
  }));
}
