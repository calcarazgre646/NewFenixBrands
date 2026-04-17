# Lifecycle SKU — Implementacion y Auditoria

**Fecha:** 2026-04-16 (actualizado 2026-04-16 tarde)
**Sesion:** Implementacion de reglas de Rodrigo + auditoria + respuestas del cliente
**Estado:** Funcional. 6 de 8 preguntas respondidas por Rodrigo. 2 pendientes (capacidades + perfil gerencia).

---

## Resumen ejecutivo

El Centro de Acciones ahora implementa las reglas de lifecycle de Rodrigo:
- Tabla de linealidad 3 tipos x 6 tramos (18 celdas exactas)
- 6 acciones con responsables diferenciados por tipo de producto
- Analisis secuencial de 5 pasos (tallas, consolidar/mover, STH vs promedio, cascade)
- Cascade A->B->OUT con routing por cluster
- Edad por cohorte original (primera entrada a la red)
- Perfiles DOI 15d/45d
- Accion definida obligatoria a 90d+ (maintain si STH alto, markdown si STH bajo)
- Evaluacion lifecycle por talla individual (no por SKU completo)
- Cascade destino por mejor vendedor del SKU
- Pareto eliminado — priorizacion 100% por urgencia operativa

Se audito contra cada regla del cliente y se ejecuto bug hunting adversarial con multiples agentes independientes.

---

## Reglas implementadas (R1-R9)

### R1 — Reglas base edad x STH
**Estado:** IMPLEMENTADO + AUDITADO

La tabla detallada por tipo de producto (R2) es la que manda. La regla simple de Rodrigo (45/60/75/90d) coincide con "basicos" en los brackets correspondientes.

**Respuesta de Rodrigo (pregunta #1):** "Revisar curva de tallas, consolidar si es posible. Caso contrario mantener hasta agotar stock."

**Implementacion:** A 90d+ con STH alto (por encima del umbral), el sistema:
1. Primero intenta completar curva de tallas (consolidar/reponer)
2. Si no hay curva que completar → `maintain_until_sold` (mantener hasta agotar)
3. Solo si STH esta DEBAJO del umbral → `markdown_liquidacion`

Todo SKU de 90d+ tiene una accion definida — la diferencia es que no se aplica markdown a un producto que vendio bien.

### R2 — Tabla de linealidad: 3 tipos x 6 tramos
**Estado:** IMPLEMENTADO + AUDITADO (18/18 celdas exactas)

Archivo: `src/domain/lifecycle/linealidad.ts:73-77`

| Edad | 15d | 30d | 45d | 60d | 75d | 90d |
|------|-----|-----|-----|-----|-----|-----|
| Carry Over | 20% | 40% | 50% | 65% | 80% | 95% |
| Basicos | 15% | 30% | 40% | 55% | 70% | 85% |
| Temporada | 10% | 20% | 30% | 45% | 60% | 75% |

Clasificacion de producto: `classify.ts` usa `carry_over` (boolean del ERP) y `est_comercial` ("lanzamiento" = temporada). Prioridad: carry_over > temporada > basicos.

### R3 — Acciones y responsables
**Estado:** IMPLEMENTADO + AUDITADO (18/18 roles correctos)

Archivo: `src/domain/lifecycle/linealidad.ts:27-69`

Las 2 excepciones de Temporada (15d y 45d con Marketing B2C + Brand Manager) estan correctas.

### R4 — Analisis secuencial (5 pasos)
**Estado:** IMPLEMENTADO con gap menor

Archivo: `src/domain/lifecycle/sequentialDecision.ts`

| Paso | Estado | Detalle |
|------|--------|---------|
| 1. Tallas en tienda actual | OK | `sizeCurve.stores[].presentTalles` |
| 2. Tallas en otras tiendas | OK | `gapSources` map |
| 3a. Consolidar o mover | OK | Sales ratio >= 0.8 -> consolidar, <0.8 -> mover. Fallback por volumen (50%) |
| 3b. STH vs promedio tienda | OK | `storeAvgSth` (promedio de todos los SKUs en la tienda) |
| 4. Sugerir accion | OK | 10 outcomes posibles, todos cubiertos |

**Respuesta de Rodrigo (pregunta #4):** "Al no tener historicos, comparar contra la tienda que mejor vendio ese SKU independiente de si la curva estuvo completa o no." — Ya funciona asi. Sin cambio necesario.

### R5 — Reglas por cluster
**Estado:** IMPLEMENTADO + AUDITADO (10/10)

Archivos: `clusterRouting.ts`, `sequentialDecision.ts:253`, `waterfall.ts:669-692`

- A -> B desde bracket 30 (despues de "corregir ejecucion" a 15d)
- B -> OUT desde bracket 60
- OUT no cascadea (markdown en lugar)
- Flujo inverso bloqueado (OUT->A, OUT->B)
- Destino por mejor vendedor del SKU en el cluster destino (Rodrigo: "siempre priorizar donde mejor se vende")
- Tiendas llenas se excluyen como filtro secundario

**Respuesta de Rodrigo (pregunta #2):** "Siempre debe priorizarse donde mejor se vende." — Implementado.

### R6 — Edad por cohorte original
**Estado:** IMPLEMENTADO + FIX APLICADO

Archivo: `sth.queries.ts` (fuente primaria), `waterfall.ts:358-385` (fallback chain)

Fuente primaria: `mv_sth_cohort.cohort_age_days = CURRENT_DATE - first_entry_network`. Correcto.

**Fix aplicado:** Cuando la fuente primaria no tiene dato para un (store, sku), ahora busca `cohortAgeDays` en CUALQUIER tienda para ese SKU (ya que es network-level) antes de caer al fallback DOI. El fallback DOI (`mv_doi_edad`) usa "last movement" que es semanticamente diferente pero es ultimo recurso.

### R7 — Perfiles DOI 15d / 45d
**Estado:** IMPLEMENTADO con gap menor

Archivo: `auth/types.ts:140-146`, `CompactActionList.tsx:63-77`, `ActionsTab.tsx:116-125`

- Formato de brackets: correcto (15d granular, 45d ejecutivo)
- Toggle visible solo para super_user y gerencia

**Gap:** `getUserViewProfile` mapea TODO rol "gerencia" a 45d. "Gerencia de Producto" deberia ver 15d. Ver pregunta #5.

### R8 — 3 analisis constantes
**Estado:** INTEGRADOS en el motor de decisiones

| Analisis | Donde esta | Roles |
|----------|-----------|-------|
| Reposicion de tallas (%OOS) | `sequentialDecision.ts` Steps 1-3 | BM + Ops + Logistica |
| Asignacion de tienda (STH vs promedio) | `sequentialDecision.ts` Step 4 | BM + Ops + Logistica |
| Cobertura DOI = Age x (1-STH)/STH | `sth.ts:44-49` | Brand Manager |

Los 3 alimentan directamente las decisiones del motor. No se muestran como stat cards separadas — generan acciones concretas.

### R9 — Salidas no-venta
**Estado:** BLOQUEADO por ERP

El ERP solo tiene `tipo_doc = "ST"` (526K filas). No hay forma de distinguir merma/devolucion/cambio. Placeholder `ExitReason` en `types.ts:89` listo para cuando Fenix provea datos. Documentado en `docs/PENDING_CLIENT.md`.

---

## Fixes aplicados en esta sesion

### De la auditoria contra reglas (gaps G1-G7)

| Fix | Descripcion | Archivos |
|-----|-------------|----------|
| G1 | Step 3: consolidar vs mover a mejor tienda (antes siempre reposition_sizes) | sequentialDecision.ts |
| G2 | STH vs promedio de TIENDA (antes usaba promedio de red por SKU) | waterfall.ts, sequentialDecision.ts |
| G5 | Cascade A->B desde 30d (antes solo desde 60d) | sequentialDecision.ts |
| G5b | Cascade destino usa cluster correcto (A->B, B->OUT) — antes siempre iba a OUT | waterfall.ts |
| G7 | roles.ts duplicado eliminado | roles.ts, roles.test.ts |

### De la auditoria de reglas (R1-R9)

| Fix | Descripcion | Archivos |
|-----|-------------|----------|
| R1 | 90d+: STH alto → revisar curva, consolidar o mantener. STH bajo → markdown. | linealidad.ts, sequentialDecision.ts |
| R6 | Cohort age fallback busca en cualquier tienda antes de usar DOI | waterfall.ts |

### Del bug hunting adversarial

| Fix | Descripcion | Archivos |
|-----|-------------|----------|
| B1 | Capacity check acumula inflow (antes usaba stock original, permitia overflow) | waterfall.ts |
| B2 | Cascade destino por mejor vendedor del SKU (Rodrigo), con capacidad como filtro | waterfall.ts |
| BUG-1 | FERIA y MARTELLUQUE removidos de EXCLUDED_STORES en STH query | sth.queries.ts |

### Datos actualizados

| Fix | Descripcion |
|-----|-------------|
| MARTELLUQUE | Agregado a STORE_CLUSTERS (B) y config_store en BD |
| Capacidades | STORE_ASSORTMENT actualizado con datos de Derlys (6 tiendas). SHOPMCAL ahora tiene dato (1,863). WRSSL corregido de 3,000 a 1,811. |
| config_store | 5 UPDATEs ejecutados en BD auth para reflejar capacidades reales |

---

## Bugs pendientes (priorizados)

### Resueltos con respuestas de Rodrigo

| Bug | Respuesta de Rodrigo | Estado |
|-----|---------------------|--------|
| STH mejor talla | "Evaluar por talla individual. UX: mostrar promedio pero abrir detalle por talla." | IMPLEMENTADO — lifecycle ahora evalua per (sku, talle, store) |
| 90d+ con STH alto | "Revisar curva, consolidar si posible, sino mantener hasta agotar." | IMPLEMENTADO |
| Cascade destino | "Siempre priorizar donde mejor se vende." | IMPLEMENTADO |
| Mejor vendedor sin curva completa | "Comparar contra la tienda que mejor vendio, independiente de curva." | Ya funcionaba asi |

### Pendientes menores

| Bug | Descripcion |
|-----|-------------|
| WOI como proxy de edad | Producto nuevo con carga grande -> WOI alto -> puede sobreestimar edad. Mitigado con threshold 52 semanas. |

### Mejoras de performance y UX (RESUELTAS)

| Bug | Estado |
|-----|--------|
| O(n*m) cohort fallback | RESUELTO — pre-computado Map<sku, age> con O(1) lookup |
| importedSet recreado | RESUELTO — movido fuera del loop |
| DOI sin cap | RESUELTO — cap a 9999 |
| setState en useMemo | RESUELTO — separado a useEffect |
| Paginacion stale | RESUELTO — safePage clamp |
| storeStockMap ambos canales | RESUELTO — usa inventory completa para capacidad |
| Pareto eliminado | RESUELTO — priorizacion 100% por risk (urgencia) |
| Stats no reactivas a filtros | RESUELTO — se recalculan desde filteredItems |
| Buscador eliminado | RESUELTO — se redisena con nuevo UX |

### Pendientes menores de UX

| Bug | Descripcion |
|-----|-------------|
| Cache 30min sin refresh | Agregar boton "actualizar" + indicador "hace X min". Sera parte del rediseno UX. |

### No arreglables (limitaciones de datos)

| Bug | Descripcion |
|-----|-------------|
| minStockAbs=3 en SKUs sin demanda | Requiere logica de demand-gating mas sofisticada |
| networkAvgSth como fallback | Solo aplica cuando storeAvgSth es null (tiendas sin datos STH suficientes) |
| Single-store SKU | 100% cobertura por definicion. Requiere curva de tallas de referencia del ERP |

---

## Preguntas para Rodrigo — Estado

| # | Pregunta | Respuesta | Estado |
|---|----------|-----------|--------|
| 1 | 90d+ con STH alto → markdown o algo mas suave? | "Revisar curva, consolidar si posible, sino mantener hasta agotar" | IMPLEMENTADO |
| 2 | Destino cascade A→B → por capacidad, ventas o proximidad? | "Siempre priorizar donde mejor se vende" | IMPLEMENTADO |
| 3 | STH por talla → mejor, peor o promedio? | "Evaluar por talla individual. UX: promedio + abrir detalle" | IMPLEMENTADO |
| 4 | Best performer sin curva completa? | "Comparar contra mejor vendedor independiente de curva" | Ya funcionaba asi |
| 5 | Gerencia de Producto vs Comercial para toggle 15d/45d | SIN RESPUESTA | PENDIENTE |
| 6 | B2C → MAYORISTA cuando es mejor vendedor? | SIN RESPUESTA | PENDIENTE (excluido por ahora) |
| 7 | Capacidades faltantes (15 tiendas) | Rodrigo derivo a Derlys con Madeleine | ESPERANDO DATOS |
| 8 | MARTELLUQUE: tienda o deposito? | "Aunque no lo creas, es una tienda. Considerar como B." | IMPLEMENTADO |

---

## Verificacion

```
Tests:  1338 passing (40 suites)
TSC:    0 errores
Build:  OK
Deploy: https://fenix-brands-one.vercel.app (via CLI, auto-deploy deshabilitado)
PR:     #18 merged (lifecycle engine + sync pendientes)
```

## Cambios posteriores a respuestas de Rodrigo

| Cambio | Descripcion |
|--------|-------------|
| 90d+ con STH alto | Revertido `forcedAt90`. Ahora: revisar curva → consolidar → maintain. No markdown. |
| Cascade por ventas | Destino por mejor vendedor del SKU (no por capacidad). Capacidad como filtro secundario. |
| STH por talla | Lifecycle evalua per (sku, talle, store). `precomputeSkuStoreAvgSth` para promedio por SKU. |
| Pareto eliminado | Toggle, badge, stat card, computo. Risk es el unico eje de priorizacion. |
| Stats reactivas | Stat cards se recalculan desde filteredItems (responden a filtros de tipo). |
| Brand filter fix | storeStockTotals usa inventory completa (no filtrada por marca) para capacidad. |
| Buscador eliminado | Sera parte del rediseno UX con sistema de tickets/cards. |
| Loading text | "Calculando desde llegada a deposito Stock" (pedido de Rodrigo). |

## Archivos clave modificados (sesion completa)

```
src/domain/lifecycle/linealidad.ts         — 90d: no forcedAt90, linealidad pura
src/domain/lifecycle/sequentialDecision.ts  — Step 3 consolidar/mover, cascade 30d, 90d+ maintain
src/domain/lifecycle/sth.ts               — DOI cap 9999
src/domain/lifecycle/roles.ts             — ELIMINADO (duplicado)
src/domain/actionQueue/waterfall.ts        — lifecycle per-talle, storeAvgSth, bestPerformer, capacity acumulativa, cascade por ventas, cohort O(1), importedSet fuera loop, Pareto eliminado, brand filter fix
src/domain/actionQueue/clusters.ts         — MARTELLUQUE + capacidades Derlys
src/domain/actionQueue/types.ts            — +transferencia_lifecycle, paretoFlag deprecated, sizeUnits/presentSizes/networkSizes
src/domain/actionQueue/grouping.ts         — paretoCount eliminado
src/queries/sth.queries.ts                — FERIA/MARTELLUQUE removidos de EXCLUDED_STORES
src/features/action-queue/hooks/useActionQueue.ts    — setState→useEffect, paretoCount eliminado, stats simplificadas
src/features/action-queue/components/ActionsTab.tsx   — Pareto UI eliminado, stats reactivas a filtros, buscador eliminado
src/features/action-queue/components/ActionFilters.tsx — Buscador eliminado, solo chips de tipo
src/features/action-queue/components/ActionCard.tsx    — Nuevo sistema de tickets (otro agente)
src/features/action-queue/components/CompactActionList.tsx — Curva visual con pills + unidades
src/features/action-queue/components/ActionQueueLoader.tsx — Texto "desde llegada a deposito Stock"
src/features/action-queue/components/exportHtml.ts — "Priorizado por urgencia" (no Pareto)
vercel.json — github.enabled: false
```
