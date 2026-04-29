/**
 * domain/cobranza/types.ts
 *
 * Tipos del dominio de Cobranza Mayorista/UTP.
 *
 * Una "cuota" en `c_cobrar` representa un pago programado de una factura. La
 * cuota tiene fecha de emisión (`f_factura`), fecha de vencimiento
 * (`f_venc_cuota`) y, cuando se cobró, fecha real de pago (`f_pago`) +
 * `monto_total`. El "pendiente_de_pago" baja a 0 cuando la cuota se liquida.
 *
 * El join con vendedor se hace por cliente: c_cobrar.codigo_cliente →
 * maestro_clientes_mayoristas.cliente_id → vendedor (texto). El mapeo de
 * vendedorNombre → vendedorCodigo lo hace el caller con datos de ventas.
 */

/** Una cuota cruda enriquecida con el nombre del vendedor del cliente. */
export interface CobranzaRow {
  codigoCliente:    number;
  /** Nombre del vendedor del cliente según `maestro_clientes_mayoristas`. null si no mapeado. */
  vendedorNombre:   string | null;
  /** Importe de la cuota (Gs). Puede ser negativo si es nota de crédito/devolución. */
  montoTotal:       number;
  /** Saldo pendiente al cierre. 0 cuando la cuota fue liquidada. */
  pendientePago:    number;
  /** Fecha de emisión de factura (ISO YYYY-MM-DD). null si la BD no la tiene. */
  fechaFactura:     string | null;
  /** Fecha real de pago (ISO YYYY-MM-DD). null si la cuota sigue abierta. */
  fechaPago:        string | null;
  /** Fecha de vencimiento de la cuota (ISO YYYY-MM-DD). */
  fechaVencimiento: string | null;
}

/** Agregación de cobranza para un vendedor en un período. */
export interface CobranzaByVendedor {
  /** Código numérico del vendedor (v_vended de fjdhstvta1). */
  vendedorCodigo: number;
  /** Nombre canónico del vendedor (v_dsvende). */
  vendedorNombre: string;
  /** Suma de `monto_total` de cuotas pagadas en el período (Gs). Puede ser negativo. */
  cobranzaGs:     number;
  /** Cantidad de cuotas pagadas en el período. */
  cuotasCobradas: number;
  /**
   * DSO (Days Sales Outstanding) promedio de las cuotas pagadas en el período:
   * promedio simple de (f_pago - f_factura) en días. null si no hay datos
   * válidos (sin pagos, fechas faltantes, o todas las cuotas con f_pago < f_factura).
   */
  dsoDias:        number | null;
}

/** Pool de cobranza no atribuida a un vendedor individual. */
export interface CobranzaUnattributed {
  /** Suma del pool (típicamente UNIFORMES/UTP, o clientes sin mapeo). */
  cobranzaGs:     number;
  cuotasCobradas: number;
  dsoDias:        number | null;
  /** Etiqueta del bucket — "UNIFORMES" o "SIN_VENDEDOR". */
  bucket:         string;
}

export interface CobranzaAggregateResult {
  byCodigo:       Map<number, CobranzaByVendedor>;
  /** Cobranza con vendedor declarado pero cuyo nombre no matchea con ningún código. */
  unattributed:   CobranzaUnattributed[];
}
