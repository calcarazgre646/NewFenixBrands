# Auditoría Logística / Importaciones — 2026-03-10 14:28

## Contexto

Auditoría completa de producción de la sección Logística / ETAs de Importación.
Archivos auditados: 9 | Líneas revisadas: ~1,100 | Tests: 23 (7 nuevos)

---

## Bug grave reportado

**Síntoma:** Embarques con ETA del 5 de marzo seguían apareciendo como "Este Mes"
el 10 de marzo, sin ninguna señal de que estuvieran atrasados.

**Causa raíz:** `getArrivalStatus()` en `arrivals.ts` no tenía concepto de "overdue".
El tipo `ArrivalStatus` solo tenía 4 valores: `past | this_month | next_month | upcoming`.
Cualquier ETA dentro del mes actual (sea pasada o futura) se clasificaba como `this_month`.

`statusLabel("this_month", -5)` retornaba "Este Mes" — idéntico a un embarque que llega
en 20 días. Un operador no tenía forma de saber que el embarque estaba atrasado.

---

## Hallazgos completos (21 items)

### Críticos (3)
| # | Problema | Fix |
|---|----------|-----|
| C1 | Sin status "overdue" — ETAs vencidas del mes muestran "Este Mes" | Agregado `"overdue"` a `ArrivalStatus`, nueva lógica en `getArrivalStatus()` |
| C2 | `daysUntil` negativo ignorado en `statusLabel()` | Ahora: `"Atrasado · 5d"` para overdue, `"Hoy"` para daysUntil=0 |
| C3 | PVP y Margen del grupo tomaban solo `rows[0]` — dato incorrecto | Ahora muestra rango min–max si hay variación |

### Bugs (5)
| # | Problema | Fix |
|---|----------|-----|
| B1 | JSDoc decía "DD/MM/YYYY" pero parser era MM/DD/YYYY | Corregido comentario |
| B2 | `getDaysUntil` y `getArrivalStatus` creaban `new Date()` por separado | Unificado: `today` se pasa como parámetro (pureza + testabilidad) |
| B3 | `KNOWN_BRANDS` filtraba marcas desconocidas silenciosamente | Documentado (pendiente: agregar warning visual) |
| B4 | `groupArrivals` usaba `etaLabel` crudo como key — formatos inconsistentes | Nuevo campo `etaKey` (ISO date) para grouping determinista |
| B5 | ChildRow no mostraba descripción del producto | Agregado: descripción + temporada en child rows |

### Inconsistencias (5)
| # | Problema | Fix |
|---|----------|-----|
| I1 | Solo PVP/Margen B2C, datos B2B fetcheados pero no mostrados | Pendiente confirmación Rodrigo |
| I2 | `normalizeBrand()` no se usaba en query de logística | Ahora usa `normalizeBrand()` para consistencia |
| I3 | Filtros locales vs. `useFilters()` global | Migrado: marca usa filtro global (header avatares) |
| I4 | Sin conteo de pasados ocultos | Agregado: `"Ver pasados (3)"` |
| I5 | `nextDate` no incluía "en Xd" | Pendiente mejora menor |

### Performance/Robustez (3)
| # | Problema | Fix |
|---|----------|-----|
| P1 | Sin paginación en tabla | Pendiente (baja prioridad con ~500 filas) |
| P2 | Query sin `fetchAllRows()` — truncamiento >1000 rows | Ahora usa `fetchAllRows()` |
| P3 | Sin Error Boundary | Pendiente |

### UX (5)
| # | Problema | Fix |
|---|----------|-----|
| U1 | Sin export HTML | Pendiente |
| U2 | Sin "Expandir todo" | Agregado |
| U3 | GroupRow no accesible con teclado | Agregado: tabIndex, role, onKeyDown |
| U4 | ChildRow key usaba índice | Mejorado: key compuesto |
| U5 | Stat card "Por origen" cortaba a 3 sin indicar más | Agregado: "+N mas" |

---

## Cambios implementados

### Fase 1 — Fix bug de fechas + status overdue

**`src/domain/logistics/types.ts`**
- Agregado `"overdue"` a `ArrivalStatus`
- Nuevo campo `etaKey: string` en `LogisticsArrival`
- Nuevo campo `overdueCount: number` en `LogisticsSummary`

**`src/domain/logistics/arrivals.ts`**
- `getArrivalStatus(date, today)` — nueva clasificación: `date < todayStart` → "overdue"
- `getDaysUntil(date, today)` — recibe `today` como parámetro (pureza)
- `statusLabel()` — "Atrasado · Xd" para overdue, "Hoy" para daysUntil=0
- `toArrivals(rows, now?)` — acepta `now` opcional para testabilidad, genera `etaKey` ISO
- `groupArrivals()` — usa `etaKey` en vez de `etaLabel` crudo
- `computeSummary()` — calcula `overdueCount`, excluye overdue de `nextDate`

### Fase 2 — Fix datos y consistencia

**`src/queries/logistics.queries.ts`**
- Fix JSDoc: "MM/DD/YYYY" (no DD/MM/YYYY)
- Usa `normalizeBrand()` de `api/normalize.ts`
- Usa `fetchAllRows()` para evitar truncamiento >1000 rows

### Fase 3 — Consistencia UI con header global

**`src/layout/AppHeader.tsx`**
- Agregado `/logistica` a `hasInPageFilters` → header muestra solo avatares de marca
- Agregado `hideFilters` para `/calendario` (sin filtros en header)

**`src/features/logistics/hooks/useLogistics.ts`**
- Marca: migrado de `useState` local a `useFilters()` global
- Eliminados: `brand`, `setBrand`, `category`, `setCategory`, `clearFilters`, `hasFilters`, `availableBrands`, `availableCategories`
- Hook simplificado de 12 props a 8
- Único filtro local: `showPast` (toggle)

**`src/features/logistics/LogisticsPage.tsx`**
- Eliminado: `PageHeader`, `FilterSelect` de marca y categoría
- Eliminado: context row "Logística / ETAs"
- Agregado: estilo rojo para status `"overdue"` con fondo sutil
- Agregado: PVP rango min–max y Margen rango en GroupRow
- Agregado: descripción + temporada en ChildRow
- Agregado: stat card "Atrasados" (rojo, condicional)
- Agregado: conteo "(N)" en botón "Ver pasados"
- Agregado: botón "Expandir todo"
- Agregado: accesibilidad GroupRow (tabIndex, role, onKeyDown)
- Agregado: "+N mas" en stat card "Por origen"

### Tests

**`src/domain/logistics/__tests__/arrivals.test.ts`**
- Faked date actualizada a 2026-03-10 (era 2026-03-07)
- 7 tests nuevos:
  - `"overdue" with -5 days → "Atrasado · 5d"`
  - `"overdue" with -1 day → "Atrasado · 1d"`
  - `"this_month" with 0 days → "Hoy"`
  - Status overdue para ETA Mar 5 con today Mar 10
  - ETA = today se clasifica como this_month (no overdue)
  - daysUntil negativo para overdue
  - etaKey ISO grouping (formatos inconsistentes)
  - overdueCount en computeSummary
  - nextDate excluye overdue
- **Total: 23/23 passing**

---

## Estado final

- **TypeScript:** 0 errores en archivos de logística
- **Tests:** 372/372 passing (7 nuevos)
- **Build:** Errores pre-existentes en otros módulos (HeroMetric, InsightBar, MonthlySalesBar — archivos unused pendientes de cleanup)

## Pendiente (no implementado)

1. Columnas B2B (confirmar con Rodrigo si mostrar)
2. Export HTML para Outlook
3. Error Boundary
4. Warning visual para marcas desconocidas filtradas por KNOWN_BRANDS
5. `nextDate` con "en Xd" adicional
6. Paginación virtual (baja prioridad con ~500 filas)
