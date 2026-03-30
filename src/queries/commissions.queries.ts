/**
 * queries/commissions.queries.ts
 *
 * Queries para el módulo de comisiones.
 * Trae ventas reales por vendedor desde fjdhstvta1.
 */
import { dataClient } from "@/api/client";
import { fetchAllRows } from "@/queries/paginate";
import { trimStr, toNum } from "@/api/normalize";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

/** Ventas agregadas por vendedor/mes */
export interface SellerSalesRow {
  vendedorCodigo: number;
  vendedorNombre: string;
  canal:          string;     // "B2C" | "B2B"
  tipoVenta:      string;     // "retail" | "vtaxmayor" | "uniforme"
  sucursal:       string;
  año:            number;
  mes:            number;
  ventaNeta:      number;     // sum(v_vtasimpu)
  ventaBruta:     number;     // sum(v_impbruto)
  unidades:       number;     // sum(abs(v_cantvend))
  transacciones:  number;
}

/**
 * Trae ventas por vendedor para un año+mes.
 * Fuente: fjdhstvta1 filtrado por año y mes, agrupado en JS por vendedor.
 */
export async function fetchSellerSales(year: number, month: number): Promise<SellerSalesRow[]> {
  const buildQuery = () =>
    dataClient
      .from("fjdhstvta1")
      .select("v_vended, v_dsvende, v_canal_venta, v_uniforme, v_sucursal_final, v_vtasimpu, v_impbruto, v_cantvend")
      .eq("v_año", year)
      .eq("v_mes", month);

  const raw = await fetchAllRows<Row>(buildQuery);

  // Agrupar por vendedor+canal+sucursal
  const map = new Map<string, SellerSalesRow>();

  for (const r of raw) {
    const codigo = toNum(r.v_vended);
    const canal = trimStr(r.v_canal_venta);
    const sucursal = trimStr(r.v_sucursal_final);
    const key = `${codigo}|${canal}|${sucursal}`;

    const existing = map.get(key);
    if (existing) {
      existing.ventaNeta += toNum(r.v_vtasimpu);
      existing.ventaBruta += toNum(r.v_impbruto);
      existing.unidades += Math.abs(toNum(r.v_cantvend));
      existing.transacciones++;
    } else {
      map.set(key, {
        vendedorCodigo: codigo,
        vendedorNombre: trimStr(r.v_dsvende),
        canal,
        tipoVenta: trimStr(r.v_uniforme),
        sucursal,
        año: year,
        mes: month,
        ventaNeta: toNum(r.v_vtasimpu),
        ventaBruta: toNum(r.v_impbruto),
        unidades: Math.abs(toNum(r.v_cantvend)),
        transacciones: 1,
      });
    }
  }

  return Array.from(map.values());
}
