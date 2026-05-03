# Sesión 03/05/2026 — Filtros globales unificados (PR #54)

## Origen

Pedido del cliente: los 3 filtros globales (Marca / Canal / Período) deben aparecer **siempre y en el mismo lugar del header de la app** (junto al buscador), alineados a la izquierda, como **dropdowns** custom — no pills/buttons. Cada vista debe declarar qué filtros le aplican; cuando un filtro no aplique, debe quedar deshabilitado con tooltip explicativo (no oculto), para mantener la consistencia visual entre vistas.

## Auditoría previa

`docs/AUDIT_GLOBAL_FILTERS_2026-05-03.md` — mapeó el estado a la fecha:

- `FilterBar.tsx` (header global, modo `brandOnly` por pathnames) + `ExecutiveFilters.tsx` (in-page) + `ChannelSelector` ad-hoc en `/acciones` → **3 implementaciones dispersas** del mismo concepto.
- `FilterContext` con `useState` y `scopeToChannel` inline.
- 9 hallazgos de severidad media/alta (DSO/UPT sin canal por BD, comisiones ignora brand/channel, store sin UI, sin persistencia, etc.).
- ~42 tests directos sobre filtros, sin tests de Provider ni de UI.

## Decisiones de diseño

| # | Decisión | Razón |
|---|---|---|
| 1 | `<GlobalFilters>` único en `AppHeader` (no in-page) | Una sola fuente de verdad visual, alineado al pedido del cliente. |
| 2 | Cada Page declara su soporte vía `<DeclareViewFilters support={...} />`; un Context (`ViewFilterSupportProvider`) lo lleva al header | Co-localización, sin acoplar el header a un mapa pathname→support. |
| 3 | UI custom (no `<select>` nativo) alineada al DS del repo: `rounded-xl`, `shadow-theme-lg`, paleta `brand-*`, dark mode integrado | Mismo lenguaje visual que `Dropdown`, `NotificationDropdown`, `Button`. |
| 4 | Trigger compacto: solo el VALOR + caret (sin prefijo `MARCA:`, sin dots de color por marca) | Los 3 entran en una sola línea cómoda. Los dots los pidió quitar el cliente explícitamente. |
| 5 | Sub-canal B2B nesteado en el dropdown de Canal: `B2B` al mismo nivel que `B2C` + `Mayorista`/`UTP` indentados con rayita vertical estilo tree-view | Una interacción (vs dos). Jerarquía clara sin necesidad de etiquetas explícitas tipo "B2B · Mayorista". |
| 6 | Filtros que no aplican: trigger deshabilitado + tooltip + cursor not-allowed (no se ocultan) | Mantiene los 3 controles siempre visibles → consistencia entre vistas. |
| 7 | Role-locking: ícono 🔒 + tooltip `"Canal asignado por tu rol"` | Mismo lenguaje visual que un filtro no-soportado. |
| 8 | Toggle desktop del sidebar **removido** del `AppHeader` (estaba duplicado con el toggle del propio sidebar) | Libera ~50px → los 3 filtros entran en una sola línea. Mobile conservado. |
| 9 | Vistas sin filtros (`/calendario`, `/usuarios`, `/comisiones`, `/ayuda`) NO declaran soporte | Cero magia: ausencia de declaración = sin barra. |

## Iteración con el usuario

El rediseño tuvo 5 rondas de feedback rápidas (todas en la misma sesión):

1. **Inicial:** monté `<GlobalFilters>` in-page (top-left de cada Page). El usuario corrigió: lo quería en el header del app, junto al buscador. → Pivot completo a Context + `DeclareViewFilters`.
2. **Wrap en dos líneas:** los 3 entraban en dos líneas. El usuario notó que el toggle desktop del sidebar estaba duplicado. → Removido.
3. **DS:** reemplazo de `<select>` nativos por triggers + paneles custom alineados al DS.
4. **Compactar:** los triggers tenían prefijo `MARCA·CANAL·PERÍODO` + dots, volvieron a wrap. → Saco prefijos y dots.
5. **Nesting B2B:** `B2B (todos)` indentado y prefijado con `B2B · Mayorista` / `B2B · UTP`. El usuario pidió: `B2B` al mismo nivel que `B2C` + sub-opciones `Mayorista` y `UTP` (sin prefijo) indentadas con rayita vertical.
6. **Rayita:** la primera versión tenía la rayita full-height + el botón sub se sobresalía por la derecha (perdía margen del hover). → Wrapper `pl-5` sin `ml-2` en el botón + rayita acortada con `top-2 bottom-2`.

## Cambios principales

### Creados (10 archivos)

| Archivo | Propósito |
|---|---|
| `src/components/filters/GlobalFilters.tsx` | Componente unificado de los 3 dropdowns (custom, DS-aligned). |
| `src/components/filters/DeclareViewFilters.tsx` | Cada Page lo monta para declarar su soporte (setea Context en mount, null en unmount). Estabilidad de referencia vía `JSON.stringify` para no re-disparar el efecto. |
| `src/components/filters/compositeChannel.ts` | Helper puro: serializa Canal + sub-canal B2B en un único value (`toComposite` / `fromComposite`). |
| `src/components/filters/__tests__/compositeChannel.test.ts` | 11 tests round-trip. |
| `src/context/viewFilters.context.ts` | Context (separado del Provider para HMR). |
| `src/context/ViewFilterSupportProvider.tsx` | Provider con `useState<ViewFilterSupport | null>`. |
| `src/domain/filters/viewSupport.ts` | Contrato `ViewFilterSupport` + `ALL_FILTERS_ENABLED` + `FILTER_REASONS` + helpers. |
| `src/domain/filters/__tests__/viewSupport.test.ts` | 8 tests. |
| `src/domain/filters/scopeMapping.ts` | `scopeToChannel` extraído de `FilterContext` para test puro. |
| `src/domain/filters/__tests__/scopeMapping.test.ts` | 7 tests. |

### Eliminados (2 archivos, 485 líneas)

| Archivo | Reemplazado por |
|---|---|
| `src/components/filters/FilterBar.tsx` (313 líneas) | `<GlobalFilters>` |
| `src/features/executive/components/ExecutiveFilters.tsx` (172 líneas) | `<GlobalFilters>` (vía DeclareViewFilters) |

### Modificados (13 archivos)

- `src/context/FilterContext.tsx` — importa `scopeToChannel` del nuevo módulo.
- `src/layout/AppLayout.tsx` — wrappea con `<ViewFilterSupportProvider>`.
- `src/layout/AppHeader.tsx` — renderiza `<GlobalFilters>` cuando hay support; removido el toggle desktop del sidebar (mobile conservado) + lógica vieja `hideFilters`/`hasInPageFilters` + `<ChannelSelector>` ad-hoc.
- 9 Pages: `ExecutivePage`, `SalesPage`, `KpiDashboardPage`, `KpiCategoryPage`, `MarketingPage`, `ActionQueuePage`, `LogisticsPage`, `DepotsPage`, `PricingPage` — cada una monta `<DeclareViewFilters support={...} />` con su shape.

## Map de soporte por vista

| Ruta | Brand | Channel | Period | Cómo se declara |
|---|---|---|---|---|
| `/`, `/ventas`, `/acciones`, `/kpis`, `/kpis/:cat`, `/marketing` | ✅ | ✅ | ✅ | `ALL_FILTERS_ENABLED` |
| `/logistica` | ✅ | 🔒 noChannelInventory | 🔒 noPeriodLogistics | Custom |
| `/depositos` | ✅ | 🔒 noChannelInventory | 🔒 noPeriodDepots | Custom |
| `/precios` | ✅ | 🔒 noChannelPricing | 🔒 noPeriodSnapshot | Custom |
| `/comisiones`, `/calendario`, `/usuarios`, `/ayuda` | — | — | — | NO declara → header sin barra |

## Verificación

```
Tests:   1841 passing (66 suites, +26 nuevos vs 1815 baseline)
TSC:     0 errores
ESLint:  0 errores (2 warnings preexistentes en marketing/useMarketingProducts.ts)
Build:   ✓ built in 2.95s
Visual:  confirmada por el usuario en localhost:5173
```

**Tests nuevos (26):**
- `viewSupport.test.ts` — 8 tests (contrato + razones)
- `compositeChannel.test.ts` — 11 tests round-trip
- `scopeMapping.test.ts` — 7 tests (mapeo `channel_scope` → `ChannelFilter`)

## Deploy

- **PR:** https://github.com/calcarazgre646/NewFenixBrands/pull/54 (merged `--admin --squash --delete-branch`)
- **Squash commit en main:** `938e729` — "feat(filters): unificar filtros globales (Marca/Canal/Período) en AppHeader (#54)"
- **Vercel:** `vercel --prod` exitoso
  - Deployment: `https://fenix-brands-iic6o50xr-calcarazgre646s-projects.vercel.app`
  - Aliased a producción: **https://fenix-brands-one.vercel.app**
  - Build 6.74s · Deploy total 32s

## Aprendizajes

1. **El cliente quería filtros en el header del app, no en el header de cada page.** Las palabras "header de la página" eran ambiguas; al ver el primer rediseño aclaró rápido. Lección: cuando "header" puede significar dos lugares, mostrar el cambio antes que escribir 9 archivos.
2. **Sin testing-library en el repo** (entorno `node`, sin jsdom). Componentes React no se pueden unit-testear directamente. Solución: extraer la lógica del componente a helpers puros (`compositeChannel`, `scopeToChannel`) y testear esos. El componente queda confiando en que sus inputs/outputs están cubiertos.
3. **Estabilidad de prop por valor:** un componente como `<DeclareViewFilters support={objLiteral}>` recibe nuevo objeto cada render. `JSON.stringify(support)` como dep del `useEffect` (con `JSON.parse` adentro para entregar una copia) es trivialmente cheap para 3 keys y satisface eslint sin disable comments.
4. **El toggle desktop del sidebar era un duplicado silencioso.** Estaba ahí desde el template original; el sidebar tiene su propio toggle. Removerlo no costó nada y libera espacio crítico para la barra de filtros.
5. **"Sin dots de color por marca" fue una preferencia explícita del cliente.** No es la primera vez (referencias visuales = literales); confirma el patrón: aplicar lo pedido sin agregar adornos visuales propios.

## Pendientes (fuera de scope, queedan abiertos para futuras sesiones)

- Persistencia de filtros (URL params / localStorage) entre recargas y tabs.
- Exposición del filtro `store` (existe en el state pero sin UI).
- Refactor de DSO/UPT cuando Derlys provea las vistas con marca/canal.
- Drawer de filtros mobile (en mobile la barra del header se oculta entera; los filtros viven solo en desktop).
