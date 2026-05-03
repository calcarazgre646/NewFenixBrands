# Lógica inversa exhibición↔depósito — Análisis de sesión 2026-05-03

**Estado:** Análisis cerrado. **Implementación bloqueada** esperando datos del cliente.
**Pedido del cliente:** Audio de Rodrigo del 17/03 — *"Descontar de exhibición las ventas. Misma lógica waterfall pero inversa. Depende de capacidad física de tiendas."*
**Ticket en Basecamp:** "Lógica inversa exhibición↔depósito" (sin comentarios al 03/05/2026).
**Branch propuesta:** `feat/inverse-waterfall-exhibition` (no creada todavía).

---

## 1. Interpretación del pedido

Rodrigo describe **el espejo del waterfall actual**:

- **Hoy** el sistema detecta déficit de stock por tienda y propone reposiciones desde nodos superiores: tienda↔tienda (N1) ← RETAILS (N2) ← STOCK (N3) ← B2B (N4). Lógica empujada por **objetivo de cobertura**.
- **Lo que pide** es la cadena al revés, disparada por **eventos de venta**: una venta en tienda decrementa **exhibición** (lo visible al cliente), y se dispara reposición exhibición ← back-stock de tienda ← RETAILS ← STOCK, **gateada por la capacidad física** de la exhibición de cada tienda (no podés meter más en piso de lo que el planograma permite).

La capa "Palantir-like" pedida en abstracción (sistema lo más inteligente posible) implica:

- **Estado vivo** de exhibición por (tienda, sku, talle).
- **Trazabilidad evento → acción**: cada movimiento sugerido tiene la(s) venta(s) origen.
- **Vista única operativa** de exhibición vs back-stock vs cascada en curso.
- **Planograma editable** como contrato de capacidad.

---

## 2. Estado del codebase hoy (auditoría)

### 2.1 Waterfall existente

| Pieza | Path |
|---|---|
| Algoritmo puro (4 niveles) | `src/domain/actionQueue/waterfall.ts` (`computeActionQueue`) |
| Tipos | `src/domain/actionQueue/types.ts` (`InventoryRecord`, `ActionItem`, `WaterfallLevel`) |
| Orquestador | `src/features/action-queue/hooks/useActionQueue.ts` |
| Agrupación post-waterfall | `src/domain/actionQueue/grouping.ts` |
| Planificación de compra | `src/domain/actionQueue/purchasePlanning.ts` |
| Tests | `src/domain/actionQueue/__tests__/waterfall.test.ts` (116 tests) |

Niveles: **N1** tienda↔tienda, **N2** RETAILS→tienda retail, **N3** STOCK→RETAILS, **N4** STOCK→B2B directo.

### 2.2 Gap de datos crítico

> **El ERP no distingue exhibición vs depósito dentro de la tienda.** Todo el stock local de una tienda es un único pool en `mv_stock_tienda` / `fjdexisemp`. Solo hay 2 depósitos centrales identificados por nombre: `STOCK` (nacional) y `RETAILS` (puente retail).

Esto significa que el feature requiere **modelar exhibición virtualmente** porque el ERP no la entrega.

### 2.3 Capacidad física: parcial

- `STORE_ASSORTMENT: Record<string, number>` en `src/domain/actionQueue/clusters.ts:51` — **12 tiendas** con capacidad bruta (unidades totales).
- `config_store.assortment` (BD auth) — fallback a STORE_ASSORTMENT, sembrado en `sql/014_config_seed_etapa5.sql`.
- **No existe** segregación exhibición vs total, ni planograma por categoría/m²/slots.
- 29 tiendas sin capacidad definida.

### 2.4 Tablas relevantes (read-only operacionales)

| Tabla | Filas | Uso para esta feature |
|---|---|---|
| `fjdhstvta1` | 252K+ | Ventas detalle (sku×talle×tienda×día) — input al algoritmo inverso |
| `mv_stock_tienda` | 5K-10K | Stock por (store, sku, talle) — pool actual sin segregar |
| `mv_ventas_12m_por_tienda_sku` | 8K-15K | Histórico para suavizar ventas atípicas |
| `Dim_maestro_comercial` | ~50K | Metadata SKU (rubro, talla, sku_comercial) |
| `config_store` | 41 | Cluster + assortment (capacidad bruta hoy) |

### 2.5 UI existente para inventario

| Ruta | Archivo | Reutilizable para esta feature |
|---|---|---|
| `/depositos` | `src/features/depots/DepotsPage.tsx` | Patrón visual (cards por tienda, WOI, riesgo, novedades) |
| `/acciones` | `src/features/action-queue/ActionQueuePage.tsx` | Patrón de tickets (`ActionCard`) — base para `InverseActionCard` |
| `/calendario/evento/:id` | `src/features/calendar/EventDashboardPage.tsx` | Patrón Operational App (Palantir-like ya existente: scorecard + widgets + closed-loop) |

Filtros globales unificados (PR #54, sesión 2026-05-03) en `<GlobalFilters>` del `AppHeader`. Cada vista declara soporte vía `<DeclareViewFilters support={...}>`.

### 2.6 Tests

Vitest, env=node (sin jsdom). Patrón: lógica pura en `domain/`, tests unitarios densos. Componentes UI sin tests directos — extraer helpers puros.

---

## 3. Scope propuesto

### 3.1 MVP (este PR)

1. **Modelo de datos**: tabla `store_exhibition_target` (planograma editable) + columna `exhibition_capacity` en `config_store`.
2. **Algoritmo "waterfall inverso"** (`src/domain/actionQueue/waterfallSales.ts`, puro): input = ventas del período, output = cadena de acciones de reposición ordenadas exhibición ← back-stock ← RETAILS ← STOCK, gateadas por capacidad.
3. **Estado virtual derivado**: `current_exhibition = min(store_pool, exhibition_target)`; `current_back_stock = store_pool - current_exhibition`.
4. **Vista `/exhibicion`** (o tab dentro de `/depositos`): por tienda, exhibición vs back-stock vs central, con la cola de acciones inversas que generaron las ventas del período. Filtros globales (Marca/Canal/Período).
5. **Trazabilidad**: cada acción con `reason: "sale_event:{store,sku,date,units}"` (Palantir-like).
6. **Tests**: suite paralela a `waterfall.test.ts` con casos invertidos.

### 3.2 Fuera de scope (PR posteriores)

- Edición masiva de planograma vía CSV.
- Forecast de tiempo a vacío de exhibición.
- Auto-aprobación de movimientos exhibición↔back-stock.
- Planograma segmentado por categoría/m².
- Notificaciones email al manager de tienda cuando exhibición rota >X%.

---

## 4. Datos a crear/tocar

```
NUEVAS (BD auth uxtzzcjimvapjpkeruwb)
  store_exhibition_target  (store_code, sku, talle, target_units, updated_at, updated_by)
  ALTER config_store ADD COLUMN exhibition_capacity int NULL
  RLS: read autenticados, write super_user + gerencia

LECTURA (operacional gwzllatcxxrizxtslkeh, read-only)
  fjdhstvta1                — ventas detalle (input al algoritmo)
  mv_stock_tienda           — stock por (store, sku, talle)
  Dim_maestro_comercial     — metadata SKU
  config_store              — capacidad y cluster

DERIVADAS EN MEMORIA (no persistidas, derivadas en domain layer)
  exhibition_state{ store, sku, talle, exhibition_units, back_stock_units, target, capacity_left }
  inverse_action{ from_node, to_node, units, level (4→3→2→1 invertido), trigger_sale_id, reason }
```

---

## 5. Dónde vive cada cosa

| Cosa | Path |
|---|---|
| Tipos waterfall extendidos | `src/domain/actionQueue/types.ts` (extender) |
| Tipos exhibición | `src/domain/exhibition/types.ts` (nuevo) |
| Cálculo estado exhibición (puro) | `src/domain/exhibition/state.ts` |
| Algoritmo waterfall inverso (puro) | `src/domain/actionQueue/waterfallSales.ts` |
| Config (planograma defaults, ratio fallback) | `src/domain/config/{types,defaults,loader,schemas}.ts` (extender) |
| Queries | `src/queries/exhibition.queries.ts` |
| Hook orquestador | `src/features/exhibition/hooks/useExhibitionWaterfall.ts` |
| Página | `src/features/exhibition/ExhibitionPage.tsx` |
| Componentes | `ExhibitionVsBackStockTable`, `InverseActionTimeline`, `PlanogramEditor` (read-only en MVP) |
| SQL | `sql/015_exhibition_planogram.sql` (próximo número libre) |
| Tests | `src/domain/exhibition/__tests__/state.test.ts`, `src/domain/actionQueue/__tests__/waterfallSales.test.ts` |

---

## 6. UX/UI

Una sola página `/exhibicion`, tres bloques verticales (lenguaje visual reusado de `/depositos` y `/calendario/evento/:id`):

1. **Header sticky**: filtros globales (Marca/Canal/Período) declarados vía `DeclareViewFilters` + KPIs:
   - SKUs con exhibición rota
   - % capacidad ocupada (red)
   - Ventas del período
   - Acciones pendientes

2. **Grid por tienda** (cards expandibles, mismo patrón que `/depositos`):
   - Bar bipolar exhibición/back-stock por SKU con marca de target
   - Anillo de capacidad usada vs total
   - Acciones inversas pendientes con timestamp de la venta que las disparó

3. **Drawer de acción** (al click sobre cualquier acción): trace completo evento → exhibición rota → ruta de reposición sugerida nivel a nivel, con units disponibles en cada nodo y razón por la que se eligió ese origen. Esto es lo que cumple la abstracción "Palantir": la trazabilidad clickeable de la decisión.

Editor de planograma: en MVP, vista read-only inline (botón "editar" deshabilitado con tooltip "PR2"). Persistencia de target ya queda lista en BD.

---

## 7. Plan de implementación (6 fases, cada una commit-eable)

| Fase | Entregable | Tests | Riesgo |
|---|---|---|---|
| **F1** Modelo de datos | `sql/015_*.sql` con `store_exhibition_target` + `config_store.exhibition_capacity` + RLS + seeds defaults | smoke SQL | bajo |
| **F2** Domain puro: estado exhibición | `src/domain/exhibition/state.ts` con `deriveExhibitionState(stockRows, targets, capacity)` | unit tests (8-12 casos) | bajo |
| **F3** Domain puro: waterfall inverso | `src/domain/actionQueue/waterfallSales.ts` con `computeSalesWaterfall(sales, exhibitionState, inventory, config)` | suite paralela ≥30 casos | medio |
| **F4** Queries + hook | `exhibition.queries.ts` + `useExhibitionWaterfall.ts` | mocks de query | bajo |
| **F5** UI página + componentes | `/exhibicion` + 3 componentes + drawer trace | smoke render-less por extracción a helpers (recordar: NewFenix no tiene jsdom) | medio |
| **F6** Wiring + docs | Ruta en router, link en sidebar, sesión en `docs/`, `DECLARE_VIEW_FILTERS` | typecheck + lint + tests verdes | bajo |

---

## 8. Bloqueos del cliente (qué necesitamos antes de F1)

Las 4 decisiones de producto que **bloquean** el inicio:

### 8.1 Granularidad del planograma
**Pregunta:** ¿el target de exhibición se define a nivel `(store, sku)` o `(store, sku, talle)`?
**Recomendación nuestra:** Empezar por `(store, sku)` (menos filas, más manejable). Desglosar a talle en PR2 si hace falta.

### 8.2 Default cuando no hay planograma cargado
**Pregunta:** Cuando la tienda no tiene `target_units` definido para un SKU, ¿qué asumimos?
**Recomendación nuestra:** Ratio config-able con default **0.30** del stock local de ese SKU en esa tienda. Trackeable en `app_params` (`exhibition:default_ratio`).

### 8.3 Capacidad de exhibición vs assortment total
**Pregunta:** Para las 12 tiendas con assortment hoy, ¿asumimos `exhibition_capacity = assortment × 0.4` y dejamos `null` para el resto? ¿O esperamos a que carguen las 41?
**Recomendación nuestra:** Arrancar con default `0.4 × assortment` para las 12 que tienen, y mostrar las otras 29 con badge "capacidad pendiente" en UI hasta que se carguen.

### 8.4 Ventana de ventas que dispara el waterfall inverso
**Pregunta:** ¿el algoritmo lo corre el cliente sobre el período del filtro global (análisis histórico) o sobre las últimas N horas (modo vivo)?
**Recomendación nuestra:** Soportar ambos modos con un toggle "modo vivo: últimas 24h" arriba de la página. Default = período del filtro global.

### 8.5 Datos físicos faltantes (operativos)

**Lo que necesitamos del cliente para que el sistema sea fiel:**

1. **Planograma o conteo físico de exhibición por tienda.** Ideal: lista `(tienda, sku_comercial, target_units)`. Mínimo: porcentaje aproximado por tienda que se considera "en piso" vs "back-stock" para arrancar con un default educado.
2. **Capacidad física de exhibición** para las 41 tiendas (o al menos las 29 faltantes). Puede ser unidades totales en piso, m² de exhibición, o cantidad de slots/perchas. Cualquiera de las tres sirve si nos dicen cómo convertir a unidades.
3. **Confirmación de las 4 decisiones del bloque 8.1-8.4**.

---

## 9. Pendientes documentales actualizados

- Esta sesión añade entrada a `docs/PENDING_CLIENT.md` (próximo apartado: "Lógica inversa exhibición/depósito — datos físicos").
- Cuando se desbloquee, sesión de implementación se documenta como `docs/SESION_YYYY-MM-DD_INVERSE_WATERFALL.md` siguiendo convención.

---

## 10. Verificación pre-trabajo (estado del repo en esta sesión)

```
Branch:   main
Status:   limpio, sincronizado con origin/main (commit 75f8532)
PRs:      ninguno abierto
Tests:    1841 passing (66 suites)
Listo para nueva rama cuando se desbloquee el cliente.
```
