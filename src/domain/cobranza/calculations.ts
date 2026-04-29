/**
 * domain/cobranza/calculations.ts
 *
 * Funciones puras para Cobranza Mayorista/UTP.
 *
 * REGLA: Sin I/O, sin React, sin Supabase. Solo funciones puras.
 *
 * Conceptos:
 *   - Cobranza del período = Σ monto_total de cuotas con f_pago dentro del rango.
 *     Incluye montos negativos (notas de crédito / devoluciones) → reducen la
 *     cobranza neta del vendedor.
 *   - DSO de una cuota = (f_pago - f_factura) en días. Cuotas con DSO < 0
 *     (pago anterior a la factura — anomalía de captura) se descartan.
 *   - DSO de un vendedor = promedio simple de DSOs válidos del período.
 */
import type {
  CobranzaRow,
  CobranzaByVendedor,
  CobranzaAggregateResult,
  CobranzaUnattributed,
} from "./types";

// ─── Filtros de período ────────────────────────────────────────────────────

/** True si `f_pago` está dentro del mes (inclusive) y no es null. */
export function isPaidInMonth(row: CobranzaRow, año: number, mes: number): boolean {
  if (!row.fechaPago) return false;
  const d = parseISO(row.fechaPago);
  if (!d) return false;
  return d.year === año && d.month === mes;
}

// ─── DSO ───────────────────────────────────────────────────────────────────

/**
 * Calcula DSO (días entre factura y pago) para una cuota.
 * Devuelve null si:
 *   - falta f_factura o f_pago,
 *   - el pago es anterior a la factura (anomalía de captura).
 */
export function calcRowDSO(row: CobranzaRow): number | null {
  if (!row.fechaFactura || !row.fechaPago) return null;
  const factura = parseISO(row.fechaFactura);
  const pago = parseISO(row.fechaPago);
  if (!factura || !pago) return null;
  const dias = daysBetween(factura, pago);
  if (dias < 0) return null;
  return dias;
}

// ─── Agregación principal ──────────────────────────────────────────────────

/**
 * Agrega cobranza por vendedor para un mes específico.
 *
 * @param rows           Cuotas crudas (cliente + vendedor + montos + fechas).
 * @param año            Año del período.
 * @param mes            Mes del período (1-12).
 * @param nameToCodigo   Lookup nombre canónico (`v_dsvende` trim+upper) → código numérico.
 *                       El caller lo construye desde `fjdhstvta1` o desde la
 *                       tabla de metas. Vendedores no mapeados quedan en
 *                       `unattributed`.
 *
 * Para Mayorista/UTP usa solo cuotas con f_pago dentro del mes.
 */
export function aggregateCobranzaByVendedor(
  rows: CobranzaRow[],
  año: number,
  mes: number,
  nameToCodigo: Map<string, { codigo: number; nombre: string }>,
): CobranzaAggregateResult {
  interface Acc {
    vendedorCodigo: number;
    vendedorNombre: string;
    cobranzaGs:     number;
    cuotasCobradas: number;
    dsoSum:         number;
    dsoCount:       number;
  }

  const byCodigo = new Map<number, Acc>();
  const unBuckets = new Map<string, { cobranzaGs: number; cuotasCobradas: number; dsoSum: number; dsoCount: number }>();

  for (const row of rows) {
    if (!isPaidInMonth(row, año, mes)) continue;

    const dsoVal = calcRowDSO(row);
    const bucket = canonicalSellerName(row.vendedorNombre);
    const lookup = bucket ? nameToCodigo.get(bucket) : null;

    if (lookup) {
      const existing = byCodigo.get(lookup.codigo);
      if (existing) {
        existing.cobranzaGs += row.montoTotal;
        existing.cuotasCobradas += 1;
        if (dsoVal != null) {
          existing.dsoSum += dsoVal;
          existing.dsoCount += 1;
        }
      } else {
        byCodigo.set(lookup.codigo, {
          vendedorCodigo: lookup.codigo,
          vendedorNombre: lookup.nombre,
          cobranzaGs:     row.montoTotal,
          cuotasCobradas: 1,
          dsoSum:         dsoVal != null ? dsoVal : 0,
          dsoCount:       dsoVal != null ? 1 : 0,
        });
      }
    } else {
      const key = bucket ?? "SIN_VENDEDOR";
      const u = unBuckets.get(key);
      if (u) {
        u.cobranzaGs += row.montoTotal;
        u.cuotasCobradas += 1;
        if (dsoVal != null) {
          u.dsoSum += dsoVal;
          u.dsoCount += 1;
        }
      } else {
        unBuckets.set(key, {
          cobranzaGs:     row.montoTotal,
          cuotasCobradas: 1,
          dsoSum:         dsoVal != null ? dsoVal : 0,
          dsoCount:       dsoVal != null ? 1 : 0,
        });
      }
    }
  }

  const out = new Map<number, CobranzaByVendedor>();
  for (const acc of byCodigo.values()) {
    out.set(acc.vendedorCodigo, {
      vendedorCodigo: acc.vendedorCodigo,
      vendedorNombre: acc.vendedorNombre,
      cobranzaGs:     acc.cobranzaGs,
      cuotasCobradas: acc.cuotasCobradas,
      dsoDias:        acc.dsoCount > 0 ? acc.dsoSum / acc.dsoCount : null,
    });
  }

  const unattributed: CobranzaUnattributed[] = [];
  for (const [bucket, u] of unBuckets) {
    unattributed.push({
      bucket,
      cobranzaGs:     u.cobranzaGs,
      cuotasCobradas: u.cuotasCobradas,
      dsoDias:        u.dsoCount > 0 ? u.dsoSum / u.dsoCount : null,
    });
  }

  return { byCodigo: out, unattributed };
}

// ─── DSO global ────────────────────────────────────────────────────────────

/**
 * DSO ponderado por cantidad de cuotas a través de todos los vendedores
 * (incluye unattributed). null si no hay cuotas con DSO válido.
 *
 * Sirve para el KPI "Días promedio de pago" de la sección de comisiones.
 */
export function calcOverallDSO(result: CobranzaAggregateResult): number | null {
  let sum = 0;
  let count = 0;

  for (const v of result.byCodigo.values()) {
    if (v.dsoDias != null) {
      sum += v.dsoDias * v.cuotasCobradas;
      count += v.cuotasCobradas;
    }
  }
  for (const u of result.unattributed) {
    if (u.dsoDias != null) {
      sum += u.dsoDias * u.cuotasCobradas;
      count += u.cuotasCobradas;
    }
  }

  return count > 0 ? sum / count : null;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

interface ParsedDate {
  year:  number;
  month: number;
  day:   number;
  ts:    number; // epoch ms UTC para diferencias
}

/** Parsea YYYY-MM-DD. null si formato inválido. */
export function parseISO(iso: string): ParsedDate | null {
  if (!iso || iso.length < 10) return null;
  const y = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7));
  const d = Number(iso.slice(8, 10));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  // UTC ts para evitar drift por timezone local
  const ts = Date.UTC(y, m - 1, d);
  return { year: y, month: m, day: d, ts };
}

/** Diferencia en días entre dos fechas (b - a). */
export function daysBetween(a: ParsedDate, b: ParsedDate): number {
  const MS_PER_DAY = 86_400_000;
  return Math.round((b.ts - a.ts) / MS_PER_DAY);
}

/** Normaliza nombre de vendedor: trim + UPPER, null si vacío. */
export function canonicalSellerName(name: string | null | undefined): string | null {
  if (!name) return null;
  const t = name.trim().toUpperCase();
  return t === "" ? null : t;
}
