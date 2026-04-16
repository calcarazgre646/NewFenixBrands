# Prompt de Auditoría: SKU Lifecycle Management System

**Instrucción para el agente auditor:** Lee los dos documentos de referencia y luego audita la implementación. No asumas nada — verifica cada punto contra el código real.

---

## Documentos de referencia (LEER PRIMERO)

1. **`docs/LIFECYCLE_01_ESTADO_ACTUAL.md`** — Estado del sistema ANTES de la implementación
2. **`docs/LIFECYCLE_02_REQUERIMIENTOS_CLIENTE.md`** — Requerimientos completos del cliente (Rodrigo Aguayo)

---

## Contexto

El proyecto NewFenixBrands (`/Users/prueba/Downloads/NewFenixBrands`) es una plataforma de analytics para retail de indumentaria (marcas Martel, Wrangler, Lee) en Paraguay. El "Centro de Acciones" (`/acciones`) es la feature principal: un algoritmo waterfall de 4 niveles que recomienda movimientos de inventario.

El cliente pidió evolucionar el sistema con lifecycle management basado en STH (Sell-Through Rate) por cohorte, reglas por tipo de producto, acciones con responsables, y flujo cluster-aware. La implementación se hizo en 4 fases.

**Stack:** React 19 + TypeScript + Vite + TanStack Query v5 + Supabase
**Arquitectura:** queries/ (fetch) → domain/ (pure functions) → features/ (UI) → hooks/ (orchestration)

---

## Checklist de auditoría

### A. Requerimiento: Clasificación de producto (Sección 1.2 de LIFECYCLE_02)

El cliente definió 3 tipos de producto:
- **Carry Over**: `carry_over = "SI"` en ERP
- **Básicos**: default (no carry over, no lanzamiento)
- **Temporada / Moda**: `est_comercial = "lanzamiento"`

**Verificar:**
- [ ] Existe tipo `ProductType = "carry_over" | "basicos" | "temporada"`
- [ ] Existe función `classifyProductType(estComercial, carryOver)` que implementa la lógica
- [ ] `carry_over = true` tiene prioridad sobre `est_comercial = "lanzamiento"` (un producto carry over relanzado sigue siendo carry over)
- [ ] Los campos `estComercial` y `carryOver` fluyen desde `inventory.queries.ts` → `InventoryRecord` → `waterfall.ts` → `ActionItem`
- [ ] `productType` aparece en `ActionItemFull` (output del waterfall)
- [ ] Tests cubren los 3 tipos + edge cases (case insensitive, prioridad carry_over)

### B. Requerimiento: DOI como filtro en waterfall (conversación WhatsApp 01/04/2026)

Rodrigo: *"si un producto lleva 169d es ilógico que lo repongamos"*. Se acordó que el DOI debe participar en la decisión.

**Valores del cliente:**
- Original (WhatsApp): "Más de 90 días: ningún SKU puede seguir sin acción definida; debe ejecutarse salida obligatoria"

**Verificar:**
- [ ] `WaterfallConfig` tiene `doiStaleThreshold` (default 90) y `doiDeadThreshold` (default 180)
- [ ] En `waterfall.ts`, la clasificación de déficit/superávit consulta el DOI de cada SKU
- [ ] SKU con DOI ≥ `doiDeadThreshold` → NO se agrega a `deficitStores` (excluido de restock), stock restante se trata como excedente
- [ ] SKU con DOI ≥ `doiStaleThreshold` → need se reduce (deprioritizado)
- [ ] SKU con DOI = 0 o sin datos → comportamiento unchanged (no afectado)
- [ ] Thresholds están en `app_params` (config editable, no hardcoded)
- [ ] Validación schema: `doiStaleThreshold < doiDeadThreshold`

### C. Requerimiento: Tabla de linealidad — Edad × STH × TipoProducto (email 09/04/2026)

El cliente definió una matriz de 18 celdas (3 tipos × 6 tramos):

| Edad → | 15d | 30d | 45d | 60d | 75d | 90d |
|--------|-----|-----|-----|-----|-----|-----|
| **Carry Over** → STH mín | ≥ 20% | ≥ 40% | ≥ 50% | ≥ 65% | ≥ 80% | ≥ 95% |
| **Básicos** → STH mín | ≥ 15% | ≥ 30% | ≥ 40% | ≥ 55% | ≥ 70% | ≥ 85% |
| **Temporada** → STH mín | ≥ 10% | ≥ 20% | ≥ 30% | ≥ 45% | ≥ 60% | ≥ 75% |

**Verificar:**
- [ ] Existe `evaluateLinealidad(productType, ageDays, sth, thresholds?)` como función pura
- [ ] Los 18 valores de la matriz coinciden EXACTAMENTE con los del cliente
- [ ] `findBracket(ageDays)` retorna el bracket correcto (e.g., age=47 → bracket 45, age=10 → null)
- [ ] Cuando STH < umbral → retorna `isBelowThreshold: true` con `action` y `responsibleRoles`
- [ ] Cuando STH ≥ umbral → retorna `isBelowThreshold: false` con `action: null`
- [ ] Edad < 15 → ningún bracket aplica → sin evaluación
- [ ] Edad > 90 → usa bracket 90 (no se cae)
- [ ] Thresholds son parametrizables (recibe `LinealidadThresholds` opcional)
- [ ] Tests cubren las 18 celdas + edge cases

### D. Requerimiento: Acciones con responsable (email 09/04/2026, Sección 1.3 de LIFECYCLE_02)

| Tramo | Acción | Responsable (carry_over/basicos) | Responsable (temporada) |
|-------|--------|----------------------------------|------------------------|
| 15d | Revisar Exhibición | Marketing B2C | Marketing B2C + Brand Manager |
| 30d | Revisar Asignación | Brand Manager | Brand Manager |
| 45d | Acción Comercial | Brand Manager | Marketing B2C + Brand Manager |
| 60d | Markdown Selectivo | Brand Manager + Gerencia Retail | Brand Manager + Gerencia Retail |
| 75d | Transfer OUT + MD Progresivo | BM + GR + Ops + Logística | BM + GR + Ops + Logística |
| 90d | Markdown Liquidación | Gerencia Retail | Gerencia Retail |

**Verificar:**
- [ ] Existe `assignRoles(action, productType)` que retorna roles correctos
- [ ] Los roles de Temporada en 15d y 45d difieren de Carry Over/Básicos (incluyen brand_manager y marketing_b2c adicional respectivamente)
- [ ] `ResponsibleRole` incluye: marketing_b2c, brand_manager, gerencia_retail, operaciones_retail, logistica
- [ ] Tests verifican las 18 combinaciones

### E. Requerimiento: STH por cohorte (email 09/04/2026, Secciones 1.1 y Q&A)

- STH = Units Sold / Units Received
- **Edad se mide desde fecha de ingreso a la RED (first_entry_network), NO por tienda**
- Transferencias A→B NO resetean la edad (Q&A P2: confirmado)

**Verificar:**
- [ ] Existe `mv_sth_cohort` materialized view (SQL en `sql/019_mv_sth_cohort.sql`)
- [ ] La MV tiene `first_entry_network` = MIN(fecha_transaccion) agrupado por (sku, talle) — NO por store
- [ ] La MV tiene `first_entry_store` = MIN(fecha_transaccion) agrupado por (sku, talle, store) — para referencia
- [ ] `sth = sold / received` capped a 1.0 (no puede ser >100%)
- [ ] `cohort_age_days = CURRENT_DATE - first_entry_network`
- [ ] Existe `fetchSthCohort()` en queries con 2-level lookup (exact + fallback)
- [ ] `calcSth(sold, received)` retorna 0 si received ≤ 0 (no NaN)
- [ ] `calcCohortAge(firstEntry, now)` retorna 0 si null o futuro
- [ ] `calcDoiFromSth(ageDays, sth)` implementa fórmula: `age × (1-STH) / STH`
- [ ] `lookupSth(sthData, store, sku, talle)` hace lookup 2-level como `lookupDoiAge`
- [ ] `sthData` se pasa opcionalmente en `WaterfallInput` y se usa en `makeItem`
- [ ] `sth` y `cohortAgeDays` aparecen en `ActionItem` (opcionales)
- [ ] `useActionQueue` hook conecta `fetchSthCohort` y lo pasa al waterfall
- [ ] La MV está en `refresh_all_and_log()` cron

### F. Requerimiento: Reglas por cluster (WhatsApp 01/04/2026)

- Tiendas A: prioridad novedades. Si no rinde → B primero, NO OUT directamente
- Tiendas B: absorben de A
- OUT: concentra salida, mayor edad

**Verificar:**
- [ ] Existe `rankTransferCandidates(deficitCluster, candidates)` que ordena por compatibilidad
- [ ] A deficit → prefiere surplus de A, luego B. OUT al final o excluido
- [ ] B deficit → A primero, luego B, OUT como último recurso
- [ ] OUT deficit → acepta de cualquier cluster
- [ ] `isTransferAllowed(source, dest)` bloquea OUT→A y OUT→B
- [ ] `nextClusterCascade(current)` retorna A→B, B→OUT, OUT→null
- [ ] El waterfall N1 usa `rankTransferCandidates` para ordenar surplus stores antes de asignar
- [ ] El waterfall N1 usa `isTransferAllowed` para bloquear transferencias inválidas

### G. Requerimiento: Análisis secuencial de 5 pasos (email 09/04/2026, Sección 3)

1. Revisar tallas en tienda actual
2. Revisar tallas en otras tiendas
3a. Si hay tallas → consolidar o mover a mejor performer
3b. Si no hay tallas → STH vs promedio
4. STH > promedio tienda → mantener hasta agotar
5. STH < promedio → transferencia/markdown

**Verificar:**
- [ ] Existe `analyzeSequentially(ctx, sizeCurve, thresholds?)` como función pura
- [ ] Si hay tallas faltantes disponibles en otras tiendas → outcome "reposition_sizes"
- [ ] Si STH ≥ umbral → "no_action"
- [ ] Si STH < umbral pero ≥ promedio red → "maintain_until_sold"
- [ ] Si STH < umbral y < promedio red en tienda A/B con edad ≥60d → "transfer_cascade"
- [ ] Si en OUT sin cascade posible → "markdown"
- [ ] Sin datos STH → "no_action" (graceful degradation)

### H. Requerimiento: Análisis de curva de tallas (email 09/04/2026, Sección 3 paso 1-2)

**Verificar:**
- [ ] Existe `buildSizeCurveForSku(records)` que construye la curva completa
- [ ] Detecta tallas faltantes por tienda
- [ ] Identifica qué tiendas tienen las tallas faltantes (gap sources)
- [ ] Excluye depósitos (STOCK, RETAILS) y B2B del análisis
- [ ] `curveCoverage()` calcula % de cobertura correctamente

### I. Requerimiento: 3 análisis constantes (email 09/04/2026, Sección 8)

1. Reposición de tallas: %OOS por SKU × tienda
2. Asignación de tienda: STH × SKU por tienda vs promedio red
3. Cobertura de ventas: DOI derivado de STH

**Verificar:**
- [ ] `analyzeSizeReposition(records)` detecta quiebre de tallas con sources
- [ ] `analyzeStoreAssignment(sthData)` flagea tiendas >5pp bajo promedio
- [ ] `analyzeCoverage(sthData, threshold?)` alerta DOI derivado > threshold
- [ ] Los 3 son funciones puras (no React, no side effects)

### J. Requerimiento: Tramos por perfil (email 09/04/2026, Sección 5)

- Gerencia Producto / Brand Managers: 15d (0-15, 16-30, 31-45, 46-60, 61-75, 76-90+)
- Gerencia Comercial Retail: 45d (0-45, 46-90, 90+)

**Verificar:**
- [ ] UI tiene toggle "Detalle (15d)" / "Ejecutivo (45d)"
- [ ] Detalle muestra 6 brackets
- [ ] Ejecutivo muestra 3 brackets
- [ ] Los brackets agrupan correctamente los items

### K. UI: Tab Lifecycle + badges

**Verificar:**
- [ ] ActionQueuePage tiene 3 pestañas: "Acciones", "Planificación de Compra", "Lifecycle"
- [ ] Tab "Lifecycle" muestra items agrupados por bracket de edad
- [ ] Cada fila muestra: producto, tienda, tipo (badge), edad, STH, estado (OK/bajo umbral), acción, responsables
- [ ] CompactActionList muestra badge "CO" (carry over) y "TM" (temporada) en filas de producto
- [ ] Básicos no tienen badge (es el default)

---

## Archivos clave a auditar

### Domain (funciones puras)
- `src/domain/lifecycle/types.ts` — tipos centrales
- `src/domain/lifecycle/classify.ts` — clasificación de producto
- `src/domain/lifecycle/linealidad.ts` — motor de reglas edad × STH
- `src/domain/lifecycle/roles.ts` — asignación de responsables
- `src/domain/lifecycle/sth.ts` — cálculos STH
- `src/domain/lifecycle/sizeCurve.ts` — análisis de curva de tallas
- `src/domain/lifecycle/clusterRouting.ts` — routing por cluster
- `src/domain/lifecycle/sequentialDecision.ts` — decisión secuencial 5 pasos
- `src/domain/lifecycle/analyses.ts` — 3 análisis constantes

### Waterfall (integración)
- `src/domain/actionQueue/waterfall.ts` — algoritmo core (DOI filter, cluster routing, STH lookup)
- `src/domain/actionQueue/types.ts` — tipos extendidos (productType, sth, cohortAgeDays en ActionItem/InventoryRecord)

### Queries
- `src/queries/inventory.queries.ts` — `toInventoryRecord()` ahora pasa estComercial, carryOver, productType
- `src/queries/sth.queries.ts` — fetch de mv_sth_cohort
- `src/queries/keys.ts` — sthKeys

### Config
- `src/domain/config/types.ts` — WaterfallConfig + doiStaleThreshold, doiDeadThreshold
- `src/domain/config/defaults.ts` — defaults actualizados
- `src/domain/config/schemas.ts` — validación con cross-field (stale < dead)
- `src/hooks/useConfig.ts` — useWaterfallConfig resuelve los nuevos params

### SQL
- `sql/019_mv_sth_cohort.sql` — materialized view STH por cohorte

### UI
- `src/features/action-queue/ActionQueuePage.tsx` — 3 pestañas
- `src/features/action-queue/components/LifecycleTab.tsx` — tab lifecycle con perfiles
- `src/features/action-queue/components/CompactActionList.tsx` — badges CO/TM

### Tests (10 archivos, ~270 tests nuevos)
- `src/domain/lifecycle/__tests__/classify.test.ts`
- `src/domain/lifecycle/__tests__/linealidad.test.ts`
- `src/domain/lifecycle/__tests__/roles.test.ts`
- `src/domain/lifecycle/__tests__/sth.test.ts`
- `src/domain/lifecycle/__tests__/analyses.test.ts`
- `src/domain/lifecycle/__tests__/sizeCurve.test.ts`
- `src/domain/lifecycle/__tests__/clusterRouting.test.ts`
- `src/domain/lifecycle/__tests__/sequentialDecision.test.ts`

---

## Criterios de aprobación

1. Todos los valores numéricos del cliente (umbrales STH, acciones, responsables) deben coincidir EXACTAMENTE
2. Las reglas de negocio (edad no se resetea por transferencia, carry_over > temporada en prioridad) deben estar implementadas
3. Funciones puras en domain/ sin dependencias de React ni side effects
4. Tests verifican cada regla de negocio
5. TSC 0 errores, Build OK, todos los tests pasan
6. Config parametrizable (no hardcoded) vía `app_params`
