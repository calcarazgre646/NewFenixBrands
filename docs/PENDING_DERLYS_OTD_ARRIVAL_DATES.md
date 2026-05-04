# Pendiente Derlys/Edgar — Fechas reales de llegada para OTD (On-Time Delivery)

**Solicitante:** Calcaraz · **Fecha:** 2026-05-04 · **Prioridad:** Media · **Bloqueante de:** ticket "On-time delivery" (Carlos, reunión Torre de Control).

## Pedido del cliente (Carlos)

> *"Fecha planificada vs real de llegada → % compras a tiempo. Logística sin datos de llegada aún. Necesita datos Derlys/Edgar."*

KPI clásico de Supply Chain: **OTD = (pedidos llegados a tiempo) / (pedidos totales del período)**, agregado por mes / proveedor / marca / temporada.

## Auditoría BD (2026-05-04) — qué se probó antes de pedir

Para no asumir, se auditó directamente la BD `gwzllatcxxrizxtslkeh` antes de marcar el ticket como bloqueado.

| Probado | Resultado |
|---------|-----------|
| `productos_importacion` (tabla actual de `/logistica`) | **vacía** hoy (`count = 0`). Antes ~580 filas. Edgar/Derlys reorganizando. |
| 34 nombres candidatos de columnas (`FECHALLEGADAREAL`, `FECHARECEPCION`, `FECHAINGRESO`, `FECHAARRIBOREAL`, `FECHAENTREGA`, `RECIBIDO`, `DEMORA`, `DELAY_DAYS`, `ENTREGADO`, etc.) | **0 existen** |
| Audit columns (`updated_at`, `status_changed_at`, `en_stock_at`) para inferir transición `EN TRANSITO → EN STOCK` | **0 existen** (solo `created_at`) |
| 70+ tablas alternativas en BD DATA + AUTH (`arribos`, `recepciones`, `llegadas`, `oc_recepcion`, `fcomprasenc`, `fcomprasdet`, `delivery_logs`, `arrival_logs`, `mv_compras`, `pedido_proveedor`, etc.) | **0 encontradas** |
| Inferir desde `mv_sth_cohort` (primera aparición del SKU en stock = proxy de "llegada real") | **bloqueado**: `productos_importacion` no expone `sku_comercial` → no hay join 1:1 |

**Veredicto:** el dato no existe en BD. Carlos tenía razón.

## Lo que necesitamos de Derlys/Edgar

### Cambio en la planilla de carga

Que la planilla de importación que Edgar mantiene y Derlys carga periódicamente sume **dos columnas nuevas** (1 obligatoria, 1 opcional pero recomendada):

| Columna nueva | Tipo | Obligatoria | Para qué |
|---------------|------|-------------|----------|
| `FECHALLEGADAREAL` | DATE (formato `D-Mon-YYYY` para mantener el patrón ya existente) | **SÍ** | Día efectivo de ingreso a depósito. Es el dato núcleo del OTD. Se llena cuando el contenedor entra a STOCK. Hasta entonces queda NULL. |
| `FECHADESPACHO` | DATE (mismo formato) | NO (recomendada) | Día que el proveedor despachó desde origen. Permite separar atrasos del proveedor vs. atrasos de transporte/aduana. |

**Cero migración histórica necesaria.** Desde el día que empiecen a registrarlas, el indicador empieza a poblarse. Pedidos viejos quedan NULL → se excluyen del cálculo.

### SQL sugerido (Derlys lo aplica una vez)

```sql
ALTER TABLE productos_importacion
  ADD COLUMN "FECHALLEGADAREAL" TEXT NULL,
  ADD COLUMN "FECHADESPACHO"    TEXT NULL;

COMMENT ON COLUMN productos_importacion."FECHALLEGADAREAL" IS
  'Fecha efectiva de ingreso del pedido a depósito (formato D-Mon-YYYY). NULL si todavía no llegó.';
COMMENT ON COLUMN productos_importacion."FECHADESPACHO" IS
  'Fecha de despacho desde origen (formato D-Mon-YYYY). Opcional, para análisis proveedor vs transporte.';
```

Tipo `TEXT` para mantener el patrón de las otras fechas de la tabla (`FECHAAPROXIMADADEARRIBO`, `FECHAAPROXIMADADELANZAMIENTO`) que ya vienen como string `D-Mon-YYYY` desde la planilla. El parser `parseDMonYYYY` ya las normaliza en `src/api/normalize.ts`.

## Decisiones que también necesitamos del cliente (Rodrigo + Carlos)

Antes de implementar el ticket nuevo:

1. **Tolerancia "a tiempo":**
   - Estricto (mismo día o antes)
   - ±3 días
   - ±7 días
   - Otra
2. **Agrupaciones sugeridas:**
   - Por mes (tendencia)
   - Por proveedor (ranking de cumplimiento)
   - Por marca (Martel/Wrangler/Lee)
   - Por temporada
   *Default propuesto: las 4 disponibles vía filtros + tabs.*
3. **Umbral de semáforo OTD %:**
   - Verde ≥ 90 %, ámbar 70–90 %, rojo < 70 % *(propuesto)*
4. **Pedidos `ANULADO`:** ¿se excluyen del denominador? *(propuesto: sí)*

## Ticket que sigue una vez destrabado

Pestaña nueva **"Cumplimiento"** en `/logistica` con:

- KPI card: % OTD del período (semáforo).
- Comparativa por proveedor (ranking, días promedio de demora).
- Comparativa por marca.
- Tendencia mensual (12 meses).
- Tabla detalle por OC: planificada / real / desvío en días / status.
- Filtros estándar (período, marca, proveedor).
- Plumbing: nuevo campo en `LogisticsImport` (`actualArrival: Date | null`), funciones puras en `src/domain/logistics/otd.ts` (`computeOtdRatio`, `groupByProvider`, `groupByBrand`, `groupByMonth`).

**Estimación:** 1 sesión (~4–6 hs) una vez que Derlys confirme que las columnas están cargándose.
