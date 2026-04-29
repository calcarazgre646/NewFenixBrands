/**
 * queries/cobranza.queries.ts
 *
 * Trae cuotas de `c_cobrar` enriquecidas con el vendedor del cliente
 * (`maestro_clientes_mayoristas`). El cruce numérico → nombre canónico de
 * vendedor lo hace el caller (hook) usando el código de `fjdhstvta1`.
 *
 * Filtramos por `f_pago` dentro del mes consultado para evitar arrastrar
 * 832K cuotas históricas — sólo nos interesa la cobranza efectivamente
 * realizada en el período.
 */
import { dataClient } from "@/api/client";
import { fetchAllRows } from "@/queries/paginate";
import { trimStr, toNum, toInt } from "@/api/normalize";
import type { CobranzaRow } from "@/domain/cobranza/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

/** Mapeo cliente → vendedor declarado en `maestro_clientes_mayoristas`. */
async function fetchClienteVendedorMap(): Promise<Map<number, string | null>> {
  const buildQuery = () =>
    dataClient
      .from("maestro_clientes_mayoristas")
      .select("cliente_id, vendedor");

  const rows = await fetchAllRows<Row>(buildQuery);
  const out = new Map<number, string | null>();
  for (const r of rows) {
    const id = toInt(r.cliente_id);
    if (id <= 0) continue;
    const v = trimStr(r.vendedor);
    out.set(id, v === "" ? null : v);
  }
  return out;
}

/**
 * Trae cuotas pagadas en el mes solicitado, enriquecidas con el vendedor
 * declarado para el cliente. Los montos se devuelven sin transformar (pueden
 * ser negativos por notas de crédito).
 */
export async function fetchSellerCobranza(year: number, month: number): Promise<CobranzaRow[]> {
  const monthStart = monthStartISO(year, month);
  const monthEnd   = monthEndISO(year, month);

  const buildQuery = () =>
    dataClient
      .from("c_cobrar")
      .select("codigo_cliente, monto_total, pendiente_de_pago, f_factura, f_pago, f_venc_cuota")
      .gte("f_pago", monthStart)
      .lte("f_pago", monthEnd);

  const [raw, clienteToVendedor] = await Promise.all([
    fetchAllRows<Row>(buildQuery),
    fetchClienteVendedorMap(),
  ]);

  return raw.map((r): CobranzaRow => {
    const codigoCliente = toInt(r.codigo_cliente);
    return {
      codigoCliente,
      vendedorNombre:   clienteToVendedor.get(codigoCliente) ?? null,
      montoTotal:       toNum(r.monto_total),
      pendientePago:    toNum(r.pendiente_de_pago),
      fechaFactura:     normalizeISO(r.f_factura),
      fechaPago:        normalizeISO(r.f_pago),
      fechaVencimiento: normalizeISO(r.f_venc_cuota),
    };
  });
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function monthStartISO(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

function monthEndISO(year: number, month: number): string {
  // Trick: pasar día 0 del mes siguiente devuelve el último día del mes actual
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${String(month).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
}

/** Normaliza fecha del ERP (puede venir como Date string o null) a YYYY-MM-DD. */
function normalizeISO(val: string | null | undefined): string | null {
  if (val == null) return null;
  const s = String(val).trim();
  if (s === "") return null;
  // Supabase devuelve dates como "YYYY-MM-DD" para tipo `date`. Si llega con T
  // (timestamp) recortamos a la parte de fecha.
  if (s.length >= 10) return s.slice(0, 10);
  return s;
}
