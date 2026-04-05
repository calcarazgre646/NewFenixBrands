# Auditoría Integral — Home Ejecutivo (ExecutivePage)

**Fecha:** 2026-03-08 22:00
**Scope:** Auditoría end-to-end de la página `/` (Executive Dashboard "Road to Annual Target")
**Resultado:** 10 problemas identificados, rediseño completo propuesto

---

## 1. Inventario de archivos auditados

| Archivo | Líneas | Rol |
|---------|--------|-----|
| `src/features/executive/ExecutivePage.tsx` | 365 | Página principal — layout + composición |
| `src/features/executive/hooks/useExecutiveData.ts` | 299 | Hook de datos — fetch wide, filter local |
| `src/features/executive/components/MonthlyPerformanceTable.tsx` | 263 | Tabla colapsable 12 meses × 6 columnas |
| `src/domain/executive/calcs.ts` | 154 | Funciones puras: target, forecast, gap, series, rows |
| `src/components/filters/FilterBar.tsx` | 150 | Barra de filtros global (header) |
| `src/components/ui/stat-card/StatCard.tsx` | 69 | Tarjeta de métrica reutilizable |
| `src/components/ui/card/Card.tsx` | — | Contenedor genérico (variant/padding) |
| `src/components/ui/section/Section.tsx` | 37 | Wrapper de sección con label + divider |
| `src/context/FilterContext.tsx` | — | Estado global de filtros |
| `src/queries/sales.queries.ts` | — | fetchMonthlySalesWide |
| `src/queries/budget.queries.ts` | — | fetchBudget |
| `src/queries/stores.queries.ts` | — | fetchStoreGoals |
| `src/queries/filters.ts` | — | filterSalesRows (filtrado local) |

**Total líneas directamente involucradas:** ~1,337

---

## 2. Flujo de datos (End-to-End)

```
Supabase (4 queries paralelas)
  ├── mv_ventas_mensual (CY) ──┐
  ├── mv_ventas_mensual (PY) ──┤
  ├── Budget_2026 ──────────────┤  → useExecutiveData()
  └── fmetasucu (goals) ───────┘       │
                                        ├── filterSalesRows() [useMemo]
                                        ├── aggregateByMonth() [useMemo]
                                        ├── resolvePeriod() [useMemo]
                                        ├── calcAnnualTarget() ─┐
                                        ├── calcForecast() ─────┤
                                        ├── calcLinearPaceGap()─┤  → ExecutiveMetrics
                                        ├── calcRunRate() ──────┘
                                        ├── buildCumulativeSeries() → ChartPoint[12]
                                        └── buildMonthlyRows() → MonthlyRow[12]
                                               │
                                        ExecutivePage (render)
                                          ├── Header Banner (target + status badge)
                                          ├── 4 × StatCard
                                          ├── Progress Bar
                                          ├── Area Chart (ApexCharts)
                                          ├── MonthlyPerformanceTable
                                          └── 5 × QuickLink
```

**Veredicto de arquitectura: EXCELENTE.** Separación limpia. Cero lógica en UI. Fetch wide/filter local. Cambio de filtro = 0 API calls. Toda la lógica pura en `domain/` es testeable. No hay nada que cambiar en esta capa.

---

## 3. Problemas identificados

### P1: Jerarquía visual plana (ALTA)

**Evidencia:** Las 4 StatCards usan el mismo componente, mismo tamaño, mismo peso tipográfico. No hay "North Star Metric" — el dato más importante (desvío vs ritmo) compite visualmente con datos secundarios.

**Impacto:** El CEO no puede responder "¿cómo vamos?" en <3 segundos. Necesita leer y comparar 4 tarjetas mentalmente.

**Referencia:** En Stripe Dashboard y Vercel Analytics, la métrica primaria ocupa 3-4× más espacio que las secundarias.

### P2: Redundancia del objetivo (ALTA)

**Evidencia:** `annualTarget` aparece en:
1. Header banner: "Road to 69.892M Gs."
2. StatCard #1: "Objetivo Anual: 69.892M Gs."
3. Progress bar legend: "(₲ 69.892M)" implícito

**Impacto:** Data-Ink Ratio (Tufte) violado. 3 repeticiones del mismo número en ~200px verticales. Cada repetición reduce la señal/ruido del dashboard.

### P3: Filtros desvinculados del contexto (MEDIA)

**Evidencia:** El FilterBar vive en el header global (`AppLayout`), no en la página. El dashboard muestra un pequeño badge "Filtro activo: Martel / B2C" pero no ofrece control directo.

**Impacto:** El usuario debe mirar arriba (header) para cambiar filtros, luego mirar abajo (dashboard) para ver el efecto. Dos contextos visuales para una sola operación mental.

### P4: Tabla colapsada por defecto (MEDIA)

**Evidencia:** `MonthlyPerformanceTable` inicia con `useState(false)` → tabla oculta. El usuario debe hacer click para ver los 12 meses.

**Impacto:** El contenido más granular y accionable está hidden by default. En un dashboard ejecutivo diario, esto es un click extra innecesario.

### P5: Chart sin diferenciación de texturas (MEDIA)

**Evidencia:** `dashArray: [0, 0, 6]` — Real y Pronóstico son ambos líneas sólidas. Solo el Objetivo es dashed. Diferenciación: solo color (azul vs verde).

**Impacto:** Usuarios con daltonismo protanopia/deuteranopia (8% de hombres) no distinguen azul de verde sin textura adicional.

### P6: QuickLinks redundantes (BAJA)

**Evidencia:** 5 tarjetas de navegación (KPIs, Ventas, Acciones, Logística, Calendario) ocupan ~200px de altura. El sidebar ya tiene estos mismos links.

**Impacto:** 25% del viewport inferior dedicado a navegación redundante. Espacio premium desperdiciado.

### P7: Sin insight accionable (ALTA)

**Evidencia:** Ningún componente responde "¿por qué estamos adelantados/atrasados?" ni "¿qué marca/canal es responsable?". Solo datos crudos.

**Impacto:** El CEO ve el gap pero no sabe quién lo causa. Debe navegar a `/ventas` y hacer drill-down manual. Eso es friccción de nivel 1 en la métrica más importante.

### P8: Progress bar simplista (MEDIA)

**Evidencia:** Dos `<div>` con width% sobre un bg-gray. Comunica progreso pero no urgencia, ritmo, ni tendencia.

**Impacto:** No aprovecha el espacio horizontal. Una barra del 64.2% no dice si el ritmo se está acelerando o desacelerando.

### P9: Sin micro-animaciones (BAJA)

**Evidencia:** Ningún componente tiene staggered entry, fade-in, ni transición de carga. La página aparece completa de golpe.

**Impacto:** Percepción de calidad. Las animaciones de entrada guían el ojo del usuario por la jerarquía visual. Sin ellas, el dashboard se siente "flat".

### P10: Inconsistencia en el tratamiento de datos vacíos (BAJA)

**Evidencia:** Meses sin datos: `—` (em-dash). Meses con 0: `0 Gs.`. Visualmente idénticos para el usuario pero semánticamente distintos (no hay datos vs hay datos y son 0).

**Impacto:** Confusión menor en edge cases (tienda nueva, marca sin ventas en un mes).

---

## 4. Análisis del feedback del Senior

### Coincidencias

| Punto del Senior | Veredicto | Nota |
|-----------------|-----------|------|
| Embudo de contexto (Marca → Canal → Tiempo) | **CORRECTO** | Los 3 filtros pesan igual visualmente pero son jerárquicos |
| Data-Ink Ratio (objetivo repetido 3×) | **CORRECTO** | P2 en esta auditoría |
| North Star = Desvío, no objetivo | **CORRECTO** | P1 en esta auditoría |
| Texturas distintas en chart | **CORRECTO** | P5 en esta auditoría |
| Progressive Disclosure | **CORRECTO** | P4 (tabla), P7 (insights) |
| Scorecards con jerarquía visual | **CORRECTO** | P1 en esta auditoría |

### Desacuerdos

| Punto del Senior | Veredicto | Razón |
|-----------------|-----------|-------|
| Dropdown con logos de marca | **EXCESIVO** | Para 3-4 opciones, chips visibles son superiores (0-click scanning vs 1-click dropdown). Logos son decorativos sin valor informacional. |
| "Hola Carlitos" personalización | **INAPROPIADO** | Tono consumer app. Un dashboard B2B/analytics debe ser austero. La inteligencia se comunica con datos, no con saludo. |
| Anomalías marcadas en chart | **FUTURO** | Requiere campo "motivo" inexistente en BD. Sin datos → sin feature. Marcar como v2. |
| Referencia Palantir/Salesforce | **DESPROPORCIONADA** | Equipos de 50+ diseñadores, datasets de millones. Mejor referencia: Linear, Vercel Analytics, Stripe Dashboard (claridad con un equipo pequeño). |

### Perspectiva no mencionada por el Senior

1. **Performance como feature UX:** El patrón fetch-wide/filter-local ya entrega filtrado en 0ms. Esto es una ventaja UX que el rediseño debe PRESERVAR y COMUNICAR (transiciones instantáneas, no loaders al cambiar filtro).

2. **Mobile no es prioridad:** Los ejecutivos de indumentaria miran dashboards en desktop (oficina) o tablet (reuniones). Responsive sí, mobile-first no.

3. **La tabla es el asset oculto:** MonthlyPerformanceTable con 6 vistas (Total/B2B/B2C/Martel/Wrangler/Lee) es la pieza más rica. Su selector de vistas es independiente de los filtros globales. Esto es valioso y debe destacarse.

---

## 5. Componentes TailAdmin auditados para el rediseño

| Componente | Uso recomendado | Razón |
|-----------|----------------|-------|
| `Card` (elevated) | Hero metric, insight card | Sombra eleva contenido primario |
| `Card` (default) | Scorecards secundarios | Consistencia sin competir |
| `Badge` | Tags en insight card | Semántica de status |
| `Tabs` | Toggle chart/table en mobile | Accesible, pattern conocido |
| `Tooltip` | Ayuda contextual en métricas | Info on-demand, sin ruido |
| `Skeleton` | Loading states | Perceived performance |
| `StatCard` | Métricas secundarias | Reutilizable, ya probado |
| `Section` | Separadores semánticos | Consistente con el resto de la app |

**NO usar:** Modal (sin confirmaciones), Dropdown UI (filtros son chips), Table genérico (tabla ejecutiva necesita diseño custom).

---

## 6. Métricas de calidad actual

| Dimensión | Score | Detalle |
|----------|-------|---------|
| Arquitectura | 9/10 | Impecable separación de capas |
| Performance | 9/10 | 0ms filter switch, <1s initial load |
| Accesibilidad | 7/10 | ARIA parcial en chart, sin skip-link, sin texturas |
| Jerarquía visual | 4/10 | Todo plano, sin North Star |
| Inteligencia | 2/10 | Solo datos, sin insights |
| Motion | 2/10 | Sin animaciones de entrada |
| Responsividad | 7/10 | Funcional pero no optimizada |
| Dark mode | 6/10 | Funcional, genérico |

**Score global:** 5.75/10 — Arquitectura excelente, presentación mediocre.

---

## 7. Conclusión

El Home Ejecutivo tiene una base técnica de primer nivel (hook, queries, domain logic, tests) pero una capa de presentación que no está a la altura. El rediseño debe ser EXCLUSIVAMENTE en la capa de UI — cero cambios en hooks, queries, o lógica de dominio. Se necesita:

1. Un componente hero con el desvío como North Star Metric
2. Insights automáticos calculados con datos existentes (funciones puras nuevas)
3. Filtros integrados en la página con jerarquía visual
4. Tabla siempre visible con diseño premium
5. Chart con texturas accesibles
6. Animaciones de entrada coordinadas
7. Eliminación de redundancias (objetivo repetido, QuickLinks)

**Archivos afectados:** Solo `src/features/executive/` + nuevos componentes + nuevas funciones puras en `src/domain/executive/`.

---

*Auditoría realizada sobre 365 tests passing, TSC 0 errors, Build OK.*
