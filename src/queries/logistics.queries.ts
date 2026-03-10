/**
 * queries/logistics.queries.ts
 *
 * Queries para el módulo de logística.
 * Fuente: Import (tabla de órdenes de importación, ~500 filas)
 *
 * NOTAS sobre la tabla:
 *   - COSTOESTIMADO: "$68,450.00" → USD, coma como separador de miles
 *   - PVPSUGERIDOB2C/B2B: string con coma como decimal
 *   - FECHAAPROXIMADADEARRIBO: string "MM/DD/YYYY" (formato USA, NO DD/MM/YYYY)
 *   - MARGENB2C/B2B: "64%" → number
 *   - Calidad de datos limitada (Derlys limpiará gradualmente)
 */
import { dataClient } from "@/api/client";
import { trimStr, toInt, parseUSDString, parsePct, normalizeBrand } from "@/api/normalize";
import { fetchAllRows } from "@/queries/paginate";

/**
 * Parsea fecha MM/DD/YYYY (formato EE.UU. que usa la tabla Import).
 * La tabla Import NO usa DD/MM/YYYY sino MM/DD/YYYY.
 * Fix documentado en logisticsService.ts del proyecto viejo (27/02/2026).
 */
function parseMMDDYYYY(val: string | null | undefined): Date | null {
  if (!val) return null;
  const parts = val.trim().split("/");
  if (parts.length !== 3) return null;
  const [m, d, y] = parts.map(Number);
  if (isNaN(d) || isNaN(m) || isNaN(y) || y < 2000 || m < 1 || m > 12 || d < 1 || d > 31)
    return null;
  return new Date(y, m - 1, d);
}

// Supabase TS parser no soporta nombres ERP legacy con mayúsculas/acentos.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

export interface LogisticsImport {
  brand:       string;
  season:      string;
  supplier:    string;
  category:    string;
  description: string;
  color:       string | null;
  quantity:    number;
  origin:      string;
  costUSD:     number;
  pvpB2C:      number;
  pvpB2B:      number;
  marginB2C:   number;  // 0-100
  marginB2B:   number;  // 0-100
  eta:         Date | null;
  etaLabel:    string;
}

export async function fetchLogisticsImports(): Promise<LogisticsImport[]> {
  const data = await fetchAllRows(() =>
    dataClient
      .from("Import")
      .select(
        '"MARCA", "TEMPORADA", "PROVEEDOR", "CATEGORIA", "DESCRIPCIÓN", ' +
        '"COLOR/WASH", "CANTIDAD", "ORIGEN", "COSTOESTIMADO", ' +
        '"PVPSUGERIDOB2C", "PVPSUGERIDOB2B", "MARGENB2C", "MARGENB2B", ' +
        '"FECHAAPROXIMADADEARRIBO"'
      )
      .order('"FECHAAPROXIMADADEARRIBO"')
  ) as Row[];

  return data.map((r) => {
    const etaStr = trimStr(r["FECHAAPROXIMADADEARRIBO"]);
    const eta    = parseMMDDYYYY(etaStr);
    return {
      brand:       normalizeBrand(r["MARCA"]),
      season:      trimStr(r["TEMPORADA"]),
      supplier:    trimStr(r["PROVEEDOR"]),
      category:    trimStr(r["CATEGORIA"]),
      description: trimStr(r["DESCRIPCIÓN"]) || "",
      color:       trimStr(r["COLOR/WASH"]) || null,
      quantity:    toInt(r["CANTIDAD"]),
      origin:      trimStr(r["ORIGEN"]),
      costUSD:     parseUSDString(r["COSTOESTIMADO"]),
      pvpB2C:      parseFloat(trimStr(r["PVPSUGERIDOB2C"]).replace(",", ".")) || 0,
      pvpB2B:      parseFloat(trimStr(r["PVPSUGERIDOB2B"]).replace(",", ".")) || 0,
      marginB2C:   parsePct(r["MARGENB2C"]),
      marginB2B:   parsePct(r["MARGENB2B"]),
      eta,
      etaLabel:    etaStr,
    };
  });
}
