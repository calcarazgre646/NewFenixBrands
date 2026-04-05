# Auditoría Design System & Plan de Mejoras Pre-Rediseño UI/UX

**Fecha:** 2026-03-08 20:06
**Autor:** Claude Code (Opus 4.6)
**Objetivo:** Evaluar madurez del proyecto para un rediseño UI/UX profesional y definir plan de acción

---

## 1. Scorecard General

| Dimensión                      | Nota    | Veredicto         |
| ------------------------------ | ------- | ----------------- |
| Separación de dependencias     | 9.5/10  | Excelente         |
| Arquitectura por capas         | 9/10    | Excelente         |
| Calidad React/TypeScript       | 8.5/10  | Muy Bueno         |
| Sistema de diseño              | 6/10    | Inmaduro          |
| Componentes UI reutilizables   | 5.5/10  | Insuficiente      |
| Accesibilidad                  | 7/10    | Bueno             |
| Mantenibilidad                 | 8.5/10  | Muy Bueno         |
| Escalabilidad                  | 8/10    | Muy Bueno         |
| **Preparación para rediseño**  | **6.5/10** | **Requiere trabajo** |

---

## 2. Diagnóstico Detallado

### 2.1 Fortalezas (NO TOCAR)

- **Arquitectura de capas impecable**: `domain → queries → hooks → features` sin dependencias inversas
- **Dominio puro**: 0 dependencias externas, 265+ tests
- **TypeScript strict**: Sin `any`, interfaces en todos los componentes
- **TanStack Query maduro**: Query key factories, stale times por recurso, invalidación por filtros
- **Separación lógica/presentación**: Componentes son puramente presentacionales

### 2.2 Debilidades que Bloquean el Rediseño

#### A. Sistema de Diseño Primitivo
- Solo 8 componentes UI base: Button, Badge, Dropdown, Modal, Table, FilterSelect, InputField, Label
- Faltan componentes esenciales: Card, Skeleton, Tooltip, Toast, Tabs, Spinner, Avatar, EmptyState, Pagination, DataTable
- Sin variantes documentadas ni API consistente (size, variant, color)
- Sin Storybook ni catálogo visual

#### B. Componentes Inline en Páginas
- `MetricCard`, `StatCard`, `QuickLink` → inline en ExecutivePage
- `SectionHeader` → inline en ExecutivePage
- `MiniMonth` → inline en CalendarPage
- Cada feature tiene su propia implementación de cards sin API común
- **Impacto**: No se puede rediseñar "las cards" porque no existe UN componente Card

#### C. Sin Convención de Layout
- Cada página define su propio grid con valores ad-hoc
- No hay `<PageHeader>`, `<PageSection>`, `<Grid>` estandarizados
- Spacing inconsistente entre páginas

#### D. Tokens Incompletos
- Colores bien definidos en `@theme`
- Faltan: spacing scale del proyecto, radius scale, transition tokens, typography weights/tracking
- Tipografía: solo Outfit, sin sistema de pesos ni tracking definido

#### E. Zero Animaciones
- Sin transitions, sin skeleton loading animado, sin micro-interacciones
- Barrera para rediseño de alto impacto visual

#### F. Accesibilidad Parcial
- Modal sin focus trap
- Tablas sin `scope` en headers
- Sin `:focus-visible` ring consistente
- Dropdowns sin keyboard navigation
- Sin skip-to-content link

---

## 3. Plan de Acción

### Fase A — Design Tokens Completos
**Objetivo**: Expandir `index.css` con tokens faltantes

Tareas:
1. Añadir spacing scale del proyecto (page, section, card padding)
2. Añadir radius scale explícito
3. Añadir transition/animation tokens (durations, easings)
4. Añadir typography tokens (weights, tracking, line-heights)
5. Documentar paleta semántica (cuándo usar cada color)

Archivos a modificar:
- `src/index.css`

### Fase B — Componentes UI Base
**Objetivo**: Crear componentes reutilizables que faltan

Componentes a crear:
1. `Card` — contenedor base con variantes (default, outlined, elevated)
2. `StatCard` — extraer de ExecutivePage, API unificada (value, label, trend, icon)
3. `Skeleton` — loading states (variantes: text, card, table-row, circle)
4. `Tabs` — extraer patrón de SalesAnalyticsPanel
5. `Spinner` — indicador de carga inline
6. `EmptyState` — estado vacío consistente (icon, title, description, action)
7. `Tooltip` — tooltip accesible
8. `PageHeader` — título de página + acciones + breadcrumb
9. `PageSection` — sección con título opcional + children

Ubicación: `src/components/ui/[nombre]/`

Cada componente debe tener:
- Props interface con `variant`, `size` donde aplique
- Soporte dark mode
- Soporte responsive
- ARIA attributes correctos
- Transition tokens aplicados

### Fase C — Refactor de Componentes Inline
**Objetivo**: Reemplazar implementaciones ad-hoc con componentes del design system

Tareas:
1. ExecutivePage: reemplazar MetricCard/StatCard/QuickLink/SectionHeader inline
2. KpiCard: adaptar a usar Card base
3. ActionGroupCard: adaptar a usar Card base
4. SalesAnalyticsPanel: extraer Tabs a componente reutilizable
5. CalendarPage: extraer MiniMonth a componente
6. Todas las páginas: usar PageHeader + PageSection para layout consistente
7. Loading states: reemplazar skeletons ad-hoc con Skeleton component

Archivos a modificar:
- `src/features/executive/ExecutivePage.tsx`
- `src/features/kpis/components/KpiCard.tsx`
- `src/features/action-queue/components/ActionGroupCard.tsx`
- `src/features/sales/components/SalesAnalyticsPanel.tsx`
- `src/features/calendar/CalendarPage.tsx`
- `src/features/logistics/LogisticsPage.tsx`
- Todas las páginas (PageHeader/PageSection)

### Fase D — Accesibilidad Base
**Objetivo**: Cumplir mínimos de accesibilidad

Tareas:
1. Modal: implementar focus trap
2. Tablas: añadir `scope="col"` y `scope="row"`
3. Estilos: añadir `:focus-visible` ring global
4. AppHeader: añadir skip-to-content link
5. Loading states: `aria-live="polite"` para anunciar cambios
6. Dropdown: keyboard navigation (arrow keys, Escape)
7. Icon buttons: verificar `aria-label` en todos

### Fase E — Documentar Estándares
**Objetivo**: Crear guía que el equipo de frontend siga

Crear `docs/DESIGN_SYSTEM.md` con:
1. Catálogo de componentes disponibles con props y variantes
2. Paleta de colores con uso semántico
3. Escala tipográfica con casos de uso
4. Patrones de layout (cuándo usar qué grid)
5. Convenciones de animación (motion budget)
6. Reglas de accesibilidad mínimas
7. Naming conventions
8. Proceso de creación de componentes nuevos

---

## 4. Estándares Post-Implementación

### Regla 1: Component-First
Antes de escribir markup, verificar si existe un componente UI. Si no existe, crearlo en `src/components/ui/` ANTES de usarlo en la feature.

### Regla 2: Zero Inline Components
Prohibido definir componentes presentacionales dentro de archivos de página. Todo componente visual va en `components/`.

### Regla 3: Tokens, Never Hardcode
Prohibido valores hardcodeados de color, spacing, radius, shadow. Todo debe referenciar tokens de `@theme` o clases Tailwind del design system.

### Regla 4: Responsive by Default
Todo componente debe funcionar en mobile (375px) y desktop (1536px). Mobile-first.

### Regla 5: Dark Mode Required
Todo componente debe tener variante `dark:`. No se acepta PR sin soporte dark mode.

### Regla 6: Motion Budget
- Hover/focus transitions: `--duration-fast` (150ms)
- Entrada de componentes: `--duration-normal` (250ms)
- Animaciones complejas: `--duration-slow` (400ms)
- Nunca más de 400ms

### Regla 7: Accessibility Checklist
Cada componente interactivo: `aria-label` o `aria-labelledby`, keyboard support, focus visible, contrast ratio 4.5:1 mínimo.

---

## 5. Qué NO Modificar

- `src/domain/` — Lógica de negocio pura, intocable
- `src/queries/` — Capa de fetch, no tiene presentación
- `src/api/` — Capa de normalización, no tiene presentación
- `src/context/` — Providers de estado global, estructura correcta
- `src/features/*/hooks/` — Composición de datos, no presentación
- Tests existentes — Solo añadir, nunca borrar

---

## 6. Orden de Ejecución

```
Fase A (tokens)
  ↓
Fase B (componentes nuevos) — puede empezar en paralelo con A
  ↓
Fase C (refactor inline) — depende de B
  ↓
Fase D (accesibilidad) — puede empezar en paralelo con C
  ↓
Fase E (documentación) — al final, documenta el estado final
```

---

## 7. Criterio de Éxito

El refactor está completo cuando:
- [x] Todos los tokens definidos en `@theme` (spacing, radius, transitions, typography) — **Fase A ✅**
- [x] 9+ componentes UI nuevos creados con API consistente — **Fase B ✅** (Card, StatCard, Skeleton, Tabs, Spinner, EmptyState, Tooltip, PageHeader, Section)
- [x] Componentes inline principales extraídos — **Fase C ✅** (ExecutivePage, SalesPage, LogisticsPage, ActionQueuePage, KpiCard)
- [x] Páginas principales usan PageHeader + Section — **Fase C ✅**
- [x] Modal con focus trap — **Fase D ✅**
- [x] Tablas con scope attributes — **Fase D ✅** (LogisticsPage, ActionQueueTable, MonthlyPerformanceTable)
- [x] `:focus-visible` global — **Fase A ✅**
- [x] Skip-to-content link — **Fase D ✅**
- [x] Dropdown con keyboard navigation (Arrow keys, Escape) — **Fase D ✅**
- [x] `docs/DESIGN_SYSTEM.md` completo — **Fase E ✅**
- [x] `npm run build` sin errores — ✅ verificado
- [x] Tests existentes pasan (365) — ✅ verificado
- [x] 0 errores TypeScript — ✅ verificado

**Completado:** 2026-03-08 20:30
