/**
 * queries/recurrence.queries.ts
 *
 * Recurrencia de clientes — % de clientes que compran ≥2 veces en el período.
 *
 * FUENTE: v_transacciones_dwh
 *   Una fila por (factura × cliente × tienda × fecha). Tiene num_transaccion,
 *   codigo_cliente y codigo_sucursal. Datos hasta 31/12/2025; 2026 está vacío
 *   en esta vista hasta que Derlys complete el ETL.
 *
 * FÓRMULA: clientes_con_>=2_facturas / clientes_totales × 100
 *
 * Filtros soportados:
 *   - brand:   false (la vista no tiene marca a nivel transacción)
 *   - channel: true (derivable vía codigo_sucursal → cosujd → classifyStore)
 *   - store:   true (filtra codigo_sucursal a la tienda específica)
 *
 * Excluye codigo_cliente=0 (placeholder para venta sin cliente identificado;
 * solo 18 filas en BD a hoy).
 */
import { dataClient } from "@/api/client";
import { fetchAllRows } from "@/queries/paginate";
import { toInt, trimStr, classifyStore } from "@/api/normalize";

export interface RecurrenceInput {
  /** Año del período (ej: 2025). */
  year: number;
  /** Meses incluidos (1-indexed). */
  months: number[];
  /** Canal: 'b2b', 'b2c' o null para total. */
  channel?: "b2b" | "b2c" | null;
  /** Tienda específica en formato cosupc (4 dígitos zero-padded). null = todas. */
  storeCosupc?: string | null;
  /** Map cosupc → cosujd para resolver canal cuando se filtra por canal. */
  storeMap?: Map<string, string> | null;
}

export interface RecurrenceResult {
  totalCustomers: number;
  recurrentCustomers: number;
  recurrencePct: number;
}

/**
 * Calcula recurrencia para un período.
 *
 * Filtra v_transacciones_dwh por año + meses (en JS via fecha_formateada
 * dd/mm/yyyy — la columna `año` con tilde requiere el cliente Supabase JS;
 * acá filtramos como rango de fechas para evitar el problema de encoding).
 *
 * Optimización: para reducir volumen, traemos una página por mes filtrando
 * fecha_formateada con LIKE 'dd/MM/YYYY' en BD.
 */
export async function fetchCustomerRecurrence(
  input: RecurrenceInput,
): Promise<RecurrenceResult> {
  if (input.months.length === 0) {
    return { totalCustomers: 0, recurrentCustomers: 0, recurrencePct: 0 };
  }

  // Trae una vez por mes — fecha_formateada con LIKE %/MM/YYYY filtra en BD
  // sin necesidad de la columna 'año' (que tiene tilde y rompe URL encoding).
  const allRows: Array<{ codigo_cliente: number; codigo_sucursal: string; num_transaccion: number }> = [];

  for (const m of input.months) {
    const monthPattern = `%/${pad(m)}/${input.year}`;
    const rows = await fetchAllRows(() => {
      let q = dataClient
        .from("v_transacciones_dwh")
        .select("codigo_cliente, codigo_sucursal, num_transaccion")
        .like("fecha_formateada", monthPattern)
        .neq("codigo_cliente", 0);
      if (input.storeCosupc) {
        q = q.eq("codigo_sucursal", input.storeCosupc);
      }
      return q;
    });
    for (const r of rows) {
      allRows.push({
        codigo_cliente: toInt(r.codigo_cliente),
        codigo_sucursal: trimStr(r.codigo_sucursal),
        num_transaccion: toInt(r.num_transaccion),
      });
    }
  }

  const channelActive = input.channel === "b2b" || input.channel === "b2c";
  const storeMap = input.storeMap;

  const txByCustomer = new Map<number, Set<number>>();
  for (const r of allRows) {
    if (channelActive) {
      const cosujd = storeMap?.get(r.codigo_sucursal)?.trim().toUpperCase() ?? "";
      const storeChannel = classifyStore(cosujd);
      if (storeChannel !== input.channel) continue;
    }
    const set = txByCustomer.get(r.codigo_cliente) ?? new Set<number>();
    set.add(r.num_transaccion);
    txByCustomer.set(r.codigo_cliente, set);
  }

  let total = 0;
  let recurrent = 0;
  for (const txSet of txByCustomer.values()) {
    total += 1;
    if (txSet.size >= 2) recurrent += 1;
  }

  return {
    totalCustomers: total,
    recurrentCustomers: recurrent,
    recurrencePct: total > 0 ? (recurrent / total) * 100 : 0,
  };
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
