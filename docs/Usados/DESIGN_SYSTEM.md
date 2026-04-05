# Design System — NewFenixBrands

Guía de referencia para el equipo de frontend. Todo desarrollo de UI debe seguir este documento.

---

## 1. Componentes UI Disponibles

Ubicación: `src/components/ui/[nombre]/`

### Card
```tsx
import { Card } from "@/components/ui/card/Card";

<Card variant="default" padding="md">contenido</Card>
<Card variant="outlined" padding="lg">contenido</Card>
<Card variant="elevated" padding="none">contenido</Card>
```
| Prop | Tipo | Default | Opciones |
|------|------|---------|----------|
| variant | string | `"default"` | `"default"` \| `"outlined"` \| `"elevated"` |
| padding | string | `"md"` | `"none"` \| `"sm"` \| `"md"` \| `"lg"` |
| className | string | `""` | Clases adicionales |

### StatCard
```tsx
import { StatCard } from "@/components/ui/stat-card/StatCard";

<StatCard label="Ventas" value="1.234M ₲" sub="vs año anterior" />
<StatCard label="Brecha" value="+5%" variant="positive" />
<StatCard label="Error" value="-3%" variant="negative" />
```
| Prop | Tipo | Default | Opciones |
|------|------|---------|----------|
| label | string | — | Título corto en uppercase |
| value | string | — | Valor principal (ya formateado) |
| sub | string? | — | Texto secundario |
| variant | string | `"neutral"` | `"neutral"` \| `"positive"` \| `"negative"` |
| icon | ReactNode? | — | Icono opcional |

### Skeleton
```tsx
import { Skeleton, PageSkeleton } from "@/components/ui/skeleton/Skeleton";

<Skeleton variant="text" />
<Skeleton variant="card" count={4} />
<Skeleton variant="table-row" count={5} />
<Skeleton variant="circle" />
<PageSkeleton />  // Skeleton de página completa
```
| Prop | Tipo | Default |
|------|------|---------|
| variant | string | `"text"` |
| width | string? | — |
| height | string? | — |
| count | number | `1` |

### Tabs
```tsx
import { Tabs } from "@/components/ui/tabs/Tabs";

const items = [
  { key: "brands", label: "Marcas" },
  { key: "channel", label: "Canal" },
];
<Tabs items={items} active={activeTab} onChange={setActiveTab} size="md" />
```
| Prop | Tipo | Default |
|------|------|---------|
| items | `TabItem[]` | — |
| active | string | — |
| onChange | `(key) => void` | — |
| size | string | `"md"` |

### Spinner
```tsx
import { Spinner } from "@/components/ui/spinner/Spinner";

<Spinner size="sm" />
<Spinner size="md" />
<Spinner size="lg" />
```

### EmptyState
```tsx
import { EmptyState } from "@/components/ui/empty-state/EmptyState";

<EmptyState
  title="Sin datos disponibles"
  description="No hay registros para los filtros seleccionados."
  action={<Button onClick={reset}>Limpiar filtros</Button>}
/>
```

### Tooltip
```tsx
import { Tooltip } from "@/components/ui/tooltip/Tooltip";

<Tooltip content="Margen bruto sobre ventas netas" position="top">
  <span>MB%</span>
</Tooltip>
```

### PageHeader
```tsx
import { PageHeader } from "@/components/ui/page-header/PageHeader";

<PageHeader
  title="Analisis de Ventas"
  description="Periodo: Ene–Feb 2026"
  actions={<Button>Exportar</Button>}
/>
```

### Section
```tsx
import { Section } from "@/components/ui/section/Section";

<Section label="Resumen Ejecutivo" description="Progreso anual al objetivo">
  {children}
</Section>
```

### Button
```tsx
import Button from "@/components/ui/button/Button";

<Button variant="primary" size="md">Guardar</Button>
<Button variant="outline" size="sm" startIcon={<Icon />}>Exportar</Button>
```

### Badge
```tsx
import { Badge } from "@/components/ui/badge/Badge";

<Badge text="Premium" className="bg-amber-100 text-amber-700" />
```

### Modal
```tsx
import { Modal } from "@/components/ui/modal";

<Modal isOpen={open} onClose={close}>
  <h2>Titulo</h2>
  <p>Contenido</p>
</Modal>
```
Incluye: focus trap, Escape para cerrar, restauración de foco al cerrar.

### Dropdown
```tsx
import { Dropdown } from "@/components/ui/dropdown/Dropdown";
```
Incluye: click outside, Escape, navegación con Arrow Up/Down.

### Otros: FilterSelect, InputField, Label, Table
Ver archivos en `src/components/ui/form/` y `src/components/ui/table/`.

---

## 2. Paleta de Colores — Uso Semántico

Definidas en `src/index.css` via `@theme`.

| Token | Hex | Cuándo usar |
|-------|-----|-------------|
| `brand-500` | `#465fff` | Acciones primarias, enlaces, elementos activos |
| `brand-50/100` | — | Fondos de elementos seleccionados, badges activos |
| `success-500` | `#12b76a` | Valores positivos, tendencia al alza, cumplimiento OK |
| `success-50/100` | — | Fondos de estados positivos |
| `error-500` | `#f04438` | Valores negativos, errores, alertas críticas |
| `error-50/100` | — | Fondos de estados negativos |
| `warning-500` | `#f79009` | Precaución, datos parciales, mes en curso |
| `warning-50/100` | — | Fondos de advertencias |
| `orange-500` | `#fb6514` | Acentos secundarios, categorías |
| `gray-50` | `#f9fafb` | Fondo de página (light mode) |
| `gray-900` | `#101828` | Texto principal (light mode) |
| `gray-400/500` | — | Texto secundario, labels |
| `gray-200` | `#e4e7ec` | Bordes, separadores |

### Dark mode
Siempre usar clases `dark:` correspondientes. Ejemplos:
- Texto principal: `text-gray-900 dark:text-white`
- Texto secundario: `text-gray-500 dark:text-gray-400`
- Bordes: `border-gray-200 dark:border-gray-700`
- Fondos card: `bg-white dark:bg-gray-800`
- Fondos página: `bg-gray-50 dark:bg-gray-900`

---

## 3. Tipografía

**Familia:** Outfit (Google Fonts) — `font-outfit`

| Uso | Clase | Peso |
|-----|-------|------|
| Títulos de página | `text-xl font-bold` | 700 |
| Subtítulos sección | `text-xs font-semibold uppercase tracking-widest` | 600 |
| Valores KPI | `text-2xl font-bold` | 700 |
| Texto body | `text-sm` | 400 |
| Labels | `text-xs font-medium` | 500 |
| Micro texto | `text-[10px] font-semibold uppercase tracking-wider` | 600 |

### Tokens de tipografía (`@theme`)
```
--font-weight-normal: 400
--font-weight-medium: 500
--font-weight-semibold: 600
--font-weight-bold: 700
--tracking-tight: -0.025em
--tracking-normal: 0em
--tracking-wide: 0.025em
```

---

## 4. Spacing & Layout

### Tokens de spacing (`@theme`)
```
--spacing-page-x: 1.5rem     → Padding horizontal de página
--spacing-page-y: 1.5rem     → Padding vertical de página
--spacing-section: 1.5rem    → Gap entre secciones
--spacing-card: 1.25rem      → Padding interno de cards (md)
--spacing-card-sm: 1rem      → Padding interno de cards (sm)
```

### Patrones de grid
```tsx
// 4 columnas KPI/stats
<div className="grid grid-cols-2 gap-4 lg:grid-cols-4">

// 5 columnas quick links
<div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-5">

// 6 columnas stats compactos
<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
```

### Estructura de página estándar
```tsx
<div className="space-y-6 p-4 sm:p-6">
  <PageHeader title="..." description="..." actions={...} />
  {/* Secciones de contenido */}
</div>
```

---

## 5. Radius Scale

```
--radius-sm: 0.375rem   → Badges, inputs pequeños
--radius-md: 0.5rem     → Botones, inputs
--radius-lg: 0.75rem    → Cards pequeñas, dropdowns
--radius-xl: 1rem       → Cards grandes (rounded-2xl en Tailwind)
--radius-2xl: 1.5rem    → Modales
--radius-full: 9999px   → Pills, avatares
```

---

## 6. Animaciones — Motion Budget

### Tokens de transición (`@theme`)
```
--duration-fast: 150ms      → Hover, focus, toggles
--duration-normal: 250ms    → Entrada de componentes, expansión
--duration-slow: 400ms      → Animaciones complejas (máximo permitido)
--ease-default: cubic-bezier(0.4, 0, 0.2, 1)
--ease-in: cubic-bezier(0.4, 0, 1, 1)
--ease-out: cubic-bezier(0, 0, 0.2, 1)
--ease-bounce: cubic-bezier(0.34, 1.56, 0.64, 1)
```

### Reglas
- Transiciones de hover/focus: `duration-[var(--duration-fast)]`
- Expansión/colapso de secciones: `duration-[var(--duration-normal)]`
- Nunca animaciones mayores a 400ms
- Skeleton loading usa `animate-pulse` (built-in Tailwind)
- Usar `transition-colors`, `transition-all`, `transition-transform` según corresponda

---

## 7. Accesibilidad — Checklist Mínimo

### Obligatorio en todo componente interactivo:
- [ ] `aria-label` o `aria-labelledby` en botones sin texto visible
- [ ] `aria-expanded` en botones que abren/cierran contenido
- [ ] `role="dialog"` + `aria-modal="true"` en modales
- [ ] `role="tab"` + `aria-selected` en tabs
- [ ] `role="menu"` en dropdowns
- [ ] `scope="col"` en headers de tablas (`<th>`)
- [ ] `tabIndex` correcto para elementos custom focusables
- [ ] Soporte de keyboard: `Escape` para cerrar, `Arrow` para navegar, `Enter`/`Space` para activar

### Ya implementado globalmente:
- `:focus-visible` ring en todos los elementos interactivos (via `index.css`)
- Skip-to-content link en `AppHeader`
- Focus trap en `Modal`
- Keyboard navigation en `Dropdown` (Arrow Up/Down, Escape)

### Contraste mínimo:
- Texto sobre fondo: ratio 4.5:1 (WCAG AA)
- La paleta de colores del proyecto cumple esto por defecto

---

## 8. Sombras

```
shadow-theme-xs  → Inputs, elementos sutiles
shadow-theme-sm  → Cards hover, badges
shadow-theme-md  → Tooltips, popovers
shadow-theme-lg  → Dropdowns, modales
shadow-theme-xl  → Elementos prominentes
shadow-focus-ring → Focus ring (automático via :focus-visible)
```

---

## 9. Reglas del Equipo

### Regla 1: Component-First
Antes de escribir markup, verificar si existe un componente UI en `src/components/ui/`. Si no existe, **crearlo primero** y luego usarlo.

### Regla 2: Zero Inline Components
Prohibido definir componentes presentacionales dentro de archivos de página. Si un componente se usa en más de un lugar (o podría usarse), va en `components/`.

### Regla 3: Tokens, Never Hardcode
Prohibido valores hardcodeados de color (`#465fff`), spacing (`24px`), radius, shadow. Todo debe referenciar tokens `@theme` o clases Tailwind.

### Regla 4: Responsive by Default
Todo componente debe funcionar en mobile (375px) hasta desktop (1536px). Usar mobile-first con prefijos `sm:`, `md:`, `lg:`, `xl:`.

### Regla 5: Dark Mode Required
Todo componente debe tener variante `dark:`. No se acepta código sin soporte dark mode.

### Regla 6: Motion Budget
Ver sección 6. Nunca más de 400ms.

### Regla 7: Accessibility
Ver sección 7. Cada componente interactivo debe cumplir el checklist.

---

## 10. Proceso para Crear un Componente Nuevo

1. **Verificar** que no existe ya en `src/components/ui/`
2. **Crear** archivo en `src/components/ui/[nombre]/[Nombre].tsx`
3. **Definir** Props interface con tipos explícitos
4. **Implementar** con soporte dark mode, responsive, aria attributes
5. **Usar** tokens de `@theme` para colores, spacing, radius, transitions
6. **Documentar** en este archivo (agregar entrada en sección 1)
7. **Usar** en la feature page via import `@/components/ui/[nombre]/[Nombre]`

### Naming
- Archivos componente: `PascalCase.tsx`
- Directorio: `kebab-case/`
- Props: `interface [Nombre]Props`
- Exports: named export (`export function Nombre`)

---

## 11. Importaciones

```tsx
// Componentes UI
import { Card } from "@/components/ui/card/Card";
import { StatCard } from "@/components/ui/stat-card/StatCard";
import { PageHeader } from "@/components/ui/page-header/PageHeader";
import { Section } from "@/components/ui/section/Section";
import { Skeleton, PageSkeleton } from "@/components/ui/skeleton/Skeleton";
import { Tabs } from "@/components/ui/tabs/Tabs";
import { Spinner } from "@/components/ui/spinner/Spinner";
import { EmptyState } from "@/components/ui/empty-state/EmptyState";
import { Tooltip } from "@/components/ui/tooltip/Tooltip";
import { Badge } from "@/components/ui/badge/Badge";
import Button from "@/components/ui/button/Button";
import { Modal } from "@/components/ui/modal";
import { Dropdown } from "@/components/ui/dropdown/Dropdown";
```
