# BRIEF PARA AGENTE — FASE D: Vista de Historial de Decisiones

## Tu rol
Sos un agente de frontend. Tu trabajo es crear una nueva página `/decisiones` que muestre el historial completo de ejecuciones del motor de decisiones, detalle de acciones generadas, y cambios de configuración. Es una página de LECTURA — no modifica datos.

## Contexto del proyecto

**Path:** `/Users/prueba/Downloads/NewFenixBrands`
**Stack:** React 19 + TypeScript strict + Vite + Tailwind CSS v4 + TanStack Query v5 + Supabase + React Router v7
**Estado:** EN PRODUCCIÓN. ~1060+ tests. TSC 0 errores.
**Design system:** Componentes propios en `src/components/ui/`

## PROCESO OBLIGATORIO — AUDITAR ANTES DE CAMBIAR

Antes de escribir código, DEBÉS leer estos archivos para entender los patrones del proyecto:

### Archivos que DEBÉS leer (en este orden)

1. **`docs/AUDIT_DECISION_TRACEABILITY.md`** — Parte 2.5 (UI de trazabilidad) y 2.7 (Queries útiles)
2. **`sql/015_decision_traceability.sql`** — Estructura de las 4 tablas
3. **`src/domain/decisions/types.ts`** — Tipos DecisionRun, DecisionAction, ConfigVersion
4. **`src/queries/decisions.queries.ts`** — Queries existentes (fetchDecisionRuns, fetchDecisionActions, fetchActiveConfigVersion)
5. **`src/App.tsx`** — Para entender el patrón de rutas y guards
6. **Una página existente como referencia de estructura:**
   - `src/features/logistics/LogisticsPage.tsx` — buen ejemplo de página con stats + tabla
   - `src/features/action-queue/ActionQueuePage.tsx` — ejemplo de página con tabs
7. **Componentes UI existentes que vas a reusar:**
   - `src/components/ui/page-header/PageHeader.tsx`
   - `src/components/ui/card/Card.tsx`
   - `src/components/ui/table/index.tsx`
   - `src/components/ui/badge/Badge.tsx`
   - `src/components/ui/tabs/Tabs.tsx`
   - `src/components/ui/empty-state/EmptyState.tsx`
   - `src/components/ui/spinner/Spinner.tsx`
   - `src/components/ui/stat-card/StatCard.tsx`
   - `src/components/ui/skeleton/Skeleton.tsx`
8. **`src/layout/AppSidebar.tsx`** — Para agregar el item de navegación
9. **`src/domain/auth/types.ts`** — Roles y permisos (para saber quién ve esta página)
10. **`src/queries/keys.ts`** — decisionKeys (creados en Fase B)
11. **`src/hooks/useConfig.ts`** — Patrón de hooks con TanStack Query

### Entendé el sistema de permisos

```typescript
// domain/auth/types.ts
type Role = "super_user" | "gerencia" | "negocio";

// Quién ve /decisiones: solo super_user y gerencia
// Mismo patrón que /comisiones o /depositos
```

## Reglas de arquitectura (NO negociar)

1. **Queries** en `src/queries/` — ya existen en `decisions.queries.ts`
2. **Hooks** en `src/features/decisions/hooks/`
3. **Componentes** en `src/features/decisions/components/`
4. **Página** en `src/features/decisions/DecisionHistoryPage.tsx`
5. **Tailwind v4:** clases utility. Seguir el estilo visual existente (dark/light mode).
6. **Lazy loading:** La página se importa con `React.lazy()` en App.tsx
7. **Imports:** `@/` alias
8. **Responsive:** La página debe funcionar en desktop (1280px+). Mobile es nice-to-have.

## Archivos a CREAR (5)

### 1. `src/features/decisions/DecisionHistoryPage.tsx`

Página principal con 3 tabs:
- **"Ejecuciones"** — Timeline de decision_runs
- **"Configuración"** — Historial de config_versions
- **"Auditoría"** — config_audit_log (cambios granulares)

Layout:
```
PageHeader: "Historial de Decisiones" con subtítulo "Trazabilidad del motor de acciones"
┌──────────────────────────────────────────────┐
│ Stats: Total runs │ Acciones generadas │ ... │
├──────────────────────────────────────────────┤
│ [Ejecuciones] [Configuración] [Auditoría]    │
├──────────────────────────────────────────────┤
│ Contenido del tab activo                     │
└──────────────────────────────────────────────┘
```

### 2. `src/features/decisions/components/RunsTimeline.tsx`

Lista cronológica de ejecuciones (decision_runs):

Cada run muestra:
- Fecha/hora formateada (ej: "05 Abr 2026, 14:32")
- Quién lo ejecutó (full_name de profiles)
- Tipo (waterfall/purchase_planning/commissions)
- Stats: total_actions, total_gap_units, total_impact_gs, computation_ms
- Filtros usados (brand, channel, year)
- Badge con config_version si existe
- Click → expande para mostrar RunDetailView

Paginación: mostrar 20 runs a la vez, botón "Cargar más".

### 3. `src/features/decisions/components/RunDetailView.tsx`

Vista de detalle de un run específico (expandible dentro de RunsTimeline):

Muestra:
- **Stats bar:** total_actions, pareto_count, critical_count, gap_units, impact_gs
- **Tabla de acciones:** Todas las decision_actions de ese run_id
  - Columnas: Rank, SKU, Talle, Marca, Tienda, Acción recomendada, Ideal, Gap, Impacto, Riesgo, Status
  - Status con badge coloreado (pending/approved/rejected/executed)
  - Si reviewed_by → mostrar nombre + fecha
  - Sortable por rank o impact
  - Paginación (50 por página)
- **Resumen de review:** "15 aprobadas, 3 rechazadas, 82 pendientes"

### 4. `src/features/decisions/components/ConfigHistoryView.tsx`

Lista de config_versions con diffs:

Cada versión muestra:
- Fecha + quién la creó
- Razón del cambio (si existe)
- Badge "Activa" para la versión vigente
- **Diff visual:** Lista de cambios con old→new
  - Tabla: | Campo | Antes | Después |
  - Colores: rojo para valores removidos, verde para nuevos
  - Agrupado por tabla (app_params, config_store, commission_scale)

Si no hay versiones, mostrar EmptyState "Sin cambios de configuración registrados".

### 5. `src/features/decisions/hooks/useDecisionHistory.ts`

Hook que orchesta los queries:

```typescript
export function useDecisionHistory() {
  const runsQuery = useQuery({
    queryKey: decisionKeys.runs(),
    queryFn: () => fetchDecisionRuns(50),
  });
  
  return { runs: runsQuery.data ?? [], isLoading: runsQuery.isLoading };
}

export function useRunDetail(runId: string | null) {
  return useQuery({
    queryKey: decisionKeys.actions(runId ?? ""),
    queryFn: () => fetchDecisionActions(runId!),
    enabled: !!runId,
  });
}

export function useConfigHistory() {
  return useQuery({
    queryKey: decisionKeys.activeConfigVersion(),
    queryFn: () => fetchConfigVersions(), // necesitás agregar esta query si no existe
  });
}
```

## Archivos a MODIFICAR (3)

### 6. `src/App.tsx`

Agregar la ruta `/decisiones`:
- Lazy import del componente
- Dentro de PermissionGuard con roles `["super_user", "gerencia"]`
- Mismo patrón que `/depositos` o `/comisiones`

Leé App.tsx para ver el patrón exacto. Probablemente algo como:
```typescript
const DecisionHistoryPage = lazy(() => import("./features/decisions/DecisionHistoryPage"));

// Dentro de las rutas protegidas:
<Route path="/decisiones" element={
  <PermissionGuard allowed={["super_user", "gerencia"]}>
    <DecisionHistoryPage />
  </PermissionGuard>
} />
```

### 7. `src/layout/AppSidebar.tsx`

Agregar item "Decisiones" en la sección de Control (junto a Usuarios y Comisiones):
- Icono: usa un icono SVG existente del proyecto o crea uno simple (clipboard-check o history)
- Visible solo para super_user y gerencia (mismo patrón que otros items restringidos)
- Path: `/decisiones`

### 8. `src/queries/decisions.queries.ts`

Si necesitás queries adicionales que no existen, agregalas aquí. Probablemente necesités:
- `fetchConfigVersions(limit?)` — todas las versiones ordenadas por fecha
- `fetchConfigAuditLog(limit?)` — log de cambios granulares
- `fetchRunWithProfile(runId)` — run + JOIN con profiles para el nombre del usuario

Usá el patrón existente de queries del proyecto. Ejemplo:
```typescript
export async function fetchConfigVersions(limit = 20): Promise<ConfigVersion[]> {
  const { data, error } = await authClient
    .from("config_versions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}
```

## Diseño visual

Seguí el estilo visual del resto del proyecto:
- **Fondo:** bg-white dark:bg-gray-900 (o el patrón que veas en otras páginas)
- **Cards:** Usar el componente Card existente
- **Stats:** Usar StatCard existente
- **Tablas:** Usar el componente Table existente
- **Badges:** Reusar Badge con variants existentes
- **Empty states:** Usar EmptyState existente
- **Loading:** Usar Spinner o Skeleton existentes

**NO inventar un design system nuevo.** Reusar TODO lo que el proyecto ya tiene.

## Qué NO hacer

- NO modificar ningún archivo en `features/action-queue/` (eso es Fase C)
- NO modificar `waterfall.ts` ni ningún archivo de domain
- NO crear nuevas tablas SQL
- NO agregar dependencias
- NO crear componentes UI base (usar los existentes en components/ui/)
- NO implementar escritura/modificación de datos (esta página es READ-ONLY)
- NO hacer la página responsive para mobile (desktop-first, mobile es nice-to-have)
- NO agregar tests nuevos para los componentes de UI (los tests de queries ya existen de Fase B)

## Verificación

Después de todos los cambios:
1. `npx tsc --noEmit` — 0 errores
2. `npx vitest run` — todos los tests pasan
3. `npx vite build` — build OK
4. La ruta `/decisiones` es accesible desde el sidebar
5. La página carga sin errores (puede mostrar estados vacíos si no hay datos)
6. Los 3 tabs funcionan
7. El detail view se expande/colapsa

## Entregable

1. 5 archivos nuevos (página + 3 componentes + hook)
2. 3 archivos modificados (App.tsx, AppSidebar.tsx, decisions.queries.ts)
3. TSC 0 errores
4. Tests pasando
5. Build OK
