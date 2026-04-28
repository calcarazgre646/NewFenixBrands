/**
 * domain/commissions/whatif.ts
 *
 * Simulador "what-if" determinístico que reusa `calcCommission` para responder
 * "si vendo Gs X más en N días, gano Gs Y más". Sin red, sin React.
 */
import type { SellerProjection } from "@/domain/projections/types";
import type { CommissionResult, CommissionScale, SellerGoal } from "./types";
import { calcCommission } from "./calculations";

export interface WhatIfInput {
  /** Ventas adicionales en Gs. (sobre la venta proyectada actual). Debe ser ≥ 0. */
  additionalGs: number;
  /** Días en los que se logran esas ventas adicionales. Solo informativo (UI). */
  daysAhead?: number;
}

export interface WhatIfResult {
  /** Ventas proyectadas originales (sin escenario). */
  ventaProyectadaOriginal: number;
  /** Ventas proyectadas en el escenario simulado. */
  ventaProyectadaSimulada: number;
  /** Gs. de comisión proyectada original. 0 si la proyección no tenía meta. */
  comisionOriginalGs: number;
  /** Gs. de comisión en el escenario simulado. */
  comisionSimuladaGs: number;
  /** Diferencia de comisión (simulada − original). */
  deltaComisionGs: number;
  /** % de cumplimiento simulado (sobre la meta original). */
  cumplimientoSimuladoPct: number;
  /** Resultado completo de la simulación, por si la UI quiere más detalle. */
  result: CommissionResult;
  /**
   * true si la proyección base no tenía meta (Mayorista/UTP sin
   * `comisiones_metas_vendedor`). En ese caso comisiones quedan en 0.
   */
  metaPendiente: boolean;
}

/**
 * Simula cuánta comisión adicional ganaría el vendedor si vendiera
 * `additionalGs` Gs. más en lo que queda del mes.
 *
 * Reusa `calcCommission` para que cualquier cambio de escala en
 * Configuración se propague automáticamente al simulador.
 */
export function simulateAdditionalSales(
  projection: SellerProjection,
  scale: CommissionScale,
  input: WhatIfInput,
): WhatIfResult {
  const additionalGs = Math.max(0, input.additionalGs);
  const ventaProyectadaOriginal = projection.ventaProyectada;
  const ventaProyectadaSimulada = ventaProyectadaOriginal + additionalGs;

  const meta = projection.metaVentas ?? 0;
  const metaPendiente = projection.metaVentas === null;

  const goal: SellerGoal = {
    vendedorCodigo: projection.vendedorCodigo,
    vendedorNombre: projection.vendedorNombre,
    rolComision: projection.rolComision,
    canal: projection.canal,
    año: projection.año,
    mes: projection.mes,
    trimestre: Math.ceil(projection.mes / 3),
    metaVentas: meta,
    metaCobranza: 0,
    sucursalCodigo: projection.sucursalCodigo,
  };

  // Cobranza no se simula (cobranzaReal=0). Las escalas se pasan por nombre
  // para reusar el motor exacto que la app usa en producción.
  const result = calcCommission(
    goal,
    ventaProyectadaSimulada,
    0,
    { [scale.role]: scale },
  );

  // Si no había meta, la UI debe mostrar "Pendiente" en comisión. Mantenemos
  // los Gs. en 0 pero exponemos el flag para que el componente decida.
  const comisionOriginalGs = projection.comisionProyectadaGs ?? 0;
  const comisionSimuladaGs = metaPendiente ? 0 : result.comisionTotalGs;

  return {
    ventaProyectadaOriginal,
    ventaProyectadaSimulada,
    comisionOriginalGs,
    comisionSimuladaGs,
    deltaComisionGs: comisionSimuladaGs - comisionOriginalGs,
    cumplimientoSimuladoPct: result.cumplimientoVentasPct,
    result,
    metaPendiente,
  };
}
