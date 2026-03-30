# NewFenixBrands — Contexto para el Agente

## Mision del proyecto

Reconstruccion completa de FenixBrands (plataforma analytics para empresa de indumentaria paraguaya: marcas Martel, Wrangler, Lee). El proyecto viejo tenia logica de negocio duplicada, queries mezcladas con UI y 0 tests. Este proyecto reconstruye todo con arquitectura limpia.

**Stack:** React 19 + TypeScript + Vite + Tailwind CSS v4 + TanStack Query v5 + Supabase + React Router v7

**Proyecto viejo (SOLO como referencia de UI y logica de negocio):** `/Users/prueba/Downloads/FenixBrands`
→ Ver `docs/OLD_PROJECT_REFERENCE.md` antes de mirar el viejo.

---

## Estado actual (actualizado 30/03/2026)

| Fase | Feature | Estado |
|------|---------|--------|
| Infra | Rutas, layout, auth, contextos, queries, domain logic | ✅ COMPLETO |
| 0 | SignInPage + ChangePasswordPage (primer login) | ✅ COMPLETO |
| 1 | KpiDashboardPage (`/kpis`) — 9 core + 50 catálogo + sparklines + UPT activado | ✅ COMPLETO |
| 1B | ExecutivePage (`/`) — Road to Annual Target, chart acumulado, tabla mensual | ✅ COMPLETO |
| 2 | SalesPage (`/ventas`) — Metricas, 4 tabs analytics, YoY tiendas, Top/Bottom SKUs | ✅ COMPLETO |
| 3 | ActionQueuePage (`/acciones`) — Waterfall 4 niveles + Ideal/Gap/DOI + 2 pestañas (Acciones + Planificación de Compra) | ✅ COMPLETO + AUDITADO |
| 4 | LogisticsPage (`/logistica`) — ETAs importacion, tabla agrupada | ✅ COMPLETO + AUDITADO |
| 5 | CalendarPage (`/calendario`) — FullCalendar + CRUD + Realtime + Llegadas logística | ✅ COMPLETO + AUDITADO |
| 6 | UsersPage (`/usuarios`) — CRUD completo, Edge Function, cambio contraseña | ✅ COMPLETO + AUDITADO |
| 6B | DepotsPage (`/depositos`) — Filtros estandarizados in-page + Novedades/Lanzamientos | ✅ COMPLETO + AUDITADO |
| 7 | CommissionsPage (`/comisiones`) — Comisiones por vendedor, datos reales, 8 escalas | ⚠️ PARCIAL — esperando datos de Fenix |

**La app corre:** `npm run dev` → http://localhost:5173
**Tests:** 967 passing (24 suites) | TSC 0 errores | Build OK
**Deploy:** https://fenix-brands-one.vercel.app
**Sesión 14/03/2026 (00:00–04:00):** Ver log detallado abajo
**Sesión 14/03/2026 (04:00–14:00):** Ver log detallado abajo
**Sesión 24/03/2026:** Ver log detallado abajo
**Sesión 30/03/2026:** Ver log detallado abajo

---

## Proximo trabajo

**Comisiones — Retail FUNCIONAL, Mayorista/UTP esperando datos de Fenix:**
- Retail: 33 vendedores con comisiones reales calculadas (cumplimiento por tienda)
- Mayorista/UTP: ventas reales conectadas pero meta individual "Pendiente" (necesita `comisiones_metas_vendedor`)
- Cobranza Mayorista/UTP: pendiente (`c_cobrar` vacia)
- Roles supervisor/gerencia/backoffice: pendiente mapeo explicito
- SQL y spec completa en `docs/COMISIONES_DATA_SPEC.md`
- Datos de cobranza en `c_cobrar` (para comision Mayorista/UTP)
- Ver preguntas pendientes en `docs/COMISIONES_DATA_SPEC.md`

**Deuda SettingsPage:** Posible contenido restante:
- Perfil de usuario (nombre, foto, cambiar contraseña)
- Preferencias de app (tema claro/oscuro)
- Configuracion de alertas/notificaciones
- **Requiere definicion de Rodrigo/Derlys antes de implementar**

---

## Reglas de arquitectura (NO negociar)

1. **Queries** en `src/queries/` → solo fetch + normalizacion, sin logica de negocio
2. **Calculos** en `src/domain/kpis/calculations.ts` → funciones puras, ya existentes
3. **Hooks** en `src/features/[feature]/hooks/` → unen queries + domain logic
4. **Componentes** en `src/features/[feature]/components/` → solo UI, sin logica
5. **Filtros globales** via `useFilters()` → nunca estado local de filtros en paginas
6. **Periodos** via `resolvePeriod()` → nunca calcular meses manualmente
7. **Porcentajes** siempre en escala 0-100 (no 0-1)
8. **Division por 0** → siempre retorna 0 (ya manejado en calculations.ts)

---

## Archivos criticos a conocer

```
src/
  api/normalize.ts              — Frontera ERP→app (parsers, normalizeBrand, classifyStore)
  api/client.ts                 — dataClient (BD operacional) + authClient (auth)
  domain/filters/types.ts       — AppFilters, PeriodFilter, BrandFilter, ChannelFilter
  domain/kpis/calculations.ts   — TODAS las formulas KPI puras (12 funciones)
  domain/period/resolve.ts      — resolvePeriod() — fuente de verdad de periodos
  domain/actionQueue/waterfall.ts — Algoritmo waterfall puro (4 niveles) + idealUnits/gapUnits/DOI
  domain/actionQueue/clusters.ts  — Clusters de tiendas (A/B/OUT) + restricciones horarias
  domain/actionQueue/grouping.ts  — Agrupacion pura por tienda/marca + totalGapUnits/avgDOI
  domain/actionQueue/purchasePlanning.ts — buildPurchasePlan (SKU-level gap), summarizeByBrand, computeGapTotals
  features/action-queue/components/ActionsTab.tsx — Pestaña "Acciones" (controles, stats, grupos)
  features/action-queue/components/PurchasePlanningTab.tsx — Pestaña "Planificación de Compra" (stats, filtros marca/tipo, tabla SKU)
  domain/logistics/types.ts      — Tipos logística (ArrivalStatus, LogisticsGroup, etc.)
  domain/logistics/arrivals.ts   — Funciones puras: toArrivals, groupArrivals, computeSummary
  domain/logistics/calendar.ts   — Funciones puras: groupsToCalendarItems, arrivalsByDay (proyeccion logistica→calendario)
  context/FilterContext.tsx     — useFilters() — estado global de filtros
  queries/sales.queries.ts      — fetchMonthlySales, fetchDailyDetail, fetchBrandBreakdown, fetchTopSkus (con weightPct)...
  queries/inventory.queries.ts  — fetchInventory, fetchInventoryValue
  queries/salesHistory.queries.ts — fetchSalesHistory (6m promedio por tienda+SKU)
  queries/tickets.queries.ts    — fetchTickets (AOV diario)
  queries/logistics.queries.ts  — fetchLogisticsImports (tabla Import, ETAs)
  queries/budget.queries.ts     — fetchBudget
  queries/keys.ts               — Query key factories para TanStack Query
  queries/users.queries.ts      — fetchAllProfiles, updateProfile, createUser, deleteUser
  features/calendar/hooks/useCalendarArrivals.ts — Hook: logística→calendario (read-only)
  features/users/               — UsersPage CRUD + hooks + modals
  features/auth/ChangePasswordPage.tsx — Cambio de contraseña obligatorio (primer login)
  supabase/functions/manage-user/index.ts — Edge Function (create/delete users con service_role)
```

---

## Docs detallados

- `docs/ARCHITECTURE.md` — Arquitectura completa, convenciones, patrones
- `docs/NEXT_FEATURES.md` — Spec de features (fases 1-4 completadas, ver estado arriba)
- `docs/OLD_PROJECT_REFERENCE.md` — Como y cuando usar el proyecto viejo como referencia
- `docs/AUDIT_WATERFALL_CORE_2026-03-08.md` — Auditoria end-to-end del algoritmo SISO/waterfall (8 bugs corregidos, flujo de datos completo, campos usados/no usados, preguntas pendientes cliente)
- `docs/AUDIT_INTEGRAL_2026-03-11.md` — Auditoria integral completa (428 tests, 16 hallazgos, score 8.5/10)
- `docs/PREGUNTAS_CLIENTE_COLA_ACCIONES.md` — 5+3 preguntas pendientes para Rodrigo/Derlys

---

## Sesión 12/03/2026 01:25 — Transparent Loading UX (ActionQueuePage)

**Objetivo:** Transformar la latencia de carga de la Cola de Acciones en parte de la UX en vez de ocultarla con un skeleton genérico.

**Patrón:** Process Transparency — Live Activity Feed, Ambient Motion, Staggered Reveal, Progress Theater.

### Archivos creados/modificados

| Archivo | Cambio |
|---------|--------|
| `src/features/action-queue/hooks/useActionQueue.ts` | Agregado `LoadingPhase`, `LoadingProgress` types y `loadingProgress` computed property con fases granulares: `fetching-inventory` → `processing-records` → `fetching-history` → `computing-waterfall` → `done` |
| `src/features/action-queue/components/ActionQueueLoader.tsx` | **NUEVO.** Componente de carga transparente: icono spinning + título "Definiendo Acciones", 4 phase step cards con indicadores (done/active/pending), activity log con mensajes contextuales drip-fed, 2 counter pills (Registros, SKUs), 5 floating cards ambient con colores de marca |
| `src/index.css` | 6 keyframes CSS: `aq-float`, `aq-fade-in`, `aq-slide-in`, `aq-ping`, `aq-pulse`, `aq-spin-slow` |
| `src/features/action-queue/ActionQueuePage.tsx` | Reemplazado `<PageSkeleton />` por `<ActionQueueLoader progress={loadingProgress} />` |

### Ajustes de refinamiento
- Icono spinner movido a la izquierda del título (inline flex)
- Activity log limitado a ~3 bullets visibles con `max-h-[92px]` + `overflow-y-auto`
- Phase step cards sin `maxHeight` fijo (no se rompen al pasar a verde/check)
- Floating cards redistribuidas a esquinas del viewport (sin superposición con contenido central)
- Composición centrada verticalmente con `h-[calc(100vh-4rem)]` + `pb-[12vh]` para centro óptico
- Eliminada pill "Acciones" (nunca muestra cifra durante loading)
- Título cambiado a "Definiendo Acciones"

**Verificación:** TSC 0 errores | Build OK | ESLint 0 errors | 480 tests passing

---

## Sesión 14/03/2026 00:00–04:00 — Gestión de Usuarios + Calendario + KPIs + UI

### 1. UsersPage — CRUD completo (00:00–01:30)

**Creado:**
- `src/features/users/UsersPage.tsx` — Tabla de usuarios con filtros, badges, editar/eliminar
- `src/features/users/components/UserEditModal.tsx` — Edición de perfil (rol, canal, cargo, estado)
- `src/features/users/components/UserCreateModal.tsx` — Crear usuario (email, nombre, rol, canal)
- `src/features/users/components/UserDeleteDialog.tsx` — Confirmación de eliminación
- `src/features/users/hooks/useUsers.ts` — Hook TanStack Query con mutations create/update/delete
- `src/domain/users/validation.ts` — validateEmail, validateCreateUser, validatePassword, canDeleteUser
- `src/queries/users.queries.ts` — fetchAllProfiles, updateProfile, createUser, deleteUser (Edge Function)
- `src/features/auth/ChangePasswordPage.tsx` — Cambio de contraseña obligatorio (primer login)
- `supabase/functions/manage-user/index.ts` — Edge Function (create con fenix123 + delete)
- `sql/005_must_change_password.sql` — Columna + funciones RPC SECURITY DEFINER

**RLS resuelto:**
- Policy recursiva causaba error 500 → fix con `get_my_role()` SECURITY DEFINER
- Policies para UPDATE/INSERT de profiles
- Funciones `clear_must_change_password()` / `set_must_change_password()` para primer login
- Secret `SB_SERVICE_ROLE_KEY` en Edge Functions (no `SUPABASE_*` que CLI rechaza)

**Modificado:** App.tsx (rutas), AppSidebar.tsx (sección Control), AppHeader.tsx (ocultar filtros en /usuarios), domain/auth/types.ts (mustChangePassword), profile.queries.ts

### 2. Calendario — Auditoría + Mejoras (01:30–02:30)

**RLS:** `sql/006_calendar_rls.sql` — 8 policies para calendar_events + calendar_categories (shared, todos los autenticados)

**Nuevos campos:** `sql/007_calendar_description_budget.sql`
- `description TEXT` — contexto del evento
- `budget NUMERIC` — presupuesto trazable con índice
- `currency TEXT` (PYG/USD) — preparado multi-moneda

**Refactorizado:**
- Modal inline del CalendarPage (150 líneas) extraído a `EventFormModal.tsx`
- Categoría ahora es select dropdown (no radio buttons)
- Presupuesto con símbolo ₲/$ inline + pill PYG/USD
- Fechas lado a lado (grid 2 cols)

**Hook mejorado:**
- `validateDateRange()`, `parseBudgetInput()`, `validateEventForm()` — funciones puras
- Budget max validation (100B)
- Empty slug protection en addCategory
- Stale closure fix en updateCategoryColor (functional updater, deps [])
- Rollback en update/delete/move con try/catch
- `categoryHasEvents()` para proteger eliminación
- Concurrent edit protection (exists check antes de update)
- Category dedup (23505 duplicate key handling)

### 3. KPIs — UPT activado + Catálogo completo (02:30–03:45)

**UPT activado:**
- Datos de `v_transacciones_dwh` (nueva tabla, 12K+ filas 2026) verificados vs `vw_ticket_promedio_diario`
- Unidades de `mv_ventas_mensual` (columna `unidades` agregada a la vista materializada)
- YoY funcional (prior year data disponible)
- Format `ratio` (2 decimales) en vez de `number` (redondeaba a 0 decimales)
- Nota de aproximación removida (bloqueaba render del valor)

**Vista materializada actualizada:**
```sql
ALTER → mv_ventas_mensual ahora incluye SUM(v_cantvend) AS unidades
```

**Catálogo de 50 KPIs visible:**
- `src/domain/kpis/categories.ts` — 9 categorías con metadata, helpers getPstLabel/getPstBadgeClass
- Dashboard muestra stats + 9 core cards + 9 secciones con preview 4 KPIs + "Ver todos"
- Cards bloqueadas con opacity-50 + grayscale + lock icon overlay (estilo FenixBrands)
- Badge "Fase 2" (púrpura) para los 8 KPIs `next`
- `KpiCategoryPage.tsx` — Vista por categoría con filtro PST, breadcrumb, stats bar

**Sparklines SVG:**
- Reutiliza `MiniSparkline` de sales (SVG puro, Catmull-Rom)
- 6 KPIs con sparkline: Revenue, GM%, AOV, UPT, Markdown, (LfL si hay meses)
- Color dinámico: verde (YoY positivo), rojo (negativo), brand blue (sin YoY)

### 4. UI/UX estandarización (03:45–04:00)

**Sidebar:**
- KPIs movido de "Comercial" a "Análisis"
- Icono barco (ship.svg) para Logística
- Icono warehouse (warehouse.svg) para Depósitos

**Filtros estandarizados:**
- Header: solo marca en páginas con filtros in-page
- In-page: canal + período (ExecutiveFilters) — ahora en: Inicio, Ventas, Acciones, Logística, KPIs, Depósitos
- Calendario y Usuarios: sin filtros en header

**KPI cards rediseñadas:**
- Title uppercase tracking-wide
- Valor + sparkline lado a lado
- YoY badge en footer (no junto al valor — evita line breaks)
- Grid 3 columnas (más espacio para cifras largas)
- whitespace-nowrap en valores

**Console.warn removidos** de profile.queries.ts (producción limpia)
**Password hardcoded** → env var `DEFAULT_USER_PASSWORD` en Edge Function

### Tests: 762 passing (19 suites)

| Suite | Tests |
|-------|-------|
| domain/auth | 43 |
| domain/kpis/calculations | 45 |
| domain/kpis/fenix.contract | 101 |
| domain/kpis/filterSupport | 15 |
| domain/period | 19 |
| domain/executive | 38 |
| domain/actionQueue/waterfall | 116 |
| domain/actionQueue/grouping | 35 |
| domain/logistics | 23 |
| domain/depots | 23 |
| domain/search/engine | 21 |
| domain/search/catalog | 16 |
| domain/users/validation | 47 |
| api/normalize | 42 |
| queries/profile | 17 |
| queries/users | 12 |
| queries/paginate | 9 |
| features/users | 34 |
| features/calendar | 96 |

**Verificación final:** 762 tests | TSC 0 errores | Build OK

---

## Sesión 14/03/2026 04:00–14:00 — Logística↔Calendario + UI Inicio + YoY Tiendas + Top/Bottom SKUs

### 1. Llegadas de Logística en Calendario (04:00–06:00)

**Objetivo:** Conectar logística con calendario. Las ETAs de importación se visualizan como indicadores read-only en el calendario (no son eventos editables).

**Arquitectura:**
```
Import table → fetchLogisticsImports (reutiliza query existente, TanStack Query deduplica)
  → toArrivals() → groupArrivals() (reutiliza domain existente)
  → groupsToCalendarItems() (NUEVA función pura)
  → useCalendarArrivals() (NUEVO hook)
  → CalendarPage integra: toggle + render diferenciado + year view indicators + click → popover
```

**Archivos creados:**

| Archivo | Propósito |
|---------|-----------|
| `src/domain/logistics/calendar.ts` | Funciones puras: `groupsToCalendarItems`, `arrivalsByDay`, `getBrandColor`, `getStatusColor` |
| `src/domain/logistics/__tests__/calendar.test.ts` | 26 tests: transform, colores, aggregation, edge cases |
| `src/features/calendar/hooks/useCalendarArrivals.ts` | Hook: reutiliza query logística + transform → FullCalendar events (0 queries nuevas) |
| `src/features/calendar/components/ArrivalDetailPopover.tsx` | Modal read-only con datos de llegada + "Ver en Logística" → navigate("/logistica") |
| `src/features/calendar/__tests__/calendarArrivals.test.ts` | 17 tests: pipeline completo, integración, toggle, colores, edge cases |

**Archivos modificados:**

| Archivo | Cambio |
|---------|--------|
| `src/features/calendar/CalendarPage.tsx` | Integración completa: toggle "Llegadas" con icono barco SVG + conteo + legend por marca. FullCalendar merge events+arrivals (arrivals: editable=false, display diferenciado con brand color + status border-left). Year view: barras de colores por marca en mini-months. Click en llegada → ArrivalDetailPopover. Arrivals no arrastrables/redimensionables. Import `EventResizeDoneArg` tipado correctamente. |

**Principios de diseño:**
- Llegadas NO son eventos del calendario (no CRUD, no arrastrar, no redimensionar)
- Visual diferenciado: barra con icono barco + color de marca + borde de status
- Datos vienen de la misma query que `/logistica` (TanStack Query deduplica, 0 cost)
- Toggle de visibilidad con conteo y legend por marca
- Click abre popover read-only con detalle + link a logística

**Deploy:** `vercel --prod` → https://fenix-brands-one.vercel.app (build OK)

### 2. Fix errores TS pre-existentes (06:00–06:30)

5 errores de `tsc -b` (incluye tests) que existían antes de esta sesión:

| Archivo | Error | Fix |
|---------|-------|-----|
| `features/calendar/__tests__/useCalendar.test.ts` | TS2352 cast DbEvent→Record | `as unknown as Record` |
| `features/kpis/components/KpiCard.tsx` | TS6133 `getYoyIcon` no usada | Eliminada |
| `features/users/__tests__/useUsers.test.ts` | TS2367 comparación imposible | Tipo explícito `string` |
| `features/users/__tests__/useUsers.test.ts` | TS2367 role !== "negocio" | Cast `as string` |
| `queries/__tests__/profile.queries.test.ts` | TS2556 spread args | Tipado `_table: string` en mockFrom |

### 3. Ajustes UI — Página de Inicio (06:30–08:00)

**Card Meta Anual/Mensual — Fix de altura:**
- **Problema:** Card más alta que los bloques izquierdos (Ventas Netas + vs 2025 + Gráfico)
- **Causa:** Gauge height=400 + mt-30 (120px) + mt-28 (112px) = ~730px vs ~470px izquierda
- **Fix:** Gauge height 400→240, margins eliminados, layout flex: título (top) → gauge centrado (flex-1) → footer (mt-auto)
- Badge "Faltan ₲X" / "Meta superada" movido a esquina superior derecha del título
- Variable `remaining` muerta eliminada, `channelInsights` no usado eliminado

**InsightBar — Simplificación:**
- Eliminado efecto de transición (fade in/out, setInterval, rotación)
- Eliminada barra de canales (`altInsights`)
- Solo queda barra de marcas fija, sin animación
- Interface limpiada: eliminados `altInsights`, estilos B2C/B2B muertos, `ROTATE_INTERVAL`

### 4. YoY por Tienda y Zona Mayorista en Ventas (08:00–10:00)

**Objetivo:** "Ver el % año contra año (de las ventas solamente) en las tarjetas por tienda y zonas."

**Implementación:**

| Archivo | Cambio |
|---------|--------|
| `src/features/sales/hooks/useSalesAnalytics.ts` | `StoreBreakdownRow` + `prevNeto?: number` y `yoyPct?: number`. `buildStoreBreakdown` recibe PY rows y calcula YoY por tienda con `calcYoY()`. 0 queries nuevas (datos PY ya cacheados via `salesPYQ`). |
| `src/features/sales/components/StoresTable.tsx` | Badge YoY como primer badge en cards B2B y B2C: `▲ +12.5% vs 2025` verde o `▼ -3.2% vs 2025` rojo. Año dinámico via `useFilters().year - 1`. Solo visible si hay datos del año anterior. |
| `src/features/sales/components/StoreDetailView.tsx` | Nueva card "vs {priorYear}" en grid KPIs (6 cols). Background verde/rojo contextual. Fallback `—` si no hay datos PY. Año dinámico via `useFilters()`. |

**Lógica YoY:**
- Mismo período (mismos `activeMonths`), mismos filtros (marca, canal)
- Agrupado por tienda (cosujd)
- `calcYoY(netoActual, netoPY)` — fórmula existente en `calculations.ts`
- Tienda nueva (sin datos PY) → `yoyPct = undefined`, badge no se muestra
- Año dinámico: `filters.year - 1` (resiliente a cambios de año)

### 5. Top/Bottom SKUs + Peso % (10:00–12:00)

**Objetivo:** "En Top SKUs faltó el peso % del SKU en la venta y el filtro por Top Seller y Bottom Sellers."

| Archivo | Cambio |
|---------|--------|
| `src/queries/sales.queries.ts` | `TopSkuRow` + campo `weightPct: number` (0-100). `fetchTopSkus` calcula peso de cada SKU sobre total de ventas del universo. `limit=0` retorna todos (necesario para bottom). |
| `src/features/sales/components/SkusCard.tsx` | Toggle **Top / Bottom** (pill switch en esquina superior derecha). Top: 20 mejores, Bottom: 20 peores (invertidos). Badge rank rojo para bottom. Nuevo dato `X.X% del total` en brand-500 debajo de unidades. |

### 6. Auditoría + Pulido final (12:00–14:00)

Auditoría completa de todos los cambios de la sesión. Hallazgos corregidos:

| Hallazgo | Severidad | Fix |
|----------|-----------|-----|
| Variable `remaining` no usada en ExecutivePage IIFE | Media | Eliminada |
| `channelInsights` destructurado pero no usado | Media | Eliminado del destructuring |
| `InsightBarProps.altInsights` tipo muerto + `Omit` innecesario | Baja | Interface simplificada |
| `handleEventResize` con tipo duck-typed | Media | Import `EventResizeDoneArg` de `@fullcalendar/interaction` |
| Estilos B2C/B2B muertos en InsightBar `LABEL_STYLES` | Baja | Eliminados |

### Tests: 848 passing (22 suites)

| Suite | Tests |
|-------|-------|
| domain/auth | 43 |
| domain/kpis/calculations | 45 |
| domain/kpis/fenix.contract | 101 |
| domain/kpis/filterSupport | 15 |
| domain/period | 19 |
| domain/executive | 38 |
| domain/actionQueue/waterfall | 116 |
| domain/actionQueue/grouping | 35 |
| domain/logistics/arrivals | 38 |
| domain/logistics/calendar | 26 |
| domain/depots | 23 |
| domain/search/engine | 21 |
| domain/search/catalog | 16 |
| domain/help/guide | 28 |
| domain/users/validation | 47 |
| api/normalize | 42 |
| queries/profile | 17 |
| queries/users | 17 |
| queries/paginate | 9 |
| features/users | 34 |
| features/calendar/useCalendar | 101 |
| features/calendar/calendarArrivals | 17 |

**Verificación final:** 848 tests | 22 suites | TSC 0 errores | TSC -b 0 errores | Build OK

---

## Sesión 24/03/2026 — Reposición Sugerida vs Ideal + Planificación de Compra

### Origen

Reunión Torre de Control 23/03/2026. Rodrigo: "la planificación de nuevo producto a nivel: SKU, Tipo de Producto, Marca".

### 1. Métricas idealUnits / gapUnits / daysOfInventory en waterfall

**3 campos nuevos en ActionItem (types.ts):**
- `idealUnits` — unidades que la tienda necesita para llegar al target (sin restricción de disponibilidad)
- `gapUnits` — idealUnits − suggestedUnits = demanda insatisfecha = señal de compra
- `daysOfInventory` — (currentStock / historicalAvg) × 30

**waterfall.ts:** `makeItem` recibe `idealUnitsParam`, calcula DOI y gap. Cada nivel pasa el valor correcto:
- N1 (transfer): `idealUnits = deficit.need`
- N2 cascade: `idealUnits = toFill` (remainder post-N1)
- N2 directo: `idealUnits = deficit.need`
- N3 (central→depot): `idealUnits = unmetDeficit`
- N4 (B2B): `idealUnits = deficit.need`
- Surplus/liquidación: `idealUnits = 0` (default)

**grouping.ts:** `ActionGroup` y `ActionSection` tienen `totalGapUnits` y `avgDOI` (weighted by historicalAvg).

### 2. Función pura purchasePlanning.ts

- `buildPurchasePlan(items)` — deduplica por (store, sku, talle) tomando max gap, agrupa por (sku, talle), retorna `PurchaseGapRow[]` con brand/linea/categoria para filtrar en UI
- `summarizeByBrand(rows)` — totales por marca
- `computeGapTotals(rows)` — totales globales

### 3. Reestructuración UX: 2 pestañas

**ActionQueuePage.tsx** → shell con loading/error + tab bar + channel B2C/B2B compartido

**Pestaña "Acciones" (ActionsTab.tsx):**
- Stats: Total Acciones, SKUs Únicos, Pareto 80%, Sin Stock, Stock Bajo, Sobrestock (6 cards)
- Controles: Pareto toggle, vista Tienda/Marca
- Grupos con secciones operativas
- Cada fila de acción: +3 columnas (Ideal, Gap, DOI)
- Pill rojo "gap" en header de cada grupo

**Pestaña "Planificación de Compra" (PurchasePlanningTab.tsx):**
- Stats propios: Gap Total, SKUs con Gap, DOI Promedio, Impacto Potencial (4 cards)
- Summary pills por marca con gap + Gs.
- Filtros: Marca y Tipo de Producto (segmented controls)
- Tabla SKU-level: producto, talle, marca, tipo, gap, ideal, sugerido, tiendas, impacto
- Paginación + totales footer

**Tab bar con badges:** total acciones + gap units (rojo si > 0)

### 4. Export HTML actualizado

- +3 columnas: Ideal, Gap, DOI
- +1 stat: Gap Total en header

### 5. Auditoría post-implementación

3 hallazgos corregidos:
- DOI variant mostraba amarillo cuando avgDOI=0 → agregado `avgDOI === 0 ? "neutral"`
- Guard de cost inconsistente en aggregateGaps → match con línea 75
- Tests edge cases faltantes → +4 tests (suggestedUnits=0, dedup idéntico, linea/categoria vacíos)

### Archivos creados

| Archivo | Propósito |
|---------|-----------|
| `src/domain/actionQueue/purchasePlanning.ts` | Función pura: buildPurchasePlan, summarizeByBrand, computeGapTotals |
| `src/domain/actionQueue/__tests__/purchasePlanning.test.ts` | 15 tests |
| `src/features/action-queue/components/ActionsTab.tsx` | Pestaña "Acciones" |
| `src/features/action-queue/components/PurchasePlanningTab.tsx` | Pestaña "Planificación de Compra" |

### Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `src/domain/actionQueue/types.ts` | +3 campos: idealUnits, gapUnits, daysOfInventory |
| `src/domain/actionQueue/waterfall.ts` | makeItem + idealUnitsParam, DOI, gap en cada nivel |
| `src/domain/actionQueue/grouping.ts` | +totalGapUnits, +avgDOI en ActionGroup/ActionSection |
| `src/features/action-queue/ActionQueuePage.tsx` | Refactorizado a shell con tabs |
| `src/features/action-queue/hooks/useActionQueue.ts` | +totalGapUnits, +avgDOI |
| `src/features/action-queue/components/CompactActionList.tsx` | +3 columnas (Ideal, Gap, DOI) |
| `src/features/action-queue/components/ActionGroupCard.tsx` | +pill gap en header |
| `src/features/action-queue/components/exportHtml.ts` | +3 columnas, +stat Gap Total |
| `src/domain/actionQueue/__tests__/waterfall.test.ts` | +8 tests (idealUnits, gap, DOI) |
| `src/domain/actionQueue/__tests__/grouping.test.ts` | Helper actualizado con nuevos campos |

### Verificación final

907 tests | 23 suites | TSC 0 errores | Build OK

### Deploy

- **PR #9:** https://github.com/calcarazgre646/NewFenixBrands/pull/9 (merged)
- **Vercel:** https://fenix-brands-one.vercel.app (production)

---

## Sesión 30/03/2026 — Novedades en Depósito + Comisiones de Vendedores

### 1. DepotsPage — Novedades / Lanzamientos (PR #10)

**Objetivo:** El equipo comercial necesita ver qué productos nuevos (Wrangler, Lee) llegaron a depósito y en qué estado de distribución están.

**Auditoría BD:**
- `est_comercial = "lanzamiento"` en `mv_stock_tienda`: 8,151 filas, ~230 SKUs únicos
- Marcas: Wrangler, Lee, Martel — exactamente las del pedido
- Distribución derivable: cruzando presencia del SKU en STOCK/RETAILS vs tiendas dependientes

**Implementación:**

| Archivo | Propósito |
|---------|-----------|
| `domain/depots/types.ts` | +NoveltyDistributionStatus, NoveltySkuSummary, NoveltyData, isNovelty en DepotSkuRow |
| `domain/depots/calculations.ts` | +classifyNoveltyDistribution, buildNoveltyData, isDependentStore exportado |
| `domain/depots/__tests__/calculations.test.ts` | +18 tests (clasificación, distribución, edge cases) |
| `features/depots/components/NoveltyBadge.tsx` | Pill violeta "Nuevo" |
| `features/depots/components/DistributionStatusPill.tsx` | 3 estados: gris/ámbar/verde |
| `features/depots/components/NoveltySection.tsx` | Sección completa: barra distribución + tabla paginada |
| `features/depots/DepotsPage.tsx` | +sección NoveltySection |
| `features/depots/components/DepotKpiCards.tsx` | +6ta card "Novedades" (grid 5→6) |
| `features/depots/components/StoreAccordion.tsx` | +NoveltyBadge en filas SKU |
| `features/depots/components/SkuLeadersTable.tsx` | +NoveltyBadge en filas SKU |

**Lógica:**
- Producto nuevo = `est_comercial === "lanzamiento"` (flag del ERP, 0 migraciones)
- En depósito: solo en STOCK/RETAILS, 0 tiendas dependientes
- En distribución: en < 80% de tiendas dependientes
- Cargado: en >= 80% de tiendas (threshold configurable: NOVELTY_COVERAGE_THRESHOLD)

**UI adicional:** Nombre de producto arriba, código SKU abajo en las 3 tablas de Depósitos.

### 2. CommissionsPage — Comisiones de Vendedores

**Objetivo:** Automatizar cálculo de comisiones para 3 canales (Mayorista, UTP, Retail) con 8 roles y escalas escalonadas.

**Auditoría BD:**
- `fjdhstvta1.v_vended` + `v_dsvende`: vendedor por transacción (33 retail + 4 mayorista + 1 UTP activos)
- `fmetasucu`: metas por tienda/mes (15 tiendas × 12 meses)
- `Budget_2026`: 2,842 filas con Revenue targets + Sales Comisions precalculadas
- `c_cobrar`: existe con 15 columnas pero 0 filas
- `maestro_clientes_mayoristas`: 444 clientes mapeados a 5 vendedores + UNIFORMES

**2 lógicas de cálculo separadas:**

| | Retail | Mayorista/UTP |
|---|---|---|
| Cumplimiento | Venta total TIENDA / meta TIENDA | Venta VENDEDOR / meta VENDEDOR |
| Meta viene de | `fmetasucu` (funciona) | `comisiones_metas_vendedor` (pendiente) |
| Cobranza | No aplica | `c_cobrar` (pendiente, vacía) |
| Estado | **FUNCIONAL con datos reales** | **Ventas reales + "Pendiente" en meta** |

**Implementación:**

| Archivo | Propósito |
|---------|-----------|
| `domain/commissions/types.ts` | 8 roles, 3 canales, SellerGoal, CommissionResult, CommissionSummary |
| `domain/commissions/scales.ts` | 8 escalas verificadas contra specs de Rodrigo |
| `domain/commissions/calculations.ts` | Motor de cálculo puro: cumplimiento, tramos, % y fijo |
| `domain/commissions/storeMapping.ts` | classifyStoreForCommission, storeGoalToSellerGoal |
| `domain/commissions/__tests__/calculations.test.ts` | 41 tests: 8 roles, edge cases, batch, summary |
| `queries/commissions.queries.ts` | fetchSellerSales — ventas por vendedor de fjdhstvta1 |
| `features/commissions/CommissionsPage.tsx` | Página: KPIs, filtro mes/canal, badge "Datos reales" |
| `features/commissions/hooks/useCommissions.ts` | Hook con 2 lógicas: Retail (tienda) + Mayorista/UTP (vendedor) |
| `features/commissions/components/CommissionTable.tsx` | Tabla paginada, "Pendiente" para datos faltantes |
| `features/commissions/components/ScalesReference.tsx` | 8 tablas de referencia collapsibles |
| `domain/auth/types.ts` | +canViewCommissions |
| `App.tsx` | +ruta /comisiones |
| `layout/AppSidebar.tsx` | +item Comisiones en sección Control |
| `layout/AppHeader.tsx` | Filtros ocultos en /comisiones |
| `docs/COMISIONES_DATA_SPEC.md` | Spec completa: lógica, datos, SQL, preguntas |

**Pendiente de Fenix (para completar Mayorista/UTP):**
1. Tabla `comisiones_metas_vendedor` con metas individuales por vendedor (SQL en spec)
2. Datos de cobranza en `c_cobrar`
3. Rol de comisión por vendedor (supervisor, gerencia, backoffice)

### 3. CalendarPage — Fixes de vista año

| Fix | Detalle |
|-----|---------|
| "Ano" → "Año" | Corregido en botón custom FullCalendar + toolbar vista año |
| "Dia" → "Día" | Corregido en buttonText FullCalendar + toolbar vista año |
| Tooltip hover en vista año | Popover al pasar mouse sobre días con eventos: lista de eventos + llegadas logísticas |
| Llegadas respetan toggle | `showArrivals` ahora controla visibilidad en vista año (antes siempre se mostraban) |
| Indicadores de llegada más visibles | Barras de 1×2.5px → cuadrados de 1.5×1.5px |

### Verificación final

967 tests | 24 suites | TSC 0 errores | Build OK

### Deploy

- **PR #10:** https://github.com/calcarazgre646/NewFenixBrands/pull/10 (merged) — Novedades Depósito
- **Comisiones + Calendario:** deploy directo via `vercel --prod`
- **Vercel:** https://fenix-brands-one.vercel.app (production)
