# Auditoría Integral — NewFenixBrands

**Fecha:** 2026-03-11 02:51
**Auditor:** Claude Code (Opus 4.6)
**Scope:** Codebase completo (`src/`), build, tests, lint, seguridad, accesibilidad, arquitectura

---

## Resumen Ejecutivo

| Métrica | Resultado |
|---------|-----------|
| **Tests** | 428/428 PASS (10 suites, 342ms) |
| **TypeScript (`tsc --noEmit`)** | 0 errores |
| **Build producción (`tsc -b && vite build`)** | OK (2.52s, 584 módulos) |
| **ESLint** | **7 errores + 5 warnings** |
| **Seguridad** | 0 issues |
| **Dead code** | 0 archivos muertos |
| **Console statements** | 1 (`console.warn` de migración) |
| **TODO/FIXME/HACK** | 0 en código (todo documentado en `docs/`) |
| **Cross-project imports** | 0 (aislamiento total del viejo FenixBrands) |

**Score global: 8.5 / 10**
Arquitectura excelente (9.5/10), domain logic sólida (9/10), UI/a11y con margen de mejora (7/10).

---

## Métricas del Build

| Chunk | Tamaño | Gzip |
|-------|--------|------|
| `index.css` | 132.64 KB | 19.89 KB |
| `vendor-charts` (ApexCharts) | 579.94 KB | 157.87 KB |
| `vendor-calendar` (FullCalendar) | 263.69 KB | 76.95 KB |
| `index` (app core) | 267.33 KB | 83.65 KB |
| `vendor-supabase` | 174.16 KB | 45.90 KB |
| `vendor-query` (TanStack Query) | 50.83 KB | 15.82 KB |
| `vendor-react` | 36.73 KB | 13.24 KB |
| `SalesPage` | 48.65 KB | 11.57 KB |
| `ActionQueuePage` | 40.27 KB | 12.02 KB |
| `ExecutivePage` | 33.20 KB | 9.35 KB |
| `SignInPage` | 33.86 KB | 11.18 KB |
| `CalendarPage` | 22.49 KB | 6.74 KB |
| `LogisticsPage` | 14.03 KB | 4.51 KB |
| `KpiDashboardPage` | 9.05 KB | 3.38 KB |

**Warning de Vite:** `vendor-charts` > 500 KB. ApexCharts es la dependencia más pesada.

---

## Suites de Tests (428 total)

| Suite | Tests | Tiempo |
|-------|-------|--------|
| `waterfall.test.ts` | 116 | 20ms |
| `fenix.contract.test.ts` | 101 | 16ms |
| `calculations.test.ts` | 45 | 4ms |
| `normalize.test.ts` | 37 | 5ms |
| `grouping.test.ts` | 35 | 5ms |
| `arrivals.test.ts` | 23 | 42ms |
| `engine.test.ts` | 21 | 13ms |
| `resolve.test.ts` | 19 | 7ms |
| `catalog.test.ts` | 16 | 15ms |
| `filterSupport.test.ts` | 15 | 3ms |

---

## Estructura del Proyecto (`src/`)

```
src/
├── api/
│   ├── __tests__/normalize.test.ts
│   ├── client.ts                    # Supabase auth + data clients
│   └── normalize.ts                 # Parsers, brand normalization, store classification
├── components/
│   ├── common/
│   │   ├── ErrorBoundary.tsx        # Root error boundary + Sentry
│   │   ├── PageMeta.tsx
│   │   └── ThemeToggleButton.tsx
│   ├── filters/FilterBar.tsx
│   ├── form/{InputField.tsx, Label.tsx}
│   ├── header/{NotificationDropdown.tsx, UserDropdown.tsx}
│   ├── search/GlobalSearch.tsx      # ⌘K search (combobox ARIA)
│   └── ui/
│       ├── badge/Badge.tsx
│       ├── button/Button.tsx
│       ├── card/Card.tsx
│       ├── dropdown/Dropdown.tsx
│       ├── empty-state/EmptyState.tsx
│       ├── form/FilterSelect.tsx
│       ├── modal/index.tsx
│       ├── page-header/PageHeader.tsx
│       ├── section/Section.tsx
│       ├── skeleton/Skeleton.tsx
│       ├── spinner/Spinner.tsx
│       ├── stat-card/StatCard.tsx
│       ├── table/index.tsx
│       ├── tabs/Tabs.tsx
│       └── tooltip/Tooltip.tsx
├── context/
│   ├── AuthContext.tsx
│   ├── FilterContext.tsx
│   ├── SidebarContext.tsx
│   └── ThemeContext.tsx
├── domain/
│   ├── actionQueue/
│   │   ├── __tests__/{grouping.test.ts, waterfall.test.ts}
│   │   ├── clusters.ts              # Store clusters A/B/OUT + horarios
│   │   ├── grouping.ts              # Agrupación pura por tienda/marca
│   │   ├── types.ts
│   │   └── waterfall.ts             # Algoritmo waterfall 4 niveles
│   ├── executive/
│   │   ├── calcs.ts                 # Funciones puras: forecast, cumulative, monthly rows
│   │   └── insights.ts              # Brand/channel insights vs presupuesto
│   ├── filters/types.ts
│   ├── kpis/
│   │   ├── __tests__/{calculations.test.ts, fenix.contract.test.ts, filterSupport.test.ts}
│   │   ├── calculations.ts          # 20 funciones KPI puras
│   │   ├── fenix.catalog.ts         # Catálogo 50 KPIs
│   │   ├── filterSupport.ts
│   │   └── types.ts
│   ├── logistics/
│   │   ├── __tests__/arrivals.test.ts
│   │   ├── arrivals.ts              # toArrivals, groupArrivals, computeSummary
│   │   └── types.ts
│   ├── period/
│   │   ├── __tests__/resolve.test.ts
│   │   ├── helpers.ts               # MONTH_SHORT/FULL, calendar helpers
│   │   └── resolve.ts               # resolvePeriod() — fuente de verdad
│   └── search/
│       ├── __tests__/{catalog.test.ts, engine.test.ts}
│       ├── catalog.ts               # Search catalog builder
│       ├── engine.ts                # Multi-word search + scoring
│       └── types.ts
├── features/
│   ├── action-queue/
│   │   ├── components/{ActionGroupCard.tsx, CompactActionList.tsx, exportHtml.ts}
│   │   ├── hooks/useActionQueue.ts
│   │   └── ActionQueuePage.tsx
│   ├── auth/SignInPage.tsx
│   ├── calendar/
│   │   ├── hooks/useCalendar.ts
│   │   └── CalendarPage.tsx
│   ├── executive/
│   │   ├── components/{DataFreshnessTag.tsx, ExecutiveFilters.tsx, InsightBar.tsx, MonthlyPerformanceTable.tsx}
│   │   ├── hooks/useExecutiveData.ts
│   │   └── ExecutivePage.tsx
│   ├── kpis/
│   │   ├── components/KpiCard.tsx
│   │   ├── hooks/useKpiDashboard.ts
│   │   ├── KpiCategoryPage.tsx
│   │   └── KpiDashboardPage.tsx
│   ├── logistics/
│   │   ├── hooks/useLogistics.ts
│   │   └── LogisticsPage.tsx
│   └── sales/
│       ├── components/SalesAnalyticsPanel.tsx   # ⚠ 1,423 líneas
│       ├── hooks/{useSalesAnalytics.ts, useSalesDashboard.ts}
│       └── SalesPage.tsx
├── hooks/useModal.ts
├── icons/index.ts
├── layout/{AppHeader.tsx, AppLayout.tsx, AppSidebar.tsx, Backdrop.tsx}
├── lib/{queryClient.ts, sentry.ts}
├── queries/
│   ├── budget.queries.ts
│   ├── filters.ts                   # filterSalesRows compartido
│   ├── inventory.queries.ts
│   ├── keys.ts                      # Query key factories + STALE/GC constants
│   ├── logistics.queries.ts
│   ├── paginate.ts                  # fetchAllRows() para tablas >1000 filas
│   ├── sales.queries.ts
│   ├── salesHistory.queries.ts
│   ├── stores.queries.ts
│   └── tickets.queries.ts
├── utils/format.ts                  # Todas las funciones de formateo PYG
├── App.tsx
├── main.tsx
├── index.css
└── vite-env.d.ts
```

---

## Hallazgos

### Severidad: CRÍTICO

#### C1. `useMemo` llamado condicionalmente — Violación de React Hooks Rules

- **Archivo:** `src/features/sales/components/SalesAnalyticsPanel.tsx:434`
- **Problema:** En el componente `ChannelZonesCard`, hay un `return` anticipado en línea ~430 que renderiza `<StoreDetailView>`. Después de ese return, en línea 434 se llama `useMemo` para construir `barOptions`. Esto significa que en renders donde `storeDetail` es truthy, el `useMemo` no se ejecuta — violando la regla de React de que los hooks deben llamarse siempre en el mismo orden.
- **Impacto:** React puede crashear o mostrar datos stale cuando `storeDetail` cambia de `null` a un valor o viceversa. En la práctica puede no manifestarse si el componente se desmonta/remonta, pero es un bug latente.
- **ESLint:** `react-hooks/rules-of-hooks` (error)
- **Fix recomendado:** Mover todos los `useMemo` antes del `if (storeDetail)` return, o extraer `StoreDetailView` como componente separado que reciba los datos como props.
- **Esfuerzo:** 15 min

#### C2. Missing dependency `filters.channel` en `channelInsights` useMemo

- **Archivo:** `src/features/executive/hooks/useExecutiveData.ts:657`
- **Problema:** El `useMemo` de `channelInsights` (línea 642-657) tiene un guard `if (filters.channel !== "total") return []` en el body, pero `filters.channel` no está en el dependency array. React no re-ejecutará el memo cuando cambie el canal, potencialmente mostrando insights de canal stale.
- **Impacto:** Si el usuario filtra por canal (B2B/B2C) y luego vuelve a "total", los channel insights pueden no actualizarse.
- **ESLint:** `react-hooks/exhaustive-deps` (warning)
- **Fix recomendado:** Agregar `filters.channel` al dependency array en línea 657.
- **Esfuerzo:** 2 min

#### C3. `let` debería ser `const` — `linearPaceGap`

- **Archivo:** `src/features/executive/hooks/useExecutiveData.ts:447`
- **Problema:** `linearPaceGap` se declara con `let` en línea 424, pero solo se asigna una vez en línea 447 (`linearPaceGap = periodTarget - ytd`). Nunca se reasigna después.
- **Observación adicional:** `linearPaceGap` y `gapToTarget` (línea 448) son idénticos: ambos son `periodTarget - ytd`. Uno de los dos es redundante.
- **ESLint:** `prefer-const` (error)
- **Fix recomendado:** Cambiar a `const` o eliminar la variable duplicada.
- **Esfuerzo:** 1 min

---

### Severidad: ALTA

#### A1. Accesibilidad — `<div>` clickeables sin soporte de teclado (2 instancias)

- **Archivo:** `src/features/sales/components/SalesAnalyticsPanel.tsx:675, 737`
- **Problema:** Tarjetas de tiendas B2C y B2B usan `<div onClick={...}>` sin `onKeyDown`, `role="button"`, ni `tabIndex={0}`. Usuarios de teclado y lectores de pantalla no pueden interactuar con estos elementos.
- **ESLint:** `jsx-a11y/click-events-have-key-events`, `jsx-a11y/no-static-element-interactions` (4 errors)
- **Fix recomendado:** Cambiar `<div>` a `<button>` con estilos equivalentes, o agregar `role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && handleSelect(...)}`.
- **Esfuerzo:** 10 min

#### A2. Accesibilidad — `role="option"` sin focusability

- **Archivo:** `src/components/search/GlobalSearch.tsx:284`
- **Problema:** El `<div role="option">` para resultados KPI informativos no tiene `tabIndex`. Los elementos con role interactivo deben ser focuseables.
- **ESLint:** `jsx-a11y/interactive-supports-focus` (error)
- **Fix recomendado:** Agregar `tabIndex={-1}` al div (es seleccionable via flechas, no necesita tab directo).
- **Esfuerzo:** 1 min

#### A3. Archivo excesivamente grande — SalesAnalyticsPanel.tsx (1,423 líneas)

- **Archivo:** `src/features/sales/components/SalesAnalyticsPanel.tsx`
- **Problema:** Un solo archivo contiene 4 componentes de tab completos (Marcas, Canal/Zonas, Comportamiento, Top SKUs), cada uno con sus propios charts, sparklines, y lógica de renderizado. Dificulta navegación, code review, y testing.
- **Recomendación:** Extraer en 4 archivos:
  - `BrandsCard.tsx` — Tab de marcas con donut chart y breakdown
  - `ChannelZonesCard.tsx` — Tab canal/zonas con horizontal bar + store cards
  - `BehaviorCard.tsx` — Tab comportamiento con day-of-week y tendencias
  - `SkuCard.tsx` — Tab Top SKUs con tabla y métricas
  - `salesAnalytics.utils.ts` — Helpers compartidos (sparklines, colores, margin health)
- **Esfuerzo:** 2 horas

---

### Severidad: MEDIA

#### M1. 10 archivos >400 líneas

| # | Archivo | Líneas | Nota |
|---|---------|--------|------|
| 1 | `SalesAnalyticsPanel.tsx` | 1,423 | **Prioridad de split** (ver A3) |
| 2 | `fenix.catalog.ts` | 866 | Catálogo KPI — aceptable como referencia única |
| 3 | `useExecutiveData.ts` | 703 | Hook complejo pero cohesivo — aceptable |
| 4 | `sales.queries.ts` | 634 | Considerar split por tipo de query |
| 5 | `CalendarPage.tsx` | 614 | Considerar extraer modales |
| 6 | `ExecutivePage.tsx` | 531 | Aceptable para la complejidad de la vista |
| 7 | `useKpiDashboard.ts` | 529 | Considerar extraer lógica de categorías |
| 8 | `waterfall.ts` | 473 | Algoritmo core — no conviene fragmentar |
| 9 | `LogisticsPage.tsx` | 440 | Considerar extraer tabla y filtros |
| 10 | `useSalesAnalytics.ts` | 426 | Considerar extraer agregación day-of-week |

#### M2. Chunk `vendor-charts` > 500KB

- **Detalle:** ApexCharts genera un chunk de 579.94 KB (157.87 KB gzip). Es el chunk más pesado de la app.
- **Impacto:** Afecta First Load en páginas con charts (Executive, Sales, KPIs).
- **Mitigación actual:** Los charts ya están en rutas lazy-loaded, por lo que solo se descargan cuando el usuario navega a esas páginas.
- **Posible mejora:** Investigar alternativas más livianas (Chart.js, Recharts) o tree-shaking más agresivo de ApexCharts.

#### M3. ESLint warnings `react-refresh/only-export-components` (4 archivos)

- **Archivos:** `AuthContext.tsx:104`, `FilterContext.tsx:83`, `SidebarContext.tsx:18`, `ThemeContext.tsx:52`
- **Problema:** Cada Context exporta el Provider (componente) junto con un hook (`useAuth`, `useFilters`, etc). Fast Refresh advierte que esto puede romper HMR.
- **Impacto:** Solo afecta DX durante desarrollo (HMR puede hacer full reload en vez de hot update). No afecta producción.
- **Fix opcional:** Mover hooks a archivos separados (`useAuth.ts`, `useFilters.ts`, etc).

#### M4. `console.warn` en producción

- **Archivo:** `src/queries/inventory.queries.ts:70`
- **Contenido:** `console.warn("[fetchInventory] sku_comercial column not found — run sql/002_sku_comercial.sql")`
- **Contexto:** Warning de migración para alertar que la columna `sku_comercial` no existe aún. Es intencional pero debería removerse una vez aplicada la migración `sql/002_sku_comercial.sql`.

#### M5. Duplicación de patrones Map en sparklines

- **Archivo:** `SalesAnalyticsPanel.tsx:207, 234, 266, 1008`
- **Problema:** Cuatro funciones (`buildStoreSparklines`, `buildStoreDailySparklines`, `deriveStoreDaily`, y agregación diaria) repiten el patrón de construir `Map<string, number[]>` con lógica casi idéntica.
- **Recomendación:** Extraer helper genérico `buildAggregationMap<K, V>(rows, keyFn, valueFn)`.

#### M6. Constantes de color de marca duplicadas

- **Archivo:** `SalesAnalyticsPanel.tsx:47-58`
- **Problema:** `BRAND_COLORS` y `BRAND_CHART_COLOR` están definidos localmente. Podrían centralizarse si se usan en otros componentes en el futuro.
- **Impacto actual:** Bajo — solo se usan en este archivo.

---

### Severidad: BAJA

#### B1. SVGs decorativos sin `aria-hidden="true"` (~15 instancias)

- **Archivos principales:**
  - `ActionGroupCard.tsx:86-94` — IntentIcon SVGs
  - `AppHeader.tsx:49-55, 80-81` — Toggle/menu SVGs
  - `CalendarPage.tsx:355, 363, 529, 573` — Navigation SVGs
- **Impacto:** Lectores de pantalla pueden intentar leer los SVGs decorativos como contenido.
- **Fix:** Agregar `aria-hidden="true"` a SVGs decorativos.

#### B2. Botones sin `aria-label` (3 instancias)

- **Archivos:**
  - `ActionGroupCard.tsx:191-196` — Botón export (tiene `title` pero no `aria-label`)
  - `CalendarPage.tsx:388` — Botón de modal
  - `ActionQueuePage.tsx:123-144` — Toggle buttons Pareto
- **Fix:** Agregar `aria-label` descriptivo.

#### B3. Error boundaries solo en root

- **Actual:** `ErrorBoundary.tsx` wrappea toda la app en `main.tsx`.
- **Mejora:** Agregar error boundaries por feature (Sales, Calendar, Logistics) para que un error en un módulo no tire toda la app.
- **Esfuerzo:** 30 min

---

## Seguridad — Checklist Completo

| Check | Resultado |
|-------|-----------|
| `dangerouslySetInnerHTML` | ✅ 0 instancias |
| `eval()` / `new Function()` | ✅ 0 instancias |
| Hardcoded API keys/secrets | ✅ 0 — solo en `.env.local` |
| XSS vectors | ✅ 0 — React escapa todo |
| SQL injection | ✅ N/A — Supabase client con queries parametrizadas |
| `as any` / `@ts-ignore` | ✅ 0 instancias |
| TypeScript strict mode | ✅ Activo |
| Dependencias con vulnerabilidades conocidas | ✅ No detectadas |
| CORS / CSP | ℹ️ Gestionado por Supabase/Vercel |

---

## Arquitectura — Evaluación

| Aspecto | Score | Nota |
|---------|-------|------|
| Separación queries / domain / UI | 9.5/10 | Patrón fetch-wide/filter-local consistente |
| Type safety | 9.5/10 | 0 `any`, strict mode, interfaces completas |
| Domain logic pura | 9/10 | 20 funciones KPI + waterfall + logistics sin side effects |
| Tests | 8.5/10 | 428 tests domain — UI sin tests (aceptable para fase actual) |
| Design system | 8/10 | 15 componentes UI reutilizables post-auditoría 08/03 |
| Accesibilidad | 7/10 | Skip-to-content, ARIA combobox, pero faltan a11y en cards clickeables |
| Bundle size | 7/10 | ApexCharts domina, lazy loading mitiga |
| Código mantenible | 7.5/10 | 1 mega-archivo (SalesAnalyticsPanel) baja el promedio |

**Score global: 8.5 / 10**

---

## Comparación con Auditorías Anteriores

| Auditoría | Fecha | Tests | Hallazgos | Fixes |
|-----------|-------|-------|-----------|-------|
| Waterfall Core | 08/03/2026 | 265 | 9 bugs críticos/altos | 9/9 |
| Design System | 08/03/2026 | 365 | 5 fases de refactor | 5/5 |
| Executive Home | 08/03/2026 | 237 | 8 bugs | 8/8 |
| Logística | 10/03/2026 | 372 | 21 hallazgos | 13/21 |
| **Integral (esta)** | **11/03/2026** | **428** | **16 hallazgos** | **0/16 (pendientes)** |

---

## Plan de Acción

| Prioridad | ID | Hallazgo | Esfuerzo | Estado |
|-----------|----|----------|----------|--------|
| 🔴 1 | C1 | Fix `useMemo` condicional en SalesAnalyticsPanel | 15 min | ⬜ Pendiente |
| 🔴 2 | C2 | Agregar `filters.channel` a deps en useExecutiveData | 2 min | ⬜ Pendiente |
| 🔴 3 | C3 | `let` → `const` linearPaceGap | 1 min | ⬜ Pendiente |
| 🟡 4 | A1 | Fix `<div onClick>` → `<button>` en store cards | 10 min | ⬜ Pendiente |
| 🟡 5 | A2 | Agregar `tabIndex={-1}` a `role="option"` en GlobalSearch | 1 min | ⬜ Pendiente |
| 🟡 6 | A3 | Split SalesAnalyticsPanel en 4 componentes | 2h | ⬜ Pendiente |
| 🔵 7 | M2 | Evaluar alternativa a ApexCharts o tree-shaking | 2h | ⬜ Backlog |
| 🔵 8 | M4 | Remover `console.warn` post-migración | 1 min | ⬜ Bloqueado (requiere migración SQL) |
| 🔵 9 | M5 | Extraer helper genérico de Map aggregation | 20 min | ⬜ Backlog |
| ⚪ 10 | B1 | Agregar `aria-hidden` a SVGs decorativos | 15 min | ⬜ Backlog |
| ⚪ 11 | B2 | Agregar `aria-label` a 3 botones | 5 min | ⬜ Backlog |
| ⚪ 12 | B3 | Error boundaries por feature | 30 min | ⬜ Backlog |

---

## Notas para el Equipo

1. **C1 es el único bug que puede causar un crash en producción.** Es improbable que se manifieste porque el componente `ChannelZonesCard` se monta/desmonta al cambiar de tab, pero viola las reglas de React y debe corregirse.

2. **Los 428 tests cubren exclusivamente domain logic.** No hay tests de componentes React (unit ni integration). Esto es una decisión consciente para la fase actual — los tests cubren la lógica de negocio donde están los bugs más costosos.

3. **El proyecto está en producción** en https://fenix-brands-one.vercel.app con Sentry configurado (DSN pendiente de activar).

4. **Fase 6 (SettingsPage)** sigue sin spec del cliente. No se debe implementar hasta definición de Rodrigo/Derlys.

---

*Documento generado automáticamente por Claude Code (Opus 4.6) durante auditoría integral del 11/03/2026.*
