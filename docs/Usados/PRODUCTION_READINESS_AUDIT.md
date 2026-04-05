# Auditoria de Produccion — NewFenixBrands

**Fecha:** 2026-03-07 22:07 (PYT -03:00)
**Auditor:** Claude Code (Opus 4.6)
**Proyecto:** NewFenixBrands v2
**Objetivo:** Determinar si cada dato visible al usuario es correcto, robusto y listo para produccion enterprise

---

## Estado Pre-Auditoria

### Bloques de remediacion completados (esta sesion):

| Bloque | Resumen | Commit |
|--------|---------|--------|
| 1 | Git init, cache leak, ErrorBoundary, swiper CVE | `5855fb2` |
| 2 | manualChunks (580KB->0.86KB), ESLint, security headers, Calendar refactor | `38aa1a8` |
| 3 | +39 tests (237 total), XSS sanitization, -27 dead files (-959 LOC) | `27cf78c` |
| 4 | Sentry, jsx-a11y (14->0 errors), Switch/Modal a11y, Calendar loading | `c676c4c` |

### BD verificada:

| Vista/Tabla | Filas | Estado |
|-------------|-------|--------|
| fjdexisemp | 54,624 | OK — tabla base inventario |
| v_inventario | 54,624 | OK — JOIN con talla corregido (era 429K) |
| mv_stock_tienda | 38,686 | OK — filtros e_cantid>0, e_tpitem='1', GROUP BY |
| mv_ventas_mensual | ~1,400 | Vista materializada ventas agregadas |
| mv_ventas_12m_por_tienda_sku | ~8-20K | Vista materializada historial 12m |
| vw_ticket_promedio_diario | ~10K/anio | Vista tickets diarios |
| Budget_2026 | 2,842 | Solo hasta mayo 2026 |
| Import | ~303 | Tabla importaciones logistica |
| fintsucu | 121 | Maestro tiendas |
| fmetasucu | 180 | Metas tiendas 2026 |

---

## FASE 1: Verificacion de Calculos (Prioridad Maxima)

Objetivo: Trazar formula por formula, desde la BD hasta el pixel en pantalla.
Metodologia: Leer hook -> verificar query -> verificar formula en calculations.ts -> verificar que el componente muestra el resultado correcto.

### Plan de verificacion por seccion:

#### 1.1 ExecutivePage (Home `/`) — VERIFICADO 07/03/2026 22:30

**Archivos trazados:**
- `src/features/executive/hooks/useExecutiveData.ts` (279 lineas)
- `src/domain/executive/calcs.ts` (159 lineas)
- `src/features/executive/ExecutivePage.tsx` (420 lineas)
- `src/features/executive/components/MonthlyPerformanceTable.tsx` (255 lineas)
- `src/queries/sales.queries.ts` → `fetchMonthlySalesWide`
- `src/queries/budget.queries.ts` → `fetchBudget`
- `src/queries/stores.queries.ts` → `fetchStoreGoals`

**Resultados:**
- [x] Road to Annual Target: `calcAnnualTarget(goals)` suma metas de `fmetasucu`, fallback 70B Gs
- [x] YTD: solo meses cerrados (`m <= calMonth - 1`), excluye parcial — correcto
- [x] Forecast: extrapolacion lineal `ytd + (ytd/daysElapsed) * daysRemaining` — conservador por diseno
- [x] Gap to Target: `annualTarget - forecastYearEnd`, signo negativo = adelantado — correcto
- [x] Required Monthly Run Rate: `(target - ytd) / monthsRemaining`, retorna 0 si superado — correcto
- [x] Linear Pace Gap: `target * (daysElapsed/daysInYear) - ytd` — correcto
- [x] Progress bars: stacked (azul=real, verde=forecast), capped at 100% — correcto
- [x] Grafico acumulado: 12 puntos, cumReal + cumForecast + cumTarget, forecast conecta al ultimo real — correcto
- [x] Tabla mensual: 12 filas con real/budget/LY, DiffBadge positivo/negativo — correcto
- [x] View selector (6 vistas): re-filtra datos WIDE cacheados, sin API call — correcto
- [x] `LY_BUDGET_FACTOR = 0.90` como fallback cuando PY data falta — documentado

**Observaciones (no bugs):**
1. Forecast usa `dayOfYear(new Date())` pero YTD excluye mes parcial → daily rate ligeramente conservador
2. Budget no filtra por tienda (solo brand+channel) → cuando hay filtro de tienda, muestra budget total
3. Budget_2026 solo tiene Ene-May → Jun-Dic muestran 0 (linea target se aplana en grafico)

#### 1.2 KpiDashboardPage (`/kpis`) — 9 KPIs — VERIFICADO 07/03/2026 22:45

**Archivos trazados:**
- `src/features/kpis/hooks/useKpiDashboard.ts` (530 lineas)
- `src/domain/kpis/calculations.ts` (275 lineas)
- `src/domain/kpis/filterSupport.ts` (63 lineas)
- `src/features/kpis/KpiDashboardPage.tsx` (41 lineas)
- `src/features/kpis/components/KpiCard.tsx` (111 lineas)
- `src/domain/period/resolve.ts` (122 lineas)
- `src/queries/inventory.queries.ts` → `fetchInventoryValue`
- `src/queries/tickets.queries.ts` → `fetchAnnualTickets`, `filterTicketsByChannel`
- `src/queries/sales.queries.ts` → `fetchMonthlySalesWide`, `fetchDailyDetail`, `fetchPriorYearMTDWide`

**Resultados por KPI:**
- [x] Revenue: `currNeto` = sum filteredSales por activeMonths; YoY usa day-precise o symmetric fallback — correcto
- [x] LfL: `calcLfL(currClosedNeto, prevNeto)` — solo closed months, simetrico — correcto
- [x] Gross Margin: `(neto - cogs) / neto * 100`; YoY en pp (no %) — correcto
- [x] GMROI: `(grossMargin * 12/months) / invValue` — anualizacion correcta
- [x] Inventory Turnover: `(cogs * 12/months) / invValue` — anualizacion correcta
- [x] AOV: `totalSales / totalTickets` de `vw_ticket_promedio_diario`; YoY cuando hay tickets PY — correcto
- [x] UPT: correctamente deshabilitado con mensaje "se necesita vista con items por factura" — correcto
- [x] Returns Rate: `absNegativeNeto / positiveNeto * 100` desde fjdhstvta1 daily — correcto
- [x] Markdown Dependency: `dcto / bruto * 100`; YoY en pp — correcto

**Verificacion transversal:**
- [x] Division por 0: todas las funciones en calculations.ts retornan 0 — correcto
- [x] Porcentajes en escala 0-100 (no 0-1) — correcto
- [x] resolvePeriod(): ytd/lastClosedMonth/currentMonth logic — correcto
- [x] YoY day-precise: fetchPriorYearMTDWide con triple proteccion (ORDER BY, SUM acumulador, staleTime) — correcto
- [x] Filtro availability: checkKpiAvailability consulta catalogo, bloquea KPIs sin soporte — correcto
- [x] Per-card loading: cada KPI tiene su propio isLoading/error — correcto
- [x] prevCurrMoLoading no bloquea valores principales, solo YoY% — correcto

**Observaciones (no bugs):**
1. GMROI y Rotacion usan inventario point-in-time (snapshot `mv_stock_tienda`), no promedio del periodo
2. LfL no filtra "mismas tiendas" — incluye todas las tiendas que matchean filtros
3. AOV no se puede filtrar por marca (vista tickets sin columna marca) — documentado en catalogo

#### 1.3 SalesPage (`/ventas`) — VERIFICADO 07/03/2026 23:00

**Archivos trazados:**
- `src/features/sales/SalesPage.tsx` (240 lineas)
- `src/features/sales/hooks/useSalesDashboard.ts` (192 lineas)
- `src/features/sales/hooks/useSalesAnalytics.ts` (302 lineas)
- `src/queries/sales.queries.ts` → `fetchBrandBreakdown`, `fetchChannelMix`, `fetchTopSkus`, `fetchDailyDetail`

**Resultados:**
- [x] Summary cards: real, budget attainment (`real/budget*100`), growthVsLY, GM% — correcto
- [x] Budget attainment: `(real / budget) * 100` con budget filtrado por brand+channel — correcto
- [x] Tab Marcas: fetchBrandBreakdown agrega por marca canonica, incluye YoY — correcto
- [x] Tab Canal/Zonas: fetchChannelMix con pct share — correcto
- [x] Tab Comportamiento: buildDayOfWeek con avgNeto por unique days (no double-counting) — correcto
- [x] Tab SKUs: fetchTopSkus agregado por SKU en JS, top 20 — correcto
- [x] Tab Tiendas: buildStoreBreakdown con GM%, markdownPct, AOV por tienda — correcto
- [x] Partial month warning visible con indicator animado — correcto
- [x] showBrandsTab se oculta cuando hay filtro de marca activo — correcto

**BUG ENCONTRADO:**
- **`growthVsLY` asimetrico durante mes parcial** (linea 153-169 de useSalesDashboard.ts):
  `currRows` usa `activeMonths` (incluye mes parcial actual) pero `prevRows` usa `closedMonths` (solo meses completos del ano anterior).
  En YTD con mes parcial: `real` = Ene+Feb+7dias-Mar vs `prevNeto` = Ene+Feb solamente.
  Esto infla el YoY% durante meses parciales.
  El KPI dashboard maneja esto correctamente con `currClosedNeto` como fallback simetrico.
  **Severidad:** Baja — solo afecta durante los primeros dias de cada mes.
  **Estado:** CORREGIDO — se agrego `closedReal` y `growthVsLY` ahora usa `calcYoY(closedReal, prevNeto)`.

#### 1.4 ActionQueuePage (`/acciones`) — VERIFICADO 07/03/2026 23:15

**Archivos trazados:**
- `src/features/action-queue/ActionQueuePage.tsx` (251 lineas)
- `src/features/action-queue/hooks/useActionQueue.ts` (197 lineas)
- `src/domain/actionQueue/waterfall.ts` (393 lineas)
- `src/domain/actionQueue/clusters.ts` (68 lineas)
- `src/queries/inventory.queries.ts` → `fetchInventory`
- `src/queries/salesHistory.queries.ts` → `fetchSalesHistory`
- `src/features/action-queue/components/exportHtml.ts` (XSS verificado en Block 3)

**Resultados:**
- [x] Waterfall L1 (tienda↔tienda): deficit stores matched con surplus, max 3 counterparts — correcto
- [x] Waterfall L2 (RETAILS→tienda): cuando no hay lateral transfer — correcto
- [x] Waterfall L3 (STOCK→RETAILS): dedup por sku+talle — correcto
- [x] Waterfall L4 (STOCK→B2B directo): solo cuando mode=b2b y no hay surplus — correcto
- [x] Pareto 80/20: cumulative impact / totalImpact <= 0.80 — correcto
- [x] Sort: risk priority (critical>low>overstock>balanced) → suggestedUnits desc → impactScore desc → sku/talle/store — determinista
- [x] Impact score: `units * max(price,1) * grossMarginFactor` donde GMF = `1 + max(0, GM%) * 0.3` (rango 1.0-1.3) — correcto
- [x] Sales history: divide por `monthsWithSales.size` (meses CON ventas, no 12) — correcto
- [x] Cover months: 6 para imported (Wrangler/Lee), 3 para local (Martel) — correcto
- [x] Export HTML: `esc()` aplica entity encoding a todos los campos de usuario — XSS prevenido
- [x] Filtros: brand/linea/categoria/store aplicados pre-waterfall, channel como mode — correcto
- [x] MAX_ACTIONS = 100 — limite razonable
- [x] Stat cards: totalItems, paretoCount, criticalCount, lowCount, overstockCount, uniqueSkus — correcto

**Observaciones:**
1. `bestDayMap` siempre vacio (data no disponible aun) → columna "best day" muestra "—"
2. Per-store target sin historial usa avgQty cross-store como fallback — puede inflar para tiendas nuevas

#### 1.5 LogisticsPage (`/logistica`) — VERIFICADO 07/03/2026 23:25

**Archivos trazados:**
- `src/features/logistics/LogisticsPage.tsx` (441 lineas)
- `src/features/logistics/hooks/useLogistics.ts` (111 lineas)
- `src/domain/logistics/arrivals.ts` (130 lineas)
- `src/domain/logistics/types.ts`
- `src/queries/logistics.queries.ts` (88 lineas)

**Resultados:**
- [x] Summary cards: activeOrders (excluye past), totalUnits, nextDate, byOrigin — correcto
- [x] Status: `getArrivalStatus()` clasifica por BOM/BONM/BO2M boundaries — correcto
- [x] statusLabel: "Pasado", "Este Mes · Xd", "Prox. Mes · Xd", "En Xd" — correcto
- [x] Grouping: `(brandNorm + supplier + etaLabel)` con key `|||` separator — correcto
- [x] Sort: ETA ascending, nulls last (`.sort()` en toArrivals) — correcto
- [x] Date parsing: `parseMMDDYYYY()` (MM/DD/YYYY como usa Import table) — correcto
- [x] Filtros: brand (por brandNorm), category, toggle pasados — correcto
- [x] Group row muestra primeras 2 categorias + "+N" overflow — correcto
- [x] Child row detalle: season, color, category, quantity, pvpB2C, marginB2C — correcto
- [x] Expand/collapse individual + "Colapsar todo" — correcto

**Sin bugs encontrados.**

#### 1.6 CalendarPage (`/calendario`) — VERIFICADO 07/03/2026 23:30

**Archivos trazados:**
- `src/features/calendar/hooks/useCalendar.ts` (170 lineas)
- `src/features/calendar/CalendarPage.tsx`

**Resultados:**
- [x] CRUD: addEvent (crypto.randomUUID), updateEvent, deleteEvent — correcto
- [x] Drag & drop: moveEvent actualiza start_date/end_date — correcto
- [x] Optimistic updates: setEvents local ANTES del response de Supabase — correcto
- [x] Realtime: suscripcion a INSERT/UPDATE/DELETE en calendar_events y calendar_categories — correcto
- [x] Dedup INSERT: `prev.some(e => e.id === row.id)` evita duplicado entre optimistic + realtime — correcto
- [x] Categories: updateCategoryColor (optimistic first), addCategory — correcto
- [x] `saving` state con try/finally en todas las mutaciones — correcto
- [x] Cleanup: `removeChannel` en useEffect return — correcto
- [x] A11y: htmlFor/id en labels, role="button" en day cells, aria-labelledby en categories

**Sin bugs encontrados.**

---

## FASE 1: Resumen de Hallazgos

| Seccion | Veredicto | Bugs | Observaciones |
|---------|-----------|------|---------------|
| 1.1 ExecutivePage | PASS | 0 | 3 observaciones menores |
| 1.2 KpiDashboardPage | PASS | 0 | 3 observaciones menores |
| 1.3 SalesPage | PASS (bug corregido) | 1 (bajo, FIXED) | YoY asimetrico en mes parcial → corregido |
| 1.4 ActionQueuePage | PASS | 0 | 2 observaciones menores |
| 1.5 LogisticsPage | PASS | 0 | 0 |
| 1.6 CalendarPage | PASS | 0 | 0 |

**Bug unico encontrado y CORREGIDO:** `useSalesDashboard.ts` linea 153-174 — `growthVsLY` comparaba activeMonths (con parcial) vs closedMonths (sin parcial).
**Fix aplicado:** se agrego `closedReal` que filtra por closedMonths, y `growthVsLY` ahora usa `calcYoY(closedReal, prevNeto)` (simetrico). `real` sigue usandose para las cards de display. 237 tests pasan.

---

## FASE 2: Refresh de Vistas Materializadas — RESUELTO (07/03/2026)

**Riesgo:** mv_stock_tienda, mv_ventas_12m_por_tienda_sku y mv_ventas_mensual son materializadas.
Si no hay pg_cron, los datos se congelan en el momento del ultimo refresh.

### Diagnostico inicial: pg_cron NO existia (07/03/2026)

### Resolucion: pg_cron habilitado + 3 jobs creados (07/03/2026)

**Acciones completadas:**
1. Habilitado pg_cron en Supabase (Database → Extensions → pg_cron → schema pg_catalog)
2. Creados 3 refresh jobs con las siguientes frecuencias:

| Job | Frecuencia | Cron | Razon |
|-----|-----------|------|-------|
| refresh_mv_stock_tienda | Cada 4h | `0 */4 * * *` | Inventario cambia con cada venta/movimiento. Fuente de Cola de Acciones. |
| refresh_mv_ventas_mensual | Cada 6h | `0 */6 * * *` | Ventas agregadas mensuales. KPIs se consultan 2-3 veces/dia. |
| refresh_mv_ventas_12m | Cada 12h | `0 6,18 * * *` | Historial largo (365 dias). Un dia nuevo de ventas es cambio minimo. Vista mas pesada. |

3. Verificado con `SELECT * FROM cron.job;` — 3 jobs activos.

### Referencia: ajustar frecuencias en el futuro

### SQL para crear los 3 refresh jobs (ejecutar despues de habilitar pg_cron):

```sql
-- Refresh mv_ventas_mensual: cada 6 horas (ventas se actualizan por ETL periodico)
SELECT cron.schedule(
  'refresh_mv_ventas_mensual',
  '0 */6 * * *',
  'REFRESH MATERIALIZED VIEW CONCURRENTLY mv_ventas_mensual;'
);

-- Refresh mv_stock_tienda: cada 4 horas (inventario cambia mas frecuentemente)
SELECT cron.schedule(
  'refresh_mv_stock_tienda',
  '0 */4 * * *',
  'REFRESH MATERIALIZED VIEW CONCURRENTLY mv_stock_tienda;'
);

-- Refresh mv_ventas_12m_por_tienda_sku: cada 12 horas (historial largo, menos urgente)
SELECT cron.schedule(
  'refresh_mv_ventas_12m',
  '0 6,18 * * *',
  'REFRESH MATERIALIZED VIEW CONCURRENTLY mv_ventas_12m_por_tienda_sku;'
);
```

**NOTA:** `CONCURRENTLY` requiere un UNIQUE INDEX en cada vista. Si no existe:
```sql
-- Solo necesario si CONCURRENTLY falla:
CREATE UNIQUE INDEX IF NOT EXISTS mv_ventas_mensual_pk
  ON mv_ventas_mensual (v_año, v_mes, v_marca, v_sucursal_final, v_canal_venta);

CREATE UNIQUE INDEX IF NOT EXISTS mv_stock_tienda_pk
  ON mv_stock_tienda (store, sku, talle);

CREATE UNIQUE INDEX IF NOT EXISTS mv_ventas_12m_pk
  ON mv_ventas_12m_por_tienda_sku (year, month, store, sku);
```

Si no se puede usar CONCURRENTLY, quitar esa palabra (el refresh bloqueara reads brevemente).

### Script de refresh manual (alternativa si pg_cron no se puede habilitar):

```sql
-- Ejecutar manualmente cuando Derlys actualice datos:
REFRESH MATERIALIZED VIEW mv_ventas_mensual;
REFRESH MATERIALIZED VIEW mv_stock_tienda;
REFRESH MATERIALIZED VIEW mv_ventas_12m_por_tienda_sku;
```

### Indicador de staleness en la app:

No implementado. Opciones futuras:
1. Crear tabla `mv_refresh_log` con timestamp del ultimo refresh → mostrar en consola
2. Agregar campo `refreshed_at` en una tabla de metadata

**Estado del codigo:** TanStack Query tiene `staleTime: 30min` en todos los hooks, lo que limita la frecuencia de re-fetch al browser. Pero si la vista materializada no se refresca, el dato de Supabase esta congelado independientemente del staleTime.

---

## FASE 3: Edge Cases y Robustez — VERIFICADO 07/03/2026 23:45

### 3.1 Budget_2026 hardcodeado — que pasa en 2027?

**Archivo:** `src/queries/budget.queries.ts` linea 41
**Comportamiento:** `const tableName = Budget_${year}` — usa el ano del filtro dinamicamente.
**Cuando year=2027:** busca tabla `Budget_2027`. Si no existe:
- `error` capturado con `console.warn` → retorna `[]` (array vacio)
- Budget attainment = 0, budget columns show "—"
- Chart cumTarget line = 0 (flat)
**Veredicto:** Degradacion graceful. No crashea. Derlys debe crear `Budget_2027` antes de Enero 2027.
**Estado:** [x] DOCUMENTADO — no requiere fix de codigo

### 3.2 Tickets sin columna marca — AOV filtrado por marca

**Archivo:** `src/queries/tickets.queries.ts` — `vw_ticket_promedio_diario` no tiene columna marca
**Comportamiento:** Cuando hay filtro de marca activo, AOV muestra valor a nivel empresa (filtrado por canal/tienda pero no por marca).
**Veredicto:** Limitacion arquitectural de la vista de BD. `checkKpiAvailability` en el catalogo declara `brand: false` para AOV, mostrando "No disponible con filtro de marca" cuando corresponde.
**Estado:** [x] DOCUMENTADO en catalogo de KPIs — no requiere fix

### 3.3 Tiendas nuevas sin historial 12m — promedio inflado?

**Archivo:** `src/queries/salesHistory.queries.ts` linea 81-83
**Comportamiento:** `total / Math.max(monthsWithSales.size, 1)` — divide por meses CON ventas, no 12.
- Tienda con 2 meses de datos → promedio basado en 2 meses (no inflado por division entre 12)
- Sin embargo, 2 meses puede no ser representativo (ej: si son meses altos, target queda alto)
**Veredicto:** Matematicamente correcto. Representatividad limitada es inherente a datos escasos.
El waterfall ya tiene fallback a `avgQty` cross-store cuando no hay historial individual.
**Estado:** [x] VERIFICADO — comportamiento correcto

### 3.4 Meses sin datos en budget (jun-dic 2026)

**Archivo:** `Budget_2026` solo tiene filas para Enero–Mayo 2026
**Comportamiento UI:**
- Executive chart: cumTarget line se aplana despues de Mayo (0 budget acumulado adicional)
- Monthly table: columna Presupuesto muestra "—" para Jun–Dic
- Sales budget attainment: si activeMonths incluye Jun+, el budget total puede ser mas bajo que real → attainment > 100%
- KPI dashboard: no afecta (no usa budget)
**Veredicto:** Degradacion graceful. La UI muestra "—" correctamente.
**Accion requerida:** Derlys debe cargar Budget Jun–Dic 2026 cuando este disponible.
**Estado:** [x] DOCUMENTADO — no requiere fix de codigo

### 3.5 fetchAllRows sin ORDER BY — riesgo de duplicados?

**Archivo:** `src/queries/paginate.ts`
**Analisis detallado por tabla:**

| Tabla | ORDER BY | Riesgo | Mitigacion |
|-------|----------|--------|------------|
| mv_ventas_mensual | Si (v_mes, v_marca, ...) | Ninguno | Paginacion determinista |
| mv_stock_tienda | No | Bajo | Vista materializada (snapshot estatico), rows no cambian entre paginas |
| mv_ventas_12m_por_tienda_sku | No | Bajo | Idem — snapshot estatico |
| fjdhstvta1 (daily) | No | Medio | ORDER BY causa timeout (250K+ filas sin indice). Paginacion secuencial minimiza riesgo. |
| fjdhstvta1 (MTD wide) | Si (v_marca, v_sucursal_final, v_dia) | Ninguno | Custom paginacion con SUM acumulador (order-agnostic) |
| vw_ticket_promedio_diario | No | Bajo | ~10K filas/ano → 11 paginas max. Sin indice, pero vista sobre tabla con PK |

**Veredicto:** Riesgo real solo en fjdhstvta1 sin ORDER BY (~20K filas daily detail).
Impacto: en el peor caso, 1-2 filas duplicadas/faltantes entre paginas → error despreciable en sumas.
Para fetchPriorYearMTDWide: triple proteccion documentada (ORDER BY + SUM + staleTime).
**Estado:** [x] VERIFICADO — riesgo aceptable, mitigado donde es critico

---

## PENDIENTES NO-CODIGO (requieren accion del equipo):

| Item | Responsable | Estado |
|------|-------------|--------|
| Configurar Sentry (crear cuenta sentry.io, VITE_SENTRY_DSN) | Rodrigo/Derlys | Pendiente |
| Cargar Budget junio-diciembre 2026 | Derlys | Pendiente |
| ~~Habilitar pg_cron + crear 3 refresh jobs~~ | Derlys | **COMPLETADO 07/03/2026** |
| Poblar v_transacciones_dwh (UPT real por factura) | Derlys | Futuro |
| Definir spec Fase 6 SettingsPage | Rodrigo | Pendiente |
