# Rediseño UI/UX — Filtros globales unificados (Marca / Canal / Período)

**Fecha:** 2026-05-03
**Branch:** `feat/global-filters-unified-header`
**Auditoría previa:** `docs/AUDIT_GLOBAL_FILTERS_2026-05-03.md`
**Pedido del cliente:** los 3 filtros globales (Marca / Canal / Período) deben aparecer **siempre y en el mismo lugar** (top-left del header de cada vista que los usa), y deben ser **dropdowns** — no pills/buttons — para que el orden y el espacio sean sostenibles entre vistas.

---

## Decisiones de diseño

| # | Decisión | Razón |
|---|---|---|
| 1 | Componente único `<GlobalFilters>` reutilizable, montado top-left de cada Page que use filtros | Una sola fuente de verdad visual + un solo punto de mantenimiento. |
| 2 | UI = 3 `<select>` nativos (Marca · Canal · Período) en ese orden, alineados a la izquierda | Orden fijo = músculo visual del usuario entre vistas. Native select = UX mobile cero-config. |
| 3 | Sub-canal B2B nesteado en el dropdown de Canal (`B2B (todos)`, `B2B · Mayorista`, `B2B · UTP`) | Una sola interacción para llegar al sub-canal; antes era una segunda fila condicional. |
| 4 | Cuando un filtro NO aplica matemáticamente a la vista, se muestra **deshabilitado con tooltip** explicativo (no se oculta) | Mantiene los 3 controles siempre visibles → consistencia. El usuario sabe por qué no puede tocarlo. |
| 5 | Role-locking (canal asignado por rol): select disabled + ícono 🔒 + tooltip `"Canal asignado por tu rol"` | Mismo lenguaje visual que un filtro no-soportado, sin distinción innecesaria. |
| 6 | El AppHeader global pierde la barra de filtros entera; solo conserva sidebar toggle, búsqueda, tema, notificaciones, usuario | Elimina la duplicación header-global vs in-page que existía con `brandOnly`. |
| 7 | Las vistas sin filtros (`/calendario`, `/usuarios`, `/comisiones`, `/ayuda`) simplemente no renderizan `<GlobalFilters>` | Cero magia: si no usás filtros, no los mostrás. |

**Fuera de scope (issues separados):**
- Persistencia URL/localStorage de filtros entre recargas o tabs.
- Exposición del filtro `store` (existe en el state pero sin UI hoy).
- Refactor de DSO/UPT para soportar filtros (bloqueado por BD: `c_cobrar` y vista de Derlys).
- Drawer de filtros mobile (los 3 dropdowns nativos quedan cómodos en wrap-flex).

---

## Arquitectura

### Contrato `viewSupportedFilters`
**Archivo:** `src/domain/filters/viewSupport.ts`

```ts
export type FilterSupport = boolean | string;
//                          ↑       ↑
//              true = OK   false = no aplica (tooltip default)
//                          string = no aplica (tooltip custom)

export interface ViewFilterSupport {
  brand:   FilterSupport;
  channel: FilterSupport;
  period:  FilterSupport;
}

export const ALL_FILTERS_ENABLED: ViewFilterSupport = {
  brand: true, channel: true, period: true,
};

export const FILTER_REASONS = {
  noChannelInventory: "Este módulo no se segmenta por canal: stock físico es transversal.",
  noPeriodLogistics:  "Logística muestra llegadas vigentes (ETAs futuras y pasadas): no aplica filtro de período.",
  noPeriodDepots:     "Depósitos muestra stock actual: no aplica filtro de período.",
  noPeriodSnapshot:   "Precios es un snapshot del catálogo: no aplica filtro de período.",
  noChannelPricing:   "Precios se muestra a nivel SKU comercial (PVP, PVM): no segmenta por canal.",
};
```

### Componente `<GlobalFilters>`
**Archivo:** `src/components/filters/GlobalFilters.tsx`

```tsx
<GlobalFilters />                                    // ALL_FILTERS_ENABLED
<GlobalFilters support={{
  brand: true,
  channel: FILTER_REASONS.noChannelInventory,
  period: FILTER_REASONS.noPeriodLogistics,
}} />
```

- Lee/escribe en `FilterContext` vía `useFilters()`. **No tiene estado propio.**
- Helper puro extraído: `src/components/filters/compositeChannel.ts` (`toComposite` / `fromComposite`) para la lógica del dropdown de Canal.
- Helper puro extraído: `src/domain/filters/scopeMapping.ts` (`scopeToChannel`) — antes inline en `FilterContext`.

### Map de soporte por vista (estado actual)

| Ruta | Brand | Channel | Period | Notas |
|---|---|---|---|---|
| `/` Inicio | ✅ | ✅ | ✅ | `ALL_FILTERS_ENABLED` |
| `/ventas` | ✅ | ✅ | ✅ | `ALL_FILTERS_ENABLED` |
| `/acciones` | ✅ | ✅ | ✅ | `ALL_FILTERS_ENABLED` |
| `/logistica` | ✅ | 🔒 `noChannelInventory` | 🔒 `noPeriodLogistics` | El hook solo lee `filters.brand` |
| `/depositos` | ✅ | 🔒 `noChannelInventory` | 🔒 `noPeriodDepots` | Stock físico transversal |
| `/precios` | ✅ | 🔒 `noChannelPricing` | 🔒 `noPeriodSnapshot` | Snapshot de catálogo |
| `/kpis` | ✅ | ✅ | ✅ | Cada KPI declara su propio `supportedFilters` internamente |
| `/kpis/:cat` | ✅ | ✅ | ✅ | Idem |
| `/marketing` | ✅ | ✅ | ✅ | `ALL_FILTERS_ENABLED` |
| `/comisiones` | — | — | — | No renderiza `<GlobalFilters>` (filtros propios internos) |
| `/calendario` | — | — | — | No renderiza |
| `/usuarios` | — | — | — | No renderiza |
| `/ayuda` | — | — | — | No renderiza |

---

## Cambios por archivo

### Creados
| Archivo | Propósito |
|---|---|
| `src/components/filters/GlobalFilters.tsx` | Componente unificado de los 3 dropdowns. |
| `src/components/filters/compositeChannel.ts` | Helper puro Canal + sub-canal B2B → value compuesto. |
| `src/components/filters/__tests__/compositeChannel.test.ts` | 11 tests round-trip. |
| `src/domain/filters/viewSupport.ts` | Contrato `ViewFilterSupport` + `FILTER_REASONS` + helpers. |
| `src/domain/filters/__tests__/viewSupport.test.ts` | 8 tests. |
| `src/domain/filters/scopeMapping.ts` | `scopeToChannel` extraído de `FilterContext`. |
| `src/domain/filters/__tests__/scopeMapping.test.ts` | 7 tests. |

### Eliminados
| Archivo | Reemplazado por |
|---|---|
| `src/components/filters/FilterBar.tsx` | `<GlobalFilters>` |
| `src/features/executive/components/ExecutiveFilters.tsx` | `<GlobalFilters>` |

### Modificados
| Archivo | Cambio |
|---|---|
| `src/context/FilterContext.tsx` | Importa `scopeToChannel` del nuevo módulo (era inline). Sin cambio de comportamiento. |
| `src/layout/AppHeader.tsx` | Removido `<FilterBar>`, `hideFilters`/`hasInPageFilters` y el subcomponente `<ChannelSelector>`. AppHeader ya solo tiene sidebar toggle, búsqueda, tema, notificaciones, usuario. |
| `src/features/executive/ExecutivePage.tsx` | `<ExecutiveFilters>` → `<GlobalFilters>` (2 instancias: desktop + mobile). Filtros pasan a la izquierda; `DataFreshnessTag` queda a la derecha. |
| `src/features/sales/SalesPage.tsx` | Idem. |
| `src/features/kpis/KpiDashboardPage.tsx` | Idem. |
| `src/features/kpis/KpiCategoryPage.tsx` | `<GlobalFilters>` arriba, breadcrumb + título debajo (antes filtros estaban a la derecha del título). |
| `src/features/marketing/MarketingPage.tsx` | `<ExecutiveFilters>` → `<GlobalFilters>`. |
| `src/features/action-queue/ActionQueuePage.tsx` | Nueva fila de filtros + freshness arriba; tab bar pierde el freshness embebido. Removida la dependencia del `<ChannelSelector>` que antes vivía en `AppHeader`. |
| `src/features/logistics/LogisticsPage.tsx` | Agregado `<GlobalFilters support={{ brand:true, channel: …noChannelInventory, period: …noPeriodLogistics }} />`. |
| `src/features/depots/DepotsPage.tsx` | Agregado `<GlobalFilters support={{ brand:true, channel: …noChannelInventory, period: …noPeriodDepots }} />`. |
| `src/features/pricing/PricingPage.tsx` | Agregado `<GlobalFilters support={{ brand:true, channel: …noChannelPricing, period: …noPeriodSnapshot }} />`. |

---

## Verificación programática

| Check | Resultado |
|---|---|
| `npx tsc --noEmit` | ✅ 0 errores |
| `npm run lint` | ✅ 0 errores (2 warnings preexistentes en `marketing/useMarketingProducts.ts`, no introducidos por este PR) |
| `npx vitest run` | ✅ **1841 / 1841 passing** (66 suites; +26 tests vs baseline 1815) |
| `npm run build` | ✅ built in 2.85s |

**Tests nuevos (26):**
- `viewSupport.test.ts` — 8 tests del contrato
- `compositeChannel.test.ts` — 11 tests del helper de Canal
- `scopeMapping.test.ts` — 7 tests del mapper de role-locking

---

## Verificación visual pendiente (responsabilidad del usuario)

El repo no tiene infra de component testing (no jsdom, no @testing-library/react), así que el comportamiento del componente y el layout final por vista necesitan verificarse en el navegador antes de mergear.

**Checklist sugerido (`npm run dev`):**
- [ ] `/` Inicio: 3 dropdowns top-left + DataFreshnessTag top-right; cambiar marca y verificar que datos refresquen.
- [ ] `/ventas`: idem, cambiar canal a B2B → Mayorista en 1 click.
- [ ] `/acciones`: filtros arriba de la tab bar; tabs siguen funcionando.
- [ ] `/logistica`: dropdown Canal y Período aparecen disabled; hover → tooltip explicativo.
- [ ] `/depositos`: idem.
- [ ] `/precios`: dropdown Canal y Período disabled.
- [ ] `/kpis`: 3 dropdowns activos; cambiar período afecta los cards.
- [ ] `/kpis/:categoria`: filtros arriba del breadcrumb.
- [ ] `/marketing`: 3 dropdowns activos.
- [ ] `/comisiones`, `/calendario`, `/usuarios`, `/ayuda`: NO debe aparecer la barra de filtros.
- [ ] Mobile (<lg): los 3 dropdowns hacen wrap correctamente.
- [ ] Rol con `channel_scope` distinto de `total`: dropdown de Canal aparece con 🔒 + tooltip "Canal asignado por tu rol".

---

## Beneficios concretos

1. **Consistencia visual entre vistas** — los 3 controles SIEMPRE en el mismo lugar y orden.
2. **Menos código duplicado** — eliminadas 3 implementaciones (FilterBar header, ExecutiveFilters in-page, ChannelSelector ad-hoc en AppHeader para `/acciones`) por una sola.
3. **Tipado del soporte por vista** — `ViewFilterSupport` declara explícitamente qué filtros aplican y por qué, queda compilado en el código.
4. **Mejor UX mobile** — `<select>` nativo abre el picker del SO.
5. **Sub-canal B2B en una sola interacción** — antes era 2 clicks (elegir B2B + elegir sub).
6. **Honestidad sobre limitaciones** — DSO/UPT/etc. no esconden el filtro, lo deshabilitan con razón explícita.
