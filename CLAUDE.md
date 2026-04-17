# NewFenixBrands — Contexto para el Agente

## Mision del proyecto

Reconstruccion completa de FenixBrands (plataforma analytics para empresa de indumentaria paraguaya: marcas Martel, Wrangler, Lee). El proyecto viejo tenia logica de negocio duplicada, queries mezcladas con UI y 0 tests. Este proyecto reconstruye todo con arquitectura limpia.

**Stack:** React 19 + TypeScript + Vite + Tailwind CSS v4 + TanStack Query v5 + Supabase + React Router v7

**Proyecto viejo (SOLO como referencia de UI y logica de negocio):** `/Users/prueba/Downloads/FenixBrands`
→ Ver `docs/OLD_PROJECT_REFERENCE.md` antes de mirar el viejo.

---

## Estado actual (actualizado 04/04/2026)

| Fase | Feature | Estado |
|------|---------|--------|
| Infra | Rutas, layout, auth, contextos, queries, domain logic | ✅ COMPLETO |
| 0 | SignInPage + ChangePasswordPage (primer login) | ✅ COMPLETO |
| 1 | KpiDashboardPage (`/kpis`) — 9 core + 50 catálogo + sparklines + UPT activado | ✅ COMPLETO |
| 1B | ExecutivePage (`/`) — Road to Annual Target, chart acumulado, tabla mensual | ✅ COMPLETO |
| 2 | SalesPage (`/ventas`) — Metricas, 4 tabs analytics, YoY tiendas, Top/Bottom SKUs | ✅ COMPLETO |
| 3 | ActionQueuePage (`/acciones`) — Waterfall 4 niveles + Lifecycle SKU (linealidad 3x6, sequential 5 pasos, cascade A→B→OUT, mandatory exit 90d) + 2 pestañas | ✅ COMPLETO + LIFECYCLE + AUDITADO (ver docs/LIFECYCLE_04) |
| 4 | LogisticsPage (`/logistica`) — ETAs importacion, tabla agrupada | ✅ COMPLETO + AUDITADO |
| 5 | CalendarPage (`/calendario`) — FullCalendar + CRUD + Realtime + Llegadas logística | ✅ COMPLETO + AUDITADO |
| 6 | UsersPage (`/usuarios`) — CRUD completo, Edge Function, cambio contraseña | ✅ COMPLETO + AUDITADO |
| 6B | DepotsPage (`/depositos`) — Filtros estandarizados in-page + Novedades/Lanzamientos | ✅ COMPLETO + AUDITADO |
| 7 | CommissionsPage (`/comisiones`) — Comisiones por vendedor, datos reales, 8 escalas | ⚠️ PARCIAL — esperando datos de Fenix |

**La app corre:** `npm run dev` → http://localhost:5173
**Tests:** 1060 passing (29 suites) | TSC 0 errores | Build OK
**Deploy:** https://fenix-brands-one.vercel.app
**Sesión 04/04/2026:** Config editable — Etapas 2-5 (ver abajo)
**Sesión 30/03/2026:** Ver log detallado abajo
**Sesión 24/03/2026:** Ver log detallado abajo
**Sesión 14/03/2026 (04:00–14:00):** Ver log detallado abajo
**Sesión 14/03/2026 (00:00–04:00):** Ver log detallado abajo

---

## Proximo trabajo

**Config editable — COMPLETA (Etapas 2-5):**
- ✅ Comisiones: 8 escalas en `config_commission_scale` → loop completo BD→UI
- ✅ Márgenes: 4 thresholds en `app_params` → loop completo BD→UI
- ✅ Depots: 5 thresholds en `app_params` → loop completo BD→UI
- ✅ Executive: 2 defaults en `app_params` → loop completo BD→UI
- ✅ Freshness: 1 config en `app_params` → backend-only (hook lee status pre-computado)
- ✅ Waterfall: 12 thresholds en `app_params` → loop completo BD→UI
- ✅ Store clusters: 41 tiendas en `config_store` → loop completo BD→UI
- ✅ 27 tests frágiles migrados a contract tests
- ✅ Dead code eliminado (CLUSTER_PRICE_MIX, storeMapping.ts)
- Seed: `sql/013_config_seed.sql` (Etapa 4) + `sql/014_config_seed_etapa5.sql` (Etapa 5)
- Ver `docs/ETAPA_2_3_CONFIG_IMPLEMENTATION.md` para estado completo

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
  domain/config/types.ts           — Interfaces de config por dominio (WaterfallConfig, DepotConfig, etc.)
  domain/config/defaults.ts        — Valores hardcoded como defaults nombrados (importa de fuentes canónicas)
  domain/config/schemas.ts         — Validación sin Zod: ValidationResult<T>, numericField, validateXxxConfig
  domain/config/loader.ts          — resolveParam, resolveStoreConfig, resolveCommissionScales (remote→validate→fallback)
  queries/config.queries.ts        — fetchAppParams, fetchStoreConfig, fetchCommissionScales (authClient)
  hooks/useConfig.ts               — 7 hooks: useWaterfallConfig, useDepotConfig, useFreshnessConfig, useExecutiveConfig, useMarginConfig, useStoreConfig, useCommissionScales
```

---

## Docs detallados

- `docs/ARCHITECTURE.md` — Arquitectura completa, convenciones, patrones
- `docs/NEXT_FEATURES.md` — Spec de features (fases 1-4 completadas, ver estado arriba)
- `docs/OLD_PROJECT_REFERENCE.md` — Como y cuando usar el proyecto viejo como referencia
- `docs/AUDIT_WATERFALL_CORE_2026-03-08.md` — Auditoria end-to-end del algoritmo SISO/waterfall (8 bugs corregidos, flujo de datos completo, campos usados/no usados, preguntas pendientes cliente)
- `docs/AUDIT_INTEGRAL_2026-03-11.md` — Auditoria integral completa (428 tests, 16 hallazgos, score 8.5/10)
- `docs/PREGUNTAS_CLIENTE_COLA_ACCIONES.md` — 5+3 preguntas pendientes para Rodrigo/Derlys
- `docs/CONFIG ARCHITECTURE.md` — Diseño de arquitectura del sistema de config (modelo, loader, validación, fallback)
- `docs/ETAPA_2_3_CONFIG_IMPLEMENTATION.md` — Documentación completa Etapas 2-5 + seed + estado final
- `docs/scope freeze + inventario final.md` — Auditoría de ~95 constantes de negocio, clasificación, mapa de impacto
- `docs/safety net de tests.md` — Auditoría de fragilidad de tests, migración a contract tests

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

---

## Sesión 04/04/2026 — Config Editable: Etapas 2 + 3 + 4 + Seed Producción

### Objetivo

Implementar infraestructura de configuración editable y primera migración de quick wins. Permitir que constantes de negocio se externalicen progresivamente a tablas Supabase sin romper nada.

### Etapa 2 — Infraestructura de config

**3 tablas SQL creadas** en Supabase auth (BD de la app):

| Tabla | Propósito |
|-------|-----------|
| `app_params` | Key/value JSONB para thresholds, ratios, factores (~30 params) |
| `config_store` | Config por tienda: cluster, capacidad, horarios, exclusión, B2B |
| `config_commission_scale` | Escalas de comisión: 8 roles × tiers JSONB |

**SQL:** `sql/012_config_tables.sql` — tablas vacías + RLS (lectura autenticados, escritura super_user).

**11 archivos creados:**

| Archivo | Propósito |
|---------|-----------|
| `domain/config/types.ts` | Interfaces: WaterfallConfig, DepotConfig, FreshnessConfig, ExecutiveConfig, MarginConfig, StoreConfig, CommissionConfig |
| `domain/config/defaults.ts` | Defaults hardcoded como exports. Importa de fuentes canónicas (clusters.ts, classify.ts) |
| `domain/config/schemas.ts` | Validación sin Zod: ValidationResult\<T\>, numericField(), 10 validate functions |
| `domain/config/loader.ts` | resolveParam(), resolveStoreConfig(), resolveCommissionScales() — remote→validate→fallback |
| `domain/config/__tests__/schemas.test.ts` | 44 tests |
| `domain/config/__tests__/loader.test.ts` | 14 tests |
| `domain/config/__tests__/defaults.test.ts` | 15 tests (golden snapshots + self-validation) |
| `queries/config.queries.ts` | fetchAppParams, fetchStoreConfig, fetchCommissionScales (authClient) |
| `hooks/useConfig.ts` | 8 hooks con TanStack Query (staleTime 10min, fallback a defaults) |

**Decisiones clave:**
- Sin Zod (proyecto no lo tenía — validación con funciones TS puras)
- configKeys en `queries/keys.ts` central (no archivo separado)
- Cross-field validation en hooks (depot: critical < low < high; margin: moderate < healthy)
- Commission scales merge: `{ ...fallback, ...overrides }` para garantizar todos los roles

### Etapa 3 — Quick wins

**Grupo A — Deduplicación (4 constantes, 10 duplicaciones eliminadas):**

| Constante | De | A |
|-----------|------|--------|
| `4.33` (MOS→semanas) | Hardcoded ×4 en features | `WEEKS_PER_MONTH` desde defaults |
| DOI 180/90 | Hardcoded ×2 | `DOI_AGE_THRESHOLDS` desde defaults |
| `PAGE_SIZE = 20` | Hardcoded ×3 | `FEATURE_PAGE_SIZE` desde defaults |
| `LOGISTICS_THRESHOLDS` | Inline en LogisticsPage | `DEFAULT_LOGISTICS_FRESHNESS` en defaults |

**Grupo B — Inyección de config (5 funciones de domain parametrizadas):**

| Función | Archivo | Parámetro agregado |
|---------|---------|-------------------|
| `getThresholds()` | freshness/classify.ts | sourceThresholds, defaultThresholds |
| `calcAnnualTarget()` | executive/calcs.ts | fallback (default: 70B) |
| `buildMonthlyRows()` | executive/calcs.ts | lyBudgetFactor (default: 0.90) |
| `classifyDepotRisk()` | depots/calculations.ts | config (default: 4/8/16 semanas) |
| `classifyNoveltyDistribution()` | depots/calculations.ts | noveltyCoverage (default: 0.80) |

**Archivos de features modificados:** ActionGroupCard.tsx, PurchasePlanningTab.tsx, CompactActionList.tsx, exportHtml.ts, NoveltySection.tsx, LogisticsPage.tsx — todos importan constantes centralizadas en vez de hardcodear.

### Auditoría de calidad (Simplify)

10 hallazgos corregidos post-implementación: helper DRY, casts innecesarios, doble normalización, cross-field validation, imports centralizados. Ver `docs/ETAPA_2_3_CONFIG_IMPLEMENTATION.md`.

### Etapa 4 — Migración cuidada: Comisiones + Márgenes

**Safety net:** 27 tests frágiles migrados a contract tests (comisiones: 14, márgenes: 8, depots: 5). Todos derivan expected de la fuente canónica.

**Funciones parametrizadas:**

| Función | Parámetro agregado |
|---------|-------------------|
| `calcCommission()` | `scales: Record<string, CommissionScale>` |
| `calcAllCommissions()` | `scales` (pasado a calcCommission) |
| `classifyMarginHealth()` | `config: MarginConfig` |
| `marginHealthThresholds()` | `config: MarginConfig` |

**Conexión end-to-end comisiones:**
- `useCommissions` hook → `useCommissionScales()` → `scales[role]` (ya no importa SCALE_BY_ROLE)
- `CommissionsPage` → `useCommissionScales()` → pasa scales a ScalesReference como prop
- `ScalesReference` → recibe `scales` como prop (ya no importa ALL_SCALES)

**Conexión end-to-end márgenes:**
- `SalesPage` → `useMarginConfig()` → `classifyMarginHealth(pct, channel, config)`
- `StoresTable` → `useMarginConfig()` → `classifyMarginHealth()` (B2B y B2C)
- `StoreDetailView` → `useMarginConfig()` → `classifyMarginHealth()` ×2 + `marginHealthThresholds()`

**Seed en producción** (`sql/013_config_seed.sql`):
- `config_commission_scale`: 8 filas (8 roles × tiers JSONB, maxPct=null para Infinity)
- `app_params`: 12 filas (4 margin + 5 depot + 2 executive + 1 freshness)
- Verificado en producción: `/comisiones` y `/ventas` idénticos ✅

**Postergado:** Store clusters (afecta waterfall), depots/executive/freshness end-to-end (requiere refactor de buildDepotData)

### Verificación final

1058 tests (28 suites) | TSC 0 errores | Build OK | Producción verificada

### Archivos de documentación

- `docs/ETAPA_2_3_CONFIG_IMPLEMENTATION.md` — Documentación completa Etapas 2-4 + seed
- `docs/CONFIG ARCHITECTURE.md` — Diseño de arquitectura (Etapa 2)
- `docs/scope freeze + inventario final.md` — Auditoría de constantes (Etapa 0)
- `docs/safety net de tests.md` — Auditoría de fragilidad de tests (Etapa 1)

---

## Sesión 04/04/2026 (continuación) — Etapa 5: End-to-end + Store Clusters + Waterfall + Dead Code + Tests

### Objetivo

Completar la migración de configuración editable: cablear los dominios faltantes (depots, executive), limpiar dead code, parametrizar store clusters y waterfall thresholds, poblar tablas y deployar.

### 1. Conexiones end-to-end faltantes

**Depots (2 archivos):**

| Archivo | Cambio |
|---------|--------|
| `domain/depots/calculations.ts` | `buildDepotData()` acepta `config: DepotConfig` y `clusters: Record<string, StoreCluster>`. Pasa config a `classifyDepotRisk()` (×3), `classifyNoveltyDistribution()`, `getStoreCluster()`. `buildNoveltyData()` acepta `noveltyCoverage`. |
| `features/depots/hooks/useDepots.ts` | Importa `useDepotConfig` + `useStoreConfig`. Pasa `depotConfig` y `storeConfig.clusters` a `buildDepotData()`. |

**Executive (1 archivo):**

| Archivo | Cambio |
|---------|--------|
| `features/executive/hooks/useExecutiveData.ts` | Importa `useExecutiveConfig`. `70_000_000_000` → `execConfig.annualTargetFallback`. `calcAnnualTarget()` (×2) recibe fallback. `buildMonthlyRows()` (×2) recibe `lyBudgetFactor`. |

**Freshness:** No requiere cambio — `useDataFreshness` lee status pre-computado de BD. Config es backend-only.

### 2. Dead code eliminado

| Item | Archivo | Razón |
|------|---------|-------|
| `CLUSTER_PRICE_MIX` | clusters.ts | 0 consumidores |
| `DEFAULT_CLUSTER_PRICE_MIX` | defaults.ts | Default del dead code |
| `ClusterPriceMix` type + validator + hook | types.ts, schemas.ts, useConfig.ts | Soporte del dead code |
| `classifyStoreForCommission` + `storeGoalToSellerGoal` | storeMapping.ts (eliminado) | Nunca llamados |
| 6 tests + 1 snapshot | tests/ | Tests del dead code |

### 3. Etapa 5 Bloque A — Store clusters parametrizados

**Funciones en `clusters.ts` parametrizadas:**
- `getStoreCluster(code, clusters?)` — default STORE_CLUSTERS
- `getTimeRestriction(code, restrictions?)` — default STORE_TIME_RESTRICTIONS
- `getStoreAssortment(code, assortments?)` — default STORE_ASSORTMENT

**5 consumidores actualizados:**
- `waterfall.ts` → `computeActionQueue` recibe `storeClusters`, `storeTimeRestrictions`
- `grouping.ts` → `groupActions` recibe `clusters`, `timeRestrictions`, `assortments`
- `depots/calculations.ts` → `buildDepotData` recibe `clusters`
- `useActionQueue.ts` → pasa `storeConfig.clusters` al enriquecer records
- `ActionsTab.tsx` → pasa `storeConfig.*` a `groupActions`

### 4. Etapa 5 Bloque B — Waterfall thresholds parametrizados

9 constantes module-level eliminadas → destructuradas desde `WaterfallConfig` param:
`lowStockRatio`, `highStockRatio`, `minStockAbs`, `minAvgForRatio`, `minTransferUnits`, `paretoTarget`, `surplusLiquidateRatio`, `b2cStoreCoverWeeks`, `minImpactGs`.

Además: `getCoverWeeks(brand)` → lógica inline con `importedBrands`/`coverWeeksImported`/`coverWeeksNational` del config.

**Conexión:** `useActionQueue` → `useWaterfallConfig()` → `computeActionQueue(..., waterfallConfig)`

### 5. Seed en producción

**SQL:** `sql/014_config_seed_etapa5.sql` — ejecutado en Supabase auth el 04/04/2026.

| Tabla | Filas | Contenido |
|-------|-------|-----------|
| `app_params` | +12 | 12 waterfall thresholds (domain='waterfall') |
| `config_store` | 41 | 20 retail + 3 B2B + 18 excluidas |

### 6. Tests migrados + nuevos

**Tests frágiles migrados a contract tests:**
- `freshness/classify.test.ts` — thresholds derivados de `SOURCE_THRESHOLDS` y `getThresholds()`
- `executive/calcs.test.ts` — fallback derivado de `DEFAULT_EXECUTIVE_CONFIG`
- `grouping.test.ts` — assortment derivado de `STORE_ASSORTMENT`

**Tests nuevos:**
- `queries/__tests__/filters.test.ts` — 8 tests para `filterSalesRows()` (brand, channel, store, combinaciones)

### Verificación final

```
Tests:  1060 passing (29 suites)
TSC:    0 errores
Build:  OK
Deploy: https://fenix-brands-one.vercel.app — verificado por usuario ✅
```

### Estado final del sistema de config

Todos los dominios con loop completo BD→UI:

| Dominio | Tabla | Filas | Seed |
|---------|-------|-------|------|
| Comisiones (8 escalas) | config_commission_scale | 8 | 013 |
| Márgenes (4 thresholds) | app_params | 4 | 013 |
| Depots (5 thresholds) | app_params | 5 | 013 |
| Executive (2 defaults) | app_params | 2 | 013 |
| Freshness (1 config) | app_params | 1 | 013 |
| Waterfall (12 thresholds) | app_params | 12 | 014 |
| Store clusters (41 stores) | config_store | 41 | 014 |

Totales: 24 filas en app_params + 8 en config_commission_scale + 41 en config_store = 73 filas de config en producción.

---

## Sesión 16/04/2026 — Lifecycle per-talle + Rediseño UI tickets + Deploy

### 1. Engine: Lifecycle por talle (enfoque híbrido)

**Problema:** Las acciones lifecycle se evaluaban por SKU en tienda usando la talla con mejor STH como representativa. Si un SKU tenía talla S al 90% y talla L al 5%, ambas se evaluaban como "SKU al 90% → bueno" y la talla L quedaba invisible.

**Solución (pedido de Rodrigo):** Evaluar STH por talla individual, mostrar "promedio del SKU" como contexto.

**Enfoque híbrido en `waterfall.ts`:**
- Curva de tallas (Steps 1-3 de `sequentialDecision`) → sigue per-(sku, store) — no tiene sentido analizar la curva talla por talla
- STH (Steps 4-5: STH vs umbral, vs promedio tienda, cascade, markdown) → per-(sku, talle, store) usando `sthData.exact[talle]`

**Implementación:**
- `precomputeSkuStoreAvgSth(sthData)` computa promedio STH de todas las tallas de un SKU en una tienda
- 2 Maps de decisión: `curveDecisions: Map<"STORE|sku">` y `talleDecisions: Map<"STORE|sku|talle">`
- Cuando outcome de curva no produce decisión, se llama `analyzeSequentially(ctx, null)` por cada talla con su STH específico
- Dedup de emisión: `"STORE|sku"` para curve, `"STORE|sku|talle"` para STH
- `makeItem` setea `skuAvgSthInStore` para items no-depósito

### 2. Rediseño UI: sistema de tickets/cards

Refactor de la pestaña "Acciones" de tabla compacta a tickets auto-contenidos.

**Archivos creados:**

| Archivo | Propósito |
|---------|-----------|
| `features/action-queue/components/ActionCard.tsx` | Ticket auto-contenido. 5 variantes por intent (movimientos, lifecycle review/commercial/exit, size curve). Layout: header (verbo + risk badge) → body (producto + contenido específico) → footer (impacto $ solo en movimientos) |
| `features/action-queue/components/ActionCardList.tsx` | Grid de tickets reemplazo de la tabla |
| `features/action-queue/components/ActionFilters.tsx` | Filtros de la pestaña (intent, marca, vista) |
| `features/action-queue/components/FlatGroupSection.tsx` | Sección flat por intent dentro del grupo de tienda |

**Archivos eliminados:**
- `features/action-queue/components/CompactActionList.tsx` (reemplazado por ActionCardList + ActionCard)

### 3. Integración engine↔UI

**`ActionCard.tsx` adaptado al engine per-talle:**
- Header del producto muestra `· {talle}` para todo lifecycle no-curve (line 141-143)
- `LifecycleReviewBody`: "Sell-Through talla {talle}" en header del bloque STH + "SKU prom. X%" abajo
- `LifecycleCommercialBody`: idem
- `LifecycleExitBody`: "Stock talla" + "STH talla" + subtexto "SKU prom. X%"
- `lifecycle_reposition` (size curve) sigue oculta la talle — correcto, es SKU-level

**`ActionGroupCard.tsx`:**
- `buildSectionDiagnosis` agrega `tallesVsSkus`: muestra "(N SKUs · M talles)" cuando difieren, "(N SKUs)" cuando coinciden
- Aplica a lifecycle_review, lifecycle_commercial, lifecycle_exit

**Tipo `ActionItem` (`types.ts`):**
- `+ skuAvgSthInStore?: number` — promedio STH de las tallas del SKU en la tienda (contexto)

### 4. Tests

`waterfall.test.ts` — 5 tests nuevos en describe "computeActionQueue · lifecycle per-talle":
- SKU con talla S (STH 90%) y talla L (STH 5%) a 60d → solo emite acción sobre talla L
- Curve outcome aplica a todas las tallas (no se duplica per-talle)
- skuAvgSthInStore correctamente calculado
- Dedup correcto entre curve y talle decisions

### 5. Deploy

```bash
vercel --prod
```

**Producción:** https://fenix-brands-one.vercel.app
**Build:** ✅ `built in 8.06s`
**Deploy:** ✅ `Production: https://fenix-brands-gxj1insou-calcarazgre646s-projects.vercel.app [37s]`

### Verificación final

```
Tests:  1343 passing (40 suites)
TSC:    0 errores
Build:  OK
Deploy: https://fenix-brands-one.vercel.app ✅
```

