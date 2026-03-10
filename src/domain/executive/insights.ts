/**
 * domain/executive/insights.ts
 *
 * Funciones puras para generar insights automáticos del dashboard ejecutivo.
 *
 * Dos modos:
 *   1. Vista "Todas las marcas": compara marcas entre sí vs presupuesto.
 *   2. Vista de marca individual: compara canales (B2B vs B2C) para esa marca.
 *
 * Cero dependencias de React. Cero side effects. Testeables aisladamente.
 */

export interface BrandInsight {
  /** Etiqueta del insight (marca o canal) */
  label: string;
  type: "outperforming" | "underperforming" | "stable";
  /** % vs presupuesto (ej: 108 = 8% encima del target) */
  pacePercent: number;
  /** Contribución absoluta al gap (positivo = ayuda, negativo = perjudica) */
  impact: number;
}

interface AggRow {
  key: string;
  actual: number;
  target: number;
}

const STABLE_THRESHOLD = 3; // +/- 3% = "estable"

/**
 * Genera hasta `limit` insights a partir de pares actual/target agrupados por key.
 */
function buildInsights(rows: AggRow[], limit: number): BrandInsight[] {
  const insights: BrandInsight[] = [];

  for (const { key, actual, target } of rows) {
    if (target <= 0 && actual <= 0) continue;

    const pacePercent = target > 0 ? (actual / target) * 100 : 0;
    const impact = actual - target;
    const deviation = pacePercent - 100;

    let type: BrandInsight["type"];
    if (deviation > STABLE_THRESHOLD) type = "outperforming";
    else if (deviation < -STABLE_THRESHOLD) type = "underperforming";
    else type = "stable";

    insights.push({ label: key, type, pacePercent, impact });
  }

  insights.sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));
  return insights.slice(0, limit);
}

// ─── Modo 1: Vista "Todas las marcas" — compara marcas ─────────────────────

/**
 * Genera insights por MARCA (Martel vs Wrangler vs Lee).
 * Requiere ventas y presupuesto ya filtrados por canal y periodo.
 */
export function generateBrandInsights(
  sales: Array<{ brand: string; neto: number }>,
  budget: Array<{ brand: string; revenue: number }>,
  limit = 3,
): BrandInsight[] {
  const salesMap = new Map<string, number>();
  for (const s of sales) salesMap.set(s.brand, (salesMap.get(s.brand) ?? 0) + s.neto);

  const budgetMap = new Map<string, number>();
  for (const b of budget) budgetMap.set(b.brand, (budgetMap.get(b.brand) ?? 0) + b.revenue);

  const allKeys = new Set([...salesMap.keys(), ...budgetMap.keys()]);
  const rows: AggRow[] = [];
  for (const key of allKeys) {
    if (key === "Otras") continue;
    rows.push({ key, actual: salesMap.get(key) ?? 0, target: budgetMap.get(key) ?? 0 });
  }

  return buildInsights(rows, limit);
}

// ─── Modo 2: Vista de marca individual — compara canales ────────────────────

/**
 * Genera insights por CANAL (B2B vs B2C) para una marca específica.
 * Requiere ventas y presupuesto ya filtrados por marca y periodo.
 */
export function generateChannelInsights(
  sales: Array<{ channel: string | null; neto: number }>,
  budget: Array<{ area: string; revenue: number }>,
  limit = 3,
): BrandInsight[] {
  const salesMap = new Map<string, number>();
  for (const s of sales) {
    const ch = s.channel ?? "Otro";
    salesMap.set(ch, (salesMap.get(ch) ?? 0) + s.neto);
  }

  const budgetMap = new Map<string, number>();
  for (const b of budget) budgetMap.set(b.area, (budgetMap.get(b.area) ?? 0) + b.revenue);

  const rows: AggRow[] = [];
  for (const ch of ["B2C", "B2B"]) {
    const actual = salesMap.get(ch) ?? 0;
    const target = budgetMap.get(ch) ?? 0;
    if (actual > 0 || target > 0) {
      rows.push({ key: ch, actual, target });
    }
  }

  return buildInsights(rows, limit);
}

// ─── Helpers de agregación ──────────────────────────────────────────────────

/**
 * Agrega ventas por marca para los meses activos del periodo.
 */
export function aggregateSalesByBrand(
  rows: Array<{ brand: string; month: number; neto: number }>,
  activeMonths: number[],
): Array<{ brand: string; neto: number }> {
  const map = new Map<string, number>();
  for (const r of rows) {
    if (!activeMonths.includes(r.month)) continue;
    map.set(r.brand, (map.get(r.brand) ?? 0) + r.neto);
  }
  return [...map.entries()].map(([brand, neto]) => ({ brand, neto }));
}

/**
 * Agrega ventas por canal para los meses activos del periodo.
 */
export function aggregateSalesByChannel(
  rows: Array<{ channel: string | null; month: number; neto: number }>,
  activeMonths: number[],
): Array<{ channel: string | null; neto: number }> {
  const map = new Map<string | null, number>();
  for (const r of rows) {
    if (!activeMonths.includes(r.month)) continue;
    map.set(r.channel, (map.get(r.channel) ?? 0) + r.neto);
  }
  return [...map.entries()].map(([channel, neto]) => ({ channel, neto }));
}

/**
 * Agrega presupuesto por marca para los meses activos.
 * Filtra opcionalmente por canal (area).
 */
export function aggregateBudgetByBrand(
  rows: Array<{ brand: string; month: number; area: string; revenue: number }>,
  activeMonths: number[],
  channelFilter?: string,
  partialProrata?: { month: number; factor: number } | null,
): Array<{ brand: string; revenue: number }> {
  const ch = channelFilter && channelFilter !== "total" ? channelFilter.toUpperCase() : null;
  const map = new Map<string, number>();
  for (const r of rows) {
    if (!activeMonths.includes(r.month)) continue;
    if (ch && r.area !== ch) continue;
    const factor = partialProrata && r.month === partialProrata.month ? partialProrata.factor : 1;
    map.set(r.brand, (map.get(r.brand) ?? 0) + r.revenue * factor);
  }
  return [...map.entries()].map(([brand, revenue]) => ({ brand, revenue }));
}

/**
 * Agrega presupuesto por canal (area) para los meses activos.
 * Filtra opcionalmente por marca.
 */
export function aggregateBudgetByChannel(
  rows: Array<{ brand: string; month: number; area: string; revenue: number }>,
  activeMonths: number[],
  brandFilter?: string,
  partialProrata?: { month: number; factor: number } | null,
): Array<{ area: string; revenue: number }> {
  const map = new Map<string, number>();
  for (const r of rows) {
    if (!activeMonths.includes(r.month)) continue;
    if (brandFilter && r.brand !== brandFilter) continue;
    const factor = partialProrata && r.month === partialProrata.month ? partialProrata.factor : 1;
    map.set(r.area, (map.get(r.area) ?? 0) + r.revenue * factor);
  }
  return [...map.entries()].map(([area, revenue]) => ({ area, revenue }));
}
