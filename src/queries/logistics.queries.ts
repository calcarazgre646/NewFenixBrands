/**
 * queries/logistics.queries.ts
 *
 * Queries para el módulo de logística.
 * Fuente: productos_importacion (tabla de órdenes de importación, ~580 filas)
 *
 * NOTAS sobre la tabla:
 *   - COSTOESTIMADO: "68.450,00" → formato EU/PY (punto=miles, coma=decimal)
 *   - PVPSUGERIDOB2C/B2B: "189.000  " → formato PY con trailing spaces
 *   - FECHAAPROXIMADADEARRIBO: "9-Oct-2025" → formato D-Mon-YYYY
 *   - MARGENB2C/B2B: "64%" → number
 *   - CANTIDAD: string ("200") → parsear a number
 *   - STATUS: "PEDIDO" | "EN TRANSITO" | "EN STOCK" | "ANULADO" | null
 *   - ORDENDECOMPRA: string OC number | null
 *   - FECHAAPROXIMADADELANZAMIENTO: D-Mon-YYYY | null (vacía por ahora)
 */
import { dataClient } from "@/api/client";
import { trimStr, parseDMonYYYY, parseEUCost, parsePct, normalizeBrand } from "@/api/normalize";
import { fetchAllRows } from "@/queries/paginate";

// Supabase TS parser no soporta nombres ERP legacy con mayúsculas/acentos.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

/** Status del ERP — etapa del pedido en el pipeline de importación. */
export type ErpStatus = "PEDIDO" | "EN TRANSITO" | "EN STOCK" | "ANULADO";

export interface LogisticsImport {
  brand:         string;
  season:        string;
  supplier:      string;
  category:      string;
  description:   string;
  color:         string | null;
  quantity:      number;
  origin:        string;
  costUSD:       number;
  pvpB2C:        number;
  pvpB2B:        number;
  marginB2C:     number;  // 0-100
  marginB2B:     number;  // 0-100
  eta:           Date | null;
  etaLabel:      string;
  erpStatus:     ErpStatus | null;
  purchaseOrder: string | null;
  launchDate:    Date | null;
}

/** Parsea PVP formato PY: "189.000  " → 189000 */
function parsePVP(val: string | null | undefined): number {
  if (!val) return 0;
  return parseInt(val.trim().replace(/\./g, ""), 10) || 0;
}

export async function fetchLogisticsImports(): Promise<LogisticsImport[]> {
  const data = await fetchAllRows(() =>
    dataClient
      .from("productos_importacion")
      .select(
        '"MARCA", "TEMPORADA", "PROVEEDOR", "CATEGORIA", "DESCRIPCIÓN", ' +
        '"COLOR/WASH", "CANTIDAD", "ORIGEN", "COSTOESTIMADO", ' +
        '" PVPSUGERIDOB2C ", "PVPSUGERIDOB2B", "MARGENB2C", "MARGENB2B", ' +
        '"FECHAAPROXIMADADEARRIBO", "STATUS", "ORDENDECOMPRA", ' +
        '"FECHAAPROXIMADADELANZAMIENTO"'
      )
      .order('"FECHAAPROXIMADADEARRIBO"')
  ) as Row[];

  return data.map((r) => {
    const etaStr    = trimStr(r["FECHAAPROXIMADADEARRIBO"]);
    const eta       = parseDMonYYYY(etaStr);
    const rawStatus = trimStr(r["STATUS"]) || null;
    return {
      brand:         normalizeBrand(r["MARCA"]),
      season:        trimStr(r["TEMPORADA"]),
      supplier:      trimStr(r["PROVEEDOR"]),
      category:      trimStr(r["CATEGORIA"]),
      description:   trimStr(r["DESCRIPCIÓN"]) || "",
      color:         trimStr(r["COLOR/WASH"]) || null,
      quantity:      parseInt(String(r["CANTIDAD"]), 10) || 0,
      origin:        trimStr(r["ORIGEN"]),
      costUSD:       parseEUCost(r["COSTOESTIMADO"]),
      pvpB2C:        parsePVP(r[" PVPSUGERIDOB2C "]),
      pvpB2B:        parsePVP(r["PVPSUGERIDOB2B"]),
      marginB2C:     parsePct(r["MARGENB2C"]),
      marginB2B:     parsePct(r["MARGENB2B"]),
      eta,
      etaLabel:      etaStr,
      erpStatus:     rawStatus as ErpStatus | null,
      purchaseOrder: trimStr(r["ORDENDECOMPRA"]) || null,
      launchDate:    parseDMonYYYY(trimStr(r["FECHAAPROXIMADADELANZAMIENTO"])),
    };
  });
}
