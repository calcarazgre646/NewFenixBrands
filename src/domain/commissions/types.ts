/**
 * domain/commissions/types.ts
 *
 * Tipos del dominio de Comisiones.
 * 8 roles de comisión × 3 canales. Escalas escalonadas por % de cumplimiento.
 */

/** Roles de comisión (determina qué escala aplicar) */
export type CommissionRole =
  | "vendedor_mayorista"
  | "vendedor_utp"
  | "backoffice_utp"
  | "gerencia_mayorista"
  | "gerencia_utp"
  | "vendedor_tienda"
  | "supervisor_tienda"
  | "gerencia_retail";

/** Canal comercial */
export type CommissionChannel = "mayorista" | "utp" | "retail";

/** Tipo de comisión: porcentaje sobre ventas o monto fijo en Gs. */
export type CommissionType = "percentage" | "fixed";

/** Tramo de una escala de comisión */
export interface CommissionTier {
  minPct: number;      // % cumplimiento mínimo (inclusive)
  maxPct: number;      // % cumplimiento máximo (exclusive), Infinity para último tramo
  value: number;        // % de comisión (0.85 = 0.85%) o monto fijo en Gs.
}

/** Escala completa de comisión para un rol */
export interface CommissionScale {
  role: CommissionRole;
  channel: CommissionChannel;
  type: CommissionType;
  label: string;
  tiers: CommissionTier[];
}

/** Meta mensual de un vendedor */
export interface SellerGoal {
  vendedorCodigo: number;
  vendedorNombre: string;
  rolComision: CommissionRole;
  canal: CommissionChannel;
  año: number;
  mes: number;
  trimestre: number;
  metaVentas: number;       // Gs.
  metaCobranza: number;     // Gs. (solo Mayorista/UTP)
  sucursalCodigo: string | null;
}

/** Ventas reales de un vendedor en un mes */
export interface SellerSales {
  vendedorCodigo: number;
  vendedorNombre: string;
  sucursal: string;
  canal: string;
  año: number;
  mes: number;
  ventaNeta: number;        // Gs. (v_vtasimpu)
  unidades: number;
  transacciones: number;
}

/** Resultado del cálculo de comisión para un vendedor/mes */
export interface CommissionResult {
  vendedorCodigo: number;
  vendedorNombre: string;
  rolComision: CommissionRole;
  canal: CommissionChannel;
  año: number;
  mes: number;
  // Ventas
  metaVentas: number;
  ventaReal: number;
  cumplimientoVentasPct: number;    // 0-∞ (ej: 115.5 = 115.5%)
  comisionVentasPct: number;        // % aplicado (ej: 1.25)
  comisionVentasGs: number;         // Gs. calculados
  // Cobranza (solo Mayorista/UTP, 0 para Retail)
  metaCobranza: number;
  cobranzaReal: number;
  cumplimientoCobranzaPct: number;
  comisionCobranzaPct: number;
  comisionCobranzaGs: number;
  // Total
  comisionTotalGs: number;          // ventasGs + cobranzaGs (o monto fijo para supervisores)
  tipoComision: CommissionType;
  sucursal: string | null;
}

/** Resumen de comisiones de un período */
export interface CommissionSummary {
  año: number;
  mes: number;
  totalVendedores: number;
  totalComisionesGs: number;
  byChannel: Record<CommissionChannel, { count: number; totalGs: number }>;
  byRole: Record<CommissionRole, { count: number; totalGs: number }>;
  results: CommissionResult[];
}
