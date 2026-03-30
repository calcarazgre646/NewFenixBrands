/**
 * domain/commissions/calculations.ts
 *
 * Funciones puras para el cálculo de comisiones.
 *
 * REGLA: Sin I/O, sin React, sin Supabase. Solo funciones puras.
 */
import type {
  CommissionRole,
  CommissionScale,
  CommissionTier,
  CommissionResult,
  CommissionSummary,
  SellerGoal,
  SellerSales,
  CommissionChannel,
} from "./types";
import { SCALE_BY_ROLE } from "./scales";

// ─── Core ──────────────────────────────────────────────────────────────────

/** Calcula el % de cumplimiento: (real / meta) × 100. 0 si meta es 0. */
export function calcCumplimiento(real: number, meta: number): number {
  if (meta <= 0) return 0;
  return (real / meta) * 100;
}

/** Encuentra el tramo aplicable para un % de cumplimiento dado. */
export function findTier(tiers: CommissionTier[], cumplimientoPct: number): CommissionTier {
  for (const tier of tiers) {
    if (cumplimientoPct >= tier.minPct && cumplimientoPct < tier.maxPct) {
      return tier;
    }
  }
  // Fallback: último tramo (>=120%)
  return tiers[tiers.length - 1];
}

/**
 * Calcula la comisión para un tipo "percentage".
 * comisión = ventaReal × (tierValue / 100)
 */
export function calcPercentageCommission(ventaReal: number, tierValue: number): number {
  return Math.round(ventaReal * (tierValue / 100));
}

/**
 * Calcula la comisión para un tipo "fixed" (supervisores tienda).
 * comisión = monto fijo del tramo (en Gs.)
 */
export function calcFixedCommission(tierValue: number): number {
  return tierValue;
}

// ─── Cálculo por vendedor ──────────────────────────────────────────────────

/**
 * Calcula la comisión completa de un vendedor para un mes.
 *
 * Para Mayorista/UTP: comisión ventas + comisión cobranza (misma escala, bases distintas).
 * Para Retail: solo comisión ventas (cobranza = 0).
 * Para Supervisor Tienda: monto fijo según tramo (no %).
 */
export function calcCommission(
  goal: SellerGoal,
  ventaReal: number,
  cobranzaReal: number = 0,
): CommissionResult {
  const scale: CommissionScale = SCALE_BY_ROLE[goal.rolComision];

  // ── Ventas ──
  const cumplimientoVentasPct = calcCumplimiento(ventaReal, goal.metaVentas);
  const tierVentas = findTier(scale.tiers, cumplimientoVentasPct);

  let comisionVentasPct = 0;
  let comisionVentasGs = 0;

  if (scale.type === "percentage") {
    comisionVentasPct = tierVentas.value;
    comisionVentasGs = calcPercentageCommission(ventaReal, tierVentas.value);
  } else {
    // fixed (supervisor_tienda)
    comisionVentasGs = calcFixedCommission(tierVentas.value);
  }

  // ── Cobranza (solo Mayorista/UTP) ──
  let cumplimientoCobranzaPct = 0;
  let comisionCobranzaPct = 0;
  let comisionCobranzaGs = 0;

  if (goal.metaCobranza > 0 && scale.type === "percentage") {
    cumplimientoCobranzaPct = calcCumplimiento(cobranzaReal, goal.metaCobranza);
    const tierCobranza = findTier(scale.tiers, cumplimientoCobranzaPct);
    comisionCobranzaPct = tierCobranza.value;
    comisionCobranzaGs = calcPercentageCommission(cobranzaReal, tierCobranza.value);
  }

  return {
    vendedorCodigo: goal.vendedorCodigo,
    vendedorNombre: goal.vendedorNombre,
    rolComision: goal.rolComision,
    canal: goal.canal,
    año: goal.año,
    mes: goal.mes,
    // Ventas
    metaVentas: goal.metaVentas,
    ventaReal,
    cumplimientoVentasPct: Math.round(cumplimientoVentasPct * 100) / 100,
    comisionVentasPct,
    comisionVentasGs,
    // Cobranza
    metaCobranza: goal.metaCobranza,
    cobranzaReal,
    cumplimientoCobranzaPct: Math.round(cumplimientoCobranzaPct * 100) / 100,
    comisionCobranzaPct,
    comisionCobranzaGs,
    // Total
    comisionTotalGs: comisionVentasGs + comisionCobranzaGs,
    tipoComision: scale.type,
    sucursal: goal.sucursalCodigo,
  };
}

// ─── Cálculo batch ─────────────────────────────────────────────────────────

/**
 * Calcula comisiones para todos los vendedores de un período.
 * Cruza metas con ventas reales por vendedor_codigo + año + mes.
 */
export function calcAllCommissions(
  goals: SellerGoal[],
  sales: SellerSales[],
  _cobranzaByVendedor: Map<number, number> = new Map(),
): CommissionResult[] {
  // Agrupar ventas por vendedor+año+mes
  const salesMap = new Map<string, number>();
  for (const s of sales) {
    const key = `${s.vendedorCodigo}|${s.año}|${s.mes}`;
    salesMap.set(key, (salesMap.get(key) ?? 0) + s.ventaNeta);
  }

  return goals.map(goal => {
    const key = `${goal.vendedorCodigo}|${goal.año}|${goal.mes}`;
    const ventaReal = salesMap.get(key) ?? 0;
    const cobranzaReal = _cobranzaByVendedor.get(goal.vendedorCodigo) ?? 0;
    return calcCommission(goal, ventaReal, cobranzaReal);
  });
}

/**
 * Construye el resumen de comisiones de un período.
 */
export function buildCommissionSummary(
  results: CommissionResult[],
  año: number,
  mes: number,
): CommissionSummary {
  const byChannel: Record<CommissionChannel, { count: number; totalGs: number }> = {
    mayorista: { count: 0, totalGs: 0 },
    utp: { count: 0, totalGs: 0 },
    retail: { count: 0, totalGs: 0 },
  };

  const byRole = {} as Record<CommissionRole, { count: number; totalGs: number }>;
  let totalGs = 0;

  for (const r of results) {
    totalGs += r.comisionTotalGs;

    // By channel
    byChannel[r.canal].count++;
    byChannel[r.canal].totalGs += r.comisionTotalGs;

    // By role
    if (!byRole[r.rolComision]) byRole[r.rolComision] = { count: 0, totalGs: 0 };
    byRole[r.rolComision].count++;
    byRole[r.rolComision].totalGs += r.comisionTotalGs;
  }

  return {
    año,
    mes,
    totalVendedores: results.length,
    totalComisionesGs: totalGs,
    byChannel,
    byRole,
    results,
  };
}
