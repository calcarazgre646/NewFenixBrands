/**
 * domain/projections/types.ts
 *
 * Tipos del dominio de Proyección de Ventas por Vendedor.
 *
 * Modelo: run-rate lineal diario.
 *   ritmoDiario = ventaAcumulada / díasTranscurridos
 *   ventaProyectada = ventaAcumulada + ritmoDiario × díasRestantes
 *
 * La comisión proyectada se calcula con el motor existente de comisiones
 * (domain/commissions) reusando escala + cumplimiento, con cobranza = 0
 * (Mayorista/UTP queda subestimado hasta que c_cobrar tenga datos).
 */
import type { CommissionChannel, CommissionRole } from "@/domain/commissions/types";

/** Venta neta de un vendedor en un día específico */
export interface DailySalePoint {
  day: number;          // 1-31
  ventaNeta: number;    // Gs.
}

/** Identidad mínima del vendedor para construir una proyección */
export interface SellerIdentity {
  vendedorCodigo: number;
  vendedorNombre: string;
  rolComision: CommissionRole;
  canal: CommissionChannel;
  sucursalCodigo: string | null;
}

/** Resultado de la proyección de un vendedor para un mes */
export interface SellerProjection {
  vendedorCodigo: number;
  vendedorNombre: string;
  rolComision: CommissionRole;
  canal: CommissionChannel;
  sucursalCodigo: string | null;
  año: number;
  mes: number;

  // ── Tiempo ──
  diasTranscurridos: number;        // 0..diasMes (inclusive del día actual si aplica)
  diasMes: number;                  // 28-31
  diasRestantes: number;            // diasMes - diasTranscurridos

  // ── Ventas ──
  ventaActual: number;              // Gs. acumulados hasta hoy
  ritmoDiario: number;              // Gs./día
  ventaProyectada: number;          // Gs. estimados al cierre del mes

  // ── Meta y cumplimiento (null si no hay meta cargada) ──
  metaVentas: number | null;
  cumplimientoActualPct: number | null;
  cumplimientoProyectadoPct: number | null;

  // ── Comisión (null si no hay meta — Mayorista/UTP sin tabla) ──
  comisionActualGs: number | null;
  comisionProyectadaGs: number | null;
  /** % aplicado en la proyección (tramo de la escala) */
  comisionProyectadaPct: number | null;

  // ── Cobranza (Mayorista/UTP, null para Retail o cuando no hay datos) ──
  /** Meta de cobranza del mes (Gs.). null si no aplica o no está cargada. */
  metaCobranza: number | null;
  /** Cobranza efectivamente realizada en el mes (Gs.). null si no se cargó la fuente. */
  cobranzaActual: number | null;
  /** Cumplimiento % de cobranza vs meta. null si no aplica. */
  cumplimientoCobranzaPct: number | null;
  /** Comisión de cobranza acumulada (Gs.) — calculada con el mismo tramo de la escala del rol. */
  comisionCobranzaActualGs: number | null;
  /** DSO (días promedio de pago) del vendedor en el mes. null si no hay cuotas válidas. */
  dsoDias: number | null;

  // ── Estado ──
  /** true si hay meta cargada (Retail siempre; Mayorista/UTP solo si vino de comisiones_metas_vendedor) */
  hasMeta: boolean;
  /** true si el mes ya cerró (no hay días futuros que proyectar) */
  isMonthClosed: boolean;
  /** true si el mes está en curso (hay días futuros y ya pasó al menos un día) */
  isInProgress: boolean;
}

/** Punto diario para gráfico acumulado: real hasta hoy, proyección lineal después */
export interface DailyProjectionPoint {
  day: number;
  label: string;          // "1", "2", ..., "31"
  /** Venta del día (no acumulada). null para días futuros. */
  ventaDia: number | null;
  /** Acumulado real hasta el día. null para días futuros. */
  ventaAcumReal: number | null;
  /** Acumulado proyectado: real hasta hoy, lineal después. Siempre presente. */
  ventaAcumProyectada: number;
  /** Acumulado de meta lineal (meta/diasMes × día). null si no hay meta. */
  ventaAcumMeta: number | null;
  /** true para el día calendario actual (current month) */
  isToday: boolean;
}

/** Inputs para construir una proyección */
export interface BuildProjectionInput {
  seller: SellerIdentity;
  /** Ventas diarias del mes (puede tener huecos para días sin venta) */
  daily: DailySalePoint[];
  año: number;
  mes: number;
  /**
   * Meta de ventas del vendedor para el mes. null si no hay (Mayorista/UTP
   * sin tabla `comisiones_metas_vendedor`). Cobranza no se proyecta (= 0).
   */
  metaVentas: number | null;
  /**
   * Cobranza acumulada del mes (Gs.). undefined si la fuente no está cargada
   * (proyección queda con cobranza=null). 0 es válido y significa "cargado pero no cobró nada".
   * Sólo aplica a Mayorista/UTP — Retail siempre debería pasar undefined.
   */
  cobranzaActual?: number;
  /** Meta de cobranza del mes (Gs.). undefined o 0 → no se calcula comisión cobranza. */
  metaCobranza?: number;
  /** DSO del vendedor en el mes (días). null si no hay cuotas válidas. */
  dsoDias?: number | null;
  /** Día calendario actual del sistema (1-31) — fuente de verdad del tiempo */
  calendarDay: number;
  /** Mes calendario actual del sistema (1-12) */
  calendarMonth: number;
  /** Año calendario actual del sistema */
  calendarYear: number;
}
