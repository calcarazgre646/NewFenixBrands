# Rediseño V2 — Home Ejecutivo

**Fecha:** 2026-03-08
**Base:** Auditoría `AUDIT_EXECUTIVE_HOME_2026-03-08.md`
**Principio rector:** "Glanceable Intelligence" — 3 segundos para saber si el negocio va bien o mal.

---

## Autocrítica del Rediseño V1

| Decisión V1 | Problema | Corrección V2 |
|-------------|----------|---------------|
| 5 zonas verticales | Demasiado scroll. Un ejecutivo no hace scroll. | 2 tiers: Command Center (above fold) + Temporal Detail (below fold) |
| Chart + Table side-by-side | Correcto en desktop pero forzaba layout rígido | Mantener side-by-side desktop, tabs en mobile. Ratio 55/45. |
| Insight Card como zona separada | Rompía el flujo cognitivo del hero | Insights INTEGRADOS en el Command Center, debajo de scorecards |
| Filtros "Context Bar sticky" | Sticky = complejidad CSS sin valor. La página cabe en 1 viewport. | Filtros integrados en el header del Command Center, no sticky |
| Eliminar QuickLinks completamente | Perdía el "¿qué hago ahora?" post-lectura | Reducir a una fila compacta de iconos al final, no cards grandes |
| Proponer font adicional (JetBrains Mono) | Agrega peso de carga y rompe consistencia | Outfit con tabular-nums + tracking tight. El impacto viene del SIZE, no del font. |

---

## Principios de diseño V2

### 1. "The 3-Second Test"
El CEO abre la página. En 3 segundos responde: ¿vamos bien o mal? ¿por cuánto?
- **Segundo 1:** Color del hero (verde/rojo) → bien/mal
- **Segundo 2:** Número del hero → por cuánto (%)
- **Segundo 3:** Barra de progreso → dónde estamos en el año

### 2. "Data-Ink Maximalism"
Cada pixel comunica. Cero ornamento sin función.
- El objetivo anual aparece UNA vez (en la barra de progreso)
- El YTD aparece UNA vez (en el hero context line)
- El pronóstico aparece UNA vez (en su scorecard)

### 3. "Progressive Disclosure, Not Progressive Hiding"
- Above the fold: diagnóstico (status + causa)
- Below the fold: evidencia (chart + tabla)
- La tabla NO está colapsada. Es contenido, no detalle oculto.

### 4. "Filter as Context, Not as Control"
Los filtros no son un panel de control separado. Son el TÍTULO del dashboard.
"Dashboard de Martel · B2C · YTD" — no "Dashboard (con filtro Martel activo)"

### 5. "Instant Feels Instant"
Cambiar filtro = 0ms de API. El UI debe REFLEJAR esto:
- No mostrar skeleton/spinner al cambiar filtro
- Transición suave de números (CSS transition en opacity)
- El chart re-dibuja con animación suave (ApexCharts `animateOnDataChange`)

---

## Estructura V2: 2 Tiers

### TIER 1: COMMAND CENTER (Above the fold, ~65% viewport)

```
┌──────────────────────────────────────────────────────────────────┐
│  ┌──────────────────────────────────────────────────────────┐    │
│  │  CONTEXT LINE                                             │    │
│  │  [●Todas] [●Martel] [●Wrangler] [●Lee]   B2B|B2C|Total  │    │
│  │                                                YTD ▾     │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │  HERO CARD (elevated, subtle gradient bg)                 │    │
│  │                                                           │    │
│  │     Adelantado al ritmo lineal                            │    │
│  │     +3.8%                  ← 48px, bold, green            │    │
│  │     ₲ 2.640M por encima del pace ideal                    │    │
│  │                                                           │    │
│  │  ████████████████████████░░░░  64.2%  →  Fcst: 103.8%    │    │
│  │  ₲ 44.8B de ₲ 69.9B            │     8 meses restantes   │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                   │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐        │
│  │ Pronóstico│ │  Brecha   │ │ Run-Rate  │ │ YoY Δ     │        │
│  │ Cierre    │ │ vs Target │ │ Requerido │ │ vs 2025   │        │
│  │ ₲ 72.5B   │ │+₲ 2.6B   │ │ ₲ 3.1B/m  │ │ +12.4%    │        │
│  │ ▴ 4.2%    │ │ Superado  │ │ en 8 meses│ │ ▴ vs PY   │        │
│  └───────────┘ └───────────┘ └───────────┘ └───────────┘        │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │  INSIGHTS (subtle, left-border colored)                    │   │
│  │  ▲ Wrangler cumple al 102% del ritmo (+₲ 1.2B)           │    │
│  │  ▼ Martel B2C cayó 15% vs presupuesto este mes (−₲ 4.8B) │    │
│  │  — Lee estable: alineada al 99% del pace                  │    │
│  └──────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────┘
```

### TIER 2: TEMPORAL ANALYSIS (Below fold, scroll-to)

```
┌──────────────────────────────────────────────────────────────────┐
│  Evolución Anual                                                  │
│  ┌─────────────────────────────────┬────────────────────────────┐│
│  │  AREA CHART (55%)               │  MONTHLY TABLE (45%)       ││
│  │  12 meses cumulative            │  12 filas, 6 cols          ││
│  │  3 series:                      │  Vista: [Total] B2B B2C   ││
│  │    — Real (solid blue)          │         Martel Wrangler Lee││
│  │    — Forecast (dotted blue)     │                            ││
│  │    — Target (dashed amber)      │  [tabla completa, no       ││
│  │  + "Hoy" annotation             │   colapsada]               ││
│  │  + markers en cada mes          │                            ││
│  └─────────────────────────────────┴────────────────────────────┘│
│                                                                   │
│  ── Accesos Rápidos ──────────────────────────────────────────── │
│  [📊 KPIs] [📈 Ventas] [📦 Acciones] [🚢 Logística] [📅 Cal.] │
└──────────────────────────────────────────────────────────────────┘
```

---

## Decisiones de diseño justificadas

### D1: Hero Metric = Desvío porcentual (no absoluto)

**Por qué:** El % comunica salud relativa. El CEO no sabe de memoria si ₲ 2.640M es mucho o poco. Pero "+3.8%" o "-10.2%" es instantáneamente interpretable.

**Implementación:**
- `linearPaceGap` / `annualTarget` × 100 = desvío%
- Si positivo (adelantado): success-600, flecha arriba
- Si negativo (atrasado): error-600, flecha abajo
- Font: Outfit 48px bold, tracking-tight
- Debajo: contexto en Gs absolutos (₲ X.XXXM de diferencia)

### D2: Progress bar integrada en Hero Card (no Card separada)

**Por qué V1 fallaba:** Progress bar como Card independiente = espacio vertical consumido para 16px de altura. Desperdicio.

**V2:** La barra vive DENTRO del Hero Card, debajo del número. Es contexto visual del hero, no un elemento independiente.

**Visual mejorado:**
- Barra con gradiente sutil (brand-400 → brand-500)
- Porción de forecast: mismo color pero 40% opacidad
- Debajo: "₲ 44.8B de ₲ 69.9B" a la izquierda, "8 meses restantes" a la derecha
- El target aparece UNA sola vez aquí.

### D3: Scorecards con jerarquía visual diferenciada

**Por qué V1 fallaba:** "3 niveles" era burocrático. En realidad son 4 cards con 2 niveles: accionables vs contextuales.

**V2 — 2 niveles:**
- **Accionables (2):** Pronóstico Cierre + Brecha vs Target — border más grueso, font value más grande
- **Contextuales (2):** Run-Rate Requerido + YoY — border normal, font value estándar

**Visual:** Las 4 cards van en una fila. Las 2 primeras tienen `border-l-4` con color semántico (success/error según estado). Las 2 últimas tienen border normal gris.

### D4: Insights automáticos como componente (NO hardcoded)

**Por qué es posible SIN datos nuevos:**
Con `fetchMonthlySalesWide` + `fetchBudget` ya tenemos ventas y presupuesto por marca × canal × mes. Podemos calcular:
1. Performance de cada marca vs su presupuesto (ranking)
2. Contribución de cada marca al gap total (attribution)
3. Tendencia del mes actual vs mes anterior (momentum)

**Nueva función pura en `domain/executive/insights.ts`:**
```typescript
interface Insight {
  brand: BrandCanonical;
  channel?: "B2B" | "B2C";
  type: "outperforming" | "underperforming" | "stable";
  metric: number;       // % vs presupuesto
  impact: number;       // contribución absoluta al gap
  label: string;        // texto pre-formateado
}

function generateInsights(
  salesByBrandChannel: Map<string, number>,
  budgetByBrandChannel: Map<string, number>,
  limit: number = 3,
): Insight[]
```

**Regla:** Máximo 3 insights. Ordenados por impacto absoluto descendente. El primero es siempre el mayor contribuyente positivo o negativo.

### D5: Filtros como "Context Header" del Command Center

**Layout:**
```
[● Todas] [● Martel] [● Wrangler] [● Lee]     B2B | B2C | Total     YTD ▾
 └─────── Nivel 1: Entidad ────────┘     └── Nivel 2: Canal ──┘  └─ N3 ─┘
```

**Visual:**
- Nivel 1 (Marca): Chips con dot de color de marca. El activo tiene bg-color + text-white.
- Nivel 2 (Canal): Segmented control (border group). Compacto.
- Nivel 3 (Período): Dropdown discreto (no pills). Es el menos cambiado.

**Por qué no pills para todo:** Los pills planos (V1 FilterBar) hacen que todo pese igual. El dropdown para período comunica: "esto cambia raramente, el default es YTD".

### D6: Chart mejorado (accesibilidad + claridad)

**Cambios vs actual:**
1. Forecast: `dashArray: [4, 4]` (dotted) en vez de solid. Diferencia de textura, no solo color.
2. Target: `dashArray: [8, 4]` (dashed largo). Diferente de forecast.
3. Markers visibles (size: 3) en meses con datos reales. Distingue "dato real" de "interpolación".
4. Y-axis: formato compacto pero con sufijo "B" para billones (₲ 10B, ₲ 20B...).
5. Annotation "Hoy" con línea vertical + label.
6. Grid: solo horizontales, color más sutil.

### D7: Tabla siempre visible, diseño compacto

**Cambios vs actual:**
1. NO colapsada. `open = true` siempre.
2. Sin botón de colapsar.
3. Header del selector de vistas: parte del título de la sección, no un botón separado.
4. Filas más compactas: `py-2.5` en vez de `py-3.5`.
5. Totals row: sticky bottom en scroll.
6. El mes actual tiene highlight sutil (left border warning-400).

### D8: QuickLinks como fila compacta (no cards)

**V1 actual:** 5 cards de ~80px cada una. Total: ~400px de height.
**V2:** Una fila de 5 items inline. Cada item: icono + texto, ~40px total.

```
── Módulos ──────────────────────────────────────────────────────
📊 KPIs    📈 Ventas    📦 Acciones    🚢 Logística    📅 Calendario
```

**Por qué no eliminar:** El sidebar puede estar cerrado (mobile, o preferencia). Los links dan orientación de "¿qué más puedo explorar?".

### D9: Animaciones de entrada (staggered reveal)

**Sequence:**
1. 0ms: Context filters fade in
2. 100ms: Hero card slides up + fade in
3. 250ms: Progress bar animates from 0 → value
4. 350ms: Scorecards stagger in (50ms between each)
5. 550ms: Insights slide in from left (50ms stagger)
6. Below fold: chart + table animate on scroll-into-view

**Implementación:** CSS `@keyframes` + `animation-delay` via Tailwind arbitrary values. No librería adicional.

### D10: Transiciones de filtro (no recarga)

Cuando el usuario cambia filtro:
- Números: `transition: opacity 150ms, transform 150ms` → fade down old, fade up new
- Chart: ApexCharts `animations.dynamicAnimation.enabled: true`
- Progress bar: `transition: width 400ms ease-out`
- Insights: recalcular + fade in nuevos

---

## Archivos a crear/modificar

### Nuevos:
| Archivo | Propósito | Líneas est. |
|---------|-----------|-------------|
| `src/domain/executive/insights.ts` | Funciones puras: generateInsights, rankBrands | ~80 |
| `src/domain/executive/__tests__/insights.test.ts` | Tests de insights | ~60 |
| `src/features/executive/components/HeroMetric.tsx` | Semáforo central con progress bar | ~100 |
| `src/features/executive/components/InsightBar.tsx` | Barra de insights automáticos | ~60 |
| `src/features/executive/components/ExecutiveFilters.tsx` | Filtros in-page con jerarquía | ~80 |

### Modificar:
| Archivo | Cambio |
|---------|--------|
| `src/features/executive/ExecutivePage.tsx` | Rewrite completo del JSX. Mismas props de `useExecutiveData`. |
| `src/features/executive/hooks/useExecutiveData.ts` | Agregar: `insights`, `brandPerformance` al return. |
| `src/features/executive/components/MonthlyPerformanceTable.tsx` | Remover colapso. Compactar padding. Mejorar vista selector. |
| `src/components/ui/stat-card/StatCard.tsx` | Agregar variante `"accent"` con border-left coloreado. |

### NO tocar:
- `src/domain/executive/calcs.ts` — funciones existentes quedan intactas
- `src/queries/*` — zero cambios en queries
- `src/context/FilterContext.tsx` — API de filtros no cambia
- `src/api/*` — normalización no cambia

---

## Prototipo visual

Ver archivo: `docs/prototype-executive-v2.html`
Abrir en navegador para ver el diseño completo con animaciones.

---

## Orden de implementación

1. `insights.ts` + tests → Lógica pura primero (testeable aisladamente)
2. `HeroMetric.tsx` → Centro visual del dashboard
3. `InsightBar.tsx` → Diferenciador clave
4. `ExecutiveFilters.tsx` → Embudo de contexto in-page
5. `StatCard.tsx` → Agregar variante accent
6. `useExecutiveData.ts` → Agregar insights al return
7. `MonthlyPerformanceTable.tsx` → Pulir visual
8. `ExecutivePage.tsx` → Composición final
9. Animaciones CSS en `index.css`
10. Tests de integración visual (manual)

**Estimación: ~600 líneas nuevas, ~400 líneas modificadas.**
**Zero cambios en queries, domain logic existente, o tests existentes.**
