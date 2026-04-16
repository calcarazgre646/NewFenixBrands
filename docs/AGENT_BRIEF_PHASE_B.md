# BRIEF PARA AGENTE — FASE B: Persistencia Silenciosa

## Tu rol
Sos un agente de frontend/backend. Tu trabajo es hacer que cada ejecución del motor de decisiones (waterfall) se registre automáticamente en la base de datos, SIN cambiar la experiencia del usuario. Fire-and-forget: si el persist falla, la UI sigue funcionando igual.

## Contexto del proyecto

**Path:** `/Users/prueba/Downloads/NewFenixBrands`
**Stack:** React 19 + TypeScript strict + Vite + TanStack Query v5 + Supabase + React Router v7
**Estado:** EN PRODUCCIÓN. 1060 tests (29 suites). TSC 0 errores.
**BD:** 2 Supabase clients en `src/api/client.ts`:
  - `dataClient` — BD operacional (ventas, inventario, ERP)
  - `authClient` — BD app (profiles, calendar, config, y ahora las tablas de trazabilidad)

## PROCESO OBLIGATORIO — AUDITAR ANTES DE CAMBIAR

Antes de escribir UNA línea de código, DEBÉS leer y entender estos archivos:

### Archivos que DEBÉS leer (en este orden)

1. **`docs/AUDIT_DECISION_TRACEABILITY.md`** — El diseño completo de esta feature. Leé Partes 1-4.
2. **`sql/015_decision_traceability.sql`** — Las tablas que Fase A creó. Entendé cada columna.
3. **`src/domain/actionQueue/types.ts`** — Los tipos ActionItem, WaterfallInput, InventoryRecord. Tu código de persistencia mapea ESTOS tipos a las columnas de `decision_actions`.
4. **`src/features/action-queue/hooks/useActionQueue.ts`** — EL HOOK QUE VAS A MODIFICAR. Entendé el flujo completo: qué queries ejecuta, qué computa, qué retorna.
5. **`src/queries/keys.ts`** — Query key factories. Vas a agregar keys nuevos aquí.
6. **`src/api/client.ts`** — Los 2 Supabase clients. Las tablas de trazabilidad usan `authClient`.
7. **`src/context/AuthContext.tsx`** — Para obtener el `session.user.id` del usuario actual.
8. **`src/domain/config/types.ts`** — WaterfallConfig y otros tipos de config.
9. **`src/queries/config.queries.ts`** — Para entender cómo se fetchean los params de config (los vas a snapshotear).

### Archivos de referencia (para entender patrones)

10. **`src/queries/sales.queries.ts`** — Ejemplo de cómo el proyecto estructura queries.
11. **`src/hooks/useConfig.ts`** — Ejemplo de hooks con TanStack Query + fallbacks.

## Reglas de arquitectura del proyecto (NO negociar)

1. **Queries** en `src/queries/` — solo fetch + normalizacion, sin lógica de negocio
2. **Domain** en `src/domain/` — funciones puras, sin React, sin side effects
3. **Hooks** en `src/features/[feature]/hooks/` — unen queries + domain
4. **Componentes** — solo UI, sin lógica
5. **Imports:** El proyecto usa `@/` como alias para `src/` (configurado en tsconfig + vite)
6. **TanStack Query:** staleTime 10min para config, queryKey factories en `queries/keys.ts`
7. **Supabase:** `.from("tabla").insert({...}).select("id").single()` es el patrón estándar
8. **Tipos:** TypeScript strict. NO usar `any`. NO usar `as` casting excepto donde sea inevitable.

## Archivos a CREAR (4)

### 1. `src/domain/decisions/types.ts`
Tipos puros para el sistema de trazabilidad. Deben mapear 1:1 con las columnas de las tablas SQL.

Tipos necesarios:
- `DecisionRunInsert` — lo que se envía al INSERT de decision_runs
- `DecisionActionInsert` — lo que se envía al INSERT de decision_actions (sin los campos de review)
- `DecisionRun` — row completa (con id, triggered_at)
- `DecisionAction` — row completa (con id, status, reviewed_by, etc.)
- `ConfigVersionInsert` — lo que se envía al INSERT de config_versions
- `ConfigVersion` — row completa

### 2. `src/domain/decisions/diff.ts`
Función pura para computar el diff entre 2 snapshots de config.

```typescript
export function computeConfigDiff(
  previous: { appParams: Record<string, unknown>[]; storeConfig: Record<string, unknown>[]; commissionConfig: Record<string, unknown>[] },
  current: { appParams: Record<string, unknown>[]; storeConfig: Record<string, unknown>[]; commissionConfig: Record<string, unknown>[] }
): ConfigChange[]

type ConfigChange = {
  table: "app_params" | "config_store" | "config_commission_scale";
  key: string;
  field: string;
  old: unknown;
  new: unknown;
}
```

### 3. `src/domain/decisions/__tests__/diff.test.ts`
Tests para computeConfigDiff:
- Diff vacío cuando snapshots son iguales
- Detecta cambio en app_params (valor JSONB)
- Detecta cambio en config_store (cluster, assortment)
- Detecta cambio en config_commission_scale (tiers)
- Detecta agregar/eliminar filas
- Maneja snapshots vacíos

### 4. `src/queries/decisions.queries.ts`
Queries de persistencia usando `authClient`.

Funciones:
- `persistDecisionRun(params)` → retorna `runId: string`
- `persistDecisionActions(runId, actions: ActionItem[])` → void. Batch en chunks de 100.
- `fetchActiveConfigVersion()` → `ConfigVersion | null`
- `snapshotCurrentConfig(userId, reason?)` → retorna `versionId: string`. Hace 3 fetches (app_params, config_store, config_commission_scale), computa diff vs versión anterior, desactiva la anterior, inserta nueva.
- `fetchDecisionRuns(limit?)` → `DecisionRun[]` (para Fase D, pero el query ya queda listo)
- `fetchDecisionActions(runId)` → `DecisionAction[]` (para Fase D)

## Archivo a MODIFICAR (2)

### 5. `src/queries/keys.ts`
Agregar query key factories:
```typescript
export const decisionKeys = {
  all: ["decisions"] as const,
  runs: () => [...decisionKeys.all, "runs"] as const,
  run: (id: string) => [...decisionKeys.all, "run", id] as const,
  actions: (runId: string) => [...decisionKeys.all, "actions", runId] as const,
  activeConfigVersion: () => ["config", "activeVersion"] as const,
};
```

### 6. `src/features/action-queue/hooks/useActionQueue.ts`
Este es EL CAMBIO CRÍTICO. Debés:

1. Importar `persistDecisionRun`, `persistDecisionActions` desde queries
2. Importar `useAuth` o `useSession` para obtener el userId
3. DESPUÉS de que `computeActionQueue()` retorne resultados, persistir en background
4. Usar un `useRef<string | null>(null)` para trackear si ya se persistió este run (evitar duplicados)
5. Usar un `useEffect` que reaccione cuando `items` cambia Y tiene length > 0

**REGLAS CRÍTICAS para esta modificación:**
- La persistencia es FIRE-AND-FORGET. Si falla, `console.error` y nada más.
- NO bloquear el render esperando el persist.
- NO cambiar el return type del hook.
- NO cambiar el flujo de loading/error existente.
- Resetear el `runId.current = null` cuando los filtros cambien (para que una nueva ejecución genere un nuevo run).
- Medir el `computationMs` con `performance.now()` alrededor del `computeActionQueue()` call.

**Patrón:**
```typescript
// DENTRO del hook, después de computeActionQueue:
const persistedRunId = useRef<string | null>(null);
const prevFilterKey = useRef<string>("");

useEffect(() => {
  const filterKey = JSON.stringify(filters);
  if (filterKey !== prevFilterKey.current) {
    persistedRunId.current = null;
    prevFilterKey.current = filterKey;
  }
  
  if (!items.length || persistedRunId.current) return;
  
  persistDecisionRun({...})
    .then(runId => {
      persistedRunId.current = runId;
      return persistDecisionActions(runId, items);
    })
    .catch(err => console.error("[decision-persist]", err));
}, [items, filters]);
```

## Qué NO hacer

- NO crear componentes UI (eso es Fase C y D)
- NO modificar ActionQueuePage.tsx ni ningún componente
- NO modificar waterfall.ts ni ningún archivo de domain/actionQueue (excepto agregar imports de tipos si es necesario)
- NO agregar dependencias al package.json
- NO modificar ningún test existente
- NO usar `any` en tipos
- NO crear archivos fuera de `src/domain/decisions/`, `src/queries/`, y los 2 archivos a modificar

## Verificación

Después de todos los cambios:
1. Correr `npx tsc --noEmit` — debe dar 0 errores
2. Correr `npx vitest run` — los 1060 tests existentes deben seguir pasando + tus tests nuevos
3. Correr `npx vite build` — debe compilar OK
4. Verificar que NO cambiaste el comportamiento visible del Centro de Acciones

## Entregable

1. 4 archivos nuevos creados (types, diff, diff.test, queries)
2. 2 archivos modificados (keys.ts, useActionQueue.ts)
3. TSC 0 errores
4. Tests existentes pasando + tests nuevos del diff
5. Build OK
