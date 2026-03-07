/**
 * queries/tickets.queries.ts
 *
 * Queries para ticket promedio y métricas de transacción.
 * Fuente: vw_ticket_promedio_diario
 *
 * NOTAS de la vista:
 *   - codigo_sucursal relaciona con fintsucu.cosupc (4 dígitos zero-padded)
 *   - SIN columna de marca — solo nivel empresa × tienda × día
 *   - Cubre 2024, 2025, 2026
 *   - ~30 tiendas × 365 días ≈ 10.000 filas/año → se trae el año completo con
 *     limit(10000) y se filtra por mes en JavaScript (como el proyecto anterior).
 *     Motivo: el tipo de la columna `mes` en la vista puede ser INTEGER o TEXT
 *     dependiendo de la versión del ETL, y filtrar por mes en Supabase con el
 *     tipo incorrecto retorna 0 filas. Filtrar en JS es robusto al tipo.
 */
import { dataClient } from "@/api/client";
import { toNum, trimStr, toInt, B2B_STORES } from "@/api/normalize";
import { fetchAllRows } from "@/queries/paginate";

export interface TicketRow {
  year:           number;
  month:          number;
  day:            number;
  storeCode:      string;  // cosupc "0004"
  tickets:        number;
  totalSales:     number;
}

/**
 * Tickets del año completo (todos los meses).
 * Para AOV y UPT — el filtrado por mes se hace en el hook (JS).
 *
 * No se filtra mes en Supabase: el tipo de columna `mes` en la vista puede ser
 * INTEGER o TEXT según la versión del ETL, causando 0 filas con tipo incorrecto.
 * Paginación obligatoria: max_rows=1000 en Supabase. Un año completo puede tener
 * ~30 tiendas × 365 días ≈ 10.950 filas, excediendo el límite.
 */
export async function fetchAnnualTickets(year: number): Promise<TicketRow[]> {
  const data = await fetchAllRows(() =>
    dataClient
      .from("vw_ticket_promedio_diario")
      .select("año, mes, dia, codigo_sucursal, cantidad_facturas, venta_total_dia")
      .eq("año", String(year))
  );

  return data.map((r: Record<string, unknown>) => ({
    year:       parseInt(String(r.año),              10),
    month:      parseInt(String(r.mes as string).trim(),       10),
    day:        parseInt(String(r.dia as string).trim(),       10),
    storeCode:  trimStr(r.codigo_sucursal as string),
    tickets:    toInt(r.cantidad_facturas as number),
    totalSales: toNum(r.venta_total_dia as number),
  }));
}

/**
 * Tickets del año anterior (año completo).
 */
export async function fetchPriorYearAnnualTickets(year: number): Promise<TicketRow[]> {
  return fetchAnnualTickets(year - 1);
}

/**
 * Filtra tickets de vw_ticket_promedio_diario por canal y/o tienda específica.
 * Recibe el mapa cosupc → cosujd para resolver ambos filtros.
 *
 * @param storeCosujd  Código cosujd de la tienda (filters.store). Si es null/undefined,
 *                     no se aplica filtro de tienda (todas las tiendas del canal).
 */
export function filterTicketsByChannel(
  tickets: TicketRow[],
  storeMap: Map<string, string>, // cosupc → cosujd
  channel: "b2b" | "b2c" | "total",
  storeCosujd?: string | null
): TicketRow[] {
  if (channel === "total" && !storeCosujd) return tickets;
  return tickets.filter((t) => {
    const cosujd    = storeMap.get(t.storeCode)?.trim().toUpperCase() ?? "";
    const isB2B     = B2B_STORES.has(cosujd);
    const channelOk = channel === "total" || (channel === "b2b" ? isB2B : !isB2B);
    const storeOk   = !storeCosujd || cosujd === storeCosujd.trim().toUpperCase();
    return channelOk && storeOk;
  });
}
