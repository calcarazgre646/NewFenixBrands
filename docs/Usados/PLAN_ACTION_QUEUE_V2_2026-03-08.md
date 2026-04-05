# Plan de Implementación — Cola de Acciones v2

**Fecha:** 2026-03-08
**Basado en:** `docs/AUDIT_ACTION_QUEUE_2026-03-08.md`

---

## Principio Rector

> De "dump de 14K filas" a "centro de operaciones diario con acciones priorizadas y agrupadas"

---

## Fase R1: Limpieza de datos y correcciones inmediatas

**Esfuerzo:** 1-2h
**Impacto:** Correctitud de datos
**Prioridad:** HACER YA

### Tareas:

1. **Fix comentario cluster `clusters.ts`** — Mover WRMULTIPLAZA bajo sección Cluster A
2. **Fix texto "12m" → "6m"** en `ActionQueuePage.tsx:177`
3. **Agregar assortment capacity** a `clusters.ts`:
   ```
   MARTELMCAL: 5500, TOLUQ: 5500, TOSUR: 5500,
   SHOPPINEDO: 4000, WRPINEDO: 3500, MARTELSSL: 3300,
   CERROALTO: 3000, ESTRELLA: 3000, GALERIAWRLEE: 3000, WRSSL: 3000,
   SHOPMARIANO: 2500, WRMULTIPLAZA: 2000
   ```
4. **Agregar price mix por cluster** a `clusters.ts`:
   ```
   A:   { normal: 1.00, sale: 0.00, outlet: 0.00 }
   B:   { normal: 0.57, sale: 0.43, outlet: 0.00 }
   OUT: { normal: 0.00, sale: 0.40, outlet: 0.60 }
   ```
5. **Actualizar horarios** — Agregar nota "optimizar ruta" donde la imagen lo indica
6. **Nombrar constantes hardcoded** — `SURPLUS_REALLOC_RATIO = 0.40`, `SURPLUS_LIQUIDATE_RATIO = 0.60`

### Archivos a tocar:
- `src/domain/actionQueue/clusters.ts`
- `src/features/action-queue/ActionQueuePage.tsx`
- `src/domain/actionQueue/waterfall.ts` (constantes)

---

## Fase R2: Threshold mínimo + Pareto como default

**Esfuerzo:** 2-3h
**Impacto:** ALTO — reduce ruido ~80%
**Prioridad:** HACER YA

### Tareas:

1. **`MIN_IMPACT_THRESHOLD`** en `waterfall.ts`:
   - Filtrar acciones con `impactScore < 500_000` (Gs. 500K)
   - Aplicar DESPUÉS del sort, ANTES del Pareto flagging
   - Mantener el número total sin filtrar en stats para contexto

2. **Pareto como vista default**:
   - Nuevo estado en `useActionQueue`: `showOnlyPareto: boolean` (default `true`)
   - Cuando `showOnlyPareto=true`, `items` devuelve solo `paretoFlag === true`
   - Toggle en la UI: "Mostrar solo Pareto" / "Ver todas las acciones"
   - Stats siempre muestran totales (con y sin Pareto)

3. **Assortment cap** en `waterfall.ts`:
   - Antes de generar acción de reposición, verificar:
     `currentStock + suggestedUnits <= STORE_ASSORTMENT[store]`
   - Si excede, reducir suggestedUnits al máximo posible
   - Si no hay assortment definido, no aplicar cap (backward compatible)

### Archivos a tocar:
- `src/domain/actionQueue/waterfall.ts`
- `src/domain/actionQueue/clusters.ts` (assortment data)
- `src/features/action-queue/hooks/useActionQueue.ts` (pareto toggle)
- `src/features/action-queue/ActionQueuePage.tsx` (pareto toggle UI)

### Tests a agregar:
- Test: acciones bajo threshold se filtran
- Test: Pareto filter devuelve solo flagged items
- Test: assortment cap reduce suggested units
- Test: sin assortment definido, no cap

---

## Fase R3: Vista agrupada + cards resumen

**Esfuerzo:** 4-6h
**Impacto:** MUY ALTO — transforma la UX
**Prioridad:** PRIORIDAD 1 (después de R1+R2)

### Tareas:

1. **Selector de vista** — Toggle en header:
   - "Por Tienda" (default)
   - "Por Marca"
   - "Por Categoría"
   - "Lista plana" (vista actual)

2. **Componente `ActionGroupCard`**:
   ```
   ┌──────────────────────────────────────────────────┐
   │ CERROALTO (Cluster B)                            │
   │ 47 acciones · 15 críticas · Horario: antes 10am  │
   │ Impacto: Gs. 45M · Stock: 2,800/3,000            │
   │ [▸ Expandir]  [☐ Seleccionar todo]               │
   ├──────────────────────────────────────────────────┤
   │   → Tabla colapsable con las acciones del grupo  │
   └──────────────────────────────────────────────────┘
   ```

3. **Lógica de agrupación** en hook:
   - `groupBy: "store" | "brand" | "categoria" | "flat"`
   - Post-waterfall: agrupar items → calcular stats por grupo
   - Sort grupos: por impacto total descendente

4. **Stats por grupo**:
   - Total acciones, critical, low, overstock
   - Impacto total en Gs.
   - Stock actual vs assortment (si vista por tienda)
   - MOS promedio (si vista por marca)

### Archivos nuevos:
- `src/features/action-queue/components/ActionGroupCard.tsx`

### Archivos a modificar:
- `src/features/action-queue/hooks/useActionQueue.ts` (groupBy state + agrupación)
- `src/features/action-queue/ActionQueuePage.tsx` (selector de vista + render condicional)

---

## Fase R4: Dashboard resumen "Hoy hacé esto"

**Esfuerzo:** 3-4h
**Impacto:** ALTO
**Prioridad:** PRIORIDAD 2

### Tareas:

1. **Componente `ActionSummaryDashboard`**:
   ```
   ⚠️ 3 tiendas necesitan reposición URGENTE
   CERROALTO (15 SKUs) · ESTRELLA (12) · TOSUR (8)    [Ver →]

   📦 RETAILS necesita resurtido de STOCK para 8 SKUs
   Wrangler: 5 · Martel: 3                             [Ver →]

   🔄 47 transferencias tienda↔tienda posibles
   Impacto: Gs. 234M — 80% en top 12 acciones          [Ver →]

   📊 Pareto: 287 acciones = 80% del impacto
   ```

2. **Cards clickeables** — Cada card filtra la vista de abajo:
   - "Reposición urgente" → filtra risk=critical
   - "Resurtido RETAILS" → filtra level=central_to_depot
   - "Transferencias" → filtra level=store_to_store

3. **Cálculos en hook** — Derivar stats del array de acciones:
   - Top 3 tiendas con más critical
   - Total N3 acciones y sus marcas
   - Total N1 acciones e impacto

### Archivos nuevos:
- `src/features/action-queue/components/ActionSummaryDashboard.tsx`

### Archivos a modificar:
- `src/features/action-queue/ActionQueuePage.tsx` (reemplazar StatCards)
- `src/features/action-queue/hooks/useActionQueue.ts` (dashboard stats)

---

## Fase R5: Selección + export selectivo

**Esfuerzo:** 2-3h
**Impacto:** MEDIO
**Prioridad:** PRIORIDAD 3

### Tareas:

1. **State de selección**: `Set<string>` de IDs seleccionados
2. **Checkboxes** en tabla (header = select all visible, row = toggle individual)
3. **Checkboxes en grupos** (select all del grupo)
4. **Barra flotante de selección**:
   ```
   12 acciones seleccionadas — [Exportar HTML] [Limpiar selección]
   ```
5. **Export selectivo**: `downloadActionQueueHtml(selectedItems, mode)`
6. **Export por tienda**: Genera HTML separado por tienda (para enviar a cada encargado)

### Archivos a modificar:
- `src/features/action-queue/hooks/useActionQueue.ts` (selection state)
- `src/features/action-queue/ActionQueuePage.tsx` (selection bar)
- `src/features/action-queue/components/ActionQueueTable.tsx` (checkboxes)
- `src/features/action-queue/components/ActionGroupCard.tsx` (group checkbox)
- `src/features/action-queue/components/exportHtml.ts` (selective export)

---

## Fase R6: Integración SISO (futuro)

**Esfuerzo:** 4-6h
**Impacto:** MEDIO
**Prioridad:** FUTURO — requiere confirmación del cliente sobre datos SISO

### Tareas:

1. Cargar targets SISO en Supabase (nueva tabla o Budget extendido)
2. Calcular MOS con Sell-Out proyectado (no solo historial)
3. Alertar cuando stock proyectado < 0 según modelo SISO
4. Ponderar acciones por peso de categoría SISO

---

## Resumen de Esfuerzo

| Fase | Horas | Acumulado | Estado |
|------|-------|-----------|--------|
| R1: Limpieza | 1-2h | 1-2h | POR HACER |
| R2: Threshold + Pareto | 2-3h | 3-5h | POR HACER |
| R3: Vista agrupada | 4-6h | 7-11h | PENDIENTE |
| R4: Dashboard | 3-4h | 10-15h | PENDIENTE |
| R5: Selección | 2-3h | 12-18h | PENDIENTE |
| R6: SISO | 4-6h | 16-24h | FUTURO |

---

## Dependencias Externas

| Item | Responsable | Bloquea |
|------|-------------|---------|
| Confirmar clusters 8 tiendas extra | Rodrigo | R1 (parcial) |
| Confirmar threshold mínimo Gs. 500K | Rodrigo | R2 |
| Confirmar vista default (tienda/marca) | Rodrigo | R3 |
| Confirmar si SISO es fuente de verdad | Rodrigo | R6 |
| Assortment de SHOPMCAL (sin dato) | Rodrigo | R1 |
| Horario real de SHOPSANLO | Rodrigo | R1 |
