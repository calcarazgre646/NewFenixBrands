# Datos Pendientes del Cliente (Fenix SA)

## Regla 9: Salidas no-venta (merma/devolución/cambios)

**Definición de Rodrigo (09/04/2026):**
- **Merma:** pérdida de unidades por robo, hurto. ST(inicial) > ST(final).
- **Devolución:** producto retornado, dinero devuelto, sin reemplazo.
- **Cambios:** producto retornado con reemplazo (cambio de prenda).
- Las devoluciones y cambios generan unidades que no pueden venderse en tienda → deben ir a depósito virtual "Segunda Mano".

**Estado actual:**
- `movimientos_st_jde`: 526,519 filas, TODAS con tipo_doc "ST" (Stock Transfer). No hay campo que distinga merma/devolución/cambio.
- `fjdhstvta1`: tiene `v_cantvend` pero sin campo de tipo de transacción.
- El campo `comentario` en movimientos contiene el nombre de la sucursal destino, no el tipo de movimiento.

**Lo que necesitamos de Fenix:**
1. Un campo en `movimientos_st_jde` (o tabla separada) que identifique el tipo de salida: venta normal, merma, devolución, cambio.
2. Alternativamente: una tabla separada de "salidas no-venta" con fecha, SKU, tienda, tipo, cantidad.

**Impacto:**
- Sin este dato, el STH (Sell-Through Rate) incluye salidas no-venta como si fueran ventas, lo que infla artificialmente el STH y puede generar recomendaciones incorrectas.
- El depósito virtual "Segunda Mano" no puede implementarse sin clasificar las unidades.

**Estructura preparada en código:**
- Tipo `ExitReason = "venta" | "merma" | "devolucion" | "cambio"` definido en `src/domain/actionQueue/types.ts`
- Cuando el dato llegue, solo se necesita actualizar el parser en `src/api/normalize.ts`
