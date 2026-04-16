/**
 * domain/lifecycle/types.ts
 *
 * Tipos del sistema de lifecycle management de SKUs.
 * Classifica productos por tipo, define acciones por tramo de edad × STH,
 * y asigna responsables por acción.
 *
 * Fuente: Definiciones de Rodrigo Aguayo (01/04–09/04/2026).
 */

/** Tipo de producto — determina umbrales de STH */
export type ProductType = "carry_over" | "basicos" | "temporada";

/** Tramos de edad en días (6 brackets) */
export type AgeBracket = 15 | 30 | 45 | 60 | 75 | 90;

export const AGE_BRACKETS: AgeBracket[] = [15, 30, 45, 60, 75, 90];

/** Acción recomendada por tramo de edad cuando STH < umbral */
export type LifecycleAction =
  | "revisar_exhibicion"       // 15d: revisar exhibición en tienda
  | "revisar_asignacion"       // 30d: revisar asignación de tienda
  | "accion_comercial"         // 45d: acción comercial y marketing
  | "markdown_selectivo"       // 60d: markdown selectivo
  | "transferencia_out"        // 75d: transferencia OUT + markdown progresivo
  | "markdown_liquidacion";    // 90d: markdown liquidación

/** Roles responsables de ejecutar acciones */
export type ResponsibleRole =
  | "marketing_b2c"
  | "brand_manager"
  | "gerencia_retail"
  | "operaciones_retail"
  | "logistica";

/** Resultado de evaluar linealidad para un SKU en un tramo */
export interface LinealidadResult {
  bracket: AgeBracket;
  requiredSth: number;       // 0-100 (umbral mínimo para este tramo)
  actualSth: number;         // 0-100 (STH real o proxy)
  isBelowThreshold: boolean; // true si STH < requiredSth
  action: LifecycleAction | null;  // null si STH >= requiredSth
  responsibleRoles: ResponsibleRole[];
}

/** Config de linealidad: umbral STH mínimo por tipo × bracket */
export interface LinealidadThresholds {
  carry_over: Record<AgeBracket, number>;
  basicos: Record<AgeBracket, number>;
  temporada: Record<AgeBracket, number>;
}
