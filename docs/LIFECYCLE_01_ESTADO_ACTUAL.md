# Centro de Acciones — Estado Actual

**Fecha:** 2026-04-15 09:45 (PYT)
**Contexto:** Documento pre-implementación del sistema de Lifecycle Management.
**Tests:** 1170 pass (32 suites) | TSC 0 | Build OK

---

## 1. Qué hace HOY el Centro de Acciones

El algoritmo waterfall (`waterfall.ts`, 543 líneas) recomienda movimientos de inventario basándose en:

| Input | Fuente | Cómo se usa |
|-------|--------|-------------|
| Stock actual por tienda/SKU/talle | `mv_stock_tienda` (~5-10K filas) | Clasificación déficit/superávit |
| Promedio ventas 6 meses | `mv_ventas_12m_por_tienda_sku` (~8-15K filas) | Target de cobertura (coverWeeks) |
| DOI-edad (días sin movimiento) | `mv_doi_edad` (~5K filas, fuente: `movimientos_st_jde`) | **Solo se MUESTRA, NO participa en la decisión** |
| Clusters de tienda (A/B/OUT) | `config_store` (41 filas) | **Solo metadata visual, NO afecta lógica** |

### Waterfall 4 niveles (actual)

```
N1: Tienda → Tienda (rebalanceo lateral entre surplus y deficit)
N2: RETAILS depot → Tienda (reposición desde depósito intermedio)
N3: STOCK central → RETAILS (resurtir depósito para cubrir deficit B2C)
N4: STOCK central → B2B directo (envío a mayoristas)
```

### Lógica de clasificación (actual)

- **Deficit:** `stock < target × 0.5` (con historial) o `stock ≤ minStockAbs` (sin historial)
- **Surplus:** `stock > target × 2` (con historial) o `stock > avgQty × highStockRatio` (sin historial)
- **Target:** `historicalAvg × coverMonths` (13 sem B2C, 12/24 sem por marca)
- **Filtro de ruido:** `impactScore < Gs. 500K` descartado (excepto critical)
- **Pareto 80/20:** Los items de mayor impacto financiero que suman 80% del total

### Campos en ActionItem (actual)

```
sku, skuComercial, talle, description, brand, store, storeCluster
currentStock, suggestedUnits, idealUnits, gapUnits
daysOfInventory (DOI — mostrado pero NO usado en decisión)
historicalAvg, coverWeeks, currentMOS
risk (critical | low | balanced | overstock)
waterfallLevel (store_to_store | depot_to_store | central_to_depot | central_to_b2b)
actionType (transfer | restock_from_depot | resupply_depot | central_to_b2b)
impactScore, paretoFlag
linea, categoria (metadata para filtros)
```

---

## 2. Qué datos EXISTEN pero NO se usan

### 2.1 Campos disponibles en la query pero NO pasados al waterfall

| Campo | Dónde se fetch | Dónde se pierde | Valor ejemplo |
|-------|---------------|-----------------|---------------|
| `est_comercial` | `inventory.queries.ts:103` como `estComercial` | NO está en `InventoryRecord` type | "lanzamiento", "" |
| `carry_over` | `inventory.queries.ts:104` como `carryOver` | NO está en `InventoryRecord` type | "SI", "NO" |
| `tipo_articulo` | Mapeado a `categoria` | Llega al waterfall como `categoria` | "camisa", "jean" |

### 2.2 Tabla movimientos_st_jde (522K registros desde 2022)

Hoy solo se usa para calcular "días desde último movimiento" (`mv_doi_edad`). Pero contiene:

- Fecha de cada movimiento (ingreso y salida)
- Cantidad movida (positiva/negativa)
- SKU + talle + tienda
- Tipo de movimiento (inferible por signo de cantidad)

**Con estos datos se puede construir:**
- Fecha de ingreso a tienda por cohorte (primer movimiento positivo)
- STH = unidades vendidas / unidades recibidas
- Tracking de transferencias A→B→OUT
- Detección de mermas (stock inicial > stock final sin venta)

### 2.3 Clusters de tienda

Existen 3 clusters (A=premium, B=standard, OUT=outlet) con 41 tiendas configuradas en `config_store`. El waterfall los guarda en cada ActionItem pero **no los usa para priorizar ni filtrar**.

---

## 3. Qué NO existe

| Concepto | Estado |
|----------|--------|
| STH (Sell-Through Rate) | No existe. Ni cálculo, ni tipo, ni query |
| Clasificación por tipo de producto (Carry Over / Básicos / Temporada) | No existe. `est_comercial` y `carry_over` no llegan al domain |
| Lifecycle state machine | No existe. No hay estados ni transiciones |
| Reglas por edad × STH | No existe |
| Acciones asignadas a roles | No existe. Acciones son genéricas sin responsable |
| Análisis de curva de tallas | No existe. Quiebre de talla no se detecta |
| Cohorte de ingreso | No existe. DOI mide "último movimiento", no "primer ingreso" |
| Depósito virtual de segunda mano | No existe |

---

## 4. Archivos clave actuales

| Archivo | Líneas | Propósito |
|---------|--------|-----------|
| `src/domain/actionQueue/types.ts` | 95 | Tipos del waterfall (ActionItem, WaterfallInput, etc.) |
| `src/domain/actionQueue/waterfall.ts` | 543 | Algoritmo core (4 niveles) |
| `src/domain/actionQueue/grouping.ts` | 251 | Agrupación por tienda/marca + secciones operativas |
| `src/domain/actionQueue/purchasePlanning.ts` | 170 | Gap de compra por SKU |
| `src/domain/actionQueue/clusters.ts` | 113 | Clusters, horarios, assortment |
| `src/domain/config/types.ts` | ~100 | Interfaces de config (WaterfallConfig, etc.) |
| `src/domain/config/defaults.ts` | 123 | Defaults hardcoded |
| `src/queries/inventory.queries.ts` | ~120 | Fetch de mv_stock_tienda |
| `src/queries/doiAge.queries.ts` | ~60 | Fetch de mv_doi_edad |
| `src/queries/salesHistory.queries.ts` | ~60 | Fetch de mv_ventas_12m |
| `src/features/action-queue/hooks/useActionQueue.ts` | ~300 | Hook orquestador |
| `sql/010_mv_doi_edad.sql` | ~100 | Materialized view de edad de inventario |
| `sql/008_fix_mv_stock_tienda.sql` | ~80 | MV de stock con campos comerciales |

---

## 5. Métricas de referencia

- **1170 tests** (32 suites), 0 failures
- **TSC:** 0 errores
- **Build:** OK (2.77s)
- **156 tests** solo en waterfall.test.ts
- **Coverage domain:** 89.87% lines
- **Config en producción:** 73 filas (24 app_params + 41 config_store + 8 commission_scale)
- **Deploy:** https://fenix-brands-one.vercel.app
