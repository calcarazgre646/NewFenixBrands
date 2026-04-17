/**
 * domain/marketing/etl.ts
 *
 * Funciones PURAS de limpieza y transformación de datos para el ETL de clientes.
 * Sin React. Sin Supabase. Sin efectos secundarios.
 *
 * Pipeline: CLIM100 (raw) → clean → aggregate txns/cobranzas → build profile
 */
import type { CustomerTier, EtlStats, SamCustomer } from "./types";
import { classifyCustomerTier } from "./calculations";

// ─── Fake data detection ────────────────────────────────────────────────────

const FAKE_PHONES = new Set([
  "0981111111",
  "0980000000",
  "0981234567",
  "0000000000",
  "1111111111",
  "0999999999",
]);

const FAKE_EMAIL_DOMAINS = new Set([
  "sincorreo.com",
  "sinnombre.com",
  "sincoreo.com",
  "sincorrreo.com",
  "sinmail.com",
  "noemail.com",
]);

// ─── Phone normalization ────────────────────────────────────────────────────

/**
 * Normaliza un teléfono paraguayo a formato +595 9XX XXX XXX.
 * Retorna null si es inválido o fake.
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  // Strip all non-digit characters
  let digits = raw.replace(/\D/g, "");

  if (digits.length === 0) return null;

  // If starts with 595, strip it
  if (digits.startsWith("595")) {
    digits = "0" + digits.slice(3);
  }

  // If starts with +595 (already stripped +)
  if (digits.startsWith("0") && digits.length === 10) {
    // Valid PY mobile: 09XX XXX XXX
    if (!digits.startsWith("09")) return null;
    if (isFakePhone(digits)) return null;
    return "+595" + digits.slice(1);
  }

  // 9-digit without leading 0
  if (digits.length === 9 && digits.startsWith("9")) {
    const full = "0" + digits;
    if (isFakePhone(full)) return null;
    return "+595" + digits;
  }

  return null;
}

/** Check if a phone (in 0-prefixed 10-digit format) is fake */
export function isFakePhone(phone: string): boolean {
  return FAKE_PHONES.has(phone);
}

// ─── Email normalization ────────────────────────────────────────────────────

/**
 * Normaliza email: lowercase, trim.
 * Retorna null si es inválido o fake.
 */
export function normalizeEmail(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const email = raw.trim().toLowerCase();
  if (!email.includes("@")) return null;
  if (isFakeEmail(email)) return null;
  return email;
}

/** Check if an email domain is a known fake placeholder */
export function isFakeEmail(email: string): boolean {
  const domain = email.split("@")[1];
  if (!domain) return true;
  return FAKE_EMAIL_DOMAINS.has(domain.toLowerCase());
}

// ─── RUC normalization ──────────────────────────────────────────────────────

/**
 * Normaliza un RUC paraguayo al formato base (solo dígitos, sin DV).
 *
 * CLIM100 almacena: "3846622" (sin guión, con padding)
 * v_transacciones_dwh almacena: "3846622-8" (con dígito verificador)
 *
 * Esta función stripea el guión + DV y el whitespace para que ambas
 * fuentes usen la misma clave al cruzar datos.
 */
export function normalizeRuc(raw: string): string {
  const trimmed = raw.trim();
  const dashIdx = trimmed.indexOf("-");
  return dashIdx >= 0 ? trimmed.slice(0, dashIdx) : trimmed;
}

// ─── CLIM100 row cleaning ───────────────────────────────────────────────────

export interface CleanCustomerRow {
  erpCode: string;
  ruc: string | null;
  razonSocial: string;
  phone: string | null;
  email: string | null;
  tipoCliente: string | null;
  fechaIngreso: string | null;
}

/**
 * Row after merging multiple CLIM100 codes by RUC.
 * One MergedCustomerRow = one real client.
 */
export interface MergedCustomerRow {
  ruc: string;
  erpCode: string; // primary code (first seen)
  razonSocial: string;
  phone: string | null;
  email: string | null;
  tipoCliente: string | null;
  fechaIngreso: string | null;
  codeCount: number; // how many ERP codes this RUC has
}

/**
 * Limpia una fila raw de CLIM100.
 * Retorna null si no tiene código ERP o razón social.
 */
export function cleanClim100Row(raw: Record<string, unknown>): CleanCustomerRow | null {
  const erpCode = String(raw.c_codigo ?? raw.codigo ?? "").trim();
  if (!erpCode) return null;

  const razonSocial = String(raw.c_razsoc ?? raw.razon_social ?? "").trim();
  if (!razonSocial) return null;

  return {
    erpCode,
    ruc: raw.c_ruc ? normalizeRuc(String(raw.c_ruc)) || null : null,
    razonSocial,
    phone: normalizePhone(raw.c_telefo as string | null),
    email: normalizeEmail(raw.c_email as string | null),
    tipoCliente: raw.c_tipocl ? String(raw.c_tipocl).trim() || null : null,
    fechaIngreso: raw.c_fecing ? String(raw.c_fecing).trim() || null : null,
  };
}

// ─── Merge by RUC ──────────────────────────────────────────────────────────

/**
 * Groups cleaned CLIM100 rows by RUC.
 *
 * Multiple ERP codes can belong to the same RUC (tax ID).
 * This function merges them into one entry per real client:
 * - Picks the best (non-null) phone and email
 * - Keeps the earliest fechaIngreso
 * - Counts how many codes each RUC has
 * - Rows without RUC are skipped (garbage/test data)
 */
export function mergeByRuc(rows: CleanCustomerRow[]): MergedCustomerRow[] {
  const rucMap = new Map<
    string,
    {
      erpCode: string;
      razonSocial: string;
      phone: string | null;
      email: string | null;
      tipoCliente: string | null;
      fechaIngreso: string | null;
      codeCount: number;
    }
  >();

  for (const row of rows) {
    const ruc = row.ruc;
    if (!ruc) continue; // skip rows without RUC

    const existing = rucMap.get(ruc);
    if (existing) {
      existing.codeCount++;
      // Prefer non-null contact info
      if (!existing.phone && row.phone) existing.phone = row.phone;
      if (!existing.email && row.email) existing.email = row.email;
      // Keep earliest fechaIngreso
      if (row.fechaIngreso && (!existing.fechaIngreso || row.fechaIngreso < existing.fechaIngreso)) {
        existing.fechaIngreso = row.fechaIngreso;
      }
    } else {
      rucMap.set(ruc, {
        erpCode: row.erpCode,
        razonSocial: row.razonSocial,
        phone: row.phone,
        email: row.email,
        tipoCliente: row.tipoCliente,
        fechaIngreso: row.fechaIngreso,
        codeCount: 1,
      });
    }
  }

  return Array.from(rucMap.entries()).map(([ruc, v]) => ({
    ruc,
    erpCode: v.erpCode,
    razonSocial: v.razonSocial,
    phone: v.phone,
    email: v.email,
    tipoCliente: v.tipoCliente,
    fechaIngreso: v.fechaIngreso,
    codeCount: v.codeCount,
  }));
}

// ─── Transaction aggregation ────────────────────────────────────────────────

export interface TxnAggregate {
  totalPurchases: number;
  totalSpent: number;
  avgTicket: number;
  lastPurchase: string | null;
}

/**
 * Agrega transacciones por código de cliente.
 * Cada row debe tener: customer_code, monto, fecha.
 */
export function aggregateTransactions(
  rows: Array<{ customerCode: string; monto: number; fecha: string }>,
): Map<string, TxnAggregate> {
  const map = new Map<string, { total: number; count: number; lastDate: string }>();

  for (const r of rows) {
    const code = normalizeRuc(r.customerCode);
    if (!code) continue;

    const existing = map.get(code);
    if (existing) {
      existing.total += r.monto;
      existing.count += 1;
      if (r.fecha > existing.lastDate) {
        existing.lastDate = r.fecha;
      }
    } else {
      map.set(code, { total: r.monto, count: 1, lastDate: r.fecha });
    }
  }

  const result = new Map<string, TxnAggregate>();
  for (const [code, agg] of map) {
    result.set(code, {
      totalPurchases: agg.count,
      totalSpent: agg.total,
      avgTicket: agg.count > 0 ? agg.total / agg.count : 0,
      lastPurchase: agg.lastDate,
    });
  }
  return result;
}

// ─── Cobranzas aggregation ──────────────────────────────────────────────────

export interface CobranzaAggregate {
  hasPending: boolean;
  pendingAmount: number;
}

/**
 * Agrega cobranzas pendientes por código de cliente.
 */
export function aggregateCobranzas(
  rows: Array<{ customerCode: string; pendingAmount: number }>,
): Map<string, CobranzaAggregate> {
  const map = new Map<string, number>();

  for (const r of rows) {
    const code = normalizeRuc(r.customerCode);
    if (!code) continue;
    map.set(code, (map.get(code) ?? 0) + r.pendingAmount);
  }

  const result = new Map<string, CobranzaAggregate>();
  for (const [code, amount] of map) {
    result.set(code, {
      hasPending: amount > 0,
      pendingAmount: amount,
    });
  }
  return result;
}

// ─── Profile builder ────────────────────────────────────────────────────────

/**
 * Construye un perfil parcial de SamCustomer a partir de datos mergeados por RUC.
 * El tier se calcula basado en los datos de transacciones.
 * Transactions y cobranzas se buscan por RUC (no por código ERP).
 */
export function buildCustomerProfile(
  merged: MergedCustomerRow,
  txn?: TxnAggregate,
  cob?: CobranzaAggregate,
  now: Date = new Date(),
): Omit<SamCustomer, "id" | "syncedAt" | "createdAt" | "updatedAt"> {
  const totalSpent = txn?.totalSpent ?? 0;
  const purchaseCount = txn?.totalPurchases ?? 0;
  const lastPurchase = txn?.lastPurchase ?? null;

  let daysSinceLastPurchase: number | null = null;
  if (lastPurchase) {
    const lastDate = new Date(lastPurchase);
    daysSinceLastPurchase = Math.floor(
      (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24),
    );
  }

  const tier: CustomerTier = classifyCustomerTier(
    totalSpent,
    purchaseCount,
    daysSinceLastPurchase,
  );

  return {
    erpCode: merged.erpCode,
    ruc: merged.ruc,
    razonSocial: merged.razonSocial,
    phone: merged.phone,
    email: merged.email,
    tipoCliente: merged.tipoCliente,
    tier,
    totalSpent,
    purchaseCount,
    avgTicket: txn?.avgTicket ?? 0,
    lastPurchase,
    hasPendingDebt: cob?.hasPending ?? false,
    pendingAmount: cob?.pendingAmount ?? 0,
    fechaIngreso: merged.fechaIngreso,
    codeCount: merged.codeCount,
  };
}

// ─── ETL Stats ──────────────────────────────────────────────────────────────

/**
 * Computa estadísticas de calidad del ETL.
 */
export function computeEtlStats(
  customers: Array<Pick<SamCustomer, "phone" | "email" | "tier" | "syncedAt">>,
): EtlStats {
  const tierBreakdown: Record<CustomerTier, number> = {
    vip: 0,
    frequent: 0,
    occasional: 0,
    at_risk: 0,
    inactive: 0,
  };

  let withPhone = 0;
  let withEmail = 0;
  let withBoth = 0;
  let lastSyncedAt: string | null = null;

  for (const c of customers) {
    tierBreakdown[c.tier]++;
    const hasPhone = !!c.phone;
    const hasEmail = !!c.email;
    if (hasPhone) withPhone++;
    if (hasEmail) withEmail++;
    if (hasPhone && hasEmail) withBoth++;
    if (c.syncedAt && (!lastSyncedAt || c.syncedAt > lastSyncedAt)) {
      lastSyncedAt = c.syncedAt;
    }
  }

  return {
    totalSynced: customers.length,
    withPhone,
    withEmail,
    withBoth,
    tierBreakdown,
    lastSyncedAt,
  };
}
