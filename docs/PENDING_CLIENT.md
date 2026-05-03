# Datos Pendientes del Cliente (Fenix SA)

## Workflow de aprobación de markdown (Fase 2 del ticket "Carga de markdown por SKU")

**Estado:** Fase 1 entregada (PR #55, 04/05/2026) — gerencia/super-usuario cargan markdown manual por SKU desde `/precios` y se aplica directo. Fase 2 (workflow de aprobación al Gte Comercial) **bloqueada por definiciones de proceso del cliente**.

**Lo que necesitamos de Rodrigo / Gte Comercial:**

1. **¿Quién pide y quién aprueba?**
   - ¿Solicitan también roles "negocio" (vendedores / brand managers) o solo gerencia?
   - ¿Quién es el aprobador final? ¿Solo Rodrigo? ¿Hay backup si está fuera?
   - ¿Cuánto tiempo tiene el aprobador antes de auto-rechazar el pedido?

2. **¿Vigencia obligatoria?**
   - Hoy se puede dejar abierto y apagarlo a mano. Decidir si todo markdown debe **expirar solo** (ej. 30 días por defecto) o si la duración la elige el solicitante.

3. **¿Aplica también a precio mayorista (PVM)?**
   - Hoy solo afecta el precio retail (PVP). Si quieren que un descuento también afecte ventas mayoristas, hay que confirmarlo y agregar columna en BD.

4. **¿Conexión con el lifecycle automático?**
   - El sistema ya recomienda "Markdown Selectivo / Progresivo / Liquidación" en `/acciones` para SKUs con bajo sell-through. Hoy son dos circuitos separados: el sistema recomienda, el humano carga.
   - ¿Quieren que al aprobar una recomendación de `/acciones` se cargue el markdown automáticamente? ¿O mantener separados?

**Estructura preparada en código (Fase 1):**
- Tabla `sku_markdowns` ya tiene columna `status` con valores reservados `pending_approval` y `rejected`. No hace falta migration nueva para Fase 2 — solo cambiar el flujo.
- Edge Function `send-email` (Resend) ya existe — lista para notificar al aprobador.
- Permiso `canEditPricing` ya separado de `canViewPricing` — base para distinguir solicitantes vs aprobadores.

**Tiempo estimado tras desbloqueo:** ~1 sprint (5 días) para Fase 2 completa: workflow + email + bandeja de aprobación + auto-expiración.

---

## Lógica inversa exhibición↔depósito (ticket Rodrigo, audio 17/03)

**Pedido:** descontar las ventas desde exhibición usando misma lógica waterfall pero inversa, gateada por capacidad física de cada tienda.

**Análisis completo:** ver `docs/INVERSE_WATERFALL_EXHIBITION_2026-05-03.md`.

**Estado actual:** análisis cerrado, scope y plan en 6 fases definidos. **Bloqueado por datos físicos del cliente.**

**Lo que necesitamos de Fenix:**

1. **Planograma o split exhibición vs back-stock por tienda.** Mínimo: porcentaje aproximado por tienda que se considera "en piso" vs "back-stock". Ideal: lista `(tienda, sku_comercial, unidades_target_en_piso)`.
2. **Capacidad física de exhibición** para las 41 tiendas. Hoy solo tenemos `assortment` (capacidad bruta total) cargado para 12 tiendas en `config_store`. Necesitamos:
   - Las 29 tiendas faltantes con assortment, o
   - Capacidad de exhibición específica (m², slots, unidades en piso) — cualquiera de las tres sirve si nos dicen cómo convertir a unidades.
3. **4 decisiones de producto** (ver bloque 8 del análisis):
   - Granularidad del planograma: `(store, sku)` o `(store, sku, talle)`
   - Default cuando no hay planograma cargado
   - Cómo derivamos `exhibition_capacity` para las 12 tiendas con assortment ya cargado
   - Modo del algoritmo: análisis histórico (período del filtro) vs modo vivo (últimas N horas)

**Impacto:**

- Sin estos datos, podemos arrancar con defaults educados (ratio 30% exhibición, 40% del assortment como capacidad), pero el sistema sería **estimado**, no fiel a la realidad operativa.
- El feature es construible end-to-end con datos virtuales — pero el cliente vería cifras orientativas, no las que mide en piso. Para la promesa "Palantir aplicado a Fenix" hace falta el dato físico.

**Estructura preparada en código:**
- Nada todavía. La rama `feat/inverse-waterfall-exhibition` y la migración `sql/015_exhibition_planogram.sql` se crean cuando se desbloquee.

---

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
