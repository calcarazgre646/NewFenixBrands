/**
 * queries/markdowns.queries.ts
 *
 * CRUD de markdowns por SKU comercial. BD AUTH (uxtzzcjimvapjpkeruwb).
 *
 * Modelo append-only para audit:
 *   - upsertMarkdown: si existe activo, lo marca superseded e inserta uno nuevo.
 *   - clearMarkdown:  marca el activo como expired (no DELETE).
 *
 * El UNIQUE INDEX parcial (uniq_sku_markdowns_active) garantiza que no haya
 * dos filas activas para el mismo sku_comercial.
 */
import { authClient } from "@/api/client";
import { trimStr, toNum } from "@/api/normalize";
import type { ActiveMarkdown } from "@/domain/pricing/markdown";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

interface UpsertInput {
  skuComercial: string;
  brand: string;
  markdownPct: number;
  note?: string | null;
  validUntil?: string | null;
}

function rowToMarkdown(r: Row): ActiveMarkdown {
  return {
    skuComercial: trimStr(r.sku_comercial),
    brand:        trimStr(r.brand),
    markdownPct:  toNum(r.markdown_pct),
    note:         r.note ? trimStr(r.note) : null,
    validFrom:    r.valid_from ?? "",
    validUntil:   r.valid_until ?? null,
  };
}

/**
 * Lee todos los markdowns activos. Filtro de marca opcional para alinear con
 * el filtro global de `/precios`.
 */
export async function fetchActiveMarkdowns(brandCanonical?: string | null): Promise<ActiveMarkdown[]> {
  let q = authClient
    .from("sku_markdowns")
    .select("sku_comercial, brand, markdown_pct, note, valid_from, valid_until")
    .eq("is_active", true);
  if (brandCanonical) q = q.eq("brand", brandCanonical);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map(rowToMarkdown);
}

/**
 * Inserta un markdown nuevo. Si el SKU ya tiene uno activo, lo marca
 * superseded primero (audit append-only).
 *
 * Implementado client-side (sin RPC) por simetría con el resto de queries
 * de la app y porque las dos sentencias caen bajo la misma sesión RLS:
 * el UNIQUE parcial sigue siendo el safety net si dos clientes pisan en
 * paralelo (la segunda inserción tira 23505).
 */
export async function upsertMarkdown(input: UpsertInput): Promise<ActiveMarkdown> {
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) throw new Error("No autenticado");

  // 1) Supersede del activo previo (si existe).
  const { error: supError } = await authClient
    .from("sku_markdowns")
    .update({
      is_active: false,
      status: "superseded",
      superseded_at: new Date().toISOString(),
      superseded_by: user.id,
    })
    .eq("sku_comercial", input.skuComercial)
    .eq("is_active", true);
  if (supError) throw supError;

  // 2) Insert del nuevo markdown activo.
  const { data, error } = await authClient
    .from("sku_markdowns")
    .insert({
      sku_comercial: input.skuComercial,
      brand:         input.brand,
      markdown_pct:  input.markdownPct,
      note:          input.note ?? null,
      valid_until:   input.validUntil ?? null,
      created_by:    user.id,
    })
    .select("sku_comercial, brand, markdown_pct, note, valid_from, valid_until")
    .single();
  if (error) throw error;
  return rowToMarkdown(data);
}

/**
 * Quita el markdown activo (mark expired, no DELETE — audit).
 */
export async function clearMarkdown(skuComercial: string): Promise<void> {
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { error } = await authClient
    .from("sku_markdowns")
    .update({
      is_active: false,
      status: "expired",
      superseded_at: new Date().toISOString(),
      superseded_by: user.id,
    })
    .eq("sku_comercial", skuComercial)
    .eq("is_active", true);
  if (error) throw error;
}
