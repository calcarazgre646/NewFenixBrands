/**
 * api/normalize.ts
 *
 * Frontera de datos: aquí transformamos los datos crudos del ERP legacy
 * a tipos limpios que usa el resto de la app.
 *
 * PROBLEMAS del ERP que se resuelven aquí (UNA SOLA VEZ):
 *   - Padding de espacios: "ESTRELLA    " → "ESTRELLA"
 *   - Placeholders vacíos: "." o "    ." → null
 *   - Numéricos como float: v_año=2026.0 → 2026
 *   - Strings de fecha: "10/09/2025" → Date
 *   - Montos paraguayos: "6.263.380" → 6263380
 *   - Montos dólares: "$68,450.00" → 68450.00
 *   - Marcas con sub-marcas: "Martel Premium" → "Martel"
 *
 * REGLA: Solo este archivo sabe que el ERP tiene padding. El resto de la app
 * recibe strings limpios y números.
 */

// ─── Primitivas de limpieza ───────────────────────────────────────────────────

/** Trim + null si vacío o placeholder "." */
export function cleanStr(val: string | null | undefined): string | null {
  if (val == null) return null;
  const t = val.trim();
  if (t === "" || t === "." || /^\.+\s*$/.test(t)) return null;
  return t;
}

/** Trim obligatorio — retorna string vacío si falla */
export function trimStr(val: string | null | undefined): string {
  return val?.trim() ?? "";
}

/** float/string → entero */
export function toInt(val: number | string | null | undefined): number {
  if (val == null) return 0;
  return Math.round(Number(val));
}

/** float → number con decimales */
export function toNum(val: number | string | null | undefined): number {
  if (val == null) return 0;
  return Number(val);
}

/**
 * Parsea monto paraguayo en string: "6.263.380" → 6263380
 * El separador de miles en Paraguay es el punto.
 */
export function parsePYGString(val: string | null | undefined): number {
  if (!val) return 0;
  return parseInt(val.replace(/\./g, "").trim(), 10) || 0;
}

/**
 * Parsea monto dólares: "$68,450.00" → 68450
 * La coma es separador de miles (formato americano). El punto es el decimal.
 */
export function parseUSDString(val: string | null | undefined): number {
  if (!val) return 0;
  return parseFloat(val.replace("$", "").replace(/,/g, "").trim()) || 0;
}

/**
 * Parsea porcentaje: "64%" → 64
 */
export function parsePct(val: string | null | undefined): number {
  if (!val) return 0;
  return parseFloat(val.replace("%", "").trim()) || 0;
}

/**
 * Parsea fecha DD/MM/YYYY → Date
 * Formato estilo europeo/paraguayo.
 */
export function parseDDMMYYYY(val: string | null | undefined): Date | null {
  if (!val) return null;
  const [day, month, year] = val.trim().split("/");
  if (!day || !month || !year) return null;
  return new Date(Number(year), Number(month) - 1, Number(day));
}

/**
 * Parsea periodo YYYYMM: "202601" → { year: 2026, month: 1 }
 */
export function parsePeriodYYYYMM(val: string): { year: number; month: number } {
  return {
    year:  parseInt(val.slice(0, 4), 10),
    month: parseInt(val.slice(4, 6), 10),
  };
}

// ─── Normalización de Marcas ──────────────────────────────────────────────────

/**
 * Mapa de normalización de marcas del ERP → marca canónica de la app.
 * Fuente: Dim_marcas (22 filas auditadas 03/03/2026)
 */
const BRAND_MAP: Record<string, string> = {
  "martel":          "Martel",
  "martel premium":  "Martel",
  "martel ao po'i":  "Martel",
  "martel express":  "Martel",
  "niella":          "Martel",
  "wrangler":        "Wrangler",
  "lee":             "Lee",
  // Todo lo demás → "Otras"
};

export type BrandCanonical = "Martel" | "Wrangler" | "Lee" | "Otras";

export function normalizeBrand(raw: string | null | undefined): BrandCanonical {
  const key = (raw?.trim() ?? "").toLowerCase();
  return (BRAND_MAP[key] as BrandCanonical) ?? "Otras";
}

/** Normaliza brandId del filtro de la app a los valores canónicos del ERP */
export function brandIdToCanonical(brandId: string): BrandCanonical | null {
  const map: Record<string, BrandCanonical> = {
    martel:   "Martel",
    wrangler: "Wrangler",
    lee:      "Lee",
  };
  return map[brandId] ?? null; // null = "total" (sin filtro de marca)
}

// ─── Clasificación de Tiendas ─────────────────────────────────────────────────

/**
 * Tiendas B2B (mayoristas). Fuente: auditoria FenixBrands 26/02/2026.
 * REGLA: Si cosujd.trim() está en esta lista → B2B. Resto de activas → B2C.
 */
export const B2B_STORES = new Set(["MAYORISTA", "UTP"]);

/**
 * Tiendas excluidas del análisis comercial (depósitos, batas, lavado, etc.)
 */
export const EXCLUDED_STORES = new Set([
  "ALM-BATAS", "FABRICA", "LAMBARE", "LAVADO", "LUQ-DEP-OUT",
  "MP", // muestrarios, depósitos
]);

export function classifyStore(cosujd: string): "b2c" | "b2b" | "excluded" {
  const s = cosujd.trim().toUpperCase();
  if (EXCLUDED_STORES.has(s)) return "excluded";
  if (B2B_STORES.has(s))      return "b2b";
  return "b2c";
}

// ─── Clasificación de Canal ───────────────────────────────────────────────────

export type Channel = "B2C" | "B2B";

export function normalizeChannel(raw: string | null | undefined): Channel | null {
  const val = raw?.trim().toUpperCase();
  if (val === "B2C") return "B2C";
  if (val === "B2B") return "B2B";
  return null; // "Batas", "Interno", "Otros" → excluir
}
