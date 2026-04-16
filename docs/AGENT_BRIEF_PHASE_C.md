# BRIEF PARA AGENTE — FASE C: Workflow de Review

## Tu rol
Sos un agente de frontend. Tu trabajo es agregar controles de aprobación/rechazo de acciones en la UI existente del Centro de Acciones. Los usuarios deben poder marcar cada recomendación como "aprobada", "rechazada" o "ejecutada", y ese estado debe persistirse en la tabla `decision_actions`.

## Contexto del proyecto

**Path:** `/Users/prueba/Downloads/NewFenixBrands`
**Stack:** React 19 + TypeScript strict + Vite + Tailwind CSS v4 + TanStack Query v5 + Supabase + React Router v7
**Estado:** EN PRODUCCIÓN. ~1060+ tests. TSC 0 errores.
**Design system:** Componentes propios en `src/components/ui/` (Badge, Button, Card, Modal, Tabs, Table, Tooltip, Spinner, etc.)

## PROCESO OBLIGATORIO — AUDITAR ANTES DE CAMBIAR

Antes de escribir UNA línea de código, DEBÉS leer y entender estos archivos:

### Archivos que DEBÉS leer (en este orden)

1. **`docs/AUDIT_DECISION_TRACEABILITY.md`** — Partes 2.3 (Paso 3: Workflow) y 2.4 (Mapa de archivos)
2. **`sql/015_decision_traceability.sql`** — Entiende las columnas de `decision_actions`: status, reviewed_by, reviewed_at, review_notes, executed_at, executed_by
3. **`src/domain/decisions/types.ts`** — Tipos DecisionAction, DecisionRun (creados en Fase B)
4. **`src/queries/decisions.queries.ts`** — Funciones de persistencia (creadas en Fase B). Si hay funciones `reviewAction`, `markActionExecuted`, `bulkReviewActions`, usalas. Si no existen, crealas vos.
5. **`src/features/action-queue/hooks/useActionQueue.ts`** — Entendé qué retorna el hook y cómo se usa
6. **`src/features/action-queue/ActionQueuePage.tsx`** — Shell de la página (2 tabs)
7. **`src/features/action-queue/components/ActionsTab.tsx`** — Tab "Acciones" que muestra los grupos
8. **`src/features/action-queue/components/CompactActionList.tsx`** — TABLA de acciones individuales. AQUÍ vas a agregar los controles de review.
9. **`src/features/action-queue/components/ActionGroupCard.tsx`** — Card de grupo con header colapsible. AQUÍ vas a agregar status summary.
10. **`src/components/ui/badge/Badge.tsx`** — Para entender el sistema de badges existente
11. **`src/components/ui/button/Button.tsx`** — Para entender el sistema de botones
12. **`src/components/ui/modal/index.tsx`** — Para el modal de notas de review
13. **`src/context/AuthContext.tsx`** — Para obtener user.id y role del usuario actual

### Archivos de referencia (patrones de mutation)

14. **`src/features/users/hooks/useUsers.ts`** — Ejemplo de mutations con TanStack Query en este proyecto
15. **`src/features/calendar/hooks/useCalendar.ts`** — Otro ejemplo de mutations

## Reglas de arquitectura (NO negociar)

1. **Queries** en `src/queries/` — los mutations de review van aquí
2. **Hooks** en `src/features/action-queue/hooks/` — el hook de review va aquí
3. **Componentes** — solo UI, sin lógica de negocio
4. **TanStack Query:** useMutation con invalidateQueries para actualizar la cache
5. **Tailwind v4:** clases utility directas, NO CSS modules
6. **Accesibilidad:** aria-labels en botones icon-only, focus visible
7. **Imports:** `@/` alias para `src/`
8. **Roles:** Solo `super_user` y `gerencia` pueden aprobar/rechazar. `negocio` solo puede ver.

## Archivos a CREAR (2)

### 1. `src/features/action-queue/hooks/useActionReview.ts`

Hook que expone las mutations de review:

```typescript
export function useActionReview() {
  const queryClient = useQueryClient();
  const { session } = useAuth(); // o como se acceda al user
  
  const reviewMutation = useMutation({
    mutationFn: (params: { actionId: string; status: "approved" | "rejected"; notes?: string }) =>
      reviewAction({ ...params, reviewedBy: session.user.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: decisionKeys.all });
    },
  });
  
  const executeMutation = useMutation({
    mutationFn: (actionId: string) =>
      markActionExecuted({ actionId, executedBy: session.user.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: decisionKeys.all });
    },
  });
  
  const bulkReviewMutation = useMutation({
    mutationFn: (params: { actionIds: string[]; status: "approved" | "rejected"; notes?: string }) =>
      bulkReviewActions({ ...params, reviewedBy: session.user.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: decisionKeys.all });
    },
  });
  
  return { reviewMutation, executeMutation, bulkReviewMutation };
}
```

### 2. `src/features/action-queue/components/ReviewNoteModal.tsx`

Modal simple para agregar notas al rechazar una acción:
- Input de texto (textarea, 3 líneas)
- Botón "Confirmar" + "Cancelar"
- Se abre solo al rechazar (aprobar no requiere nota)
- Título: "Motivo del rechazo"

## Archivos a MODIFICAR (4)

### 3. `src/queries/decisions.queries.ts`

Si las funciones de review NO existen (verificá primero), agregar:

```typescript
export async function reviewAction(params: {
  actionId: string;
  status: "approved" | "rejected";
  reviewedBy: string;
  notes?: string;
}): Promise<void> {
  const { error } = await authClient
    .from("decision_actions")
    .update({
      status: params.status,
      reviewed_by: params.reviewedBy,
      reviewed_at: new Date().toISOString(),
      review_notes: params.notes ?? null,
    })
    .eq("id", params.actionId);
  if (error) throw error;
}

export async function markActionExecuted(params: {
  actionId: string;
  executedBy: string;
}): Promise<void> {
  const { error } = await authClient
    .from("decision_actions")
    .update({
      status: "executed",
      executed_by: params.executedBy,
      executed_at: new Date().toISOString(),
    })
    .eq("id", params.actionId);
  if (error) throw error;
}

export async function bulkReviewActions(params: {
  actionIds: string[];
  status: "approved" | "rejected";
  reviewedBy: string;
  notes?: string;
}): Promise<void> {
  const { error } = await authClient
    .from("decision_actions")
    .update({
      status: params.status,
      reviewed_by: params.reviewedBy,
      reviewed_at: new Date().toISOString(),
      review_notes: params.notes ?? null,
    })
    .in("id", params.actionIds);
  if (error) throw error;
}
```

### 4. `src/features/action-queue/components/CompactActionList.tsx`

Este componente renderiza las filas de acciones en una tabla. Modificar para agregar:

**Por cada fila de acción:**
- Status badge a la derecha: 
  - `pending` → gris "Pendiente"
  - `approved` → verde "Aprobada"
  - `rejected` → rojo "Rechazada"
  - `executed` → azul "Ejecutada"
- 2 botones icon-only (check + X) visibles solo para `pending` y solo si el usuario tiene permiso (super_user o gerencia)
- Al hacer click en check → approve inmediatamente
- Al hacer click en X → abrir ReviewNoteModal → reject con nota
- Botón "Marcar ejecutada" (solo aparece si status = approved)

**Consideraciones:**
- Los botones deben ser pequeños (24x24px) para no romper el layout existente de la tabla
- Usar colores del design system existente (green-500, red-500, blue-500, gray-400)
- Loading state en botones durante mutation
- Disabled state si otra mutation está en progreso

### 5. `src/features/action-queue/components/ActionGroupCard.tsx`

En el header de cada grupo, agregar un summary de status:
- Pill que muestre "3/10 aprobadas" o "7 pendientes"
- Solo visible si hay un run_id activo (es decir, las acciones fueron persistidas)

### 6. `src/features/action-queue/components/ActionsTab.tsx`

Agregar controles de bulk review arriba de los grupos:
- "Aprobar todas las Pareto" — botón que aprueba todas las acciones con paretoFlag=true
- "Aprobar todas" — botón que aprueba todas las pendientes del run actual
- Solo visibles para super_user/gerencia
- Con confirmation dialog antes de ejecutar

## Cómo conectar las acciones persistidas con la UI

El hook `useActionQueue` retorna `items: ActionItem[]` que son COMPUTADAS en memoria. Después de Fase B, estas acciones también se persisten en `decision_actions` con un `run_id`.

Para conectar:
1. El hook `useActionQueue` debe exponer el `runId` del run persistido (Fase B agregó un ref)
2. Los `ActionItem` tienen un `id` (UUID generado en waterfall.ts) que se usa como PK en `decision_actions`
3. Para obtener el status actual de cada acción, podés:
   - **Opción A (recomendada):** Fetch `decision_actions` por `run_id` y crear un `Map<actionId, status>` que se cruza con los items en memoria
   - **Opción B:** Agregar el status al ActionItem en el hook

**USA Opción A** — no contamina el domain layer con estado de workflow.

Creá un hook adicional:
```typescript
function useActionStatuses(runId: string | null) {
  return useQuery({
    queryKey: decisionKeys.actions(runId ?? ""),
    queryFn: () => fetchDecisionActions(runId!),
    enabled: !!runId,
    select: (actions) => new Map(actions.map(a => [a.id, { status: a.status, reviewedBy: a.reviewed_by, reviewedAt: a.reviewed_at }])),
  });
}
```

## Qué NO hacer

- NO modificar `waterfall.ts`, `grouping.ts`, `purchasePlanning.ts`, ni ningún archivo en `domain/actionQueue/`
- NO modificar `useActionQueue.ts` (Fase B ya lo modificó — no tocar)
- NO crear nuevas páginas/rutas (eso es Fase D)
- NO modificar `ActionQueuePage.tsx` excepto si necesitás pasar props adicionales
- NO modificar `PurchasePlanningTab.tsx` (la tab de compras no tiene review)
- NO agregar dependencias
- NO cambiar el layout general de la tabla de acciones
- NO romper la funcionalidad de export HTML

## Verificación

Después de todos los cambios:
1. `npx tsc --noEmit` — 0 errores
2. `npx vitest run` — todos los tests existentes pasan
3. `npx vite build` — build OK
4. Verificar visualmente que:
   - La tabla de acciones sigue mostrando la misma info
   - Los badges de status aparecen (pueden estar todos en "pending" si no hay datos)
   - Los botones de review solo aparecen para usuarios con permiso
   - El modal de notas funciona

## Entregable

1. 2 archivos nuevos (useActionReview.ts, ReviewNoteModal.tsx)
2. 4 archivos modificados (decisions.queries.ts, CompactActionList.tsx, ActionGroupCard.tsx, ActionsTab.tsx)
3. TSC 0 errores
4. Tests pasando
5. Build OK
