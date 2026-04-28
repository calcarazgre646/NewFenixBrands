/**
 * domain/filters/b2b.ts
 *
 * Funciones puras para traducir un `B2bSubchannel` a los valores
 * concretos que esperan las distintas tablas del ERP.
 *
 * Verificado contra BD al 2026-04-28:
 *   - mv_ventas_mensual:  B2B sólo tiene v_sucursal_final ∈ {MAYORISTA, UTP}
 *   - fjdhstvta1:         cruce 1:1 entre v_sucursal_final y v_uniforme:
 *                           MAYORISTA ↔ vtaxmayor
 *                           UTP       ↔ uniforme
 *
 * El sub-filtro sólo aplica cuando channel === "b2b". Para "all" estas
 * funciones devuelven null y la query no agrega cláusula extra.
 */
import type { B2bSubchannel } from "./types";

/**
 * Devuelve el valor esperado en `v_sucursal_final` para el sub-filtro,
 * o null si el sub-filtro es "all" (no agregar filtro).
 */
export function b2bSubchannelToSucursalFinal(sub: B2bSubchannel): string | null {
  if (sub === "mayorista") return "MAYORISTA";
  if (sub === "utp")       return "UTP";
  return null;
}

/**
 * Devuelve el valor esperado en `v_uniforme` para el sub-filtro,
 * o null si el sub-filtro es "all" (no agregar filtro).
 *
 * Útil para fjdhstvta1 cuando ya hay otro filtro en v_sucursal_final.
 */
export function b2bSubchannelToUniforme(sub: B2bSubchannel): string | null {
  if (sub === "mayorista") return "vtaxmayor";
  if (sub === "utp")       return "uniforme";
  return null;
}

/**
 * Etiqueta corta para mostrar en UI cuando el sub-filtro está activo.
 * Útil para badges, breadcrumbs, etc.
 */
export function b2bSubchannelLabel(sub: B2bSubchannel): string {
  if (sub === "mayorista") return "Mayorista";
  if (sub === "utp")       return "UTP";
  return "Todos";
}
