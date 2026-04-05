# Próximas Features — Spec de Implementación

## Orden de prioridad

1. **KpiDashboardPage** — `/kpis` — Grid de KPIs con datos reales
2. **ExecutivePage** — `/` — Home ejecutivo con KPIs top + gráfico
3. **SalesPage** — `/ventas` — Análisis de ventas detallado
4. **ActionQueuePage** — `/acciones` — Cola de acciones waterfall
5. LogisticsPage, CalendarPage (menor urgencia)

---

## PRIORIDAD 1: KpiDashboardPage

**Archivo:** `src/features/kpis/KpiDashboardPage.tsx` (actualmente stub 🚧)

### Qué debe mostrar

Grid de 9 tarjetas KPI. Cada tarjeta muestra:
- Valor actual (formateado según tipo)
- Variación YoY en % con flecha ▲▼
- Label del período (de `resolvePeriod().label`)
- Estado: verde/rojo según si está bien o mal

### Los 9 KPIs (orden de prioridad)

| # | KPI | Fuente | Cálculo |
|---|-----|--------|---------|
| 1 | Ventas Netas | mv_ventas_mensual | `SUM(neto)` del período |
| 2 | YoY Ventas | mv_ventas_mensual | `calcYoY(neto_actual, neto_previo)` |
| 3 | Margen Bruto % | mv_ventas_mensual | `calcGrossMargin(neto, cogs)` |
| 4 | Dependencia de Ofertas | mv_ventas_mensual | `calcMarkdownDependency(dcto, bruto)` |
| 5 | Mix B2B % | mv_ventas_mensual | `fetchChannelMix` → pct del B2B |
| 6 | Tasa de Devoluciones | fjdhstvta1 | `calcReturnsRate(absNeg, pos)` |
| 7 | Ticket Promedio (AOV) | vw_ticket_promedio_diario | `calcAOV(totalSales, totalTickets)` |
| 8 | Rotación de Inventario | fjdexisemp + mv_ventas_mensual | `calcInventoryTurnover(cogs, invValue, months)` |
| 9 | vs Presupuesto % | Budget_2026 + mv_ventas_mensual | `calcYoY(neto_actual, budget_revenue)` |

### Paso a paso de implementación

#### 1. Crear hook principal

**Archivo:** `src/features/kpis/hooks/useSalesSummary.ts`

```typescript
import { useQuery } from '@tanstack/react-query'
import { useFilters } from '@/context/FilterContext'
import { resolvePeriod } from '@/domain/period/resolve'
import { fetchMonthlySales, fetchPriorYearMonthlySales } from '@/queries/sales.queries'
import { calcGrossMargin, calcYoY, calcMarkdownDependency } from '@/domain/kpis/calculations'
import { salesKeys } from '@/queries/keys'

export function useSalesSummary() {
  const { filters } = useFilters()

  // IMPORTANTE: necesitás los meses disponibles en la BD para resolvePeriod().
  // Estrategia simple para empezar: calcular manualmente los meses disponibles
  // hasta el mes cerrado actual. Ejemplo: si calendarMonth=3 → [1, 2]
  // Estrategia correcta (futura): query SELECT DISTINCT v_mes FROM mv_ventas_mensual WHERE v_año = year
  const calendarMonth = new Date().getMonth() + 1
  const monthsInDB = Array.from({ length: calendarMonth }, (_, i) => i + 1)
  const resolved = resolvePeriod(filters.period, monthsInDB, filters.year)

  const currQuery = useQuery({
    queryKey: salesKeys.monthly(filters),
    queryFn: () => fetchMonthlySales(filters),
  })

  const prevQuery = useQuery({
    queryKey: salesKeys.priorYear(filters),
    queryFn: () => fetchPriorYearMonthlySales(filters),
  })

  // Filtrar solo los meses activos del período
  const curr = (currQuery.data ?? []).filter(r => resolved.activeMonths.includes(r.month))
  const prev = (prevQuery.data ?? []).filter(r => resolved.activeMonths.includes(r.month))

  const neto      = curr.reduce((s, r) => s + r.neto, 0)
  const cogs      = curr.reduce((s, r) => s + r.cogs, 0)
  const bruto     = curr.reduce((s, r) => s + r.bruto, 0)
  const dcto      = curr.reduce((s, r) => s + r.dcto, 0)
  const prevNeto  = prev.reduce((s, r) => s + r.neto, 0)

  return {
    isLoading:    currQuery.isLoading || prevQuery.isLoading,
    periodLabel:  resolved.label,
    isPartial:    resolved.isPartial,
    neto,
    yoyPct:       calcYoY(neto, prevNeto),
    grossMargin:  calcGrossMargin(neto, cogs),
    markdownPct:  calcMarkdownDependency(dcto, bruto),
  }
}
```

#### 2. Crear hook para devoluciones

**Archivo:** `src/features/kpis/hooks/useReturnsRate.ts`

```typescript
// Necesita fetchDailyDetail para separar ventas positivas de negativas
import { fetchDailyDetail } from '@/queries/sales.queries'
import { calcReturnsRate } from '@/domain/kpis/calculations'

// Las devoluciones son filas con neto < 0 en fjdhstvta1
// absNegativeSales = Math.abs(SUM(neto) donde neto < 0)
// positiveSales = SUM(neto) donde neto > 0
```

#### 3. Crear componente KpiCard

**Archivo:** `src/features/kpis/components/KpiCard.tsx`

Propiedades sugeridas:
```typescript
interface KpiCardProps {
  title: string
  value: string          // ya formateado: "₲ 6.263.380" o "40.2%"
  yoyPct?: number        // calcYoY() result → mostrar con ▲▼ y color
  period: string         // resolved.label → "Ene–Feb 2026"
  isLoading?: boolean
  isPartial?: boolean    // mostrar ⚠ en la card si datos incompletos
  trend?: 'up' | 'down' | 'neutral'
  positiveDirection?: 'up' | 'down'  // para saber si "up" es bueno o malo
}
```

#### 4. Implementar KpiDashboardPage

```typescript
// src/features/kpis/KpiDashboardPage.tsx
import { useSalesSummary } from './hooks/useSalesSummary'
import KpiCard from './components/KpiCard'
import { formatPYG, formatPct } from '@/utils/format'

export default function KpiDashboardPage() {
  const sales = useSalesSummary()
  // const returns = useReturnsRate()
  // const inventory = useInventorySummary()
  // etc.

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        Dashboard KPIs
      </h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        <KpiCard
          title="Ventas Netas"
          value={formatPYG(sales.neto)}
          yoyPct={sales.yoyPct}
          period={sales.periodLabel}
          isLoading={sales.isLoading}
          positiveDirection="up"
        />
        <KpiCard
          title="Margen Bruto"
          value={formatPct(sales.grossMargin)}
          period={sales.periodLabel}
          isLoading={sales.isLoading}
          positiveDirection="up"
        />
        {/* ... más cards */}
      </div>
    </div>
  )
}
```

### Utilidades de formateo disponibles

Ver `src/utils/format.ts`. Si no tienen formatPYG y formatPct, crearlas ahí:

```typescript
// Guaraníes sin decimales con separador de miles
export function formatPYG(value: number): string {
  return new Intl.NumberFormat('es-PY', {
    style: 'currency', currency: 'PYG',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(value)
}

export function formatPct(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`
}

export function formatYoY(pct: number): string {
  const sign = pct >= 0 ? '+' : ''
  return `${sign}${pct.toFixed(1)}%`
}
```

---

## PRIORIDAD 2: ExecutivePage

**Archivo:** `src/features/executive/ExecutivePage.tsx`

Debe mostrar:
1. **Fila superior:** 3-4 KPIs principales (Ventas, Margen, YoY) — puede reutilizar `useSalesSummary`
2. **Gráfico de evolución mensual** — barras o líneas por mes del año
3. **Breakdown por marca** — usar `fetchBrandBreakdown`
4. **Mix B2B/B2C** — usar `fetchChannelMix`

Para el gráfico, el proyecto tiene `apexcharts` + `react-apexcharts` instalados.

---

## PRIORIDAD 3: SalesPage

**Archivo:** `src/features/sales/SalesPage.tsx`

Debe mostrar:
1. KPIs principales del período seleccionado
2. Gráfico de evolución mensual (neto por mes)
3. Tabla de ventas por tienda (ordenable)
4. Breakdown por marca
5. Top 20 SKUs — usar `fetchTopSkus`
6. Mix B2B/B2C — usar `fetchChannelMix`
7. Selector de tienda (contextual al canal)

---

## PRIORIDAD 4: ActionQueuePage

Esta es la más compleja. Requiere el algoritmo waterfall.

**Archivos domain relevantes:**
- `src/domain/actionQueue/types.ts` — tipos completos del algoritmo
- `src/domain/actionQueue/clusters.ts` — mapa de tiendas por cluster (A/B/OUT)

**Algoritmo waterfall (Spec Rodrigo):**
1. Para cada SKU+talle con `classifyStockRisk(coverageDays, leadTime) === 'critical'`
2. Buscar tiendas del mismo cluster con stock excedente (`'overstock'`)
3. Sugerir transferencia store→store
4. Si no hay → buscar en depósito
5. Calcular `impactScore = suggestedUnits × price × (1 + margin × 0.3)`
6. Ordenar por impactScore desc (Pareto: top 20% = 80% del impacto)

**Queries necesarias:**
- `fetchInventory(filters)` → `src/queries/inventory.queries.ts`
- `fetchSalesHistory(filters)` → `src/queries/salesHistory.queries.ts`
- `fetchStores()` → para mapear cosupc→cosujd

---

## Patrones de UI a usar (Tailwind v4)

El proyecto usa TailAdmin 2.1.0 como base. Clases disponibles:

```
// Cards
rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-5 shadow-sm

// Headings
text-2xl font-bold text-gray-900 dark:text-white
text-sm font-medium text-gray-500 dark:text-gray-400

// KPI value
text-3xl font-bold text-gray-900 dark:text-white

// Positive trend
text-green-600 dark:text-green-400

// Negative trend
text-red-500 dark:text-red-400

// Brand colors
bg-brand-500 text-white   (botones activos, filtros activos)
text-brand-500            (links, accents)
```

**Importar componentes UI ya existentes:**
```typescript
import { Button } from '@/components/ui/button/Button'
// Modal, Table, Badge, Avatar, etc. en src/components/ui/
```

---

## Referencia al proyecto viejo

Antes de mirar el viejo: ver `docs/OLD_PROJECT_REFERENCE.md`.

**Lo que SÍ se puede tomar del viejo:**
- Diseño visual de las cards KPI
- Lógica de negocio que no esté ya en calculations.ts
- Thresholds de KPIs (ej: ¿qué % de margen es "bueno"?)

**Lo que NO se debe copiar del viejo:**
- Queries mezcladas en componentes
- useState para cachear datos de Supabase
- Lógica duplicada de períodos
- Cualquier función "resolveActiveMonths" o similar
