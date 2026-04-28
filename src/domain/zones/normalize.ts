/**
 * domain/zones/normalize.ts
 *
 * Frontera entre los strings de zona crudos de BD y el resto de la app.
 *
 * Por qué existe: los datos de zona en `maestro_clientes_mayoristas.zona`
 * y `comisiones_metas_vendedor.zona` llegan con casing mixto, newlines
 * literales y variantes numeradas que rompen cualquier groupBy.
 *
 * Aplicar SIEMPRE en queries (frontera), nunca en componentes.
 */
import type { Zone } from "./types";

const NUMBERED_VARIANT_RE = /^(NORTE|SUR|ESTE|CAPITAL|CENTRAL)\s+\d+$/;

/**
 * Normaliza un string de zona crudo a su forma canónica.
 *
 * Reglas:
 *   - null / undefined / vacío / sólo whitespace → null
 *   - Cualquier secuencia de whitespace (incluido `\n`) → un espacio
 *   - Uppercase
 *   - Variantes numeradas de zonas geográficas se colapsan al nombre
 *     base: "SUR 2" → "SUR" (las metas no usan variantes numeradas, así
 *     que esto sólo aplica al master). UTP TERRITORIO N se respeta porque
 *     allí el número distingue la zona, no es una variante.
 */
export function normalizeZone(raw: string | null | undefined): Zone | null {
  if (raw == null) return null;
  const collapsed = String(raw).replace(/\s+/g, " ").trim().toUpperCase();
  if (collapsed === "") return null;
  return collapsed.replace(NUMBERED_VARIANT_RE, "$1");
}
