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
import { normalizeZone } from "@/domain/zones/normalize";
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

/** Venta neta de un vendedor en un día específico del mes */
export interface SellerDailySaleRow {
  vendedorCodigo: number;
  día:            number;
  ventaNeta:      number;
}

/** Transacción individual de un vendedor (drill-down) */
export interface SellerTransactionRow {
  /** Día del mes (1-31) */
  día:        number;
  /** Sucursal donde ocurrió la venta */
  sucursal:   string;
  /** Venta neta de la transacción (Gs.) */
  ventaNeta:  number;
  /** Unidades vendidas (abs) */
  unidades:   number;
  /** Canal de venta */
  canal:      string;
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
 * Trae ventas diarias por vendedor para un año+mes.
 * Fuente: fjdhstvta1 agrupado en JS por (vendedor, día).
 * Necesario para construir el ritmo de venta y la serie acumulada del mes.
 */
export async function fetchSellerDailySales(year: number, month: number): Promise<SellerDailySaleRow[]> {
  const buildQuery = () =>
    dataClient
      .from("fjdhstvta1")
      .select("v_vended, v_dia, v_vtasimpu")
      .eq("v_año", year)
      .eq("v_mes", month);

  const raw = await fetchAllRows<Row>(buildQuery);

  const map = new Map<string, SellerDailySaleRow>();
  for (const r of raw) {
    const codigo = toNum(r.v_vended);
    const día = toNum(r.v_dia);
    if (codigo === 999 || día < 1 || día > 31) continue;
    const key = `${codigo}|${día}`;
    const existing = map.get(key);
    const venta = toNum(r.v_vtasimpu);
    if (existing) {
      existing.ventaNeta += venta;
    } else {
      map.set(key, { vendedorCodigo: codigo, día, ventaNeta: venta });
    }
  }

  return Array.from(map.values());
}

/**
 * Trae las transacciones individuales de un vendedor en un año+mes.
 * Para drill-down: el vendedor (o gerencia) ve los tickets que componen su MTD.
 * Fuente: fjdhstvta1 filtrado por vendedor.
 */
export async function fetchSellerTransactions(
  year: number,
  month: number,
  vendedorCodigo: number,
): Promise<SellerTransactionRow[]> {
  const buildQuery = () =>
    dataClient
      .from("fjdhstvta1")
      .select("v_dia, v_sucursal_final, v_vtasimpu, v_cantvend, v_canal_venta")
      .eq("v_año", year)
      .eq("v_mes", month)
      .eq("v_vended", vendedorCodigo);

  const raw = await fetchAllRows<Row>(buildQuery);

  return raw.map((r) => ({
    día:       toNum(r.v_dia),
    sucursal:  trimStr(r.v_sucursal_final),
    ventaNeta: toNum(r.v_vtasimpu),
    unidades:  Math.abs(toNum(r.v_cantvend)),
    canal:     trimStr(r.v_canal_venta),
  }));
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
    zona:           normalizeZone(r.zona),
  }));
}
