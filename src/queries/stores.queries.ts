/**
 * queries/stores.queries.ts
 *
 * Queries de tiendas y metas.
 * Fuentes: fintsucu, fmetasucu
 */
import { dataClient } from "@/api/client";
import { trimStr, toNum, parsePeriodYYYYMM } from "@/api/normalize";

export interface StoreRecord {
  cosupc:  string;   // código numérico "0004"
  cosujd:  string;   // mnemónico "TOLAMB"
  name:    string;   // nombre descriptivo
}

export interface StoreGoal {
  storeCode:  string;   // cosupc
  storeName:  string;   // cosujd
  year:       number;
  month:      number;
  goal:       number;   // meta mensual en Gs.
}

export async function fetchStores(): Promise<StoreRecord[]> {
  const { data, error } = await dataClient
    .from("fintsucu")
    .select("cosupc, cosujd, dscsuc");

  if (error) throw new Error(`fetchStores: ${error.message}`);

  return (data ?? []).map((r) => ({
    cosupc: trimStr(r.cosupc),
    cosujd: trimStr(r.cosujd),
    name:   trimStr(r.dscsuc) || trimStr(r.cosujd),
  }));
}

export async function fetchStoreGoals(year: number): Promise<StoreGoal[]> {
  // Metas están en fmetasucu con periodo "YYYYMM"
  // Filtrar por año: periodos de 202601 a 202612
  const startPeriod = `${year}01`;
  const endPeriod   = `${year}12`;

  const { data: goals, error: e1 } = await dataClient
    .from("fmetasucu")
    .select("cod_sucursal, meta, periodo")
    .gte("periodo", startPeriod)
    .lte("periodo", endPeriod);

  if (e1) throw new Error(`fetchStoreGoals goals: ${e1.message}`);

  // También traer nombres de tiendas para enriquecer
  const { data: stores, error: e2 } = await dataClient
    .from("fintsucu")
    .select("cosupc, cosujd");

  if (e2) throw new Error(`fetchStoreGoals stores: ${e2.message}`);

  const storeMap = new Map<string, string>();
  for (const s of stores ?? []) {
    storeMap.set(trimStr(s.cosupc), trimStr(s.cosujd));
  }

  return (goals ?? []).map((r) => {
    const { year: y, month: m } = parsePeriodYYYYMM(trimStr(r.periodo));
    return {
      storeCode: trimStr(r.cod_sucursal),
      storeName: storeMap.get(trimStr(r.cod_sucursal)) ?? trimStr(r.cod_sucursal),
      year:  y,
      month: m,
      goal:  toNum(r.meta),
    };
  });
}
