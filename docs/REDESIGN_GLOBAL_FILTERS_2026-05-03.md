# Rediseño UI/UX — Filtros globales unificados (Marca / Canal / Período)

**Fecha:** 2026-05-03
**Branch:** `feat/global-filters-unified-header`
**Auditoría previa:** `docs/AUDIT_GLOBAL_FILTERS_2026-05-03.md`
**Pedido del cliente:** los 3 filtros globales (Marca / Canal / Período) deben aparecer **siempre y en el mismo lugar** del header de la app — alineados a la izquierda, junto al buscador — y deben ser **dropdowns** custom alineados al design system, no pills/buttons. Cada vista declara qué filtros le aplican.

---

## Decisiones de diseño

| # | Decisión | Razón |
|---|---|---|
| 1 | Componente único `<GlobalFilters>` que vive en el `AppHeader` (junto al buscador) | Una sola fuente de verdad visual, posición consistente entre vistas, sin duplicación in-page. |
| 2 | Cada Page declara su soporte vía `<DeclareViewFilters support={...} />`; un Context (`ViewFilterSupportProvider`) lo lleva al header | Co-localización del soporte con la Page, sin acoplar el header a un mapa pathname→support. |
| 3 | Triggers custom (no `<select>` nativo), siguiendo el design system del repo (`shadow-theme-lg`, `rounded-xl`, `bg-gray-dark`, paleta `brand-*`) | Aspecto unificado con `NotificationDropdown`, `Button`, `Dropdown` del DS. |
| 4 | Trigger compacto: solo el VALOR seleccionado + caret. Tooltip al hover muestra el contexto (`Marca: Martel`) | Los 3 entran en una línea cómoda en el header desktop. |
| 5 | Dropdown de Canal con sub-canal B2B nesteado y rayita vertical estilo tree-view: `Mayorista` y `UTP` indentados bajo `B2B` | Una sola interacción para llegar al sub-canal; el usuario entiende la jerarquía sin etiquetas explícitas. |
| 6 | Cuando un filtro NO aplica a la vista: trigger deshabilitado (opacity, cursor not-allowed) + tooltip explicativo | Mantiene los 3 controles siempre visibles → consistencia visual. |
| 7 | Role-locking (canal asignado por rol): trigger deshabilitado + ícono 🔒 + tooltip `"Canal asignado por tu rol"` | Mismo lenguaje visual que un filtro no-soportado, sin distinción innecesaria. |
| 8 | El AppHeader pierde el toggle del sidebar duplicado en desktop (el sidebar ya tiene su propio toggle); el toggle mobile se conserva | Libera ~50px de ancho para que los filtros entren cómodos en una sola línea. |
| 9 | Vistas sin filtros (`/calendario`, `/usuarios`, `/comisiones`, `/ayuda`) NO declaran soporte → el header no muestra la barra | Cero magia: ausencia de declaración = sin barra. |
| 10 | Sin dots de color por marca | Por pedido explícito del cliente. |

**Fuera de scope (issues separados):**
- Persistencia URL/localStorage de filtros entre recargas o tabs.
- Exposición del filtro `store` (existe en el state pero sin UI hoy).
- Refactor de DSO/UPT para soportar filtros (bloqueado por BD: `c_cobrar` y vista de Derlys).
- Drawer de filtros mobile (en mobile la barra del header se oculta; los dropdowns viven solo en desktop).

---

## Arquitectura

### Contrato `ViewFilterSupport`
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

### Contexto y declaración por vista

```
AppLayout
└── ViewFilterSupportProvider          // useState<ViewFilterSupport | null>
    ├── AppHeader
    │   └── <GlobalFilters support={ctx.support} />   // si support != null
    └── <Outlet>
        └── PageX
            └── <DeclareViewFilters support={...} />  // setea ctx en mount, null en unmount
```

- `src/context/viewFilters.context.ts` — Context (separado para HMR).
- `src/context/ViewFilterSupportProvider.tsx` — Provider con `useState`.
- `src/components/filters/DeclareViewFilters.tsx` — componente que cada Page monta una vez con su `support`. Usa `JSON.stringify` para depender del valor (no de la referencia) y evitar re-mounts innecesarios.

### Componente `<GlobalFilters>`
**Archivo:** `src/components/filters/GlobalFilters.tsx`

- Render: 3 `<FilterDropdown>` en orden Marca → Canal → Período.
- Cada `FilterDropdown` = trigger (botón pill `h-9 lg:h-10`) + panel `Dropdown`-style (`rounded-xl`, `shadow-theme-lg`, `bg-white dark:bg-gray-dark`).
- Trigger muestra solo el `valueLabel` + caret (no prefijos, no dots).
- Panel: lista de `<OptionRow>`, opciones activas con `bg-brand-50` + check ✓.
- Sub-opciones de Canal (Mayorista/UTP) renderizan con un wrapper `pl-5` y una rayita vertical `absolute left-3 top-2 bottom-2 w-px bg-gray-200 dark:bg-gray-700`. El botón mantiene el padding-right del panel (no se desplaza).

### Helpers puros
- `src/components/filters/compositeChannel.ts` — serializa Canal + sub-canal B2B en un único value para el dropdown (`toComposite` / `fromComposite`).
- `src/domain/filters/scopeMapping.ts` — `scopeToChannel`, antes inline en `FilterContext`.

---

## Map de soporte por vista

| Ruta | Brand | Channel | Period | Cómo se declara |
|---|---|---|---|---|
| `/` Inicio | ✅ | ✅ | ✅ | `ALL_FILTERS_ENABLED` |
| `/ventas` | ✅ | ✅ | ✅ | `ALL_FILTERS_ENABLED` |
| `/acciones` | ✅ | ✅ | ✅ | `ALL_FILTERS_ENABLED` |
| `/logistica` | ✅ | 🔒 `noChannelInventory` | 🔒 `noPeriodLogistics` | Custom |
| `/depositos` | ✅ | 🔒 `noChannelInventory` | 🔒 `noPeriodDepots` | Custom |
| `/precios` | ✅ | 🔒 `noChannelPricing` | 🔒 `noPeriodSnapshot` | Custom |
| `/kpis` | ✅ | ✅ | ✅ | `ALL_FILTERS_ENABLED` (cada KPI declara su propio soporte interno) |
| `/kpis/:cat` | ✅ | ✅ | ✅ | `ALL_FILTERS_ENABLED` |
| `/marketing` | ✅ | ✅ | ✅ | `ALL_FILTERS_ENABLED` |
| `/comisiones` | — | — | — | NO declara (header no muestra la barra) |
| `/calendario` | — | — | — | NO declara |
| `/usuarios` | — | — | — | NO declara |
| `/ayuda` | — | — | — | NO declara |

---

## Cambios por archivo

### Creados
| Archivo | Propósito |
|---|---|
| `src/components/filters/GlobalFilters.tsx` | Componente unificado de los 3 dropdowns (custom, DS-aligned). |
| `src/components/filters/DeclareViewFilters.tsx` | Cada Page lo monta para declarar su soporte. |
| `src/components/filters/compositeChannel.ts` | Helper Canal + sub-canal B2B → value compuesto. |
| `src/components/filters/__tests__/compositeChannel.test.ts` | 11 tests round-trip. |
| `src/context/viewFilters.context.ts` | Context para el `support` activo. |
| `src/context/ViewFilterSupportProvider.tsx` | Provider con useState (en AppLayout). |
| `src/domain/filters/viewSupport.ts` | Contrato `ViewFilterSupport` + `FILTER_REASONS` + helpers. |
| `src/domain/filters/__tests__/viewSupport.test.ts` | 8 tests. |
| `src/domain/filters/scopeMapping.ts` | `scopeToChannel` extraído de `FilterContext`. |
| `src/domain/filters/__tests__/scopeMapping.test.ts` | 7 tests. |

### Eliminados
| Archivo | Reemplazado por |
|---|---|
| `src/components/filters/FilterBar.tsx` | `<GlobalFilters>` en `AppHeader` |
| `src/features/executive/components/ExecutiveFilters.tsx` | `<GlobalFilters>` en `AppHeader` |

### Modificados
| Archivo | Cambio |
|---|---|
| `src/context/FilterContext.tsx` | Importa `scopeToChannel` del nuevo módulo (sin cambio funcional). |
| `src/layout/AppLayout.tsx` | Wrappea con `<ViewFilterSupportProvider>`. |
| `src/layout/AppHeader.tsx` | Renderiza `<GlobalFilters support={...} />` cuando hay soporte declarado. Removido el toggle desktop del sidebar (duplicado) y la lógica vieja `hideFilters`/`hasInPageFilters`. Mobile toggle conservado. |
| 9 Pages (`Executive`, `Sales`, `Action Queue`, `Logistics`, `Depots`, `Pricing`, `Kpi Dashboard`, `Kpi Category`, `Marketing`) | Cada una monta `<DeclareViewFilters support={...} />` y removió cualquier render de filtros in-page. |

---

## Verificación programática

| Check | Resultado |
|---|---|
| `npx tsc --noEmit` | ✅ 0 errores |
| `npm run lint` | ✅ 0 errores (2 warnings preexistentes en `marketing/useMarketingProducts.ts`, no introducidos) |
| `npx vitest run` | ✅ **1841 / 1841** (66 suites; +26 tests vs baseline 1815) |
| `npm run build` | ✅ build OK |

**Tests nuevos (26):**
- `viewSupport.test.ts` — 8 tests del contrato + razones
- `compositeChannel.test.ts` — 11 tests del helper Canal compuesto
- `scopeMapping.test.ts` — 7 tests del mapper de role-locking

---

## Verificación visual realizada

Verificada manualmente por el usuario en `npm run dev` (http://localhost:5173):
- Los 3 dropdowns aparecen en el header alineados a la izquierda en una sola línea.
- Vistas sin soporte declarado no muestran la barra.
- Hover/abierto/disabled/locked funcionan como esperado.
- Sub-opciones B2B (Mayorista, UTP) indentadas con rayita vertical conectándolas a B2B.
- Sin dots de color en marca (por pedido del cliente).

---

## Beneficios concretos

1. **Consistencia visual entre vistas** — los 3 controles SIEMPRE en el mismo lugar (header global) y orden.
2. **Menos código duplicado** — eliminadas 3 implementaciones (FilterBar header, ExecutiveFilters in-page, ChannelSelector ad-hoc en `AppHeader` para `/acciones`) por una sola.
3. **Soporte por vista tipado y co-localizado** — cada Page declara qué filtros aplican y por qué; el header reacciona automáticamente.
4. **Sub-canal B2B en una sola interacción** — antes eran 2 clicks; ahora se elige `B2B`, `Mayorista` o `UTP` directamente.
5. **Honestidad sobre limitaciones** — DSO/UPT/etc. no esconden el filtro, lo deshabilitan con razón explícita.
6. **UI alineada al design system** — mismo lenguaje visual que `Dropdown`, `NotificationDropdown`, `Button`.
