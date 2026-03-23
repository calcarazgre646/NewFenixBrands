# Prompt de Trabajo: Optimización Mobile — NewFenixBrands

> Copia este prompt completo al inicio de cada sesión de trabajo con Claude Code.

---

## CONTEXTO

Estás trabajando en el proyecto NewFenixBrands (`/Users/prueba/Downloads/NewFenixBrands`). Es un dashboard analytics (React 19 + TypeScript + Vite + Tailwind CSS v4 + ApexCharts + Supabase) para una empresa de indumentaria paraguaya.

El dashboard tiene una versión desktop ("destock") que está terminada y funcionando en producción. Tu trabajo es **optimizar exclusivamente la experiencia mobile** sin romper nada de desktop.

Ya se completó la optimización mobile de la página de inicio (`/` — ExecutivePage). Ahora hay que continuar con las demás secciones.

## MISIÓN

Revisar cada sección/página del dashboard, auditar su estado en mobile, y ejecutar mejoras siguiendo los mismos principios y patrones que se aplicaron en la página de inicio.

### Secciones pendientes de optimizar:

- `/ventas` — SalesPage
- `/acciones` — ActionQueuePage
- `/logistica` — LogisticsPage
- `/depositos` — DepotsPage
- `/kpis` — KpiDashboardPage + KpiCategoryPage
- `/calendario` — CalendarPage
- `/usuarios` — UsersPage
- `/ayuda` — HelpPage

## PROCESO DE TRABAJO (por sección)

### Fase 1: Auditoría
1. Leer el componente principal de la sección completo
2. Leer todos los CSS overrides en `src/index.css` dentro de `@media (max-width: 639px)` que apliquen a esa sección
3. Identificar todos los sub-componentes que usa la sección
4. Presentar un reporte al usuario con esta estructura:

```
## [Nombre de Sección] — Auditoría Mobile

### Desktop (estado actual)
- Descripción breve de cómo se ve y funciona

### Mobile — Problemas encontrados
| Problema | Causa | Severidad |
|----------|-------|-----------|

### Solución propuesta
- Descripción de los cambios
```

5. **Esperar aprobación** del usuario antes de implementar

### Fase 2: Implementación
1. Aplicar los cambios aprobados
2. Correr `npm run build` después de cada cambio
3. Pedir al usuario que verifique desktop primero, luego mobile

### Fase 3: Verificación
1. `npx tsc --noEmit` → 0 errores
2. `npm run build` → OK
3. Confirmar con el usuario que desktop no cambió
4. Confirmar con el usuario que mobile mejoró

## REGLAS — QUÉ HACER

### Arquitectura
- **Tailwind responsive** es la forma correcta de hacer responsive: `text-sm sm:text-base`, `p-3 sm:p-5`, `hidden sm:block`, etc.
- Las clases base (sin prefijo) son mobile-first. `sm:` es 640px+, `lg:` es 1024px+.
- Si un componente necesita verse diferente en mobile, usar clases Tailwind responsive directamente en el JSX.
- Si una tabla tiene muchas columnas, usar el patrón de **tab switcher en mobile** (`sm:hidden` / `hidden sm:block`) como se hizo en `MonthlyPerformanceTable.tsx`.

### ApexCharts
- Para adaptar charts en mobile, usar la propiedad `responsive` de ApexCharts:
```typescript
responsive: [{
  breakpoint: 640,
  options: {
    // solo se aplica < 640px
    // las opciones base (desktop) quedan intactas
  },
}],
```
- **NUNCA** usar `window.innerWidth` en opciones de chart, render, o props.
- **NUNCA** forzar height/width del canvas con CSS — ApexCharts no redistribuye.
- Para ocultar el eje Y en mobile y reclamar el espacio: `yaxis: { show: false, labels: { show: false, minWidth: 0, maxWidth: 0 } }`.
- CSS sobre ApexCharts solo para detalles cosméticos (leyenda font-size, marker size). Nunca para geometría (height, width, padding, position).

### Componentes reutilizables ya optimizados
- `StatCard` (`src/components/ui/stat-card/StatCard.tsx`) — ya tiene responsive interno
- `Card` (`src/components/ui/card/Card.tsx`) — usar Tailwind responsive en el className prop si necesitás padding diferente
- `InsightBar` — ya tiene responsive interno (1 col mobile, 3 cols desktop)

### CSS
- CSS overrides en `@media (max-width: 639px)` son aceptables SOLO para:
  - Padding de contenedores (`.section > *`)
  - Layout del header/sidebar (ya están hechos)
- CSS overrides **NO son aceptables** para:
  - Geometría interna de ApexCharts (height, width, transforms)
  - Reordenar elementos (`order`)
  - Ocultar/mostrar cosas (`display: none`) — usar Tailwind `hidden sm:block`
  - Font sizes de componentes — usar Tailwind responsive en el componente

## REGLAS — QUÉ NO HACER

1. **NUNCA modificar la experiencia desktop.** Si un cambio afecta desktop, revertirlo inmediatamente.
2. **NUNCA usar `window.innerWidth`** en render, props, o chart options.
3. **NUNCA usar `!important`** en CSS nuevo. Si hay `!important` existentes que sobran, eliminarlos.
4. **NUNCA forzar height/width de canvas SVG con CSS.**
5. **NUNCA usar `git checkout` de archivos completos** — se pierden cambios previos. Usar ediciones puntuales.
6. **NUNCA hacer cambios cosméticos fuera de la sección que estás optimizando.**
7. **NUNCA agregar dependencias nuevas.**
8. **NUNCA reescribir lógica de negocio** — solo tocar layout/presentación.
9. **NUNCA aplicar cambios sin correr `npm run build` primero.**
10. **NUNCA asumir que un cambio mobile no afecta desktop** — siempre pedir verificación en ambos.

## PATRONES DE REFERENCIA (ya implementados)

### Filtros mobile — ExecutiveFilters.tsx
```
Desktop: botones agrupados (canal) + select (período). Marca en header.
Mobile: 3 selects simples (Marca, Canal, Período) — 1 dimensión por select.
Patrón: render dual con hidden/sm:hidden.
```

### Tabla ancha → Tab switcher — MonthlyPerformanceTable.tsx
```
Desktop: tabla 10 columnas con headers agrupados.
Mobile: tab switcher (Ventas|Margen|Uds.) + tabla 4 columnas.
Patrón: estado local `mobileTab`, render dual con sm:hidden / hidden sm:block.
```

### Chart responsive — ExecutivePage buildChartOptions
```
Desktop: opciones base intactas.
Mobile: propiedad `responsive` de ApexCharts con breakpoint 640.
Patrón: yaxis oculto con minWidth:0/maxWidth:0, títulos de eje undefined, legend centrada.
```

### Gauge responsive — ExecutivePage gauge card
```
Desktop: hollow 80%, fontSize 36px, height 240.
Mobile: responsive de ApexCharts con hollow 72%, fontSize 28px, height 180.
Patrón: Tailwind responsive en el JSX para padding/títulos/footer del contenedor.
```

### InsightBar — 3 marcas
```
Desktop: grid-cols-3 con divide-x.
Mobile: grid-cols-1 con divide-y.
Patrón: Tailwind responsive directo en el componente, sin CSS overrides.
```

### StatCard — KPI cards
```
Desktop: p-5, text-[11px] label, text-xl valor, text-xs sub.
Mobile: p-3, text-[9px] label, text-base valor, text-[10px] sub.
Patrón: Tailwind responsive directo en el componente.
```

## ARCHIVOS CLAVE

```
src/index.css                    — CSS overrides mobile (limpiar los que sobren)
src/layout/AppHeader.tsx         — Header (ya optimizado)
src/layout/AppSidebar.tsx        — Sidebar (ya optimizado)
src/layout/AppLayout.tsx         — Shell principal
src/components/ui/stat-card/     — StatCard (ya responsive)
src/components/ui/card/          — Card base
src/components/ui/chart/         — ResponsiveChart wrapper
src/features/executive/          — Página inicio (ya optimizada — referencia)
src/features/sales/              — PENDIENTE
src/features/action-queue/       — PENDIENTE
src/features/logistics/          — PENDIENTE
src/features/depots/             — PENDIENTE
src/features/kpis/               — PENDIENTE
src/features/calendar/           — PENDIENTE
src/features/users/              — PENDIENTE
```

## CRITERIO DE ÉXITO

Una sección está bien optimizada cuando:
- [ ] Desktop se ve idéntico a antes del cambio
- [ ] Mobile usa el ancho completo sin scroll horizontal innecesario
- [ ] No hay texto cortado, encimado, o ilegible
- [ ] Las tablas anchas tienen tab switcher o vista simplificada
- [ ] Los charts usan `responsive` de ApexCharts, no CSS hacks
- [ ] No hay CSS `!important` nuevos
- [ ] `npm run build` pasa sin errores
- [ ] `npx tsc --noEmit` pasa sin errores
- [ ] El código queda más limpio que antes (menos CSS overrides, más Tailwind responsive)
