/**
 * features/commissions/hooks/derive.ts
 *
 * Helpers puros que dan forma a la data del hook `useCompensation`. Viven
 * fuera del hook para que sean testeables sin TanStack Query ni React.
 */
import type {
  CommissionResult,
  CommissionChannel,
} from "@/domain/commissions/types";
import type { SellerProjection } from "@/domain/projections/types";
import type { CobranzaUnattributed } from "@/domain/cobranza/types";

export interface CompensationRow {
  projection: SellerProjection;
  result:     CommissionResult;
}

/** Filtro de canal aplicado al summary — controla qué porción del pool unattributed se suma. */
export type SummaryChannelScope = "todos" | "retail" | "mayorista" | "utp";

/**
 * Atribución del pool unattributed a un canal:
 *   - UNIFORMES: por convención del cliente, son ventas UTP. Se atribuye a UTP.
 *   - SIN_VENDEDOR: ambiguo. Sólo se incluye en "todos" para evitar engañar a un canal específico.
 *   - Otros buckets: ambiguos. Sólo en "todos".
 */
function unattributedBelongsToScope(bucket: string, scope: SummaryChannelScope): boolean {
  if (scope === "todos") return true;
  if (scope === "retail" || scope === "mayorista") return false;
  if (scope === "utp") return bucket === "UNIFORMES";
  return false;
}

export interface CompensationSummary {
  totalVendedores: number;
  totalVentaActual: number;
  totalVentaProyectada: number;
  totalComisionActualGs: number;
  totalComisionProyectadaGs: number;
  totalCobranzaActualGs: number;
  totalComisionCobranzaActualGs: number;
  /** Comisión total del scope (ventas + cobranza acumuladas hasta hoy). */
  totalComisionTotalActualGs: number;
  /** DSO promedio del scope (días). null si no hay cuotas válidas. */
  overallDSODias: number | null;
}

/**
 * Deriva un `CommissionResult` (estado actual) a partir de una
 * `SellerProjection`. Usa los campos `*Actual*` de la proyección. Si
 * Mayorista/UTP no tiene meta cargada, los % y Gs. quedan en 0 (UI "Pendiente").
 */
export function projectionToResult(p: SellerProjection): CommissionResult {
  const comisionVentasGs = p.comisionActualGs ?? 0;
  const comisionCobranzaGs = p.comisionCobranzaActualGs ?? 0;
  return {
    vendedorCodigo: p.vendedorCodigo,
    vendedorNombre: p.vendedorNombre,
    rolComision: p.rolComision,
    canal: p.canal,
    año: p.año,
    mes: p.mes,
    metaVentas: p.metaVentas ?? 0,
    ventaReal: p.ventaActual,
    cumplimientoVentasPct: p.cumplimientoActualPct ?? 0,
    comisionVentasPct: 0,
    comisionVentasGs,
    metaCobranza: p.metaCobranza ?? 0,
    cobranzaReal: p.cobranzaActual ?? 0,
    cumplimientoCobranzaPct: p.cumplimientoCobranzaPct ?? 0,
    comisionCobranzaPct: 0,
    comisionCobranzaGs,
    comisionTotalGs: comisionVentasGs + comisionCobranzaGs,
    tipoComision: "percentage",
    sucursal: p.sucursalCodigo,
  };
}

/** Suma los totales del scope.
 *
 * Si se pasa `unattributed` + `channel`, el pool de cobranza no atribuida
 * se suma cuando aplica al canal: UNIFORMES → UTP, todo → "todos".
 */
export function buildCompensationSummary(
  rows: CompensationRow[],
  unattributed: CobranzaUnattributed[] = [],
  channel: SummaryChannelScope = "todos",
): CompensationSummary {
  let totalVentaActual = 0;
  let totalVentaProyectada = 0;
  let totalComisionActual = 0;
  let totalComisionProyectada = 0;
  let totalCobranzaActual = 0;
  let totalComisionCobranzaActual = 0;
  let dsoSum = 0;
  let dsoCount = 0;

  for (const { projection: p } of rows) {
    totalVentaActual += p.ventaActual;
    totalVentaProyectada += p.ventaProyectada;
    totalComisionActual += p.comisionActualGs ?? 0;
    totalComisionProyectada += p.comisionProyectadaGs ?? 0;
    totalCobranzaActual += p.cobranzaActual ?? 0;
    totalComisionCobranzaActual += p.comisionCobranzaActualGs ?? 0;
    if (p.dsoDias != null) {
      dsoSum += p.dsoDias;
      dsoCount += 1;
    }
  }

  // Sumar el pool unattributed que aplica a este canal (cobranza + DSO ponderado).
  for (const u of unattributed) {
    if (!unattributedBelongsToScope(u.bucket, channel)) continue;
    totalCobranzaActual += u.cobranzaGs;
    if (u.dsoDias != null && u.cuotasCobradas > 0) {
      // Para que el promedio sea coherente con el de los vendedores individuales,
      // tratamos el bucket como N "vendedores" virtuales (uno por cuota cobrada).
      dsoSum += u.dsoDias * u.cuotasCobradas;
      dsoCount += u.cuotasCobradas;
    }
  }

  return {
    totalVendedores: rows.length,
    totalVentaActual,
    totalVentaProyectada,
    totalComisionActualGs: totalComisionActual,
    totalComisionProyectadaGs: totalComisionProyectada,
    totalCobranzaActualGs: totalCobranzaActual,
    totalComisionCobranzaActualGs: totalComisionCobranzaActual,
    totalComisionTotalActualGs: totalComisionActual + totalComisionCobranzaActual,
    overallDSODias: dsoCount > 0 ? dsoSum / dsoCount : null,
  };
}

/** Filtra rows por canal. "todos" devuelve la misma lista. */
export function filterRowsByChannel(
  rows: CompensationRow[],
  channel: CommissionChannel | "todos",
): CompensationRow[] {
  if (channel === "todos") return rows;
  return rows.filter((r) => r.projection.canal === channel);
}

/**
 * Devuelve los top-N mejores y los top-N peores en cumplimiento proyectado.
 * Ignora vendedores sin meta cargada.
 */
export function buildTopBottoms(
  rows: CompensationRow[],
  n = 5,
): { topAhead: CompensationRow[]; topBehind: CompensationRow[] } {
  const withMeta = rows.filter((r) => (r.projection.metaVentas ?? 0) > 0);
  const sortedDesc = [...withMeta].sort(
    (a, b) =>
      (b.projection.cumplimientoProyectadoPct ?? 0) -
      (a.projection.cumplimientoProyectadoPct ?? 0),
  );
  return {
    topAhead: sortedDesc.slice(0, n),
    topBehind: sortedDesc.slice(-n).reverse(),
  };
}
