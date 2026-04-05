# Auditoría Profunda — Centro de Acciones (17/03/2026)

**Contexto:** 3ra auditoría del sistema waterfall. Perspectiva senior dev para producción real.
**Baseline:** 850 tests, TSC 0, Build OK.
**Post-audit:** 871 tests (+21 nuevos), TSC 0, Build OK.

---

## URGENTE: Dos temas reportados por Rodrigo y Derlys (16/03/2026)

### A. WRSSL y WRMULTIPLAZA no aparecen en Centro de Acciones

**Causa raíz:** Las tiendas no tenían datos en `fjdexisemp` (tabla de inventario del AS400). El proceso del AS400 no las estaba exportando.

**Estado:** Derlys ya las agregó al proceso del AS400 ("En existencias ya agregué en el proceso de AS400 para las tiendas que no aparecían").

**Acción requerida:**
```sql
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_stock_tienda;
```

**Verificación post-refresh:**
```sql
SELECT DISTINCT store FROM mv_stock_tienda WHERE store IN ('WRSSL', 'WRMULTIPLAZA');
```

**Sobre `e_sucursal`:** Es el campo de `fjdexisemp` que contiene el código de tienda del sistema JD (ej: "WRSSL"). La vista materializada lo normaliza con `UPPER(TRIM(f.e_sucursal))`. Si Derlys usó exactamente "WRSSL" y "WRMULTIPLAZA", van a matchear.

**Sobre `Dim_sucursal`:** En la BD actual no existe esa tabla. La tabla puente se llama `fintsucu` (121 filas, mapea `cosupc` ↔ `cosujd`). Verificar con Derlys si se refiere a `fintsucu`.

**No requiere cambio de código.** Solo refresh de la MV.

### B. WOI objetivo = 3 semanas para tiendas B2C ✅ IMPLEMENTADO

**Pedido de Rodrigo:** "Acordamos con el equipo tener 3 semanas en tienda. Venta promedio 6 meses, cobertura de ventas (WOI) de 3 semanas en las tiendas B2C solamente."

**Antes:** coverWeeks = 12 (Martel) / 24 (Wrangler/Lee). Una tienda vendiendo 10u/mes tenía target = 27.7u (Martel) o 55.4u (Wrangler).

**Ahora:** coverWeeks = 3 para TODAS las tiendas B2C, sin importar marca. Target = 10 × 0.69 = **6.9 unidades**.

**Impacto del cambio:**
- Muchas más tiendas van a quedar como "sobrestock" (stock > target × 2)
- Menos tiendas como "déficit" (solo si stock < target × 0.5)
- El sistema va a recomendar redistribuir más activamente
- Los depósitos (RETAILS/STOCK) mantienen el coverWeeks por marca (12/24)

**Archivos modificados:** `waterfall.ts` (constante `B2C_STORE_COVER_WEEKS = 3` + lógica condicional por mode).

---

## Resumen Ejecutivo

| Severidad | Encontrados | Corregidos | Documentados |
|-----------|:-----------:|:----------:|:------------:|
| P0 (bugs reales) | 4 | 4 | 4 |
| P1 (mejoras) | 8 | 8 | 8 |
| P2 (hardening) | 3 | 3 | 3 |
| Business gaps | 6 | 0 (requieren decisión) | 6 |
| **Total** | **21** | **15** | **21** |

---

## Fase 1: Correctness Algorítmico — RESULTADOS

### Verificados como CORRECTOS (no bugs):

| Check | Veredicto | Prueba |
|-------|-----------|--------|
| 1.1 Pareto `>=` | **CORRECTO.** El check `cumulative/total >= 0.80` detiene antes de agregar más items cuando ya se alcanzó 80%. Items que suman 80% están todos incluidos. | Prueba matemática: items 60%+20%+10%+10%, break en iter 3 con cum=0.80, items 1-2 flaggeados (sum=80%). |
| 1.2 Umbral 50% vs 40% | **INTENCIONAL.** Diferentes bases: `targetStock * 0.5` (basado en ventas reales) vs `avgQty * 0.40` (basado en inventario promedio — señal menos confiable). | Porcentajes diferentes son apropiados para bases diferentes. |
| 1.3 Math.ceil en need | **CORRECTO.** En supply chain, es preferible sobre-pedir 1 unidad que sub-pedir. `ceil(27.3) = 28` > `round(27.3) = 27`. | Estándar de la industria para cálculos de demanda. |
| 1.4 Guard qty > 10 | **INTENCIONAL.** Evita marcar como surplus una tienda con 8 unidades cuando el promedio es 3. Mover 5 unidades no justifica el costo logístico. | Guard pragmático de costo de operación. |
| 1.5 avgQty self-bias | **ACEPTABLE.** La tienda evaluada infla su propio promedio. Pero solo afecta el path sin historial (fallback). Con historial de ventas, `targetStock` es correcto. | Test DA-16 documenta el comportamiento. |
| 1.6 Date.now() en IDs | **ACEPTABLE.** `resetIdCounter()` en cada invocación + `_idCounter` incremental = IDs únicos dentro de cada ejecución. Pareto Set funciona correctamente. | Tests existentes validan pareto flagging. |

### NO se requieren cambios al algoritmo core.

---

## Fase 2: Integridad de Datos — BUGS CORREGIDOS

### BUG 2.1: Mes parcial en promedio 6m [P0] ✅ CORREGIDO

**Problema:** La query de historial incluía el mes actual (parcial). Marzo con 17 días dividido por 6 meses subestimaba el promedio mensual ~45%.

**Impacto:** Target stock más bajo → menos acciones generadas → supply chain sub-optimizado.

**Fix:** `salesHistory.queries.ts` — cambió el loop de `i=0..5` a `i=1..6`, excluyendo el mes actual parcial. Ahora usa solo meses cerrados.

```typescript
// ANTES: incluía mes parcial
for (let i = 0; i < HISTORY_MONTHS; i++) { ... }

// DESPUÉS: solo meses cerrados
for (let i = 1; i <= HISTORY_MONTHS; i++) { ... }
```

### BUG 2.2: Key mismatch potencial store|sku [P0] ✅ CORREGIDO

**Problema:** El waterfall usa `store.trim().toUpperCase()` pero la query de historial usaba solo `trimStr(r.store)` sin `.toUpperCase()`. Si la MV devolviera datos en minúsculas, las keys no matchearían → 0 historial → fallback a avgQty.

**Fix:** `salesHistory.queries.ts` — agregado `.toUpperCase()` a la construcción del key del historial.

### 2.3 Paginación sin ORDER BY: RIESGO BAJO (documentado en paginate.ts)
### 2.4 sku_comercial fallback: RIESGO BAJO (fallback de migración)
### 2.5 Brands → "Otras": ACEPTABLE (BRAND_MAP cubre todas las variantes conocidas)

---

## Fase 3: Seguridad de Recursos — BUGS CORREGIDOS

### BUG 3.1: B2B N4 sin tracking de pool [P0] ✅ CORREGIDO

**Problema:** Múltiples clientes B2B reclamaban stock de STOCK sin decrementar. Si STOCK=60 y 3 clientes pedían 30 c/u, sugería 90 unidades imposibles.

**Fix:** `waterfall.ts` — agregado pool tracking. Cuando STOCK tiene inventario, el total de allocations se limita al stock disponible. Cuando STOCK no tiene datos, las recomendaciones se generan sin cap (útil como señal de "hay que reponer").

```typescript
let remainingStock = depotStock > 0 ? depotStock : Infinity;
for (const deficit of deficitStores) {
  const units = Math.min(deficit.need, remainingStock);
  if (remainingStock !== Infinity) remainingStock -= units;
  ...
}
```

**Tests:** C-06b (capped), DA-04 (limited STOCK).

### BUG 3.2: N1 continue → N2 skip [P0] ✅ CORREGIDO

**Problema:** Cuando N1 (tienda→tienda) llenaba parcialmente un déficit, el `continue` saltaba N2 (RETAILS→tienda). El remanente iba directo a `unmetDeficit` para N3 (STOCK→RETAILS), ignorando stock disponible en RETAILS.

**Fix:** `waterfall.ts` — después de N1 parcial, si RETAILS tiene stock, se genera una acción N2 adicional para cubrir el remanente.

**Tests:** C-01 (actualizado), DA-03 (nuevo), DA-19 (pool compartido).

### 3.3 Mirror vs deficit: VERIFICADO CORRECTO
`surplusAllocations` trackea exactamente los units tomados. Test DA-08 verifica igualdad.

### 3.4 Pool surplus nunca negativo: VERIFICADO CORRECTO
`take = Math.min(avail, toFill)` → `avail - take >= 0` siempre. Test DA-09 verifica.

---

## Fase 4: Gaps de Lógica de Negocio (requieren decisión del cliente)

| Gap | Impacto | Recomendación |
|-----|---------|---------------|
| 4.1 **Estacionalidad ciega** | ALTO — promedio 6m trata verano=invierno. SKU verano (100u/m Nov-Feb) + invierno (20u/m) → promedio 60 → target inflado 3x en invierno. | **Opción A:** Ponderación estacional (últimos 3m peso 60%, anteriores 3m peso 40%). **Opción B:** Trimestre móvil en vez de 6m. Requiere definición de Rodrigo. |
| 4.2 **Carry-over sin diferenciar** | MEDIO — carry_over="SI" tratado igual que temporada nueva. Debería tener liquidación más agresiva. | Agregar factor multiplicador a SURPLUS_LIQUIDATE_RATIO para carry-over (0.80 vs 0.60 actual). |
| 4.3 **Capacidad de tienda no limita waterfall** | MEDIO — tienda al 170% de capacidad sigue recibiendo stock del algoritmo. | Agregar guard: si stock actual > assortmentCapacity * 1.1, no generar acciones de restock para esa tienda. |
| 4.4 **Cluster no prioriza** | BAJO — Cluster A (100% precio normal) no tiene prioridad sobre B/OUT para stock escaso. | Agregar peso de prioridad por cluster en la asignación de surplus pool. |
| 4.5 **Tiendas nuevas sin historia** | BAJO — reciben avgQty que puede ser excesivo/insuficiente. | Agregar flag "tienda nueva" con target conservador (50% de avgQty). |
| 4.6 **Sin awareness de promociones** | BAJO — el algoritmo no sabe de rebajas futuras ni devoluciones. | Fase futura: integrar calendario de promociones con el waterfall. |

**Acción:** Presentar tabla a Rodrigo/Derlys para priorización.

---

## Fase 5: Performance — RESULTADOS

| Check | Resultado |
|-------|-----------|
| 5.1 Query key 10KB+ | ✅ CORREGIDO — reemplazado join de 1000+ SKUs por hash numérico. |
| 5.2 Batch pagination | OK — 200 SKUs × 2 year-groups = ~4 requests por batch. Aceptable. |
| 5.3 Re-cómputo waterfall | OK — test DA-14: 500 SKUs × 10 tiendas = 5000 rows completa en <100ms. |
| 5.4 Dead code inventoryKeys | ✅ CORREGIDO — removidos params `channel`/`brand` no usados. |

---

## Fase 6: Fidelidad UI — CORREGIDOS

| Check | Resultado |
|-------|-----------|
| 6.1 Stats vs items filtrados | ✅ CORREGIDO — "Total Acciones" ahora muestra sub-label "X visibles" cuando Pareto está activo. |
| 6.2 WOI excluye items sin historia | DOCUMENTADO — comportamiento correcto: WOI solo tiene sentido con datos de venta. |
| 6.3 MOS=0 muestra "—" | ✅ CORREGIDO — ahora muestra "0.0 MOS" cuando hay historial (stock=0 con ventas es información útil). Solo muestra "—" cuando no hay historial. |
| 6.4 Ocupación vs items accionados | DOCUMENTADO — comportamiento intencional: barra muestra inventario total de la tienda, no solo items con acción. |

---

## Fase 7: Export HTML — CORREGIDOS

| Check | Resultado |
|-------|-----------|
| 7.1 Blob URL revoke timing | ✅ CORREGIDO — cambiado a `setTimeout(60s)` para que la descarga complete. |
| 7.2 Divergencia export vs UI | DOCUMENTADO — "Prom 6m" solo en export, counterparts separados en UI. Diferencias intencionales por contexto de uso (compartir vs interactuar). |
| 7.3 `esc()` coverage | OK — cubre contexto HTML (`& < > " '`). Valores en style="" son constantes, no inyectables. |

---

## Fase 8: Resiliencia a Errores — CORREGIDOS

| Check | Resultado |
|-------|-----------|
| 8.1 Retry inconsistente | ✅ CORREGIDO — historyQ ahora tiene `retry: 1` igual que inventoryQ. |
| 8.2 NaN propagation | ✅ CORREGIDO — guard `Number.isFinite(r.units)` al inicio del loop de inventory. Tests DA-01, DA-02. |
| 8.3 Precio negativo | OK — `grossMarginFactor` ya maneja `price <= 0` retornando 1. Test DA-12 verifica. |
| 8.4 Indicador de frescura | DOCUMENTADO — requiere query a `pg_stat_user_tables`. Fase futura. |
| 8.5 Error parcial en history | DOCUMENTADO — `fetchAllRows` falla en la primera página con error. Datos parciales se pierden. Riesgo aceptable con `retry: 1`. |
| 8.6 Waterfall throw | ✅ CORREGIDO — try/catch en useMemo. Error → items=[], error message en UI. |

---

## Fase 9: Tests Nuevos — 20 TESTS AGREGADOS

| Test | Qué cubre |
|------|-----------|
| DA-01 | NaN units → rows skipped sin crash |
| DA-02 | Infinity units → rows skipped sin crash |
| DA-03 | N1→N2 cascade — partial fill + depot remainder |
| DA-04 | B2B N4 pool tracking con STOCK limitado |
| DA-05 | SKU huérfano en RETAILS → no crash, no actions |
| DA-06 | SKU huérfano en STOCK → no crash, no actions |
| DA-07 | Threshold + pareto interacción |
| DA-08 | Mirror units = deficit N1 units (resource integrity) |
| DA-09 | Surplus pool nunca negativo |
| DA-10 | Negative units → no surplus generado |
| DA-11 | Zero price → impactScore finito ≥ 0 |
| DA-12 | Negative price → no inversión de margin |
| DA-13 | Store en B2C y B2B simultáneamente |
| DA-14 | Performance: 500 SKUs × 10 stores < 100ms |
| DA-15 | Pareto boundary: equal impact → subset flagged |
| DA-16 | avgQty self-bias documentation |
| DA-17 | Brand "Otras" → 12w coverage |
| DA-18 | Empty store name → rows skipped |
| DA-19 | N2 depot pool shared entre cascade y directo |
| DA-20 | Depot MOS = demanda agregada de todas las tiendas |

---

## Fase 10: Production Hardening — IMPLEMENTADO

| Item | Estado |
|------|--------|
| 10.1 Sentry DSN | PENDIENTE — no hay DSN configurado. |
| 10.2 try/catch en computeActionQueue | ✅ IMPLEMENTADO — en useMemo, error → items=[], error state dedicado. |
| 10.3 Indicador frescura | PENDIENTE — requiere query a pg_stat_user_tables. |
| 10.4 Logging de métricas | ✅ IMPLEMENTADO — en DEV: `[waterfall] N rows → M actions (P pareto) in Xms`. |
| 10.5 Kill switch | PENDIENTE — requiere feature flag infrastructure. |

---

## Archivos Modificados

| Archivo | Cambios |
|---------|---------|
| `src/domain/actionQueue/waterfall.ts` | NaN guard, N1→N2 cascade fix, B2B N4 pool tracking |
| `src/domain/actionQueue/__tests__/waterfall.test.ts` | C-01 actualizado, C-06b nuevo, 20 tests DA-* nuevos |
| `src/queries/salesHistory.queries.ts` | Excluir mes parcial (i=1..6), toUpperCase() en key |
| `src/queries/keys.ts` | inventoryKeys dead code cleanup, salesHistoryKeys hash |
| `src/features/action-queue/hooks/useActionQueue.ts` | try/catch, retry:1, dev logging |
| `src/features/action-queue/components/CompactActionList.tsx` | MOS=0 muestra "0.0 MOS" |
| `src/features/action-queue/components/exportHtml.ts` | Blob revoke 60s, MOS=0 fix |
| `src/features/action-queue/ActionQueuePage.tsx` | Stats sub-label "X visibles" |

---

## Verificación Final

```
Tests:  871 pass (22 suites) — +21 sobre baseline
TSC:    0 errores (tsc -b)
Build:  OK (2.49s)
```
