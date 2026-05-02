# Sesión 02/05/2026 — Desbloqueo de 3 KPIs (PR #51) + Fix DSO (PR #52)

## Origen

Auditoría manual de la página `/kpis` para identificar KPIs marcados como `next` o `blocked` cuyos datos ya estuvieran disponibles en BD operacional pero no conectados al dashboard.

## Diagnóstico contra BD `gwzllatcxxrizxtslkeh`

Crucé el catálogo `src/domain/kpis/fenix.catalog.ts` (50 KPIs) contra la BD operacional. De los 41 KPIs no-`core` (que muestran `LockedKpiCard`), encontré **3 desbloqueables**:

| KPI | PST previo | Bloqueo declarado | Realidad en BD hoy |
|---|---|---|---|
| `sell_through` | next | "Se necesita el histórico de movimientos" | `v_sth_cohort` viva con 285.470 filas (`units_received`, `units_sold`, `cohort_age_days`). Ya consumida por lifecycle/waterfall y `/ventas`. |
| `dso` | next | "Ir con la tabla de CxC" — la doc decía `c_cobrar` vacía | **Falso a hoy.** `c_cobrar` con 834.041 filas; 7.090 con `pendiente_de_pago > 0`. |
| `customer_recurrence` | **blocked** | "En espera del programa de duplicación" | **Datos físicamente disponibles.** `CLIM100` con 82.905 clientes, `v_transacciones_dwh` con `codigo_cliente` + `num_transaccion`. Recurrencia es agregación pura, no requiere "programa de duplicación". |

### KPIs que siguen bloqueados (confirmado)

- `ebitda_contribution`, `otb_compliance` — no existen tablas `gastos` ni `otb`.
- `oos_rate` — `movimientos_st_jde` con 526K filas pero campos en EBCDIC sin decodificar.
- `sov_som_delta`, ROAS, CAC, LTV*, todos los `future` — datos externos verdaderos.
- `conversion_rate`, `traffic` — sensores no instalados.

## PR #51 — Desbloqueo inicial

### Cambios

| Archivo | Tipo | Descripción |
|---|---|---|
| `src/queries/sellThrough.queries.ts` | new | `fetchSellThroughByWindow(storeCode?, skuBrandMap?, brand?)` agrega red-wide para 3 ventanas (30/60/90). + `fetchSkuBrandMap()` para resolver brand vía cruce SKU→brand contra `mv_stock_tienda` (la vista `v_sth_cohort` no tiene brand). |
| `src/queries/dso.queries.ts` | new (luego reescrito en PR #52) | Implementación inicial con filtros brand/channel — bug detectado post-deploy. |
| `src/queries/recurrence.queries.ts` | new | `fetchCustomerRecurrence(year, months, channel?, storeCosupc?)`. Filtra por `fecha_formateada LIKE '%/MM/YYYY'` (la columna `año` con tilde rompe URL-encoding en algunos casos). Excluye `codigo_cliente=0`. |
| `src/queries/keys.ts` | mod | `sthKeys.windows`, `sthKeys.brandMap`, `dsoKeys`, `recurrenceKeys`. |
| `src/domain/kpis/fenix.catalog.ts` | mod | 3 KPIs reclasificados: distribución 9→12 core, 2→1 blocked, 8→6 next. |
| `src/domain/kpis/calculations.ts` | mod | `calcCustomerRecurrence` puro. `calcSellThrough` y `calcDSO` ya existían (Sprint 2B). |
| `src/features/kpis/hooks/useKpiDashboard.ts` | mod | 3 useQuery nuevos con gating + 3 cards al `rawCards`. |
| Tests | new + mod | +32 tests (17 queries, 14 filterSupport, 1 contract distribución). |

### Distribución PST resultante

| PST | Antes | Después |
|---|---|---|
| core | 9 | **12** |
| blocked | 2 | **1** |
| next | 8 | **6** |
| later | 15 | 15 |
| future | 16 | 16 |

### Verificación

```
Tests:  1813 passing (63 suites, +32 desde 1781)
TSC:    0 errores
ESLint: 0 errores (2 warnings preexistentes en marketing)
Build:  OK (2.92s)
PR:     https://github.com/calcarazgre646/NewFenixBrands/pull/51 (merged --squash --admin)
Deploy: fenix-brands-gzsawt1bo → aliased https://fenix-brands-one.vercel.app
```

## PR #52 — Fix DSO (bug crítico detectado en producción)

Tras el deploy de PR #51 el usuario reportó que la card de DSO mostraba **~17.000 días** (~46 años). Diagnóstico end-to-end encontró 3 bugs encadenados.

### Bug 1: Fórmula incorrecta (numerador filtrado por período)

DSO clásico = **saldo CxC abierto SNAPSHOT a la fecha** / ventas diarias del período. La implementación inicial filtraba el numerador con `f_factura BETWEEN periodStart AND periodEnd` — eso convierte el saldo en un flujo del período, no un snapshot.

Casos rotos:
- `currentMonth=mayo 2026` (día 2): 0 facturas emitidas en mayo → numerador 0 → DSO=0 silencioso.
- Períodos largos: mezcla saldo "del período" (recientes) con ventas del período → ratios absurdos.

Fix: cutoff `f_factura <= periodEnd` para excluir facturas con fecha futura (hay datos sucios hasta 2027), pero **sin** límite inferior. Snapshot acumulado.

### Bug 2: Asimetría brand/channel

`c_cobrar` no tiene marca/canal/tienda. `mv_ventas_diarias` sí. La implementación filtraba el denominador (ventas) por brand/channel pero el numerador (CxC) quedaba a nivel total → DSO matemáticamente incoherente.

Ejemplo numérico real:
- CxC total ≈ 80.000M Gs; ventas YTD Martel ≈ 5.000M Gs (~40M/día) → "DSO Martel" = 2.000 días. Pero la deuda no es de Martel: es global.

Fix: `supportedFilters: { brand: false, channel: false, store: false }`. La card se deshabilita con mensaje "no disponible con filtro de marca" cuando hay filtros.

### Bug 3: ETL atrasado en mv_ventas_diarias

La vista termina hoy en `2026-04-29`. Si el período es mayo 2026 (currentMonth) no hay ventas → división por cero manejada como 0 silencioso, ocultando el problema.

Fix: flag `dataAvailable` en `DSOResult`. Cuando `false`, la card muestra error didáctico:

> *"Sin ventas registradas en el período (mv_ventas_diarias se actualiza con un día de retraso)"*

### Datos verificados en BD

```
c_cobrar:                    834.041 filas
  pendiente_de_pago > 0:       7.090
  pendiente > 100M Gs:         2.060
  pendiente > 1B Gs:             173  (ej: 52.500.000.000 Gs — datos sucios)
mv_ventas_diarias:             4.466 filas, rango 2025-01-02 a 2026-04-29
```

No filtramos por magnitud — eso es decisión del cliente y rompería la coherencia del snapshot. Documentado abajo en "Pendiente Derlys".

### Cambios PR #52

| Archivo | Cambio |
|---|---|
| `src/queries/dso.queries.ts` | Reescrito. Saldo snapshot. Días reales con datos. Flag `dataAvailable`. Sin brand/channel. |
| `src/queries/keys.ts` | `dsoKeys.byPeriod(year, months)` — firma reducida. |
| `src/domain/kpis/fenix.catalog.ts` | DSO `supportedFilters` → todos false. `obs` actualizado. |
| `src/features/kpis/hooks/useKpiDashboard.ts` | dsoQ sin brand/channel. Error didáctico cuando dataAvailable=false. |
| `src/queries/__tests__/dso.queries.test.ts` | Reescrito (6 tests). |
| `src/domain/kpis/__tests__/filterSupport.test.ts` | Bloque DSO ajustado. |

### Blast radius verificado

| Lugar que toca c_cobrar / mv_ventas_diarias | ¿Afectado? |
|---|---|
| `cobranza.queries.ts` (comisiones Mayorista/UTP) | No — usa `f_pago`, firma intacta. |
| `marketing.queries.ts` (segmentación) | No — intacto. |
| `useSellerProjections.ts` | No — solo comentarios sobre c_cobrar. |
| `SalesPage` + `ExecutivePage` | No — usan `mv_ventas_diarias` solo para freshness display, no leen `neto`. |
| `sales.queries.ts fetchDailySalesWide` | No — query independiente. |
| `useDataFreshness` | No — lee status pre-computado. |

### Verificación

```
Tests:  1814 passing (63 suites)
TSC:    0 errores
ESLint: 0 errores
Build:  OK (2.78s)
PR:     https://github.com/calcarazgre646/NewFenixBrands/pull/52 (merged --squash --admin)
Deploy: fenix-brands-a1xzmq0ft → aliased https://fenix-brands-one.vercel.app
```

## Pendiente para Derlys

Para que DSO admita filtros por marca/canal/tienda hace falta una de estas tres opciones, en orden de costo creciente:

1. **Tabla mapping `factura_marca`** — `numero_documento → brand`. La más barata: solo agrega un view sobre datos ya existentes (líneas de venta en `fjdhstvta1` mapean factura → SKU → brand vía `dim_maestro_comercial`).
2. **Vista `v_cxc_enriched`** que cruce `c_cobrar` con `fjdhstvta1` por `numero_documento` y resuelva brand+canal+tienda por cuota.
3. **Columnas nuevas** en `c_cobrar` directamente (`brand`, `channel`, `cosujd`) — requiere modificar el ETL de ERP.

Spec detallada en `docs/PENDING_DERLYS_DSO_ENRICHMENT.md`.

## Cambios de catálogo permanentes

```diff
- pst: 'core'  count: 9   (revenue, lfl, gross_margin, gmroi, inventory_turnover,
+ pst: 'core'  count: 12     aov, upt, returns_rate, markdown_dependency,
+                              sell_through, dso, customer_recurrence)
- pst: 'blocked' count: 2  (sov_som_delta, customer_recurrence)
+ pst: 'blocked' count: 1  (sov_som_delta)
- pst: 'next' count: 8     (ebitda, otb, sell_through, oos, dso, lfl, conversion, promo_uplift)
+ pst: 'next' count: 6     (ebitda, otb, oos, conversion, promo_uplift, promo_roi)
```

## Aprendizajes

1. **Antes de declarar un KPI bloqueado, probar la BD a hoy.** La doc del proyecto y los `obs` del catálogo decían que `c_cobrar` estaba vacía. Falso desde hace meses. Revalidar fuentes en cada sesión de auditoría.

2. **Asimetría de filtros = bug.** Si un KPI tiene numerador y denominador en tablas con dimensiones distintas, el filtro no se puede aplicar parcialmente. O ambos lados soportan el filtro, o ninguno. Filtrar solo uno produce ratios sin sentido.

3. **Snapshots vs flujos.** DSO, niveles de inventario, balances → snapshots a fecha de corte. Ventas, COGS, devoluciones → flujos del período. No mezclar las dos lógicas en una misma query.

4. **`dataAvailable` flag explícito** > silencio con `0`. Cuando la fuente de datos no tiene cobertura para el período, devolver el flag y dejar que la UI muestre un mensaje didáctico. Un cero silencioso engaña al usuario.

5. **Verificar blast radius con `grep` antes de cambiar firmas de query/key.** Cambiamos `dsoKeys.byPeriod` y `fetchDSO` de firma — ambos solo se llaman desde `useKpiDashboard.ts`, así que el cambio fue seguro. Pero debe verificarse, no asumirse.
