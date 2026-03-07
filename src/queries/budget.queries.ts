/**
 * queries/budget.queries.ts
 *
 * Queries de presupuesto.
 * Fuente: Budget_2026 (tabla hardcodeada al año — deuda técnica 2027)
 *
 * NOTA: Budget_2026 tiene montos como STRINGS con puntos como separadores de miles
 * (estilo paraguayo): "6.263.380" → 6263380.
 * La normalización de estos strings ocurre aquí.
 *
 * DEUDA TÉCNICA: Cuando llegue 2027, renombrar tabla o crear vista genérica "Budget".
 */
import { dataClient } from "@/api/client";
import { parsePYGString, trimStr, toNum } from "@/api/normalize";

export interface BudgetRow {
  year:    number;
  month:   number;      // 1-indexed
  area:    "B2C" | "B2B";
  brand:   string;      // "Lee", "Martel", "Wrangler"
  store:   string;      // Channel/Store
  units:   number;
  revenue: number;      // Gs.
  cogs:    number;      // Gs.
  grossMargin: number;  // Gs.
  gmPct:   number;      // 0-100
}

/** Mapa de nombre de mes en español → número */
const MONTH_MAP: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};

function parseMonthName(name: string): number {
  return MONTH_MAP[name.toLowerCase().trim()] ?? 0;
}

export async function fetchBudget(year: number): Promise<BudgetRow[]> {
  // La tabla se llama Budget_2026 — si el año es otro habrá que actualizar
  const tableName = `Budget_${year}`;

  const { data, error } = await dataClient
    .from(tableName)
    .select('"Year", "Month", "Area", "Brand", "Channel/Store", "Units", "Revenue", "COGS", "Gross Margin", "%GM"')
    .eq("Year", year);

  if (error) {
    console.warn(`fetchBudget: tabla ${tableName} no disponible — ${error.message}`);
    return [];
  }

  return (data ?? []).reduce<BudgetRow[]>((acc, r) => {
    const month = parseMonthName(trimStr(r["Month"]));
    if (!month) return acc; // fila inválida

    acc.push({
      year,
      month,
      area:        trimStr(r["Area"]) as "B2C" | "B2B",
      brand:       trimStr(r["Brand"]),
      store:       trimStr(r["Channel/Store"]),
      units:       toNum(r["Units"]),
      revenue:     parsePYGString(r["Revenue"]),
      cogs:        parsePYGString(r["COGS"]),
      grossMargin: parsePYGString(r["Gross Margin"]),
      gmPct:       parseFloat(trimStr(r["%GM"]).replace("%", "").replace(" ", "")) || 0,
    });
    return acc;
  }, []);
}
