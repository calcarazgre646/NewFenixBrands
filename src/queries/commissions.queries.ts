/**
 * queries/commissions.queries.ts
 *
 * Queries para el módulo de comisiones.
 * Trae ventas reales por vendedor desde fjdhstvta1.
 * Trae metas individuales desde comisiones_metas_vendedor.
 */
import { dataClient, authClient } from "@/api/client";
import { fetchAllRows } from "@/queries/paginate";
import { trimStr, toNum } from "@/api/normalize";
import type { CommissionRole, CommissionChannel } from "@/domain/commissions/types";

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

/** Meta individual de un vendedor (de comisiones_metas_vendedor) */
export interface SellerGoalRow {
  vendedorCodigo: number;
  vendedorNombre: string;
  rolComision:    CommissionRole;
  canal:          CommissionChannel;
  año:            number;
  mes:            number;
  trimestre:      number;
  metaVentas:     number;
  metaCobranza:   number;
  zona:           string | null;
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

/**
 * Trae metas individuales de vendedores para un año+mes.
 * Fuente: comisiones_metas_vendedor (tabla creada en migration 016).
 */
export async function fetchSellerGoals(year: number, month: number): Promise<SellerGoalRow[]> {
  const { data, error } = await authClient
    .from("comisiones_metas_vendedor")
    .select("vendedor_codigo, vendedor_nombre, rol_comision, canal, año, mes, trimestre, meta_ventas, meta_cobranza, zona")
    .eq("año", year)
    .eq("mes", month);

  if (error) throw new Error(`fetchSellerGoals: ${error.message}`);

  return (data ?? []).map((r: Row) => ({
    vendedorCodigo: toNum(r.vendedor_codigo),
    vendedorNombre: trimStr(r.vendedor_nombre),
    rolComision:    trimStr(r.rol_comision) as CommissionRole,
    canal:          trimStr(r.canal) as CommissionChannel,
    año:            toNum(r.año),
    mes:            toNum(r.mes),
    trimestre:      toNum(r.trimestre),
    metaVentas:     toNum(r.meta_ventas),
    metaCobranza:   toNum(r.meta_cobranza),
    zona:           r.zona ? trimStr(r.zona) : null,
  }));
}
