# Arquitectura — NewFenixBrands

## Problema que resuelve esta arquitectura

El proyecto viejo (FenixBrands) tenía:
- Queries Supabase mezcladas dentro de componentes React
- Lógica de negocio duplicada en 5+ lugares (ej: `resolveActiveMonths` copy-pasted)
- 0 tests → cambiar una fórmula rompía cosas silenciosamente
- Tipos implícitos (`any` en todas partes)
- Strings mágicos "b2c", "total", "ytd" dispersos sin tipado

Este proyecto resuelve todo eso con capas separadas.

---

## Capas de la arquitectura

```
┌─────────────────────────────────────────┐
│           FEATURES / PAGES              │  src/features/[feature]/
│   (UI únicamente — sin lógica)          │
├─────────────────────────────────────────┤
│              HOOKS                      │  src/features/[feature]/hooks/
│   (unen queries + domain + filtros)     │
├─────────────────────────────────────────┤
│            QUERIES                      │  src/queries/
│   (fetch + normalización, sin React)    │
├─────────────────────────────────────────┤
│           DOMAIN LOGIC                  │  src/domain/
│   (cálculos puros, tipos, reglas)       │
├─────────────────────────────────────────┤
│        API / NORMALIZACIÓN              │  src/api/
│   (frontera ERP→app)                    │
└─────────────────────────────────────────┘
```

### Regla de dependencias
- Features pueden importar hooks, queries, domain, api
- Hooks pueden importar queries, domain, api, context
- Queries pueden importar api, domain (solo types)
- Domain: sin dependencias externas (funciones puras)
- **NUNCA al revés** (domain no importa hooks, queries no importan hooks)

---

## Contextos (providers en main.tsx)

```
ThemeProvider
  QueryClientProvider (TanStack Query)
    AuthProvider (Supabase Auth)
      FilterProvider (filtros globales)
        SidebarProvider
          App (Router)
```

### FilterContext — el más importante
```typescript
const { filters, setBrand, setChannel, setPeriod, setYear, setStore } = useFilters()
// filters: { brand, channel, period, year, store }
// Al cambiar filters → TanStack Query refetch automático (via query keys)
```

**Nunca crear estado local de filtros en páginas.** Todo pasa por `useFilters()`.

---

## Patrón de un Hook de Feature

Ejemplo para `useSalesSummary`:

```typescript
// src/features/kpis/hooks/useSalesSummary.ts
import { useQuery } from '@tanstack/react-query'
import { useFilters } from '@/context/FilterContext'
import { resolvePeriod } from '@/domain/period/resolve'
import { fetchMonthlySales, fetchPriorYearMonthlySales } from '@/queries/sales.queries'
import { calcGrossMargin, calcYoY } from '@/domain/kpis/calculations'
import { salesKeys } from '@/queries/keys'

export function useSalesSummary() {
  const { filters } = useFilters()

  // 1. Resolver qué meses usar para el período seleccionado
  // monthsInDB: array de meses que tienen datos en la BD
  // (para YTD en Marzo: si monthsInDB=[1,2,3] → activeMonths=[1,2])
  // NOTA: monthsInDB viene de una query separada (fetchAvailableMonths)
  // o se puede hardcodear temporalmente con los meses hasta el actual

  // 2. Query con TanStack Query
  const salesQuery = useQuery({
    queryKey: salesKeys.monthly(filters),
    queryFn: () => fetchMonthlySales(filters),
  })

  const priorQuery = useQuery({
    queryKey: salesKeys.priorYear(filters),
    queryFn: () => fetchPriorYearMonthlySales(filters),
  })

  // 3. Computar KPIs con domain logic
  const currentNeto = salesQuery.data?.reduce((s, r) => s + r.neto, 0) ?? 0
  const priorNeto   = priorQuery.data?.reduce((s, r) => s + r.neto, 0) ?? 0
  const currentCogs = salesQuery.data?.reduce((s, r) => s + r.cogs, 0) ?? 0

  return {
    isLoading: salesQuery.isLoading || priorQuery.isLoading,
    neto:        currentNeto,
    yoyPct:      calcYoY(currentNeto, priorNeto),
    grossMargin: calcGrossMargin(currentNeto, currentCogs),
  }
}
```

---

## Query Keys (src/queries/keys.ts)

Las keys incluyen los filtros → cuando cambian los filtros, TanStack Query refetch automático.

```typescript
salesKeys.monthly(filters)           // ['sales', 'monthly', filters]
salesKeys.priorYear(filters)         // ['sales', 'priorYear', filters]
salesKeys.dailyDetail(filters, months)
salesKeys.brandBreakdown(filters, months)
inventoryKeys.list(filters)
inventoryKeys.value(filters)
budgetKeys.annual(year)
ticketKeys.monthly(filters)
storeKeys.list()
storeKeys.goals(year)
logisticsKeys.imports()
```

---

## resolvePeriod() — Fuente de verdad de períodos

**SIEMPRE usar esta función para determinar qué meses mostrar.**

```typescript
import { resolvePeriod } from '@/domain/period/resolve'

// monthsInDB = meses con datos en la BD para ese año
// Obtenerlos de una query: SELECT DISTINCT v_mes FROM mv_ventas_mensual WHERE v_año = year
const resolved = resolvePeriod(filters.period, monthsInDB, filters.year)

resolved.activeMonths   // [1, 2] — meses a usar en queries
resolved.closedMonths   // [1, 2] — para YoY simétrico
resolved.isPartial      // true si hay datos del mes actual en BD
resolved.label          // "Ene–Feb 2026" o "Mar 2026 ⚠"
resolved.calendarMonth  // 3 (Marzo)
resolved.calendarDay    // 4
```

**Regla:** No usar `closedMonths` para calcular YoY cuando se muestra `currentMonth`.
`closedMonths` es vacío para `currentMonth` — usar `activeMonths` directamente.

---

## Normalización de datos del ERP

Todos los datos del ERP llegan con problemas. Están resueltos en `api/normalize.ts`:

| Problema | Función | Ejemplo |
|----------|---------|---------|
| Padding espacios | `cleanStr()` / `trimStr()` | `"ESTRELLA   "` → `"ESTRELLA"` |
| Placeholder "." | `cleanStr()` | `"."` → `null` |
| Float como entero | `toInt()` | `2026.0` → `2026` |
| Monto paraguayo | `parsePYGString()` | `"6.263.380"` → `6263380` |
| Monto USD | `parseUSDString()` | `"$68,450.00"` → `68450` |
| Fecha DD/MM/YYYY | `parseDDMMYYYY()` | `"04/03/2026"` → `Date` |
| Marca con sub-marcas | `normalizeBrand()` | `"Martel Premium"` → `"Martel"` |
| Clasificación tienda | `classifyStore()` | `"MAYORISTA"` → `"b2b"` |

Las queries ya aplican estas funciones. **No re-aplicar en componentes.**

---

## Dos clientes Supabase

```typescript
import { dataClient } from '@/api/client'  // BD operacional (ventas, inventario, KPIs)
import { authClient } from '@/api/client'  // BD de la app (usuarios, calendario)
```

- `dataClient` → `gwzllatcxxrizxtslkeh.supabase.co` (BD del cliente FenixBrands)
- `authClient` → `uxtzzcjimvapjpkeruwb.supabase.co` (instancia auth de la app)

**Nunca importar `@supabase/supabase-js` directamente. Siempre usar estos clients.**

---

## Tablas Supabase disponibles (BD operacional)

| Tabla | Contenido | Rows aprox | Uso |
|-------|-----------|-----------|-----|
| `mv_ventas_mensual` | Ventas agrupadas por mes/marca/tienda | ~15K | KPIs, gráficos |
| `fjdhstvta1` | Detalle diario por SKU/talle | 250K+ | Devoluciones, Top SKUs, DOW |
| `fjdexisemp` | Inventario por SKU/talle/tienda | 54K | Cola de acciones, GMROI |
| `Import` | Importaciones logística | ~500 | Página logística |
| `Budget_2026` | Presupuesto 2026 en Gs. | ~500 | vs Budget |
| `vw_ticket_promedio_diario` | AOV por día/tienda | ~10K | Ticket promedio |
| `fintsucu` | Catálogo de tiendas | ~30 | Dropdown tiendas |
| `fmetasucu` | Metas por tienda/mes | ~300 | vs Meta |

**⚠️ NO usar `v_inventario`** — tiene JOIN cartesiano (429K filas vs 54K reales). Usar `fjdexisemp` directamente.

---

## Convenciones de código

- **Nombres de archivos:** `camelCase.ts` para utilidades, `PascalCase.tsx` para componentes
- **Hooks:** prefijo `use`, retornan `{ data, isLoading, error }` o KPIs calculados
- **Tipos de resultado de queries:** exportados desde el archivo de query (`MonthlySalesRow`, etc.)
- **Comentarios:** solo donde la lógica no es evidente. Sin comentarios obvios.
- **Errores de query:** `throw new Error(\`fetchXxx: \${error.message}\`)` — TanStack Query los captura
- **Formateo de moneda Gs:** `Intl.NumberFormat('es-PY', { style: 'currency', currency: 'PYG' })`
- **Formateo de %:** número con 1 decimal + `%` (ej: `"40.2%"`)

---

## Tests

```bash
npm test          # modo watch
npm run test:coverage  # cobertura
```

Tests existentes (82 en total):
- `src/api/__tests__/normalize.test.ts`
- `src/domain/kpis/__tests__/calculations.test.ts`
- `src/domain/period/__tests__/resolve.test.ts`

Al agregar nueva lógica de dominio, agregar tests.

---

## Ejecutar el proyecto

```bash
cd /Users/prueba/Downloads/NewFenixBrands
npm run dev        # http://localhost:5173
npm run typecheck  # 0 errores esperados
npm test           # 82 tests pasan
npm run build      # build de producción
```

Credenciales Supabase ya configuradas en `.env.local`.
Login: mismas credenciales del FenixBrands anterior.
