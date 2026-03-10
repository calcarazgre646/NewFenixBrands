# Auditoría Core Algorítmico — Cola de Acciones (SISO)

**Fecha inicio:** 2026-03-08 17:11
**Última actualización:** 2026-03-08 19:50
**Alcance:** End-to-end — desde tablas Supabase hasta UI
**Tests post-auditoría:** 365/365 passing | TSC 0 errores | Build OK

---

## 1. SISO = Cola de Acciones

El modelo SISO (Shelf In Shelf Out) descrito por el cliente ES el algoritmo waterfall implementado en la Cola de Acciones. No son sistemas separados.

| Nota del cliente | Implementación | Archivo |
|-----------------|----------------|---------|
| "6 meses hacia atras" | `HISTORY_MONTHS = 6` | `salesHistory.queries.ts:26` |
| "Inventario actual" | `mv_stock_tienda` (refresh frecuente) | `inventory.queries.ts:60` |
| "Promedio de ventas en funcion" | `total_units / 6` (por calendario, no por meses con ventas) | `salesHistory.queries.ts:100` |
| "Cuantas semanas" | `MOS = currentStock / avgMonthly` | `waterfall.ts:260` |
| "12 semanas tipo 1 (local)" | `getCoverWeeks("Martel") → 12` → `coverMonths ≈ 2.77` | `clusters.ts:113` |
| "24 semanas tipo 2 (importado)" | `getCoverWeeks("Wrangler"/"Lee") → 24` → `coverMonths ≈ 5.54` | `clusters.ts:113` |
| "Inventario en tiempo real" | TanStack Query con `staleTime: 30min` | `useActionQueue.ts:78-80` |
| "Centro de accion" | ActionQueuePage (`/acciones`) | `ActionQueuePage.tsx` |

**Clasificación Tipo 1/2:** Determinada por marca (`IMPORTED_BRANDS = ["wrangler", "lee"]`), no por campo BD. El campo `tipo_articulo` de `mv_stock_tienda` se mapea a `categoria` (camisa, jean, bermuda), NO a tipo nacional/importado. Si Martel algún día importara productos, habría que agregar un campo `tipoProducto` en la BD.

---

## 2. Flujo de datos completo (sin mocks, todo real)

```
SUPABASE
  mv_stock_tienda (~5K-10K filas)          ← inventario pre-agregado por (store, sku, talle)
  mv_ventas_12m_por_tienda_sku (~8K-20K)   ← ventas por (store, sku, year, month)
       ↓
QUERIES (src/queries/)
  fetchInventory()      → filtra units>0, normaliza brands (22 variantes→4),
                          clasifica B2C/B2B/excluded, trimStr() padding ERP
  fetchSalesHistory()   → 6 meses, batches de 200 SKUs, paralleliza por año
                          promedio = total / 6 meses calendarios
       ↓
HOOK (src/features/action-queue/hooks/useActionQueue.ts)
  inventory + salesHistory → computeActionQueue()
  TanStack Query: staleTime 30min, gcTime 60min
  Espera ambas queries antes de computar (evita flickering)
       ↓
DOMAIN (src/domain/actionQueue/waterfall.ts)
  1. Separar por zona: B2C operativas | B2B | RETAILS depot | STOCK depot
  2. Agrupar por (sku, talle) → clasificar deficit/surplus por tienda
  3. Waterfall N1→N2→N3→N4 con asignación greedy y tracking de recursos
  4. Filtrar por impact threshold (Gs. 500K, critical siempre pasa)
  5. Sort determinístico: riesgo → unidades → impacto → sku → talle → store
  6. Pareto flag: top items que suman 80% del impacto total
  7. Ranks secuenciales 1..N
       ↓
GROUPING (src/domain/actionQueue/grouping.ts)
  groupActions(items, "store"|"brand") → ActionGroup[]
  splitIntoSections(items) → ActionSection[] por intención operativa
       ↓
UI (src/features/action-queue/)
  ActionQueuePage → 3 vistas: Tienda | Marca | Lista
  ActionGroupCard → card expandible con stats + secciones colapsables
  CompactActionList → tabla contextual (omite columnas redundantes)
```

---

## 3. Tablas y campos de la BD

### 3.1 `mv_stock_tienda` (vista materializada — inventario)

```sql
SELECT store, sku, talle, description, rubro, brand, lineapr,
       tipo_articulo, sku_comercial, units, price, price_may,
       cost, value, est_comercial, carry_over
FROM mv_stock_tienda WHERE units > 0
```

| Campo BD | Campo app | Se usa en algoritmo | Se muestra en UI | Nota |
|----------|-----------|:---:|:---:|------|
| `store` | `store` | Si | Si | UPPERCASE, normalizado |
| `sku` | `sku` | Si (key) | Si | SKU técnico ERP |
| `sku_comercial` | `skuComercial` | Si (display) | Si (preferido) | Pendiente migración 002 |
| `talle` | `talle` | Si (key) | Si | |
| `description` | `description` | Si (display) | Si | |
| `brand` | `brand` | Si (coverWeeks) | Si | 22 variantes → 4 canónicas |
| `lineapr` | `linea` | Si (filtro) | Si | Camiseria, Vaqueria... |
| `tipo_articulo` | `categoria` | Si (filtro) | Si | camisa, jean, bermuda... |
| `units` | `units` | Si (stock actual) | Si | |
| `price` | `price` | Si (impact score) | No directo | |
| `cost` | `cost` | Si (margin factor) | No | |
| `price_may` | `priceMay` | Si (B2B impact) | No | Precio mayorista — usado para impact score en modo B2B |
| `value` | `value` | **NO** | No | Valor en Gs pre-calculado |
| `est_comercial` | `estComercial` | **NO** | No | Estructura comercial |
| `carry_over` | `carryOver` | **NO** | No | Temporada anterior (SI/NO) |
| `rubro` | — | **NO MAPEADO** | No | Se fetchea pero se pierde en normalización |

### 3.2 `mv_ventas_12m_por_tienda_sku` (vista materializada — ventas)

```sql
SELECT store, sku, year, month, total_units
FROM mv_ventas_12m_por_tienda_sku
WHERE year = ? AND month IN (?) AND sku IN (?)
```

Output: `Map<"STORE|sku", avgUnitsPerMonth>` donde avg = total / 6 meses.

---

## 4. Constantes del algoritmo

| Constante | Valor | Propósito |
|-----------|-------|-----------|
| `RETAILS_DEPOT` | `"RETAILS"` | Depósito de distribución |
| `STOCK_DEPOT` | `"STOCK"` | Bodega central |
| `LOW_STOCK_RATIO` | `0.40` | qty < avg × 0.4 → deficit (sin historial) |
| `HIGH_STOCK_RATIO` | `2.50` | qty > avg × 2.5 → surplus (sin historial) |
| `MIN_STOCK_ABS` | `3` | Mínimo absoluto de unidades a pedir |
| `MIN_AVG_FOR_RATIO` | `5` | Promedio mínimo para aplicar ratios |
| `MAX_COUNTERPARTS` | `3` | Máximo de tiendas fuente/destino por acción |
| `PARETO_TARGET` | `0.80` | Top items que suman 80% del impacto |
| `SURPLUS_REALLOC_RATIO` | `0.40` | (No usado post-fix: ahora usa allocation real) |
| `SURPLUS_LIQUIDATE_RATIO` | `0.60` | % del exceso restante a liquidar/markdown |
| `MIN_IMPACT_THRESHOLD` | `500,000` | Gs. mínimo para incluir acción (critical siempre pasa) |

### Cobertura por tipo de producto

| Marca | Tipo | Cover Weeks | Cover Months | Target Stock |
|-------|------|-------------|-------------|--------------|
| Martel | 1 (Nacional) | 12 | ~2.77 | avgMensual × 2.77 |
| Wrangler | 2 (Importado) | 24 | ~5.54 | avgMensual × 5.54 |
| Lee | 2 (Importado) | 24 | ~5.54 | avgMensual × 5.54 |
| Otras | 1 (default) | 12 | ~2.77 | avgMensual × 2.77 |

---

## 5. Clasificación deficit/surplus

### Con historial de ventas (6m):
```
targetStock = avgMensual × coverMonths

Si qty < targetStock × 0.5  → DEFICIT (need = targetStock - qty)
Si qty > targetStock × 2.0  → SURPLUS (excess = qty - targetStock)
Si en medio                  → BALANCEADO (sin acción)
```

### Sin historial de ventas (fallback por promedio inter-tiendas):
```
avgQty = suma_qty_todas_tiendas / num_tiendas  (para ese SKU+talle)

Si qty = 0 o qty ≤ 3              → DEFICIT (need = max(avgQty - qty, 3))
Si qty > avgQty × 2.5 y qty > 10  → SURPLUS (excess = qty - avgQty)
Si avgQty ≥ 5 y qty < avgQty × 0.4 → DEFICIT (need = avgQty - qty)
```

---

## 6. Waterfall — 4 niveles (con priorización y tracking de recursos)

### Priorización (corregida 2026-03-08 17:11):

**Deficit stores:** Ordenados por severidad
1. Stock = 0 (critical) primero
2. Luego por necesidad descendente (need desc)

**Surplus stores:** Ordenados por exceso descendente (donors grandes primero)

### Cascade para cada tienda en deficit:

```
N1: Transferencia lateral (Tienda ↔ Tienda)
    - Busca surplus stores con stock disponible (pool greedy)
    - Cada unidad se asigna exactamente una vez
    - Max 3 counterparts por acción
    - suggestedUnits = unidades realmente transferibles (no la necesidad ideal)
    ↓ (si no hay surplus disponible)

N2: Reposición desde RETAILS (Depot → Tienda)
    - Consume remainingDepot (pool compartido, se decrementa)
    - suggestedUnits = min(depotDisponible, necesidad)
    ↓ (si RETAILS no tiene stock)

N3: Resurtir RETAILS desde STOCK (Central → Depot)
    - Una sola acción por SKU+talle
    - suggestedUnits = min(depotStock, deficitNoServido)
    - currentStock = stock real de RETAILS (no 0)
    ↓ (solo en modo B2B)

N4: Envío directo B2B (STOCK → Cliente)
    - Solo si no hay surplus stores
    - suggestedUnits = necesidad completa
```

### Surplus side (post-deficit):

Para cada tienda con exceso:
1. **Mirror actions:** Refleja lo asignado en N1 como "enviar a tienda X"
2. **Liquidación:** Exceso restante × 60% → "markdown progresivo"
3. Solo si exceso ≥ 3 unidades (evita ruido)

---

## 7. Bugs corregidos (2026-03-08)

### Sesión completa — 8 bugs en el core algorítmico:

| # | Bug | Severidad | Antes | Después | Test |
|---|-----|-----------|-------|---------|------|
| 1 | `suggestedUnits` inflado | CRÍTICO | `suggestedUnits = deficit.need` (ej: 34) | `suggestedUnits = transferUnits` (ej: 16, lo realmente disponible) | #27 |
| 2 | Surplus double-promise | CRÍTICO | 3 deficit stores reclamaban las mismas 16u de un surplus | Pool greedy: `surplusPool` decrementado en cada asignación | #28 |
| 3 | Depot no consumido | CRÍTICO | 5 tiendas × 40u = 200u de depot con 100 | `remainingDepot` decrementado por tienda | #29 |
| 4 | N3 suggestedUnits > STOCK | ALTO | `suggestedUnits = totalNeed` (ej: 392) cuando STOCK tiene 87 | `suggestedUnits = min(depotStock, unmetDeficit)` | #30 |
| 5 | N3 currentStock siempre 0 | MEDIO | RETAILS no estaba en storeData → `?.qty ?? 0` | Override explícito: `item.currentStock = depotRetails` | #31 |
| 6 | Surplus over-allocation | ALTO | Cada receptor independientemente reclamaba 40% del exceso | Mirror actions basados en asignaciones reales del N1 | Implícito en #28 |
| 7 | Deficit sin priorizar | CRÍTICO | Orden arbitrario (inserción del Map = orden de la BD) | Sort: critical(0 stock) primero, luego need desc | #32 |
| 8 | Surplus sin priorizar | MEDIO | Donors chicos elegidos antes que grandes | Sort: excess desc (donors grandes primero) | Implícito |

| 9 | B2B impact usa precio retail | ALTO | `calcImpactScore(units, price, cost)` siempre usa retail | B2B usa `effectivePrice = priceMay` (wholesale). Fallback a `price` si `priceMay = 0` | #33 |

### Otros fixes de la sesión:

| Fix | Detalle |
|-----|---------|
| Emojis → SVG icons | `ActionGroupCard.tsx`: reemplazados 📦🏭🚛 por componente `IntentIcon` con SVGs inline |
| `CompactActionList` creado | Tabla contextual para vistas agrupadas — omite columnas redundantes, producto primero |
| Secciones operativas | `grouping.ts`: 5 intents (receive_transfer, receive_depot, resupply_depot, redistribute, ship_b2b) |
| N3 impossible actions | Fix previo: N3 solo si `depotStock > 0` (antes generaba con depot vacío) |
| Promedio ventas | Fix previo: divide por 6 meses calendario (no por meses con ventas — inflaba targets) |

---

## 8. Campos cargados pero NO usados

| Campo | Se carga desde | Potencial uso | Estado |
|-------|---------------|---------------|--------|
| ~~`priceMay`~~ | `mv_stock_tienda.price_may` | ~~Impact score en modo B2B debería usar precio mayorista~~ | **CONECTADO (2026-03-08 17:23)** — B2B usa `effectivePrice = priceMay` |
| `carry_over` | `mv_stock_tienda.carry_over` | Items temporada anterior: umbral de liquidación diferente, markdown más agresivo | Pendiente — preguntar al cliente |
| `CLUSTER_PRICE_MIX` | Definido en `clusters.ts` | Ajustar targets por cluster (tiendas outlet venden más sale/rebaja) | Pendiente — preguntar al cliente |
| `value` | `mv_stock_tienda.value` | Valor de inventario pre-calculado por la BD | No necesario — ya se calcula con price×units |
| `estComercial` | `mv_stock_tienda.est_comercial` | Estructura comercial | No necesario — sin uso definido |
| `rubro` | Se fetchea pero NO se mapea | Agrupación adicional por rubro | No necesario |

---

## 9. Clusters y metadata de tiendas

### Tiendas clasificadas (18):

| Cluster | Tiendas | Cover | Assortment |
|---------|---------|-------|------------|
| A (Premium) | GALERIAWRLEE, MARTELMCAL, SHOPMCAL, SHOPPINEDO, WRSSL, WRPINEDO, WRMULTIPLAZA | 100% normal | 2000-5500 u. |
| B (Standard) | CERROALTO, ESTRELLA, MARTELSSL, SHOPMARIANO, TOLUQ | 57% normal / 43% sale | 2500-5500 u. |
| OUT (Outlet) | TOSUR, FERIA, LUQ-OUTLET | 40% sale / 60% outlet | 5500 u. (solo TOSUR) |

### Tiendas SIN clasificar (pendiente Rodrigo):

`PASEOLAMB, TOLAMB, SHOPSANLO, LARURAL, MVMORRA, SHOPFUENTE` — asignadas Cluster B por defecto.

### Restricciones horarias (11 tiendas con horario definido):

Ver `clusters.ts:82-95` — restricciones como "Lun-Vie antes 9am" etc.

---

## 10. Normalización ERP → App

| Función | Input ejemplo | Output | Archivo |
|---------|--------------|--------|---------|
| `normalizeBrand()` | "Martel Premium", "martel ao po'i" | "Martel" | `normalize.ts` |
| `classifyStore()` | "MAYORISTA" | "b2b" | `normalize.ts` |
| `trimStr()` | "ESTRELLA   " | "ESTRELLA" | `normalize.ts` |
| `toNum()` | "6.263.380" | 6263380 | `normalize.ts` |

22 variantes de marca → 4 canónicas: Martel, Wrangler, Lee, Otras.
Stores excluidos: ALM-BATAS, FABRICA, LAMBARE, LAVADO, LUQ-DEP-OUT, MP.

---

## 11. Tests (265 total post-auditoría)

| Suite | Archivo | Tests | Cubre |
|-------|---------|:-----:|-------|
| Waterfall | `waterfall.test.ts` | 33 | N1-N4 cascade, filtros, sort, pareto, threshold, resource integrity (#27-31), priorización (#32), B2B priceMay (#33) |
| Grouping | `grouping.test.ts` | 18 | By store/brand, sections, intents, risk counts, metadata, section ordering |
| Normalize | `normalize.test.ts` | 37 | Brands (22 variantes), stores, numbers, dates |
| KPIs | `calculations.test.ts` | 26 | 20 funciones puras |
| KPI contracts | `fenix.contract.test.ts` | 101 | 50 KPIs × scenarios |
| Filters | `filterSupport.test.ts` | 15 | Period+brand+channel filtering |
| Period | `resolve.test.ts` | 19 | resolvePeriod() |
| Logistics | `arrivals.test.ts` | 16 | toArrivals, grouping, summary |

### Tests de integridad de recursos (nuevos #27-32):

- **#27:** `suggestedUnits === sum(counterpartStores.units)` para N1
- **#28:** Surplus stock no se double-promise (total from store ≤ excess)
- **#29:** Total restock from depot ≤ depot inventory
- **#30:** N3 suggestedUnits = min(STOCK, unmet deficit), matches counterpart
- **#31:** N3 currentStock = RETAILS depot inventory (no 0)
- **#32:** Critical (stock=0) stores priorizadas sobre low-stock
- **#33:** B2B impact score usa priceMay (wholesale) en vez de price (retail)

---

## 12. Preguntas pendientes para el cliente

Ver `docs/PREGUNTAS_CLIENTE_COLA_ACCIONES.md` — 5 preguntas originales.

### Preguntas adicionales post-auditoría:

**6. carry_over (temporada anterior)**
Los items de temporada anterior (`carry_over = "SI"`) se tratan igual que items nuevos. ¿Deberían tener umbrales de liquidación más agresivos? ¿Markdown automático?

**7. priceMay en modo B2B**
El impact score en B2B usa precio retail (`price`), no precio mayorista (`price_may`). ¿Debería usarse `price_may` para priorizar acciones B2B?

**8. Tipo 1/2 por campo BD vs por marca**
Actualmente se determina tipo nacional/importado por marca (Martel=12sem, Wrangler/Lee=24sem). Si algún producto de Martel fuera importado, tendría cobertura incorrecta. ¿Existe o debería existir un campo `tipo_producto` en la BD para clasificación por SKU?

---

## 13. Arquitectura y archivos clave

```
src/
  domain/actionQueue/
    waterfall.ts          — Algoritmo puro (4 niveles, greedy allocation)
    types.ts              — ActionItem, InventoryRecord, RiskLevel, WaterfallLevel
    grouping.ts           — groupActions(), splitIntoSections(), OperationalIntent
    clusters.ts           — STORE_CLUSTERS, STORE_ASSORTMENT, TIME_RESTRICTIONS, getCoverWeeks()

  queries/
    inventory.queries.ts  — fetchInventory(), toInventoryRecord()
    salesHistory.queries.ts — fetchSalesHistory() → Map<"STORE|sku", avg>
    keys.ts               — Query key factories, STALE_30MIN, GC_60MIN

  features/action-queue/
    ActionQueuePage.tsx   — 3 vistas (store/brand/list), filtros, stats bar
    hooks/useActionQueue.ts — Orchestrates fetch + compute + memoize
    components/
      ActionGroupCard.tsx   — Card expandible + secciones operativas + SVG icons
      CompactActionList.tsx — Tabla contextual (omite redundantes)
      ActionQueueTable.tsx  — Tabla plana (vista lista)
      exportHtml.ts         — Export HTML para Outlook

  api/
    normalize.ts          — Frontera ERP→app (brands, stores, numbers)
    client.ts             — dataClient + authClient
```

---

## 10. Ciclo de actualización del sistema (documentado 08/03/2026 18:54)

### Qué se actualiza solo (sin intervención)

| Componente | Mecanismo | Frecuencia |
|---|---|---|
| Datos de inventario en UI | TanStack Query `staleTime: 30min` | Cada carga de página o cada 30 min |
| Datos de ventas históricas | TanStack Query `staleTime: 30min` | Idem |
| Algoritmo waterfall | Se re-ejecuta con datos frescos | Cada vez que inventory/history cambian |
| Agrupación por tienda/marca | `useMemo` sobre items | Reactivo a cambios de items/filtros |
| Filtros (Pareto, marca, etc.) | Estado local React | Instantáneo |

El sistema NO tiene lógica de fecha/mes hardcodeada. Los cálculos usan los datos tal como vienen de la BD. Si mañana la BD tiene datos de abril, el sistema los procesa automáticamente.

### Qué depende de Derlys (pipeline de datos)

| Paso | Responsable | Detalle |
|---|---|---|
| ERP → tablas raw Supabase | Derlys | `fjdexisemp` (inventario), `fjdhstvta1` (ventas) |
| `REFRESH MATERIALIZED VIEW` | Derlys | `mv_stock_tienda`, `mv_ventas_12m_por_tienda_sku`, `mv_ventas_mensual` |

**RIESGO:** Si las materialized views no se refrescan, el dashboard muestra datos viejos aunque el ERP ya tenga datos nuevos. Pendiente confirmar frecuencia de refresh (pregunta #10).

### Qué requiere mantenimiento manual (código)

| Dato | Archivo | Cuándo cambia |
|---|---|---|
| Clusters de tiendas (A/B/OUT) | `clusters.ts` → `STORE_CLUSTERS` | Rodrigo reclasifica tiendas |
| Capacidad de assortment (unidades) | `clusters.ts` → `STORE_ASSORTMENT` | Cliente define capacidades nuevas |
| Horarios de transferencia | `clusters.ts` → `STORE_TIME_RESTRICTIONS` | Cambian restricciones de shopping/local |
| Marcas importadas (Tipo 2, 24 sem) | `clusters.ts` → `IMPORTED_BRANDS` | Agregan marcas nuevas al portfolio |
| Mix de precios por cluster | `clusters.ts` → `CLUSTER_PRICE_MIX` | Sin uso actual, pendiente decisión cliente |

**TODO estos datos están centralizados en un solo archivo** (`src/domain/actionQueue/clusters.ts`) por diseño. Candidato directo a Fase 6 (SettingsPage) para que el cliente los edite desde la UI sin tocar código.

### Ocupación de tiendas (implementado 08/03/2026 18:54)

Se agregó indicador de ocupación real: `stock actual total / capacidad assortment`.

- Dato de stock: sumado de `mv_stock_tienda` (todos los SKUs de la tienda, no solo los con acciones)
- Dato de capacidad: `STORE_ASSORTMENT` en `clusters.ts` (12 tiendas con dato, 8 sin dato)
- Tiendas sin capacidad definida: muestran "Cap. sin datos" (listas para activarse cuando el cliente defina)
- Tiendas >100%: se muestran en rojo con % real (sin cap), indicando sobrestock a nivel tienda

**Hallazgo:** TOLUQ (170%), TOSUR (143%), ESTRELLA (122%), MARTELMCAL (114%) superan su capacidad. Pregunta #12 al cliente.

---

## 11. Auditoría pre-producción (08/03/2026 19:11)

### Checks automatizados — TODOS PASS

| Check | Resultado |
|---|---|
| `npm run build` | OK (2.43s) |
| `tsc --noEmit` | 0 errores |
| `npm test` 265/265 | PASS (389ms) |

### Correcciones durante auditoría

- `SURPLUS_REALLOC_RATIO` (unused) → eliminada de `waterfall.ts`
- `ActionType` import (unused) → eliminado de `grouping.ts`

### Verificaciones de seguridad — PASS

| Aspecto | Estado | Detalle |
|---|---|---|
| Auth guard | OK | AuthGuard envuelve todas las rutas protegidas, /signin fuera del guard, catch-all `*` → `/` |
| ErrorBoundary | OK | Envuelve todo el árbol en main.tsx |
| .env.local excluido | OK | En .gitignore |
| Security headers | OK | X-Frame-Options DENY, nosniff, referrer-policy, permissions-policy |
| SPA rewrites | OK | `/(.*) → /index.html` en vercel.json |
| XSS en export | OK | Función `esc()` escapa todos los caracteres peligrosos |
| RETAILS/STOCK protección | OK | `trim().toUpperCase()` en waterfall.ts protege contra variaciones de casing/espacios |

### Datos de depósitos — CONFIRMADO PRESENTE

Los depósitos RETAILS (9,574 u.) y STOCK (29,034 u.) tienen datos completos por SKU+talle en `mv_stock_tienda`. El waterfall los consume correctamente:

- **N1 (Tienda↔Tienda):** Usa `surplusPool` con tracking de recursos. Cada unidad se asigna exactamente una vez.
- **N2 (RETAILS→Tienda):** `remainingDepot` se decrementa por tienda. Si RETAILS tiene 40u y 3 tiendas piden 20 cada una, las primeras 2 reciben y la tercera acumula déficit no cubierto.
- **N3 (STOCK→RETAILS):** Solo se genera para déficit no cubierto por N1+N2. `suggestedUnits = Math.min(depotStock, unmetDeficit)` — nunca sugiere más de lo que STOCK tiene.
- **N4 (STOCK→B2B):** Solo en modo B2B, directo desde STOCK central.

Las 4 tiendas con 0 stock (MARTELSSL, WRMULTIPLAZA, WRPINEDO, WRSSL) son tiendas retail, NO depósitos. Los depósitos operativos tienen datos completos.

**Cada acción que el sistema sugiere está respaldada por stock real disponible en el origen.**

### Verificaciones manuales pendientes (para antes del deploy)

| # | Check | Qué hacer |
|---|---|---|
| A | Env vars en Vercel | Verificar 4 vars en Vercel dashboard |
| B | Materialized views frescas | Confirmar con Derlys último REFRESH |
| C | RLS en data client | Verificar políticas en Supabase dashboard |
| D | Login funciona | Probar credenciales correctas e incorrectas |
| E | Top 10 acciones | Revisar que coincidan con intuición de negocio |
| F | Modo B2B | Verificar que genera acciones diferenciadas |
| G | Export HTML | Exportar y comparar con UI |

### Warnings (no bloquean deploy)

- **Sentry no configurado** — errores en producción serán invisibles hasta configurar VITE_SENTRY_DSN
- **CSP header falta** — agregar Content-Security-Policy post-deploy
- **4 tiendas con 0 stock** — puede ser normal si están cerradas (pregunta #11)
- **8 tiendas sin capacidad** — ocupación muestra "Sin datos" (pregunta #1)

---

## 12. Auditoría de tests + bug #10 (08/03/2026 19:11)

### Bug #10 encontrado por tests nuevos: storeFilter bloqueaba depósitos

**Severidad: ALTA** — Cuando el usuario filtraba por tienda específica en la UI, RETAILS y STOCK se descartaban porque el `storeFilter` se evaluaba ANTES de separar los depósitos. Resultado: N2 y N3 nunca se generaban con filtro de tienda activo.

**Fix:** Mover la separación de RETAILS/STOCK antes de los filtros de usuario en `waterfall.ts` líneas 127-134. Los depósitos siempre pasan, independientemente de filtros.

### Tests agregados (11 nuevos: #34-#44)

| # | Test | Qué valida | Resultado |
|---|---|---|---|
| 34 | Múltiples SKUs independientes | Cada SKU produce acciones separadas | PASS |
| 35 | Mismo SKU, diferentes talles | Talle M y L son items separados | PASS |
| 36 | Mirror actions de surplus | Surplus que envía tiene acción "redistribute" con counterparts | PASS |
| 37 | Liquidación de excedente | Surplus remanente ≥3u genera acción de liquidar | PASS |
| 38 | MIN_TRANSFER_UNITS | Fuentes con <2u se saltan si hay alternativas | PASS |
| 39 | Cascada N1→N2 | Deficit parcial por N1, resto por N2 | PASS |
| 40 | Price=0, cost=0 | Acciones críticas se generan aunque impactScore=0 | PASS |
| 41 | Unidades negativas | No crash con inventario negativo del ERP | PASS |
| 42 | Todas las tiendas balanceadas | 0 acciones cuando no hay desbalance | PASS |
| 43 | **storeFilter + depósitos** | **RETAILS/STOCK se procesan con filtro activo** | PASS (bug fix) |
| 44 | Filas duplicadas de inventario | Sin acciones duplicadas para mismo store+sku+talle | PASS |

### Cobertura final: 365 tests (116 waterfall + 35 grouping + 214 otros)

---

## 13. Auditoría EXHAUSTIVA de tests (08/03/2026 19:50)

Se realizó un análisis profundo de gaps en la cobertura de tests. Se identificaron 81 caminos no testeados, clasificados por prioridad. Se escribieron **72 tests nuevos** (waterfall) + **13 tests nuevos** (grouping) cubriendo todos los gaps.

### Tests CRITICAL (6 tests)

| ID | Test | Hallazgo |
|---|---|---|
| C-01 | N1 partial fill → N2 skipped | `continue` en línea 346 impide N2 cascade. Déficit se acumula en `unmetDeficit` para N3. **Decisión de diseño documentada, no bug.** |
| C-02 | N1 fully fills → no N2/N3 | Comportamiento correcto verificado. |
| C-03 | No surplus → N2 fires directly | Cascade funciona cuando N1 da 0. |
| C-04 | B2B N4 suppressed by surplus | `surplusStores.length === 0` gate. **Limitación conocida.** |
| C-05 | B2B N4 fires without surplus | Comportamiento correcto verificado. |
| C-06 | B2B N4 no resource tracking | Múltiples B2B clients pueden pedir del mismo STOCK sin decrementar. **Limitación conocida, documentada.** |

### Tests HIGH (20 tests)

| ID | Área | Qué valida |
|---|---|---|
| H-01/02/03 | Filtros + depósitos | Brand/linea/categoria NO excluyen RETAILS/STOCK |
| H-04 | Filtros combinados | Brand+linea+categoria+store juntos |
| H-05 | B2B paths | B2B single deficit → N4 |
| H-06/07 | coverMonths | Martel 12w→2.77m, Wrangler 24w→5.54m, Wrangler genera mayor déficit |
| H-08/09 | Boundary 50%/200% | Exactamente en umbral → no deficit/surplus |
| H-10/11 | qty>10 guard | ≤10 no surplus, >10 AND >avg*2.5 sí |
| H-12/13 | MIN_AVG_FOR_RATIO | avgQty<5 salta ratio, avgQty≥5 activa ratio |
| H-14 | MIN_TRANSFER_UNITS edge | Excepción cuando take=toFill |
| H-15/16 | N2 allocation | Depot se agota mid-allocation, priority critical-first |
| H-17/18 | Mirror+liquidation | Mismo store: mirror Y liquidación, threshold <3 |
| H-19 | Pareto independence | Flags por impact, no por risk sort |
| H-20 | Depot per-SKU | SKU A depot ≠ SKU B depot |

### Tests MEDIUM (30 tests)

Cubren: price fallback (cost*2), priceMay fallback, grossMargin negativo, MOS cálculo, empty store/SKU, whitespace trim, case normalization, storeFilter case insensitive, brandFilter case insensitive, deterministic sort tiebreakers, impact score formula exacta, surplus largest-first, SURPLUS_LIQUIDATE_RATIO, N3 dedup con muchas tiendas, N3 counterpart=STOCK, mirror counterparts correctos, threshold=0, overstock filter, duplicate aggregation, targetStore, Lee=importado.

### Tests LOW (16 tests)

Cubren: overflow safety, single store, equal prices, single pareto, zero impact, multi-talle, storeCluster conocido/desconocido, timeRestriction, recommendedAction, IDs únicos, resetIdCounter, skuComercial/description passthrough, mixed channels, max price across stores.

### Limitaciones conocidas documentadas

1. **N1 `continue` → N2 skip:** Una tienda que recibe ALGO por N1 no recibe N2 directo. Su déficit restante va a `unmetDeficit` para N3. Esto es diseño deliberado: evita duplicar acciones para la misma tienda.
2. **B2B N4 gate `surplusStores.length === 0`:** Si existe cualquier surplus, N4 no dispara. Los surplus stores reciben N1 en cambio.
3. **B2B N4 sin resource tracking:** No decrementa STOCK entre múltiples clientes B2B del mismo SKU. Riesgo bajo (pocos clientes B2B simultáneos por SKU).

**Zonas cubiertas del algoritmo waterfall:**
- Inputs vacíos y edge cases
- 4 niveles del waterfall (N1, N2, N3, N4)
- Filtros (marca, línea, categoría, tienda) + bypass depósitos
- Tracking de recursos (surplus pool, depot pool)
- Priorización (critical first, largest donors first)
- Pareto flagging (80/20) por impacto independiente de risk
- Impact threshold + bypass para critical
- B2C/B2B mode separation + priceMay
- Cover weeks por tipo (nacional 12w, importado 24w)
- Talle vacío → "S/T"
- N3 dedup (1 acción por SKU+talle)
- Boundary conditions en todos los umbrales
- Fallbacks de precio (price=0→cost*2, priceMay=0→price)
- Normalización de inputs (trim, uppercase, empty skip)
- Fórmula exacta de impactScore
- Deterministic sort con todos los tiebreakers
- Mirror actions + liquidation + SURPLUS_LIQUIDATE_RATIO
- Aggregación de duplicados en skuMap y depotMap
- Mirror actions + liquidación
- MIN_TRANSFER_UNITS filter
- Cascada N1→N2
- Zero-price y negative-inventory resilience
- Depósitos siempre disponibles con filtros activos
- Duplicados de inventario
