# Auditoría y Trazabilidad de Decisiones — NewFenixBrands

**Fecha:** 2026-04-05
**Alcance:** Centro de Acciones (waterfall), configuración, y operación general
**Objetivo:** Diagnosticar el estado actual y diseñar la implementación para lograr trazabilidad completa de decisiones del sistema.

---

## PARTE 1 — REPORTE DE ESTRUCTURA DEL PROYECTO

### 1.1 Dimensión del sistema

| Métrica | Valor |
|---------|-------|
| LOC (src/) | 37,676 |
| Features | 10 páginas (13 rutas) |
| Tests | 1,060 (29 suites) |
| Tablas BD | 23 (10 ERP + 6 MVs + 3 config + 2 calendar + 1 profiles + 1 freshness) |
| Edge Functions | 1 (manage-user) |
| Config en producción | 73 filas (24 app_params + 8 commission_scale + 41 config_store) |
| Funciones puras domain/ | ~45 exportadas |
| Queries | 18 archivos en queries/ |
| Deploy | Vercel (producción) |

### 1.2 Arquitectura de capas

```
┌─────────────────────────────────────────────────────┐
│ UI Layer                                             │
│  features/[feature]/components/*.tsx                 │
│  Solo rendering, zero lógica                         │
├─────────────────────────────────────────────────────┤
│ Orchestration Layer                                  │
│  features/[feature]/hooks/use*.ts                    │
│  Une queries + domain + config                       │
├─────────────────────────────────────────────────────┤
│ Domain Layer (PURO — sin React, sin side effects)    │
│  domain/actionQueue/waterfall.ts  → Motor decisiones │
│  domain/actionQueue/grouping.ts   → Agrupación       │
│  domain/actionQueue/purchasePlanning.ts → Compras    │
│  domain/kpis/calculations.ts      → 12 fórmulas KPI │
│  domain/commissions/calculations.ts → Motor comisiones│
│  domain/config/loader.ts          → Config resolution│
├─────────────────────────────────────────────────────┤
│ Data Layer                                           │
│  queries/*.queries.ts  → Fetch + normalize           │
│  api/client.ts         → 2 Supabase clients          │
│  api/normalize.ts      → ERP boundary transform      │
├─────────────────────────────────────────────────────┤
│ State Layer                                          │
│  context/FilterContext.tsx  → Filtros globales        │
│  context/AuthContext.tsx    → Sesión + permisos       │
│  TanStack Query            → Cache servidor           │
├─────────────────────────────────────────────────────┤
│ Storage Layer                                        │
│  Supabase (auth) → profiles, calendar, config        │
│  Supabase (data) → ERP tables, MVs, freshness        │
└─────────────────────────────────────────────────────┘
```

### 1.3 Motor de Decisiones — Centro de Acciones

El Centro de Acciones es el componente central que genera recomendaciones operativas. Su anatomía:

#### Inputs (5 señales)

| # | Input | Fuente BD | Cardinalidad | Refresh |
|---|-------|-----------|-------------|---------|
| 1 | Inventario actual | `mv_stock_tienda` | ~5K-10K filas | Hourly (MV refresh) |
| 2 | Historial ventas 6m | `mv_ventas_12m_por_tienda_sku` | ~8K-20K filas | Hourly |
| 3 | DOI-edad (días sin movimiento) | `mv_doi_edad` | ~5K-10K filas | Hourly |
| 4 | Config tiendas | `config_store` | 41 filas | Manual (super_user) |
| 5 | Config waterfall | `app_params` (domain=waterfall) | 12 filas | Manual (super_user) |

#### Reglas de clasificación

```
POR CADA (sku, talle) EN inventario:
  target = avg_ventas_mensual × cover_months
    → Nacional (Martel): 12 semanas = 2.77 meses
    → Importado (Wrangler, Lee): 24 semanas = 5.54 meses

  SI stock < target × 0.5 → DEFICIT
  SI stock > target × 2.0 → SURPLUS
  ELSE                     → BALANCED (sin acción)

  SI no hay historial de ventas → fallback a promedio inter-tiendas:
    SI stock = 0 OR stock ≤ 3 OR stock < avg × 0.4 → DEFICIT
    SI stock > avg × 2.5 AND stock > 10 → SURPLUS
```

#### Algoritmo Waterfall (4 niveles en cascada)

```
N1: Tienda→Tienda     (rebalanceo lateral, greedy por donante más grande)
N2: RETAILS→Tienda    (depósito resupply, pool compartido)
N3: STOCK→RETAILS     (central resupply, 1 acción por SKU+talle)
N4: STOCK→B2B         (mayorista directo, bypassa depósito)

Cada nivel consume unidades de un pool compartido.
Lo que N1 no satisface → cascadea a N2 → N3 → N4.
```

#### Output por acción

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | UUID | Identificador único (generado en runtime) |
| `sku`, `talle`, `brand` | string | Producto |
| `store`, `targetStore` | string | Origen y destino |
| `suggestedUnits` | number | Unidades factibles (limitadas por disponibilidad) |
| `idealUnits` | number | Unidades necesarias para llegar al target |
| `gapUnits` | number | idealUnits - suggestedUnits = demanda insatisfecha |
| `daysOfInventory` | number | Días desde último movimiento |
| `risk` | critical/low/overstock | Nivel de riesgo |
| `waterfallLevel` | N1/N2/N3/N4 | Nivel del algoritmo que generó la acción |
| `impactScore` | Gs. | units × price × (1 + margin × 0.3) |
| `paretoFlag` | boolean | Top items = 80% del impacto financiero |
| `recommendedAction` | string | Texto humano de la recomendación |

#### 12 Parámetros configurables (app_params)

| Parámetro | Valor actual | Efecto |
|-----------|-------------|--------|
| `lowStockRatio` | 0.40 | Umbral déficit (sin historial) |
| `highStockRatio` | 2.50 | Umbral surplus (sin historial) |
| `minStockAbs` | 3 | Mínimo absoluto para pedir |
| `minAvgForRatio` | 5 | Avg mínimo para aplicar ratios |
| `minTransferUnits` | 2 | Transferencias menores = ruido |
| `paretoTarget` | 0.80 | Top items = 80% del impacto |
| `surplusLiquidateRatio` | 0.60 | Liquidar 60% del excedente |
| `b2cStoreCoverWeeks` | 13 | Cobertura objetivo B2C (semanas) |
| `coverWeeksImported` | 24 | Lead time importado (semanas) |
| `coverWeeksNational` | 12 | Lead time nacional (semanas) |
| `minImpactGs` | 500,000 | Impacto mínimo (Gs.) para incluir |
| `importedBrands` | ["wrangler","lee"] | Marcas con cover extendido |

### 1.4 Estado actual de auditoría y trazabilidad

#### Lo que SÍ existe hoy

| Capacidad | Implementación | Ubicación |
|-----------|---------------|-----------|
| Config change tracking | `updated_at` + `updated_by` en app_params, config_store, config_commission_scale | BD (auth) |
| Data freshness monitoring | `data_freshness` con refresh timestamps y status por MV | BD (data) |
| Profile change timestamps | `updated_at` trigger en profiles | BD (auth) |
| Seller identification | `v_vended` + `v_dsvende` en transacciones | BD (data) |
| Algorithm version | Implícita en el código de `waterfall.ts` | Git |
| Config validation | `schemas.ts` valida bounds en load time | Runtime |
| Test coverage | 1,060 tests, 165 específicos del waterfall | CI |

#### Lo que NO existe hoy (gaps críticos)

| Gap | Impacto | Severidad |
|-----|---------|-----------|
| **G1: Acciones no se persisten** | Se computan on-demand, se pierden al cerrar browser | CRÍTICO |
| **G2: No hay workflow de aprobación** | No se sabe quién aceptó/rechazó qué recomendación | CRÍTICO |
| **G3: No se registra el snapshot de inputs** | No se puede reproducir por qué el sistema recomendó X | ALTO |
| **G4: No hay versionamiento de reglas** | Cambios en config retroactivamente afectan todo | ALTO |
| **G5: No hay diff de config** | Solo updated_at/by, no el valor anterior vs nuevo | MEDIO |
| **G6: No hay log de ejecuciones** | No se sabe cuántas veces se corrió el waterfall, con qué filtros | MEDIO |
| **G7: No hay métricas de efectividad** | No se puede medir si las recomendaciones mejoraron stock-outs | MEDIO |
| **G8: Export sin trazabilidad** | HTML export no tiene fingerprint ni timestamp de generación | BAJO |

---

## PARTE 2 — MANUAL DE IMPLEMENTACIÓN

### 2.1 Modelo de datos para trazabilidad

Se necesitan 4 tablas nuevas en la BD auth (Supabase):

#### Tabla 1: `decision_runs` — Ejecuciones del motor

Registra CADA vez que el waterfall se ejecuta.

```sql
CREATE TABLE decision_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_type        TEXT NOT NULL CHECK (run_type IN ('waterfall', 'purchase_planning', 'commissions')),
  triggered_by    UUID NOT NULL REFERENCES auth.users(id),
  triggered_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Contexto de ejecución
  filters_snapshot JSONB NOT NULL,
    -- { brand: "total", channel: "b2c", year: 2026, period: "ytd" }

  -- Versión de reglas usadas
  config_version_id UUID REFERENCES config_versions(id),

  -- Resultados agregados
  total_actions    INT NOT NULL DEFAULT 0,
  total_gap_units  INT NOT NULL DEFAULT 0,
  total_impact_gs  NUMERIC NOT NULL DEFAULT 0,
  pareto_count     INT NOT NULL DEFAULT 0,
  critical_count   INT NOT NULL DEFAULT 0,
  computation_ms   INT,              -- tiempo de cálculo

  -- Input dimensions (para reproducibilidad)
  inventory_row_count     INT,
  sales_history_row_count INT,
  doi_age_row_count       INT,

  metadata         JSONB             -- extensible
);

-- Índices
CREATE INDEX idx_decision_runs_triggered_at ON decision_runs(triggered_at DESC);
CREATE INDEX idx_decision_runs_triggered_by ON decision_runs(triggered_by);
CREATE INDEX idx_decision_runs_type ON decision_runs(run_type);

-- RLS
ALTER TABLE decision_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read runs"
  ON decision_runs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert runs"
  ON decision_runs FOR INSERT TO authenticated WITH CHECK (triggered_by = auth.uid());
```

#### Tabla 2: `decision_actions` — Acciones individuales generadas

Cada recomendación que el motor produjo, vinculada a su run.

```sql
CREATE TABLE decision_actions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id          UUID NOT NULL REFERENCES decision_runs(id) ON DELETE CASCADE,
  rank            INT NOT NULL,       -- posición en la lista priorizada

  -- Producto
  sku             TEXT NOT NULL,
  sku_comercial   TEXT,
  talle           TEXT NOT NULL,
  brand           TEXT NOT NULL,
  description     TEXT,
  linea           TEXT,
  categoria       TEXT,

  -- Ubicación
  store           TEXT NOT NULL,
  target_store    TEXT,
  store_cluster   TEXT,

  -- Métricas del motor
  current_stock    INT NOT NULL,
  suggested_units  INT NOT NULL,
  ideal_units      INT NOT NULL,
  gap_units        INT NOT NULL,
  days_of_inventory INT NOT NULL DEFAULT 0,
  historical_avg   NUMERIC NOT NULL DEFAULT 0,
  cover_weeks      INT NOT NULL,
  current_mos      NUMERIC NOT NULL DEFAULT 0,

  -- Clasificación
  risk             TEXT NOT NULL CHECK (risk IN ('critical', 'low', 'balanced', 'overstock')),
  waterfall_level  TEXT NOT NULL CHECK (waterfall_level IN ('store_to_store', 'depot_to_store', 'central_to_depot', 'central_to_b2b')),
  action_type      TEXT NOT NULL,
  impact_score     NUMERIC NOT NULL DEFAULT 0,
  pareto_flag      BOOLEAN NOT NULL DEFAULT false,
  recommended_action TEXT NOT NULL,

  -- Workflow de aprobación
  status           TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'approved', 'rejected', 'executed', 'expired')),
  reviewed_by      UUID REFERENCES auth.users(id),
  reviewed_at      TIMESTAMPTZ,
  review_notes     TEXT,
  executed_at      TIMESTAMPTZ,
  executed_by      UUID REFERENCES auth.users(id),

  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_decision_actions_run ON decision_actions(run_id);
CREATE INDEX idx_decision_actions_status ON decision_actions(status);
CREATE INDEX idx_decision_actions_sku ON decision_actions(sku, talle);
CREATE INDEX idx_decision_actions_store ON decision_actions(store);

-- RLS
ALTER TABLE decision_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read" ON decision_actions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert" ON decision_actions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Super user update" ON decision_actions FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_user'));
```

#### Tabla 3: `config_versions` — Snapshots de configuración

Cada vez que se cambia un parámetro, se crea una versión.

```sql
CREATE TABLE config_versions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID NOT NULL REFERENCES auth.users(id),

  -- Snapshot completo de toda la config vigente al momento
  app_params_snapshot    JSONB NOT NULL,   -- { "waterfall.lowStockRatio": 0.40, ... }
  store_config_snapshot  JSONB NOT NULL,   -- [{ store_code, cluster, ... }, ...]
  commission_snapshot    JSONB NOT NULL,   -- [{ role, tiers, ... }, ...]

  -- Diff respecto a versión anterior
  changes_diff    JSONB,
    -- [{ table: "app_params", key: "waterfall.lowStockRatio", old: 0.40, new: 0.35 }, ...]

  reason          TEXT,                    -- "Rodrigo: ajustar cover weeks importado"
  is_active       BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX idx_config_versions_active ON config_versions(is_active, created_at DESC);

ALTER TABLE config_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read" ON config_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super user insert" ON config_versions FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_user'));
```

#### Tabla 4: `config_audit_log` — Log granular de cambios

Trigger-based, captura cada UPDATE individual en las 3 tablas de config.

```sql
CREATE TABLE config_audit_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name      TEXT NOT NULL,
  record_key      TEXT NOT NULL,       -- PK del registro cambiado
  field_name      TEXT NOT NULL,       -- columna modificada
  old_value       JSONB,
  new_value       JSONB,
  changed_by      UUID REFERENCES auth.users(id),
  changed_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_config_audit_log_table ON config_audit_log(table_name, changed_at DESC);

-- Trigger function genérica
CREATE OR REPLACE FUNCTION fn_config_audit_trigger()
RETURNS TRIGGER AS $$
DECLARE
  col TEXT;
  old_val JSONB;
  new_val JSONB;
BEGIN
  FOR col IN SELECT column_name FROM information_schema.columns
    WHERE table_name = TG_TABLE_NAME AND table_schema = TG_TABLE_SCHEMA
    AND column_name NOT IN ('updated_at', 'updated_by')
  LOOP
    old_val := to_jsonb(row_to_json(OLD)) -> col;
    new_val := to_jsonb(row_to_json(NEW)) -> col;
    IF old_val IS DISTINCT FROM new_val THEN
      INSERT INTO config_audit_log (table_name, record_key, field_name, old_value, new_value, changed_by)
      VALUES (TG_TABLE_NAME,
              CASE TG_TABLE_NAME
                WHEN 'app_params' THEN (NEW).key
                WHEN 'config_store' THEN (NEW).store_code
                WHEN 'config_commission_scale' THEN (NEW).role
              END,
              col, old_val, new_val, auth.uid());
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach triggers
CREATE TRIGGER trg_audit_app_params
  AFTER UPDATE ON app_params FOR EACH ROW EXECUTE FUNCTION fn_config_audit_trigger();
CREATE TRIGGER trg_audit_config_store
  AFTER UPDATE ON config_store FOR EACH ROW EXECUTE FUNCTION fn_config_audit_trigger();
CREATE TRIGGER trg_audit_config_commission
  AFTER UPDATE ON config_commission_scale FOR EACH ROW EXECUTE FUNCTION fn_config_audit_trigger();

ALTER TABLE config_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read" ON config_audit_log FOR SELECT TO authenticated USING (true);
```

### 2.2 Diagrama de relaciones

```
                    config_audit_log
                          │ (trigger on UPDATE)
                          │
    ┌─────────────────────┼─────────────────────┐
    │                     │                     │
app_params          config_store      config_commission_scale
    │                     │                     │
    └──────────┬──────────┘                     │
               │                                │
        config_versions ◄───────────────────────┘
         (snapshot completo al cambiar config)
               │
               │ config_version_id
               ▼
        decision_runs ─── triggered_by ──► auth.users
               │
               │ run_id (1:N)
               ▼
        decision_actions ─── reviewed_by ──► auth.users
                         ─── executed_by ──► auth.users
```

### 2.3 Flujo de implementación en el frontend

#### Paso 1: Persistir ejecuciones (cierra G1, G3, G6)

**Archivo:** `src/queries/decisions.queries.ts` (NUEVO)

```typescript
import { authClient } from "@/api/client";

export async function persistDecisionRun(params: {
  runType: "waterfall" | "purchase_planning" | "commissions";
  userId: string;
  filters: AppFilters;
  configVersionId: string | null;
  stats: {
    totalActions: number;
    totalGapUnits: number;
    totalImpactGs: number;
    paretoCount: number;
    criticalCount: number;
    computationMs: number;
    inventoryRowCount: number;
    salesHistoryRowCount: number;
    doiAgeRowCount: number;
  };
}): Promise<string> {
  const { data, error } = await authClient
    .from("decision_runs")
    .insert({
      run_type: params.runType,
      triggered_by: params.userId,
      filters_snapshot: params.filters,
      config_version_id: params.configVersionId,
      total_actions: params.stats.totalActions,
      total_gap_units: params.stats.totalGapUnits,
      total_impact_gs: params.stats.totalImpactGs,
      pareto_count: params.stats.paretoCount,
      critical_count: params.stats.criticalCount,
      computation_ms: params.stats.computationMs,
      inventory_row_count: params.stats.inventoryRowCount,
      sales_history_row_count: params.stats.salesHistoryRowCount,
      doi_age_row_count: params.stats.doiAgeRowCount,
    })
    .select("id")
    .single();

  if (error) throw error;
  return data.id;
}

export async function persistDecisionActions(
  runId: string,
  actions: ActionItem[]
): Promise<void> {
  // Batch insert in chunks of 100
  const CHUNK = 100;
  for (let i = 0; i < actions.length; i += CHUNK) {
    const chunk = actions.slice(i, i + CHUNK).map((a, idx) => ({
      run_id: runId,
      rank: i + idx + 1,
      sku: a.sku,
      sku_comercial: a.skuComercial,
      talle: a.talle,
      brand: a.brand,
      description: a.description,
      store: a.store,
      target_store: a.targetStore ?? null,
      store_cluster: a.storeCluster,
      current_stock: a.currentStock,
      suggested_units: a.suggestedUnits,
      ideal_units: a.idealUnits,
      gap_units: a.gapUnits,
      days_of_inventory: a.daysOfInventory,
      historical_avg: a.historicalAvg,
      cover_weeks: a.coverWeeks,
      current_mos: a.currentMOS,
      risk: a.risk,
      waterfall_level: a.waterfallLevel,
      action_type: a.actionType,
      impact_score: a.impactScore,
      pareto_flag: a.paretoFlag,
      recommended_action: a.recommendedAction,
      status: "pending",
    }));

    const { error } = await authClient
      .from("decision_actions")
      .insert(chunk);
    if (error) throw error;
  }
}
```

#### Paso 2: Integrar en useActionQueue (cierra G1, G3, G6)

**Archivo:** `src/features/action-queue/hooks/useActionQueue.ts`

Agregar persistencia DESPUÉS de computar el waterfall, sin bloquear el render:

```typescript
// Después de computeActionQueue()...
const runId = useRef<string | null>(null);

useEffect(() => {
  if (!items.length || runId.current) return;

  // Fire-and-forget: persistir sin bloquear UI
  persistDecisionRun({
    runType: "waterfall",
    userId: session.user.id,
    filters,
    configVersionId: activeConfigVersion,
    stats: {
      totalActions: items.length,
      totalGapUnits,
      totalImpactGs: items.reduce((s, a) => s + a.impactScore, 0),
      paretoCount: items.filter(a => a.paretoFlag).length,
      criticalCount: items.filter(a => a.risk === "critical").length,
      computationMs,
      inventoryRowCount: inventoryData.length,
      salesHistoryRowCount: salesHistory.size,
      doiAgeRowCount: doiAge?.exact.size ?? 0,
    },
  }).then(id => {
    runId.current = id;
    return persistDecisionActions(id, items);
  }).catch(console.error); // No rompe la UI si falla el persist
}, [items]);
```

#### Paso 3: Workflow de aprobación/rechazo (cierra G2)

**Archivo:** `src/queries/decisions.queries.ts` (agregar)

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

#### Paso 4: Config versioning (cierra G4, G5)

**Archivo:** `src/queries/configVersion.queries.ts` (NUEVO)

```typescript
export async function snapshotCurrentConfig(
  userId: string,
  reason?: string
): Promise<string> {
  // 1. Fetch current state of all 3 tables
  const [paramsRes, storeRes, commRes] = await Promise.all([
    authClient.from("app_params").select("*"),
    authClient.from("config_store").select("*"),
    authClient.from("config_commission_scale").select("*"),
  ]);

  // 2. Get previous active version for diff
  const { data: prev } = await authClient
    .from("config_versions")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  // 3. Compute diff
  const diff = prev ? computeConfigDiff(prev, {
    app_params: paramsRes.data,
    config_store: storeRes.data,
    config_commission: commRes.data,
  }) : null;

  // 4. Deactivate previous version
  if (prev) {
    await authClient
      .from("config_versions")
      .update({ is_active: false })
      .eq("id", prev.id);
  }

  // 5. Insert new version
  const { data, error } = await authClient
    .from("config_versions")
    .insert({
      created_by: userId,
      app_params_snapshot: paramsRes.data,
      store_config_snapshot: storeRes.data,
      commission_snapshot: commRes.data,
      changes_diff: diff,
      reason,
      is_active: true,
    })
    .select("id")
    .single();

  if (error) throw error;
  return data.id;
}
```

#### Paso 5: UI de trazabilidad (nueva vista)

**Archivo:** `src/features/decisions/DecisionHistoryPage.tsx` (NUEVO)

Página con 3 vistas:

1. **Timeline de ejecuciones** — Lista cronológica de `decision_runs` con stats
2. **Detalle de run** — Acciones generadas con status (pending/approved/rejected/executed)
3. **Historial de config** — Versiones con diffs visuales

### 2.4 Mapa de archivos a crear/modificar

#### Archivos NUEVOS (11)

| Archivo | Propósito | Complejidad |
|---------|-----------|-------------|
| `sql/015_decision_traceability.sql` | 4 tablas + índices + RLS + triggers | Alta |
| `src/queries/decisions.queries.ts` | CRUD decision_runs + decision_actions | Media |
| `src/queries/configVersion.queries.ts` | Snapshot + diff de config | Media |
| `src/features/decisions/DecisionHistoryPage.tsx` | Timeline de ejecuciones | Media |
| `src/features/decisions/components/RunDetailView.tsx` | Detalle de un run + acciones | Media |
| `src/features/decisions/components/ConfigHistoryView.tsx` | Versiones de config | Baja |
| `src/features/decisions/components/ActionReviewControls.tsx` | Botones aprobar/rechazar | Baja |
| `src/features/decisions/hooks/useDecisionHistory.ts` | Hook TanStack Query | Baja |
| `src/domain/decisions/types.ts` | Tipos de dominio | Baja |
| `src/domain/decisions/diff.ts` | Función pura para computar config diff | Baja |
| `src/domain/decisions/__tests__/diff.test.ts` | Tests del diff | Baja |

#### Archivos MODIFICADOS (7)

| Archivo | Cambio |
|---------|--------|
| `src/features/action-queue/hooks/useActionQueue.ts` | Persistir run + actions post-compute |
| `src/features/action-queue/components/CompactActionList.tsx` | Botones review inline |
| `src/features/action-queue/components/ActionGroupCard.tsx` | Status badges por acción |
| `src/features/action-queue/components/exportHtml.ts` | Agregar run_id + timestamp al export |
| `src/App.tsx` | Nueva ruta `/decisiones` |
| `src/layout/AppSidebar.tsx` | Nuevo item sidebar |
| `src/queries/keys.ts` | Nuevos query keys |

### 2.5 Plan de ejecución por fases

#### Fase A: Fundación BD (1 sesión)

1. Crear `sql/015_decision_traceability.sql` con las 4 tablas
2. Ejecutar en SQL Editor de Supabase auth
3. Verificar RLS policies
4. Crear `domain/decisions/types.ts`

**Entregable:** Tablas en producción, tipos en código.

#### Fase B: Persistencia silenciosa (1 sesión)

1. Crear `queries/decisions.queries.ts` (persist run + actions)
2. Modificar `useActionQueue.ts` para persistir fire-and-forget
3. Crear `queries/configVersion.queries.ts`
4. Tests unitarios del diff
5. Verificar que la UI sigue funcionando igual (zero UX change)

**Entregable:** Cada ejecución del waterfall queda registrada en BD. Config snapshot al iniciar.

#### Fase C: Workflow de review (1 sesión)

1. Agregar botones approve/reject en `CompactActionList.tsx`
2. Status badges en `ActionGroupCard.tsx`
3. Bulk approve/reject controls
4. Mutation hooks con TanStack Query invalidation

**Entregable:** Usuarios pueden aprobar/rechazar recomendaciones desde el Centro de Acciones.

#### Fase D: Vista de historial (1 sesión)

1. Crear `DecisionHistoryPage.tsx` + componentes
2. Timeline de runs con stats
3. Drill-down a acciones de un run
4. Config history con diffs
5. Ruta + sidebar

**Entregable:** Página `/decisiones` operativa con historial completo.

#### Fase E: Métricas de efectividad (futura)

1. Comparar acciones "executed" vs cambios reales en inventario (MV siguiente)
2. Dashboard de KPIs de operación: % acciones ejecutadas, tiempo promedio de review, reducción de stock-outs
3. Requiere al menos 30 días de datos de trazabilidad

### 2.6 Campos de cada registro de auditoría

Resumen de la trazabilidad completa que se logra:

```
PREGUNTA                          → TABLA/CAMPO QUE RESPONDE
────────────────────────────────────────────────────────────────
¿Qué recomendó el sistema?       → decision_actions.recommended_action
                                    + ideal_units, gap_units, suggested_units
¿Con qué inputs?                 → decision_runs.filters_snapshot
                                    + inventory_row_count, sales_history_row_count
                                    + doi_age_row_count
¿Qué regla/versión la generó?   → decision_runs.config_version_id
                                    → config_versions.app_params_snapshot
                                    → config_versions.changes_diff
¿Quién la aprobó o rechazó?     → decision_actions.reviewed_by + reviewed_at
                                    + status + review_notes
¿Cuándo pasó?                    → decision_runs.triggered_at (generación)
                                    → decision_actions.reviewed_at (review)
                                    → decision_actions.executed_at (ejecución)
¿Qué cambió en la config?       → config_audit_log.old_value / new_value
                                    + config_versions.changes_diff
¿Cuánto impacto tuvo?           → decision_actions.impact_score
                                    → decision_runs.total_impact_gs
```

### 2.7 Queries útiles post-implementación

```sql
-- Últimas 10 ejecuciones del waterfall
SELECT dr.triggered_at, p.full_name, dr.total_actions, dr.total_gap_units,
       dr.total_impact_gs, dr.computation_ms
FROM decision_runs dr
JOIN profiles p ON p.id = dr.triggered_by
WHERE dr.run_type = 'waterfall'
ORDER BY dr.triggered_at DESC LIMIT 10;

-- Acciones pendientes de revisión (más antiguas primero)
SELECT da.sku, da.talle, da.brand, da.store, da.recommended_action,
       da.impact_score, da.risk, da.created_at
FROM decision_actions da
WHERE da.status = 'pending'
ORDER BY da.created_at ASC;

-- Tasa de aprobación por usuario reviewer
SELECT p.full_name,
       COUNT(*) FILTER (WHERE da.status = 'approved') AS approved,
       COUNT(*) FILTER (WHERE da.status = 'rejected') AS rejected,
       ROUND(100.0 * COUNT(*) FILTER (WHERE da.status = 'approved') / NULLIF(COUNT(*), 0), 1) AS approval_rate
FROM decision_actions da
JOIN profiles p ON p.id = da.reviewed_by
WHERE da.reviewed_by IS NOT NULL
GROUP BY p.full_name;

-- Historial de cambios de config (últimos 30 días)
SELECT cal.changed_at, p.full_name, cal.table_name, cal.record_key,
       cal.field_name, cal.old_value, cal.new_value
FROM config_audit_log cal
LEFT JOIN profiles p ON p.id = cal.changed_by
WHERE cal.changed_at > now() - INTERVAL '30 days'
ORDER BY cal.changed_at DESC;

-- Efectividad: acciones ejecutadas vs total por semana
SELECT date_trunc('week', dr.triggered_at) AS week,
       COUNT(DISTINCT dr.id) AS runs,
       COUNT(da.id) AS total_actions,
       COUNT(da.id) FILTER (WHERE da.status = 'executed') AS executed,
       ROUND(100.0 * COUNT(da.id) FILTER (WHERE da.status = 'executed')
             / NULLIF(COUNT(da.id), 0), 1) AS execution_rate
FROM decision_runs dr
JOIN decision_actions da ON da.run_id = dr.id
GROUP BY 1 ORDER BY 1 DESC;
```

### 2.8 Estimación de volumen

| Tabla | Filas/mes estimadas | Crecimiento |
|-------|-------------------|-------------|
| `decision_runs` | ~60-120 (2-4 ejecuciones/día × 30 días) | Lineal |
| `decision_actions` | ~6,000-24,000 (100-200 acciones × 60-120 runs) | Lineal |
| `config_versions` | ~2-5 | Bajo |
| `config_audit_log` | ~10-50 | Bajo |

**Retención sugerida:** 12 meses en tabla principal, luego archivar a tabla `_archive` con partitioning por mes. Con ~300K filas/año en `decision_actions`, no hay problema de performance en Supabase.

---

## PARTE 3 — PRIORIZACIÓN Y DEPENDENCIAS

### Matriz de impacto vs esfuerzo

```
                    ALTO IMPACTO
                         │
    Fase B (Persist)  ◄──┼──► Fase C (Review)
    [1 sesión, alto]     │    [1 sesión, alto]
                         │
    Fase A (BD)       ◄──┼──► Fase D (Historial)
    [1 sesión, medio]    │    [1 sesión, medio]
                         │
                    BAJO IMPACTO
         ───────────────────────────────
         BAJO ESFUERZO    ALTO ESFUERZO
```

### Orden recomendado

```
A (BD) → B (Persist) → C (Review) → D (Historial) → E (Métricas)
  │          │              │             │
  │          │              │             └─ requiere datos de B+C
  │          │              └─ requiere tablas de A + queries de B
  │          └─ requiere tablas de A
  └─ sin dependencias
```

**Estimación total:** 4 sesiones de trabajo (~8-12h) para Fases A-D.
**Fase E** requiere 30+ días de datos acumulados.

---

## PARTE 4 — PRINCIPIOS DE DISEÑO

1. **Zero UX regression.** La persistencia es fire-and-forget. Si falla el INSERT, la UI sigue funcionando igual. El waterfall nunca se bloquea por la trazabilidad.

2. **Reproducibilidad.** Cada run registra los counts de inputs + la versión de config. Con estos datos, se puede re-ejecutar el waterfall y obtener el mismo resultado.

3. **Inmutabilidad.** Las acciones generadas son immutables (no UPDATE de campos del motor, solo de status/review). Esto garantiza que el registro histórico no se corrompe.

4. **Separación motor/workflow.** El motor sigue siendo puro (`waterfall.ts` sin side effects). La persistencia vive en la capa de orquestación (hooks). El workflow de review vive en la UI.

5. **Extensibilidad.** El campo `metadata` en `decision_runs` permite agregar dimensiones futuras sin migración. Los tipos de run (`waterfall`, `purchase_planning`, `commissions`) permiten reusar la misma infraestructura para otros motores.
