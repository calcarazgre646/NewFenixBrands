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

export interface CompensationRow {
  projection: SellerProjection;
  result:     CommissionResult;
}

export interface CompensationSummary {
  totalVendedores: number;
  totalVentaActual: number;
  totalVentaProyectada: number;
  totalComisionActualGs: number;
  totalComisionProyectadaGs: number;
}

/**
 * Deriva un `CommissionResult` (estado actual) a partir de una
 * `SellerProjection`. Usa los campos `*Actual*` de la proyección. Si
 * Mayorista/UTP no tiene meta cargada, los % y Gs. quedan en 0 (UI "Pendiente").
 */
export function projectionToResult(p: SellerProjection): CommissionResult {
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
    comisionVentasGs: p.comisionActualGs ?? 0,
    metaCobranza: 0,
    cobranzaReal: 0,
    cumplimientoCobranzaPct: 0,
    comisionCobranzaPct: 0,
    comisionCobranzaGs: 0,
    comisionTotalGs: p.comisionActualGs ?? 0,
    tipoComision: "percentage",
    sucursal: p.sucursalCodigo,
  };
}

/** Suma los totales del scope. */
export function buildCompensationSummary(rows: CompensationRow[]): CompensationSummary {
  let totalVentaActual = 0;
  let totalVentaProyectada = 0;
  let totalComisionActual = 0;
  let totalComisionProyectada = 0;

  for (const { projection: p } of rows) {
    totalVentaActual += p.ventaActual;
    totalVentaProyectada += p.ventaProyectada;
    totalComisionActual += p.comisionActualGs ?? 0;
    totalComisionProyectada += p.comisionProyectadaGs ?? 0;
  }

  return {
    totalVendedores: rows.length,
    totalVentaActual,
    totalVentaProyectada,
    totalComisionActualGs: totalComisionActual,
    totalComisionProyectadaGs: totalComisionProyectada,
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
