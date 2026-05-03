# Auditoría — Filtros globales (brand / canal / tiempo)

**Fecha:** 2026-05-03 01:09 (-03)
**Branch base:** `main` @ `c6e3a0c` (sincronizado con `origin/main`, 0/0 ahead/behind)
**CI último run en main:** ✅ success (PR #53, 2026-05-02 21:45 UTC)
**Working tree:** limpio · typecheck ✅ · tests ✅ 1815/1815 · lint ⚠️ 2 warnings menores
**Autor de la auditoría:** Claude (Opus 4.7) en sesión interactiva con `fabian@subestatica.com`
**Propósito:** congelar el estado actual antes de iniciar un rediseño UX/UI transversal de los 3 filtros globales que dominan el sistema.

---

## 1. Estado central (store)

| Aspecto | Valor |
|---|---|
| Ubicación | `src/context/FilterContext.tsx` (Provider) + `src/context/filter.context.ts` (interface) |
| Patrón | React Context + `useState` (NO Redux, NO Zustand) |
| Shape | `AppFilters` en `src/domain/filters/types.ts:46-56` → `{ brand, channel, b2bSubchannel, store, period, year }` |
| Persistencia | ❌ No localStorage, ❌ no sessionStorage, ❌ no URL state |
| Sync entre tabs | ❌ No (cada pestaña arranca con `DEFAULT_FILTERS`) |
| Reset | `resetFilters()` → `DEFAULT_FILTERS` (respeta canal locked si rol lo exige) |
| Hook de consumo | `useFilters()` en `src/hooks/useFilters.ts` |

### Tipos canónicos (`src/domain/filters/types.ts`)
- `BrandFilter` = `"total" | "martel" | "wrangler" | "lee"`
- `ChannelFilter` = `"total" | "b2c" | "b2b"`
- `B2bSubchannel` = `"all" | "mayorista" | "utp"` (solo aplica si `channel === "b2b"`)
- `PeriodFilter` = `"ytd" | "lastClosedMonth" | "currentMonth"`

### Role-locking
- `isChannelLocked: boolean` y `lockedChannel: string | null` derivados del perfil de usuario
- `scopeToChannel(scope)` mapea el `channel_scope` del perfil a `ChannelFilter`
- Cuando un rol tiene canal locked, el selector de canal en la UI debe deshabilitarse

---

## 2. UI actual

| Componente | Path | Rol |
|---|---|---|
| `FilterBar` | `src/components/filters/FilterBar.tsx` | Selector unificado (marca + canal + período + sub-canal B2B condicional). Props: `{ filters, compact?, brandOnly? }`. |
| Montaje | `src/components/layout/AppHeader.tsx` (~L70) | Renderiza `FilterBar` salvo en `/calendario`, `/usuarios`, `/comisiones`, `/ayuda`. |
| Modo `brandOnly` | activado en 7 rutas | `/`, `/ventas`, `/acciones`, `/logistica`, `/depositos`, `/precios`, `/kpis*` → header muestra solo marca; canal/período se renderizan in-page. |
| `ExecutiveFilters` | `src/features/executive/ExecutiveFilters.tsx` | Re-renderiza canal + período en `/`. |
| Otras vistas in-page | — | Re-implementan parcialmente: **no existe un `<GlobalFilters>` único reutilizable in-page**. |

---

## 3. Consumo por vista

| Ruta | Componente | Filtros leídos | Notas |
|---|---|---|---|
| `/` | `ExecutivePage` | brand · channel · period · year | Sales + executive goals |
| `/ventas` | `SalesPage` | brand · channel · period · year · store | 4 tabs analytics |
| `/acciones` | `ActionQueuePage` | brand · channel · b2bSubchannel · period · year | Waterfall + purchase planning |
| `/logistica` | `LogisticsPage` | brand · period · year | ETAs |
| `/kpis` | `KpiDashboardPage` | brand · channel · store · period · year | 12 KPIs core + catálogo |
| `/kpis/:category` | `KpiCategoryPage` | brand · channel · store · period · year | ~50 KPIs por categoría |
| `/depositos` | `DepotsPage` | brand · period · year | Stock + risk |
| `/precios` | `PricingPage` | brand · period · year | Precios por SKU |
| `/marketing` | `MarketingPage` | brand · channel · period · year | ⚠️ scope real no confirmado en código |
| `/comisiones` | `CommissionsPage` | period | Ignora brand y channel (datos por vendedor) |
| `/usuarios` | `UsersPage` | — | No usa filtros globales |
| `/calendario` | `CalendarPage` | — | No usa filtros globales |

---

## 4. Integración con queries

- Hooks de feature (ej. `useSalesDashboard`, `useExecutiveData`, `useKpiDashboard`, `useActionQueue`) consumen `useFilters()` y propagan a:
  - **Supabase RPCs / SQL** vía argumentos
  - **Filtrado local** post-fetch con `filterSalesRows(rows, brand, channel, store, b2bSubchannel)` en `src/queries/filters.ts`
  - **Resolución de período** con `resolvePeriod(period, monthsInDB, year)` en `src/domain/period/resolve.ts`
- **TanStack Query keys** (`src/queries/keys.ts`) incluyen los filtros como parte de la clave → cualquier cambio dispara refetch automático.
- ❌ **No existe** un helper centralizado tipo `applyGlobalFilters(query)` — cada query construye su propio WHERE.

---

## 5. Asimetrías y deuda detectada

| # | Severidad | Hallazgo | Detalle |
|---|---|---|---|
| 1 | 🔴 | **DSO ignora brand/channel/store** | Limitación de BD: `c_cobrar` no segmenta. Ver `docs/PENDING_DERLYS_DSO_ENRICHMENT.md`. Catálogo lo declara explícitamente en `fenix.catalog.ts` (~L437). |
| 2 | 🔴 | **UPT bloqueado** | `fenix.catalog.ts` (~L400) marca todos los filtros = false. Espera vista de Derlys con items por factura. |
| 3 | 🟡 | **Comisiones ignora brand/channel** | Datos modelados por vendedor; pendiente `comisiones_metas_vendedor` para Mayorista/UTP. |
| 4 | 🟡 | **Marketing — scope no confirmado** | `MarketingPage` declara que aplica los 4 filtros pero la implementación real no fue verificada en esta auditoría. |
| 5 | 🟡 | **Filtro `store` sin UI** | El campo existe en `AppFilters` y lo soportan algunos hooks (sales, kpis), pero `FilterBar` no expone selector → hoy es inalcanzable desde la UI. |
| 6 | 🟡 | **Sin persistencia ni sync entre tabs** | Recargar la página o abrir nueva pestaña vuelve a `DEFAULT_FILTERS`. |
| 7 | 🟡 | **No hay reset al cambiar de vista** | Comportamiento esperable, pero no documentado. |
| 8 | 🟡 | **Defaults no auditados sistémicamente** | `DEFAULT_FILTERS.period = "ytd"` global; falta verificar si todas las vistas se benefician. |
| 9 | 🟡 | **Duplicación de UI in-page** | `ExecutiveFilters` re-implementa canal+período. Sin componente común, cualquier nueva vista repetirá. |

---

## 6. Cobertura de tests (~42 tests directos sobre filtros)

| Suite | Path | Tests | Cobertura |
|---|---|---|---|
| `filters.test.ts` | `src/queries/__tests__/filters.test.ts` | 8 | `filterSalesRows()` con todas las combos de brand/channel/store/b2bSubchannel |
| `filterSupport.test.ts` | `src/domain/kpis/__tests__/filterSupport.test.ts` | 15 | `checkKpiAvailability()` por KPI |
| `period/resolve.test.ts` | `src/domain/period/__tests__/resolve.test.ts` | 19 | `resolvePeriod()` para `ytd` / `lastClosedMonth` / `currentMonth` |

**Gaps:**
- ❌ No hay tests de `FilterContext` / `FilterProvider` (state updates, role-locking, reset).
- ❌ No hay tests de integración UI → query (cambio de filtro → refetch).
- ❌ No hay tests de persistencia (porque no hay persistencia).

---

## 7. Antecedentes en CLAUDE.md y docs/

- **CLAUDE.md (sesión 02/05, PR #49):** "Habilitar filtro B2B/B2C en GMROI y Rotación" — se removió `supportedFilters { channel: false }` obsoleto. Política: "solo soportar filtros donde matemáticamente tenga sentido."
- **CLAUDE.md (sesión 02/05, PRs #51-#53):** desbloqueo de sell-through, DSO y recurrencia. DSO terminó con fallback al último mes con datos.
- `docs/PENDING_DERLYS_DSO_ENRICHMENT.md` — pedido pendiente al cliente para enriquecer `c_cobrar` con marca/canal.
- `docs/PENDING_CLIENT.md` — pendientes globales (UPT, comisiones por canal).
- `docs/SESION_2026-05-02_KPIS_DESBLOQUEO.md` — contexto inmediato de los últimos cambios sobre filtros.

---

## 8. Veredicto para el rediseño

**El contrato (`AppFilters` + `useFilters()` + setters + role-locking) está limpio y tipado.** Cualquier rediseño UX/UI puede sustituir las piezas visuales (`FilterBar`, `ExecutiveFilters`, posibles vistas in-page) apuntando al mismo Context sin tocar las ~50 queries downstream, siempre que respete los contratos de tipo.

**Preguntas abiertas para el scope (a definir con el usuario):**
1. ¿Componente único `<GlobalFilters>` reutilizable in-page, o seguir el split header/in-page?
2. ¿Persistencia? URL params (compartible) vs localStorage (por usuario) vs ambas.
3. ¿Exponer el filtro `store` ya que existe en el state?
4. Jerarquía visual y orden (marca → canal → tiempo, u otro).
5. Comportamiento mobile.
6. Comportamiento cuando una vista no soporta un filtro (DSO, UPT): ¿deshabilitarlo, ocultarlo, mostrarlo con badge "no aplica"?
7. Reset al cambiar de vista vs preservar (hoy se preserva).
8. Tests de integración nuevos como parte del scope.
