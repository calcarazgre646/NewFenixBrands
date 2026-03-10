/**
 * queries/sales.queries.ts
 *
 * Funciones de query para datos de ventas.
 * Fuentes: mv_ventas_mensual, fjdhstvta1
 *
 * REGLAS:
 *   - Cada función hace UNA sola consulta o grupo coherente de consultas.
 *   - Toda data sale normalizada (sin padding, tipos correctos).
 *   - No hay lógica de negocio aquí: solo fetch + normalización.
 *   - No hay estado React aquí: estas son funciones puras async.
 */
import { dataClient } from "@/api/client";
import {
  toInt,
  toNum,
  trimStr,
  normalizeBrand,
  normalizeChannel,
  brandIdToCanonical,
} from "@/api/normalize";
import { fetchAllRows } from "@/queries/paginate";
import type { AppFilters } from "@/domain/filters/types";
import { getCalendarDay, getCalendarMonth, getCalendarYear } from "@/domain/period/helpers";

// Supabase TS parser no soporta ñ/acentos en nombres de columnas del ERP legacy.
// Usamos este cast en todos los .map() para que el código sea type-safe a nivel
// de nuestra app (los tipos de resultado son nuestros, no los de Supabase).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

// ─── Tipos de resultado ───────────────────────────────────────────────────────

export interface MonthlySalesRow {
  year:     number;
  month:    number;
  brand:    string;   // marca canónica normalizada
  store:    string;   // cosujd limpio
  channel:  "B2C" | "B2B" | null;
  neto:     number;
  cogs:     number;
  bruto:    number;
  dcto:     number;
}

export interface DailyDetailRow {
  year:      number;
  month:     number;
  day:       number;
  store:     string;
  sku:       string;
  talle:     string;
  brand:     string;
  units:     number;
  bruto:     number;
  dcto:      number;
  neto:      number;   // v_vtasimpu (sin IVA)
  cogs:      number;   // v_valor
  channel:   "B2C" | "B2B" | null;
  pctDcto:   number;
}

export interface BrandBreakdownRow {
  brand:       string;
  neto:        number;
  cogs:        number;
  bruto:       number;
  dcto:        number;
  prevNeto?:   number;  // mismo período año anterior
  yoyPct?:     number;
}

export interface ChannelMixRow {
  channel: "B2C" | "B2B";
  neto:    number;
  pct:     number;
}

export interface TopSkuRow {
  sku:         string;      // SKU técnico ERP (ej: "7031457")
  skuComercial: string;     // SKU Comercial de Dim_maestro_comercial (ej: "MACA004428")
  description: string;
  brand:       string;
  neto:        number;
  units:       number;
}

export interface DayOfWeekRow {
  dayNum: number;  // 0=Dom, 1=Lun, ..., 6=Sab
  label:  string;
  neto:   number;
  units:  number;
}

// ─── Helpers de filtrado ──────────────────────────────────────────────────────

/**
 * Aplica filtros de marca y canal a una query de mv_ventas_mensual.
 * REGLA: Siempre filtramos canales comerciales (B2B, B2C). Los valores
 * "Batas", "Interno", "Otros" se excluyen automáticamente.
 */
function applyMonthlySalesFilters(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: any,
  filters: AppFilters,
) {
  // Siempre filtrar solo canales comerciales
  query = query.in("v_canal_venta", ["B2B", "B2C"]);

  if (filters.brand !== "total") {
    const canonical = brandIdToCanonical(filters.brand);
    if (canonical) query = query.ilike("v_marca", `%${canonical}%`);
  }
  if (filters.channel !== "total") {
    query = query.eq("v_canal_venta", filters.channel.toUpperCase());
  }
  if (filters.store) {
    query = query.eq("v_sucursal_final", filters.store);
  }
  return query;
}

// ─── Queries ──────────────────────────────────────────────────────────────────

/**
 * Ventas mensuales agrupadas.
 * Fuente: mv_ventas_mensual (~15K filas/año — puede exceder max_rows=1000).
 * Uso: KPIs principales, gráfico de evolución, tabla ejecutiva mensual.
 */
export async function fetchMonthlySales(filters: AppFilters): Promise<MonthlySalesRow[]> {
  const buildQuery = () => {
    let q = dataClient
      .from("mv_ventas_mensual")
      .select("v_año, v_mes, v_marca, v_sucursal_final, v_canal_venta, neto, costo, bruto, dcto")
      .eq("v_año", filters.year);
    q = applyMonthlySalesFilters(q, filters);
    return q.order("v_mes").order("v_marca").order("v_sucursal_final").order("v_canal_venta");
  };

  const data = await fetchAllRows(buildQuery);

  return data.map((r: Row) => ({
    year:    toInt(r.v_año),
    month:   toInt(r.v_mes),
    brand:   normalizeBrand(r.v_marca),
    store:   trimStr(r.v_sucursal_final),
    channel: normalizeChannel(r.v_canal_venta),
    neto:    toNum(r.neto),
    cogs:    toNum(r.costo),
    bruto:   toNum(r.bruto),
    dcto:    toNum(r.dcto),
  }));
}

/**
 * Ventas mensuales del año anterior (para comparación YoY).
 * Mismo filtro de marca/canal/tienda, año - 1.
 */
export async function fetchPriorYearMonthlySales(filters: AppFilters): Promise<MonthlySalesRow[]> {
  return fetchMonthlySales({ ...filters, year: filters.year - 1 });
}

/**
 * Detalle diario de ventas (fjdhstvta1).
 * Uso: KPIs que necesitan granularidad diaria (Devoluciones, UPT, Top SKUs).
 *
 * NOTA: Esta tabla tiene 250K+ filas. Siempre filtrar por año y mes(es).
 * Paginación obligatoria: max_rows=1000 en Supabase truncaba silenciosamente.
 */
export async function fetchDailyDetail(
  filters: AppFilters,
  months: number[]
): Promise<DailyDetailRow[]> {
  if (months.length === 0) return [];

  const buildQuery = () => {
    let q = dataClient
      .from("fjdhstvta1")
      .select(
        "v_año, v_mes, v_dia, v_sucursal_final, v_sku, v_talle, v_marca, v_cantvend, " +
        "v_impbruto, v_impdscto, v_vtasimpu, v_valor, v_canal_venta, v_porcdcto"
      )
      .eq("v_año", filters.year)
      .in("v_mes", months)
      .in("v_canal_venta", ["B2C", "B2B"]);

    if (filters.brand !== "total") {
      const canonical = brandIdToCanonical(filters.brand);
      if (canonical) q = q.ilike("v_marca", `%${canonical}%`);
    }
    if (filters.channel !== "total") {
      q = q.eq("v_canal_venta", filters.channel.toUpperCase());
    }
    if (filters.store) {
      q = q.eq("v_sucursal_final", filters.store);
    }
    // NO .order() — fjdhstvta1 no tiene índices, .order() causa statement timeout.
    // Paginación secuencial (fetchAllRows serial) minimiza riesgo de filas duplicadas.
    return q;
  };

  const data = await fetchAllRows(buildQuery);

  return data.map((r: Row) => ({
    year:    toInt(r.v_año),
    month:   toInt(r.v_mes),
    day:     toInt(r.v_dia),
    store:   trimStr(r.v_sucursal_final),
    sku:     trimStr(r.v_sku),
    talle:   trimStr(r.v_talle),
    brand:   normalizeBrand(r.v_marca),
    units:   toNum(r.v_cantvend),
    bruto:   toNum(r.v_impbruto),
    dcto:    toNum(r.v_impdscto),
    neto:    toNum(r.v_vtasimpu),
    cogs:    toNum(r.v_valor),
    channel: normalizeChannel(r.v_canal_venta),
    pctDcto: toNum(r.v_porcdcto),
  }));
}

/**
 * Ventas del mes actual del año anterior hasta el mismo día.
 * Para YoY day-precise (Spec de Rodrigo, 03/03/2026).
 * Ej: si hoy es 3 de Marzo → trae fjdhstvta1 del año anterior, mes 3, días 1-3.
 * Paginación obligatoria: max_rows=1000.
 */
export async function fetchPriorYearCurrentMonthToDate(
  filters: AppFilters
): Promise<{ neto: number; cogs: number; bruto: number; dcto: number }> {
  const calMonth = getCalendarMonth();
  const calDay   = getCalendarDay();
  const prevYear = getCalendarYear() - 1;

  const buildQuery = () => {
    let q = dataClient
      .from("fjdhstvta1")
      .select("v_vtasimpu, v_valor, v_impbruto, v_impdscto")
      .eq("v_año", prevYear)
      .eq("v_mes", calMonth)
      .lte("v_dia", calDay)
      .in("v_canal_venta", ["B2C", "B2B"]);

    if (filters.brand !== "total") {
      const canonical = brandIdToCanonical(filters.brand);
      if (canonical) q = q.ilike("v_marca", `%${canonical}%`);
    }
    if (filters.channel !== "total") {
      q = q.eq("v_canal_venta", filters.channel.toUpperCase());
    }
    if (filters.store) {
      q = q.eq("v_sucursal_final", filters.store);
    }
    return q;
  };

  const data = await fetchAllRows(buildQuery);

  return data.reduce(
    (acc: { neto: number; cogs: number; bruto: number; dcto: number }, r: Row) => ({
      neto:  acc.neto  + toNum(r.v_vtasimpu),
      cogs:  acc.cogs  + toNum(r.v_valor),
      bruto: acc.bruto + toNum(r.v_impbruto),
      dcto:  acc.dcto  + toNum(r.v_impdscto),
    }),
    { neto: 0, cogs: 0, bruto: 0, dcto: 0 }
  );
}

/**
 * Breakdown por marca (para gráfico de barras de marcas en SalesPage).
 * Incluye datos del año anterior para calcular YoY.
 * Paginación obligatoria: max_rows=1000.
 */
export async function fetchBrandBreakdown(
  filters: AppFilters,
  months: number[]
): Promise<BrandBreakdownRow[]> {
  if (months.length === 0) return [];

  const buildCurr = () => {
    let q = dataClient
      .from("mv_ventas_mensual")
      .select("v_marca, neto, costo, bruto, dcto")
      .eq("v_año", filters.year)
      .in("v_mes", months)
      .in("v_canal_venta", ["B2B", "B2C"]);
    if (filters.channel !== "total") q = q.eq("v_canal_venta", filters.channel.toUpperCase());
    if (filters.store) q = q.eq("v_sucursal_final", filters.store);
    return q.order("v_marca").order("v_mes").order("v_sucursal_final").order("v_canal_venta");
  };

  const buildPrev = () => {
    let q = dataClient
      .from("mv_ventas_mensual")
      .select("v_marca, neto")
      .eq("v_año", filters.year - 1)
      .in("v_mes", months)
      .in("v_canal_venta", ["B2B", "B2C"]);
    if (filters.channel !== "total") q = q.eq("v_canal_venta", filters.channel.toUpperCase());
    if (filters.store) q = q.eq("v_sucursal_final", filters.store);
    return q.order("v_marca").order("v_mes");
  };

  const [curr, prev] = await Promise.all([
    fetchAllRows(buildCurr),
    fetchAllRows(buildPrev),
  ]);

  // Agregar por marca canónica
  const aggCurr = new Map<string, { neto: number; cogs: number; bruto: number; dcto: number }>();
  for (const r of curr) {
    const brand = normalizeBrand(r.v_marca);
    const acc = aggCurr.get(brand) ?? { neto: 0, cogs: 0, bruto: 0, dcto: 0 };
    acc.neto  += toNum(r.neto);
    acc.cogs  += toNum(r.costo);
    acc.bruto += toNum(r.bruto);
    acc.dcto  += toNum(r.dcto);
    aggCurr.set(brand, acc);
  }

  const aggPrev = new Map<string, number>();
  for (const r of prev) {
    const brand = normalizeBrand(r.v_marca);
    aggPrev.set(brand, (aggPrev.get(brand) ?? 0) + toNum(r.neto));
  }

  const result: BrandBreakdownRow[] = [];
  aggCurr.forEach((vals, brand) => {
    const prevNeto = aggPrev.get(brand) ?? 0;
    const yoyPct   = prevNeto > 0 ? ((vals.neto - prevNeto) / prevNeto) * 100 : undefined;
    result.push({ brand, ...vals, prevNeto, yoyPct });
  });

  return result.sort((a, b) => b.neto - a.neto);
}

/**
 * Mix de canal B2B/B2C.
 * Paginación obligatoria: max_rows=1000.
 */
export async function fetchChannelMix(
  filters: AppFilters,
  months: number[]
): Promise<ChannelMixRow[]> {
  if (months.length === 0) return [];

  const buildQuery = () => {
    let q = dataClient
      .from("mv_ventas_mensual")
      .select("v_canal_venta, neto")
      .eq("v_año", filters.year)
      .in("v_mes", months)
      .in("v_canal_venta", ["B2B", "B2C"]);
    if (filters.brand !== "total") {
      const canonical = brandIdToCanonical(filters.brand);
      if (canonical) q = q.ilike("v_marca", `%${canonical}%`);
    }
    if (filters.store) q = q.eq("v_sucursal_final", filters.store);
    return q.order("v_canal_venta").order("v_mes").order("v_marca");
  };

  const data = await fetchAllRows(buildQuery);

  const agg = new Map<string, number>();
  let total = 0;
  for (const r of data) {
    const ch = trimStr(r.v_canal_venta).toUpperCase();
    const n  = toNum(r.neto);
    agg.set(ch, (agg.get(ch) ?? 0) + n);
    total += n;
  }

  const result: ChannelMixRow[] = [];
  agg.forEach((neto, channel) => {
    if (channel === "B2C" || channel === "B2B") {
      result.push({ channel, neto, pct: total > 0 ? (neto / total) * 100 : 0 });
    }
  });
  return result.sort((a, b) => b.neto - a.neto);
}

// ─── Wide queries (fetch-once, filter-local) ────────────────────────────────
//
// Estas versiones NO aplican filtros de usuario (brand/channel/store) en Supabase.
// Traen el dataset completo por año y el filtrado ocurre en JS (useMemo).
// Patrón idéntico al de ticketsQ: fetch wide → cache long → filter local.

/**
 * Ventas mensuales WIDE — sin filtros de usuario.
 * Fuente: mv_ventas_mensual (~1,091 filas/año → 2 páginas → <1s).
 * Uso: KPI Dashboard (filtrado en JS vía useMemo).
 */
export async function fetchMonthlySalesWide(year: number): Promise<MonthlySalesRow[]> {
  const buildQuery = () =>
    dataClient
      .from("mv_ventas_mensual")
      .select("v_año, v_mes, v_marca, v_sucursal_final, v_canal_venta, neto, costo, bruto, dcto")
      .eq("v_año", year)
      .in("v_canal_venta", ["B2B", "B2C"])
      .order("v_mes").order("v_marca").order("v_sucursal_final").order("v_canal_venta");

  const data = await fetchAllRows(buildQuery);

  return data.map((r: Row) => ({
    year:    toInt(r.v_año),
    month:   toInt(r.v_mes),
    brand:   normalizeBrand(r.v_marca),
    store:   trimStr(r.v_sucursal_final),
    channel: normalizeChannel(r.v_canal_venta),
    neto:    toNum(r.neto),
    cogs:    toNum(r.costo),
    bruto:   toNum(r.bruto),
    dcto:    toNum(r.dcto),
  }));
}

/**
 * Ventas del año anterior hasta el mismo día — versión WIDE (sin filtros de usuario).
 * Devuelve filas PRE-AGREGADAS por brand+channel+store para filtrar en JS.
 * Uso: YoY day-precise en KPI Dashboard.
 *
 * TRIPLE PROTECCIÓN contra no-determinismo de fjdhstvta1:
 *
 *   1. ORDER BY v_marca, v_sucursal_final, v_dia — paginación determinista.
 *      SEGURO: la query filtra a ~18K filas (un mes + día), no las 250K+ totales.
 *      PostgreSQL ordena 18K filas en memoria en milisegundos.
 *      El timeout documentado es para ORDER BY sobre la tabla COMPLETA sin índices.
 *
 *   2. Acumulación SUM en Map durante paginación — order-agnostic.
 *      Si una fila aparece duplicada entre páginas, el impacto es ~1 fila, no páginas.
 *
 *   3. staleTime: Infinity en el hook — datos de año anterior son históricos,
 *      la query se ejecuta UNA SOLA VEZ por sesión. No hay re-paginación.
 */
export interface PriorYearMTDRow {
  neto:    number;
  cogs:    number;
  bruto:   number;
  dcto:    number;
  brand:   string;
  channel: "B2C" | "B2B" | null;
  store:   string;
}

const MTD_PAGE_SIZE = 1000;

export async function fetchPriorYearMTDWide(cutoffDay?: number): Promise<PriorYearMTDRow[]> {
  const calMonth = getCalendarMonth();
  const dayLimit = cutoffDay ?? getCalendarDay();
  const prevYear = getCalendarYear() - 1;

  // Acumulador: Map<"brand|channel|store", totales>
  const acc = new Map<string, PriorYearMTDRow>();
  let page = 0;

  while (true) {
    const from = page * MTD_PAGE_SIZE;
    const to   = from + MTD_PAGE_SIZE - 1;

    const { data, error } = await dataClient
      .from("fjdhstvta1")
      .select("v_vtasimpu, v_valor, v_impbruto, v_impdscto, v_marca, v_canal_venta, v_sucursal_final")
      .eq("v_año", prevYear)
      .eq("v_mes", calMonth)
      .lte("v_dia", dayLimit)
      .in("v_canal_venta", ["B2C", "B2B"])
      .order("v_marca")
      .order("v_sucursal_final")
      .order("v_dia")
      .range(from, to);

    if (error) throw new Error(`fetchPriorYearMTDWide page ${page}: ${error.message}`);
    if (!data || data.length === 0) break;

    for (const r of data as Row[]) {
      const brand   = normalizeBrand(r.v_marca);
      const channel = normalizeChannel(r.v_canal_venta);
      const store   = trimStr(r.v_sucursal_final);
      const key     = `${brand}|${channel}|${store}`;

      const row = acc.get(key);
      if (row) {
        row.neto  += toNum(r.v_vtasimpu);
        row.cogs  += toNum(r.v_valor);
        row.bruto += toNum(r.v_impbruto);
        row.dcto  += toNum(r.v_impdscto);
      } else {
        acc.set(key, {
          brand,
          channel,
          store,
          neto:  toNum(r.v_vtasimpu),
          cogs:  toNum(r.v_valor),
          bruto: toNum(r.v_impbruto),
          dcto:  toNum(r.v_impdscto),
        });
      }
    }

    if (data.length < MTD_PAGE_SIZE) break;
    page++;
  }

  return Array.from(acc.values());
}

// ─── Daily Wide (mv_ventas_diarias) ──────────────────────────────────────────

/**
 * Ventas diarias WIDE — pre-agregadas por (año, mes, día, marca, canal).
 * Fuente: mv_ventas_diarias (~2.000 filas/año → 2-3 páginas → <1s).
 * Uso: YoY día-a-día preciso en Executive y Sales dashboards.
 */
export interface DailySalesRow {
  year:    number;
  month:   number;
  day:     number;
  brand:   string;
  channel: "B2C" | "B2B" | null;
  neto:    number;
  costo:   number;
  bruto:   number;
  dcto:    number;
  units:   number;
}

export async function fetchDailySalesWide(year: number): Promise<DailySalesRow[]> {
  const buildQuery = () =>
    dataClient
      .from("mv_ventas_diarias")
      .select("year, month, day, brand, channel, neto, costo, bruto, dcto, units")
      .eq("year", year)
      .order("month").order("day").order("brand").order("channel");

  const data = await fetchAllRows(buildQuery);

  return data.map((r: Row) => ({
    year:    toInt(r.year),
    month:   toInt(r.month),
    day:     toInt(r.day),
    brand:   normalizeBrand(r.brand),
    channel: normalizeChannel(r.channel),
    neto:    toNum(r.neto),
    costo:   toNum(r.costo),
    bruto:   toNum(r.bruto),
    dcto:    toNum(r.dcto),
    units:   toInt(r.units),
  }));
}

/**
 * Mapa de SKU técnico → SKU Comercial desde Dim_maestro_comercial.
 * Cada SKU técnico mapea a exactamente un codigo_unico_final (independiente de talla).
 * Se usa para enriquecer fetchTopSkus (que viene de fjdhstvta1, sin JOIN a la dimensión).
 */
async function fetchSkuComercialMap(): Promise<Map<string, string>> {
  const buildQuery = () =>
    dataClient
      .from("Dim_maestro_comercial")
      .select("\"SKU-I\", codigo_unico_final")
      .not("codigo_unico_final", "is", null);

  const data = await fetchAllRows(buildQuery);

  const map = new Map<string, string>();
  for (const r of data as Row[]) {
    const skuI = String(r["SKU-I"] ?? "").trim();
    const comercial = trimStr(r.codigo_unico_final);
    if (skuI && comercial && !map.has(skuI)) {
      map.set(skuI, comercial);
    }
  }
  return map;
}

/**
 * Top SKUs por neto.
 * Fuente: fjdhstvta1 (granularidad de SKU necesaria).
 * Enriquecido con SKU Comercial de Dim_maestro_comercial.
 * Paginación obligatoria: max_rows=1000 truncaba resultados.
 */
export async function fetchTopSkus(
  filters: AppFilters,
  months: number[],
  limit = 20
): Promise<TopSkuRow[]> {
  if (months.length === 0) return [];

  const buildQuery = () => {
    let q = dataClient
      .from("fjdhstvta1")
      .select("v_sku, v_descrip, v_marca, v_vtasimpu, v_cantvend")
      .eq("v_año", filters.year)
      .in("v_mes", months)
      .in("v_canal_venta", ["B2C", "B2B"])
      .gt("v_vtasimpu", 0);

    if (filters.brand !== "total") {
      const canonical = brandIdToCanonical(filters.brand);
      if (canonical) q = q.ilike("v_marca", `%${canonical}%`);
    }
    if (filters.channel !== "total") q = q.eq("v_canal_venta", filters.channel.toUpperCase());
    if (filters.store) q = q.eq("v_sucursal_final", filters.store);
    return q;
  };

  // Fetch sales data and SKU mapping in parallel
  const [data, skuMap] = await Promise.all([
    fetchAllRows(buildQuery),
    fetchSkuComercialMap(),
  ]);

  // Agregar por SKU en JS (más flexible que GROUP BY en Supabase REST)
  const agg = new Map<string, TopSkuRow>();
  for (const r of data) {
    const sku = trimStr(r.v_sku);
    const acc = agg.get(sku) ?? {
      sku,
      skuComercial: skuMap.get(sku) ?? "",
      description: trimStr(r.v_descrip) || sku,
      brand: normalizeBrand(r.v_marca),
      neto: 0,
      units: 0,
    };
    acc.neto  += toNum(r.v_vtasimpu);
    acc.units += toNum(r.v_cantvend);
    agg.set(sku, acc);
  }

  return Array.from(agg.values())
    .sort((a, b) => b.neto - a.neto)
    .slice(0, limit);
}
