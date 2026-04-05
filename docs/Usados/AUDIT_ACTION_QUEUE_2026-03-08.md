# Auditoría Integral — Cola de Acciones v1

**Fecha:** 2026-03-08
**Auditor:** Claude Code (Opus 4.6)
**Alcance:** Feature completa ActionQueuePage — algoritmo, datos, UX, alineamiento con requisitos del cliente

---

## Resumen Ejecutivo

El sistema de Cola de Acciones **técnicamente funciona** — el algoritmo waterfall es correcto, los 4 niveles de prioridad operan bien, Pareto calcula correctamente, los tests cubren los caminos críticos. Pero **no resuelve el problema del cliente**: genera ~14,000 acciones sin filtro de ruido, sin agrupación, sin selección, y sin vista operativa que diga "hoy hacé ESTO".

**Veredicto:** Algoritmo sólido, UX inadecuada para uso operativo real.

---

## 1. Archivos Auditados

| Archivo | Líneas | Rol |
|---------|--------|-----|
| `src/domain/actionQueue/waterfall.ts` | 413 | Algoritmo puro (4 niveles waterfall) |
| `src/domain/actionQueue/clusters.ts` | 71 | Clusters, horarios, cover weeks |
| `src/domain/actionQueue/types.ts` | ~80 | Tipos: ActionItem, InventoryRecord, etc. |
| `src/domain/actionQueue/__tests__/waterfall.test.ts` | ~400 | 23 tests |
| `src/features/action-queue/ActionQueuePage.tsx` | 279 | Página principal |
| `src/features/action-queue/hooks/useActionQueue.ts` | 196 | Hook orquestador |
| `src/features/action-queue/components/ActionQueueTable.tsx` | ~300 | Tabla 13 columnas |
| `src/features/action-queue/components/exportHtml.ts` | ~200 | Export HTML Outlook-compatible |
| `src/queries/inventory.queries.ts` | ~150 | Fetch mv_stock_tienda |
| `src/queries/salesHistory.queries.ts` | ~100 | Fetch promedio 6m por tienda+SKU |

---

## 2. Algoritmo Waterfall — Evaluación Técnica

### Lo que está bien

- **Separación por zona**: b2c/b2b/RETAILS/STOCK correcta
- **Agrupación por (SKU, Talle)**: key `"sku|||talle"` es determinista
- **4 niveles de prioridad**: N1 store↔store → N2 depot→store → N3 central→depot → N4 central→B2B
- **Pareto independiente del sort**: copia por impacto, flag, mapea de vuelta a sort por riesgo
- **Sort determinista**: risk → units → impact → sku → talle → store
- **Deduplicación N3**: solo 1 acción central_to_depot por SKU+Talle
- **Cover weeks por marca**: 24 sem importado, 12 sem nacional
- **Pure function**: sin React, sin side effects, testeable
- **23 tests** cubren caminos críticos

### Hallazgos

#### H1: Sin threshold mínimo de impacto (CRÍTICO-UX)
**Archivo:** `waterfall.ts:217-223`
```typescript
if (qty === 0 || qty <= MIN_STOCK_ABS) {
  need = Math.round(Math.max(avgQty - qty, MIN_STOCK_ABS));
}
```
Cualquier tienda con 0-3 unidades genera acción. Mover 3 unidades de un SKU de Gs. 50,000 = Gs. 150,000 de impacto. Esto genera miles de acciones de bajo valor que entierran las acciones importantes.

#### H2: avgQty cross-store es fallback inflado (MEDIO)
**Archivo:** `waterfall.ts:191-192`
```typescript
const avgQty = stores.length > 0 ? totalQty / stores.length : 0;
```
El promedio se calcula solo sobre las tiendas que TIENEN stock de ese SKU, no sobre las 20 tiendas totales. Si un SKU está en 2 tiendas con 50 y 50 unidades, avgQty=50. Una tercera tienda con 0 genera need=50, lo cual es excesivo. Con historial de ventas esto se mitiga, pero sin historial es un problema.

#### H3: `_idCounter` módulo-level mutable (BAJO)
**Archivo:** `waterfall.ts:53-56`
En StrictMode de React, el hook puede ejecutar el memo 2x → counter se incrementa sin resetear. No causa bugs visibles pero es un leak conceptual.

#### H4: Surplus allocation hardcoded 40%/60% (MEDIO)
**Archivo:** `waterfall.ts:332-333`
El 40% de excedente se reasigna, 60% queda para liquidación. Sin constantes nombradas ni posibilidad de ajuste.

#### H5: N3 no lista tiendas beneficiarias (DISEÑO)
**Archivo:** `waterfall.ts:323`
El texto dice "para cubrir N tiendas" pero no lista cuáles son esas tiendas. El operador no sabe a quiénes beneficia el movimiento STOCK→RETAILS.

#### H6: Sin cap por assortment de tienda (FALTANTE)
El algoritmo no conoce la capacidad máxima de cada tienda. Puede generar acciones que excedan el espacio físico del local.

#### H7: Sin consideración de price mix por cluster (FALTANTE)
Cluster A = 100% precio normal, B = 57/43, OUT = 40/60 outlet. El algoritmo no considera esto al recomendar movimientos — podría enviar producto full-price a un outlet.

---

## 3. Discrepancias de Datos vs Imágenes del Cliente

### 3.1 Clusters

**Imagen del cliente (13 tiendas):**
| Tienda | Cluster | Assortment | M2 | Tipo |
|--------|---------|------------|-----|------|
| GALERIAWRLEE | A | 3,000 | 86 | Wrangler |
| MARTELMCAL | A | 5,500 | 519 | Multibrand |
| SHOPMCAL | A | — | 40 | Multibrand |
| SHOPPINEDO | A | 4,000 | 103 | Multibrand |
| WRSSL | A | 3,000 | 110 | Wrangler |
| WRMULTIPLAZA | A | 2,000 | 60 | Wrangler |
| WRPINEDO | A | 3,500 | 130 | Wrangler |
| CERROALTO | B | 3,000 | 119 | Multibrand |
| ESTRELLA | B | 3,000 | 245 | Multibrand |
| MARTELSSL | B | 3,300 | 120 | Multibrand |
| SHOPMARIANO | B | 2,500 | 82 | Multibrand |
| TOLUQ | B | 5,500 | 286 | Multibrand |
| TOSUR | OUT | 5,500 | 173 | Multibrand |

**Código actual (21 tiendas):**
- Cluster A: 6 (GALERIAWRLEE, MARTELMCAL, SHOPMCAL, SHOPPINEDO, WRSSL, WRPINEDO) + WRMULTIPLAZA bajo comentario B pero valor A
- Cluster B: 12 (CERROALTO, ESTRELLA, MARTELSSL, SHOPMARIANO, TOLUQ, PASEOLAMB, TOLAMB, SHOPSANLO, LARURAL, MVMORRA, SHOPFUENTE)
- Cluster OUT: 3 (TOSUR, FERIA, LUQ-OUTLET)

**Discrepancias:**
1. WRMULTIPLAZA: valor correcto (`"A"`) pero bajo comentario `// Cluster B` — confuso
2. 8 tiendas en código NO están en la imagen del cliente: PASEOLAMB, TOLAMB, SHOPSANLO, LARURAL, MVMORRA, SHOPFUENTE, FERIA, LUQ-OUTLET
3. Assortment capacity (unidades por tienda) NO implementado en código
4. M2 y tipo de tienda NO implementados
5. Price mix por cluster NO implementado

### 3.2 Horarios

**Imagen del cliente (12 tiendas):**
| # | Tienda | Horario (imagen) | Horario (código) | Match |
|---|--------|-----------------|-----------------|-------|
| 1 | CERROALTO | Sin restricción, optimizar ruta, antes 10am | "Antes de las 10am" | Parcial |
| 2 | ESTRELLA | Sin restricción, optimizar ruta | "Sin restricción" | Parcial |
| 3 | GALERIAWRLEE | Lun-Vie antes 10am | "Lun–Vie 10am" | OK |
| 4 | MARTELMCAL | Sin restricción, optimizar ruta | "Sin restricción" | Parcial |
| 5 | MARTELSSL | Lun-Vie antes 9am; 12-17hrs | "Lun–Vie 9am / 12–17hs" | OK |
| 6 | SHOPMARIANO | Lun-Vie antes 9am; 12-17hrs | "Lun–Vie 9am / 12–17hs" | OK |
| 7 | SHOPMCAL | Lun-Vie antes 9am; 15-17hrs | "Lun–Vie 9am / 15–17hs" | OK |
| 8 | SHOPPINEDO | Lun-Vie antes 9am; 12-17hrs | "Lun–Vie 9am / 12–17hs" | OK |
| 9 | WRSSL | Lun-Vie antes 9am; 12-17hrs | "Lun–Vie 9am / 12–17hs" | OK |
| 10 | TOSUR | Sin restricción, optimizar ruta | "Sin restricción" | Parcial |
| 11 | TOLUQ | Sin restricción, optimizar ruta | "Sin restricción" | Parcial |
| 12 | WRMULTIPLAZA | Lun-Vie antes 9am | "Lun–Vie 9am" | OK |

**Nota:** SHOPSANLO tiene horario en código ("Lun–Vie 9am / 12–17hs") pero NO aparece en la imagen del cliente. Origen del dato sin verificar.

---

## 4. GAP Analysis: Sistema Actual vs Necesidad del Cliente

| Requisito (chat + Excel SISO) | Estado | Detalle |
|-------------------------------|--------|---------|
| Priorizar "reponer" crítico | ✅ | Sort por risk (critical primero) |
| Luego volumen | ✅ | Segundo criterio: suggestedUnits desc |
| Pareto 20/80 | ✅ | Implementado correctamente |
| Filtro por tienda | ✅ | FilterSelect funcional |
| Filtro por marca | ✅ | FilterSelect funcional |
| Filtro por categoría | ✅ | FilterSelect funcional |
| Filtro por línea | ✅ | FilterSelect funcional |
| Horarios de tienda | ✅ | Columna visible |
| Clusters A/B/OUT | ✅ | Badge visible |
| Export HTML | ✅ | Outlook-compatible |
| **Agrupación por tienda** | ❌ | Lista plana de filas |
| **Agrupación por marca** | ❌ | Solo filtro, no agrupación |
| **Agrupación por categoría** | ❌ | Solo filtro, no agrupación |
| **Threshold mínimo impacto** | ❌ | Todo desbalance genera acción |
| **Vista Pareto por defecto** | ❌ | Pareto es un flag, no un filtro default |
| **Selección de acciones** | ❌ | Sin checkboxes |
| **Export selectivo** | ❌ | Todo o nada |
| **Dashboard resumen accionable** | ❌ | Solo 6 StatCards numéricas |
| **Assortment capacity** | ❌ | No implementado |
| **Price mix por cluster** | ❌ | No implementado |
| **SISO model integration** | ❌ | No usa datos del modelo SISO |

---

## 5. Evaluación UX

### Problema central
14,000 acciones / 50 por página = 280 páginas. Nadie va a scrollear 280 páginas. El Pareto reduce a ~3,000 pero sigue siendo 60 páginas sin agrupación.

### Lo que el usuario ve hoy
1. Header con toggle B2C/B2B
2. Barra de filtros (marca, línea, categoría, tienda)
3. 6 StatCards (total, SKUs únicos, Pareto, sin stock, stock bajo, sobrestock)
4. Tabla plana de 50 filas con 13 columnas
5. Paginación

### Lo que debería ver
1. Dashboard con 3-4 cards accionables ("3 tiendas necesitan reposición URGENTE")
2. Selector de vista (por tienda / por marca / por categoría / lista plana)
3. Cards colapsables agrupadas con stats por grupo
4. Checkboxes para selección
5. Barra flotante de acciones (exportar seleccionadas)

---

## 6. Tests — Cobertura del Algoritmo

| Test | Cubre | Estado |
|------|-------|--------|
| Empty inventory → empty | Edge case | ✅ |
| Balanced stock → no actions | Lógica base | ✅ |
| N1 store↔store | Nivel 1 | ✅ |
| N2 depot→store | Nivel 2 | ✅ |
| N3 central→depot | Nivel 3 | ✅ |
| N4 central→B2B | Nivel 4 | ✅ |
| Brand/store/linea/categoria filter | Filtros | ✅ |
| Sort order deterministic | Ordering | ✅ |
| Pareto flagging 80% | Pareto | ✅ |
| No artificial limit | Paginación | ✅ |
| Sales history drives deficit | Historial | ✅ |
| Cover weeks Wrangler/Martel | Negocio | ✅ |
| **Threshold mínimo** | **No existe** | ❌ GAP |
| **Assortment cap** | **No existe** | ❌ GAP |
| **Price mix filter** | **No existe** | ❌ GAP |

---

## 7. Conclusión

El algoritmo waterfall es **técnicamente correcto y bien testeado**. La arquitectura es limpia — domain puro, hook orquestador, componentes de solo UI. El problema no es el código, es que el producto no resuelve la necesidad operativa del cliente:

1. **Demasiado ruido** — sin threshold mínimo
2. **Sin agrupación** — lista plana innavegable
3. **Sin accionabilidad** — no se puede seleccionar ni enviar
4. **Sin contexto** — no dice "hoy hacé esto"

El plan de remediación (ver `PLAN_ACTION_QUEUE_V2.md`) aborda cada gap en 5 fases priorizadas.
