/**
 * domain/commissions/storeMapping.ts
 *
 * Mapeo tienda → rol/canal de comisión.
 * Transforma StoreGoal (de fmetasucu) en SellerGoal para el motor de cálculo.
 *
 * REGLA: Sin I/O, sin React. Solo funciones puras.
 */
import type { CommissionRole, CommissionChannel, SellerGoal } from "./types";
import type { StoreGoal } from "@/queries/stores.queries";

/** Clasifica una tienda en rol y canal de comisión */
export function classifyStoreForCommission(storeName: string): {
  role: CommissionRole;
  channel: CommissionChannel;
} {
  const upper = storeName.toUpperCase();
  if (upper === "MAYORISTA") return { role: "vendedor_mayorista", channel: "mayorista" };
  if (upper === "UTP")       return { role: "vendedor_utp", channel: "utp" };
  return { role: "vendedor_tienda", channel: "retail" };
}

/** Convierte un StoreGoal (tienda/mes) en un SellerGoal para el motor de comisiones */
export function storeGoalToSellerGoal(sg: StoreGoal): SellerGoal {
  const { role, channel } = classifyStoreForCommission(sg.storeName);
  return {
    vendedorCodigo: simpleCodeFromName(sg.storeName),
    vendedorNombre: sg.storeName,
    rolComision: role,
    canal: channel,
    año: sg.year,
    mes: sg.month,
    trimestre: Math.ceil(sg.month / 3),
    metaVentas: sg.goal,
    metaCobranza: 0,  // c_cobrar vacía — se conecta cuando haya datos
    sucursalCodigo: sg.storeName,
  };
}

/** Genera un código numérico estable a partir del nombre de tienda */
function simpleCodeFromName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = ((h << 5) - h + name.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}
