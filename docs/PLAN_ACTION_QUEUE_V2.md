# Plan de Implementación — Cola de Acciones v2

**Fecha:** 2026-03-08
**Autor:** Claude Code (Opus 4.6)
**Basado en:** Auditoría integral `AUDIT_ACTION_QUEUE_2026-03-08.md`

---

## Principio Rector

> De "dump de 14K filas" a "centro de operaciones diario con acciones priorizadas y agrupadas"

---

## Fases de Implementación

### FASE R1: Limpieza de datos y correcciones inmediatas

**Esfuerzo:** 1-2h · **Impacto:** Correctitud de datos · **Prioridad:** HACER YA

**Tareas:**

1. **Fix comentario cluster** — Mover `WRMULTIPLAZA` bajo sección `// Cluster A` en `clusters.ts`

2. **Fix texto UI "12m" → "6m"** — `ActionQueuePage.tsx:177` dice "Historial 12m cargado" pero el fetch es de 6 meses

3. **Agregar assortment capacity** a `clusters.ts`:
```typescript
export const STORE_ASSORTMENT: Record<string, number> = {
  MARTELMCAL: 5500, TOLUQ: 5500, TOSUR: 5500,
  SHOPPINEDO: 4000, WRPINEDO: 3500, MARTELSSL: 3300,
  CERROALTO: 3000, ESTRELLA: 3000, GALERIAWRLEE: 3000, WRSSL: 3000,
  SHOPMARIANO: 2500, WRMULTIPLAZA: 2000,
};
```

4. **Agregar price mix** a `clusters.ts`:
```typescript
export const CLUSTER_PRICE_MIX: Record<StoreCluster, { normal: number; sale: number; outlet: number }> = {
  A:   { normal: 1.00, sale: 0.00, outlet: 0.00 },
  B:   { normal: 0.57, sale: 0.43, outlet: 0.00 },
  OUT: { normal: 0.00, sale: 0.40, outlet: 0.60 },
};
```

5. **Completar horarios** — Agregar nota "optimizar en función de la ruta" donde corresponde según imagen del cliente

6. **Documentar tiendas sin clasificar** — Las 8 tiendas extra (PASEOLAMB, TOLAMB, SHOPSANLO, LARURAL, MVMORRA, SHOPFUENTE, FERIA, LUQ-OUTLET) necesitan confirmación de Rodrigo

**Archivos a modificar:**
- `src/domain/actionQueue/clusters.ts`
- `src/features/action-queue/ActionQueuePage.tsx`

---

### FASE R2: Threshold mínimo + Pareto como default

**Esfuerzo:** 2-3h · **Impacto:** ALTO (reduce ruido ~80%) · **Prioridad:** HACER YA

**Tareas:**

1. **Agregar `MIN_IMPACT_THRESHOLD`** al algoritmo waterfall:
```typescript
const MIN_IMPACT_THRESHOLD = 500_000; // Gs. 500,000
```
Filtrar acciones cuyo `impactScore < MIN_IMPACT_THRESHOLD` DESPUÉS de calcular pero ANTES de Pareto. Esto elimina acciones triviales (mover 1-3 unidades de SKUs baratos).

2. **Pareto como vista default** — Nuevo state en la página:
```typescript
const [viewMode, setViewMode] = useState<"pareto" | "all">("pareto");
```
Por defecto solo muestra acciones con `paretoFlag = true`. Toggle "Ver todas" expande la lista.

3. **Agregar constantes nombradas** para 40%/60% surplus allocation:
```typescript
const SURPLUS_REALLOC_RATIO = 0.40;
const SURPLUS_LIQUIDATE_RATIO = 0.60;
```

4. **Tests nuevos:**
- Test: acciones con impactScore < threshold son filtradas
- Test: constantes de surplus son usadas correctamente

**Archivos a modificar:**
- `src/domain/actionQueue/waterfall.ts`
- `src/features/action-queue/ActionQueuePage.tsx`
- `src/features/action-queue/hooks/useActionQueue.ts`
- `src/domain/actionQueue/__tests__/waterfall.test.ts`

---

### FASE R3: Vista agrupada + cards resumen

**Esfuerzo:** 4-6h · **Impacto:** MUY ALTO (transforma UX) · **Prioridad:** 1

**Tareas:**

1. **Selector de vista**: "Por Tienda" | "Por Marca" | "Por Categoría" | "Lista plana"

2. **Componente `ActionGroupCard`**:
```
┌─────────────────────────────────────────────────────┐
│ CERROALTO (Cluster B)                               │
│ 47 acciones · 15 críticas · Horario: antes 10am     │
│ Impacto: Gs. 45M · Assortment: 2,800/3,000         │
│ [▸ Expandir]  [☐ Seleccionar todo]                  │
├─────────────────────────────────────────────────────┤
│   → ActionQueueTable (colapsable) con filas del     │
│     grupo                                           │
└─────────────────────────────────────────────────────┘
```

3. **Lógica de agrupación** — función pura en domain:
```typescript
function groupActions(
  items: ActionItemFull[],
  groupBy: "store" | "brand" | "categoria",
): ActionGroup[]
```

4. **Stats por grupo**: total acciones, críticas, impacto total, assortment usado/capacidad

5. **Sort de grupos**: por impacto total descendente (tiendas con más problemas primero)

**Archivos nuevos:**
- `src/domain/actionQueue/grouping.ts`
- `src/features/action-queue/components/ActionGroupCard.tsx`
- `src/features/action-queue/components/ViewSelector.tsx`

**Archivos a modificar:**
- `src/features/action-queue/ActionQueuePage.tsx`
- `src/features/action-queue/hooks/useActionQueue.ts`

---

### FASE R4: Dashboard resumen "Hoy hacé esto"

**Esfuerzo:** 3-4h · **Impacto:** ALTO (actionable insights) · **Prioridad:** 2

**Tareas:**

1. **Reemplazar StatCards** con cards contextuales accionables:

```
⚠️ 3 tiendas necesitan reposición URGENTE
   CERROALTO (15 SKUs sin stock) · ESTRELLA (12) · TOSUR (8)
   [Ver acciones →]

📦 RETAILS necesita resurtido de STOCK para 8 SKUs
   Wrangler: 5 SKUs · Martel: 3 SKUs
   [Ver acciones →]

🔄 47 transferencias entre tiendas posibles
   Impacto: Gs. 234M — 80% en top 12 acciones
   [Ver acciones →]

📊 Resumen: 287 acciones Pareto = 80% del impacto
   De 2,341 acciones totales · Gs. 1.2B impacto total
```

2. **Cada card es clickeable** → filtra la vista de abajo al segmento correspondiente

3. **Lógica de derivación** — función pura:
```typescript
function computeDashboardInsights(items: ActionItemFull[]): DashboardInsight[]
```

**Archivos nuevos:**
- `src/domain/actionQueue/insights.ts`
- `src/features/action-queue/components/ActionDashboard.tsx`

---

### FASE R5: Selección + export selectivo

**Esfuerzo:** 2-3h · **Impacto:** MEDIO (operacional) · **Prioridad:** 3

**Tareas:**

1. **Checkboxes** en cada fila y en header de cada grupo (seleccionar todo del grupo)

2. **State de selección**: `Set<string>` de IDs seleccionados en el hook

3. **Barra flotante** cuando hay selección:
```
┌──────────────────────────────────────────────────────┐
│ 12 acciones seleccionadas  [Exportar HTML] [Limpiar] │
└──────────────────────────────────────────────────────┘
```

4. **Export selectivo** — `downloadActionQueueHtml` recibe solo las acciones seleccionadas

5. **Export por tienda** — genera HTML agrupado por tienda (para enviar a cada encargado su lista)

**Archivos a modificar:**
- `src/features/action-queue/ActionQueuePage.tsx`
- `src/features/action-queue/components/ActionQueueTable.tsx`
- `src/features/action-queue/components/exportHtml.ts`
- `src/features/action-queue/hooks/useActionQueue.ts`

---

### FASE R6: Integración SISO (futuro, requiere confirmación cliente)

**Esfuerzo:** 4-6h · **Impacto:** MEDIO · **Prioridad:** FUTURO

**Dependencia:** Confirmar con Rodrigo si el modelo SISO del Excel es fuente de verdad operativa o solo ejercicio de planificación.

**Tareas potenciales:**
1. Importar targets SISO a Supabase (o JSON estático)
2. Calcular MOS con Sell-Out proyectado (no solo historial)
3. Alertar cuando stock proyectado se vuelve negativo según modelo
4. Priorizar categorías según peso SISO (Camisas 36%, Remeras 21%, Vaqueros 20%)
5. Mostrar Sell-In pendiente (compras necesarias) por marca/categoría

---

## Resumen de Esfuerzo

| Fase | Esfuerzo | Impacto | Dependencia |
|------|----------|---------|-------------|
| R1: Limpieza datos | 1-2h | Correctitud | Ninguna |
| R2: Threshold + Pareto | 2-3h | ALTO | Ninguna |
| R3: Vista agrupada | 4-6h | MUY ALTO | R2 completado |
| R4: Dashboard resumen | 3-4h | ALTO | R3 completado |
| R5: Selección + export | 2-3h | MEDIO | R3 completado |
| R6: SISO integration | 4-6h | MEDIO | Confirmación cliente |
| **Total R1-R5** | **12-18h** | | |

---

## Decisiones Pendientes del Cliente

Ver documento `PREGUNTAS_CLIENTE_COLA_ACCIONES.md` para lista completa de preguntas que necesitan respuesta antes de R3-R6.
