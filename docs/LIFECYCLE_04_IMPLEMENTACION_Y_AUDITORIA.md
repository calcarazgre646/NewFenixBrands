# Lifecycle SKU — Implementacion y Auditoria

**Fecha:** 2026-04-16
**Sesion:** Implementacion de reglas de Rodrigo + auditoria end-to-end + bug hunting adversarial
**Estado:** Funcional con 8 preguntas pendientes para Rodrigo

---

## Resumen ejecutivo

El Centro de Acciones ahora implementa las reglas de lifecycle de Rodrigo:
- Tabla de linealidad 3 tipos x 6 tramos (18 celdas exactas)
- 6 acciones con responsables diferenciados por tipo de producto
- Analisis secuencial de 5 pasos (tallas, consolidar/mover, STH vs promedio, cascade)
- Cascade A->B->OUT con routing por cluster
- Edad por cohorte original (primera entrada a la red)
- Perfiles DOI 15d/45d
- Salida obligatoria a 90d+

Se audito contra cada regla del cliente y se ejecuto bug hunting adversarial con multiples agentes independientes.

---

## Reglas implementadas (R1-R9)

### R1 — Reglas base edad x STH
**Estado:** IMPLEMENTADO + AUDITADO

La tabla detallada por tipo de producto (R2) es la que manda. La regla simple de Rodrigo (45/60/75/90d) coincide con "basicos" en los brackets correspondientes.

**Fix aplicado:** A 90d+ se fuerza accion obligatoria sin importar STH (`forcedAt90` en `linealidad.ts:127`). El `maintain_until_sold` en `sequentialDecision.ts:238` se salta cuando `bracket === 90`.

**Pregunta pendiente para Rodrigo:** Un SKU con 90d y STH 96% recibe "markdown liquidacion". Puede que sea mas apropiado una accion mas suave. Ver pregunta #1.

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

**Gap:** "cuando tuvo curva completa" — el best performer no filtra por historial de curva completa. Usa ventas totales como proxy. Ver pregunta #4.

### R5 — Reglas por cluster
**Estado:** IMPLEMENTADO + AUDITADO (10/10)

Archivos: `clusterRouting.ts`, `sequentialDecision.ts:253`, `waterfall.ts:669-692`

- A -> B desde bracket 30 (despues de "corregir ejecucion" a 15d)
- B -> OUT desde bracket 60
- OUT no cascadea (markdown en lugar)
- Flujo inverso bloqueado (OUT->A, OUT->B)
- Destino por capacidad disponible (headroom), no primera tienda alfabeticamente

**Pregunta pendiente:** Criterio de eleccion de tienda destino en cascade. Ver pregunta #2.

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
| R1 | 90d mandatory exit: `forcedAt90` en linealidad + skip maintain_until_sold | linealidad.ts, sequentialDecision.ts |
| R6 | Cohort age fallback busca en cualquier tienda antes de usar DOI | waterfall.ts |

### Del bug hunting adversarial

| Fix | Descripcion | Archivos |
|-----|-------------|----------|
| B1 | Capacity check acumula inflow (antes usaba stock original, permitia overflow) | waterfall.ts |
| B2 | Cascade destino por capacidad disponible, no primera tienda del config | waterfall.ts |
| BUG-1 | FERIA y MARTELLUQUE removidos de EXCLUDED_STORES en STH query | sth.queries.ts |

### Datos actualizados

| Fix | Descripcion |
|-----|-------------|
| MARTELLUQUE | Agregado a STORE_CLUSTERS (B) y config_store en BD |
| Capacidades | STORE_ASSORTMENT actualizado con datos de Derlys (6 tiendas). SHOPMCAL ahora tiene dato (1,863). WRSSL corregido de 3,000 a 1,811. |
| config_store | 5 UPDATEs ejecutados en BD auth para reflejar capacidades reales |

---

## Bugs pendientes (priorizados)

### Dependen de respuesta de Rodrigo

| Bug | Descripcion | Pregunta |
|-----|-------------|----------|
| STH mejor talla | `byStoreSku` fallback toma talla con MEJOR STH. Tallas muertas quedan invisibles. | #3 (usar peor, promedio, o por talla?) |
| WOI como proxy de edad | Producto nuevo con carga grande -> WOI alto -> marcado para liquidacion | Relacionado con #1 (accion apropiada) |

### Mejoras de performance (no afectan resultados)

| Bug | Descripcion | Esfuerzo |
|-----|-------------|----------|
| O(n*m) cohort fallback | Itera sthData por cada sku sin age. Pre-computar Map<sku, age>. | 10 min |
| importedSet recreado | `new Set(importedBrands)` dentro del loop. Mover fuera. | 2 min |
| DOI sin cap | STH cercano a 0% produce DOI de millones. Agregar `Math.min(..., 9999)`. | 2 min |

### Mejoras de UX (no afectan datos)

| Bug | Descripcion | Esfuerzo |
|-----|-------------|----------|
| setState en useMemo | Anti-patron React. Mover a useEffect. | 30 min |
| Paginacion stale | Page no se resetea al cambiar filtros. Agregar useEffect reset. | 5 min |
| storeStockMap ambos canales | Ocupacion no refleja canal activo. Filtrar por channel. | 10 min |
| Cache 30min sin refresh | Agregar boton "actualizar" + indicador "hace X min". | 15 min |

### No arreglables (limitaciones de datos)

| Bug | Descripcion |
|-----|-------------|
| minStockAbs=3 en SKUs sin demanda | Requiere logica de demand-gating mas sofisticada |
| networkAvgSth como fallback | Solo aplica cuando storeAvgSth es null (tiendas sin datos STH suficientes) |
| Single-store SKU | 100% cobertura por definicion. Requiere curva de tallas de referencia del ERP |

---

## Preguntas pendientes para Rodrigo

1. **Salida obligatoria 90d con STH alto:** Un SKU con 90d y 96% STH (quedan 2-3 unidades) -> "markdown liquidacion" o algo mas suave?

2. **Destino de cascade A->B:** A cual tienda B? Por capacidad? Por ventas del SKU? Por proximidad?

3. **STH por talla:** Tomar la mejor talla (actual), la peor, o el promedio?

4. **"Cuando tuvo curva completa":** No hay datos historicos de curva por tienda. Usamos ventas totales como proxy. Aceptable?

5. **Gerencia de Producto vs Comercial:** Que valor de `cargo` distingue a uno del otro para el toggle 15d/45d?

6. **B2C a MAYORISTA:** Mostrar como opcion cuando MAYORISTA es el mejor vendedor de un SKU?

7. **Capacidades faltantes:** Derlys relevo 6 de 21 tiendas. Cuando se completa?

8. **MARTELLUQUE:** Tienda B normal o deposito disfrazado? (8,913 unidades, 151 WOI promedio)

---

## Verificacion

```
Tests:  1340 passing (40 suites)
TSC:    0 errores
Build:  OK
```

## Archivos clave modificados

```
src/domain/lifecycle/linealidad.ts         — forcedAt90, thresholds (no change to values)
src/domain/lifecycle/sequentialDecision.ts  — Step 3 consolidar/mover, cascade 30d, maintain skip at 90d
src/domain/lifecycle/classify.ts           — sin cambios (ya estaba correcto)
src/domain/lifecycle/clusterRouting.ts     — sin cambios (ya estaba correcto)
src/domain/lifecycle/sth.ts               — sin cambios (formula correcta)
src/domain/lifecycle/roles.ts             — ELIMINADO (duplicado)
src/domain/actionQueue/waterfall.ts        — storeAvgSth, bestPerformer, capacity acumulativa, cascade por headroom, cohort fallback
src/domain/actionQueue/clusters.ts         — MARTELLUQUE en clusters, capacidades actualizadas con Derlys
src/domain/actionQueue/types.ts            — +transferencia_lifecycle ActionType
src/queries/sth.queries.ts                — FERIA y MARTELLUQUE removidos de EXCLUDED_STORES
src/features/action-queue/hooks/useActionQueue.ts    — stockoutCount separado, G6 removido (integrado en motor)
src/features/action-queue/components/ActionsTab.tsx   — labels toggle, stat cards actualizadas
src/features/action-queue/ActionQueuePage.tsx         — props actualizadas
sql/014_config_seed_etapa5.sql            — +MARTELLUQUE row
```
