# BRIEF PARA AGENTE — FASE A: Fundación BD

## Tu rol
Sos un agente de base de datos. Tu trabajo es crear UN archivo SQL de migración con 4 tablas nuevas para un sistema de trazabilidad de decisiones. NO vas a tocar código TypeScript. NO vas a ejecutar la migración. Solo crear el archivo SQL perfecto.

## Contexto del proyecto

**Path:** `/Users/prueba/Downloads/NewFenixBrands`
**Stack:** React 19 + TypeScript + Vite + Supabase
**Estado:** EN PRODUCCIÓN con usuarios reales. 1060 tests. Build OK.
**BD:** Supabase con 2 clientes — `dataClient` (ERP operacional) y `authClient` (app: profiles, calendar, config). Las tablas nuevas van en el `authClient` (BD auth de Supabase).

## Qué existe hoy en la BD auth

Tablas de config existentes (tu trabajo depende de que entiendas su estructura):
- `app_params` — Key/value JSONB. Columnas: `key TEXT PK`, `domain TEXT`, `value JSONB`, `updated_at TIMESTAMPTZ`, `updated_by UUID`
- `config_store` — Config por tienda. Columnas: `store_code TEXT PK`, `cluster TEXT`, `assortment INT`, `time_restriction TEXT`, `is_excluded BOOLEAN`, `is_b2b BOOLEAN`, `updated_at`, `updated_by`
- `config_commission_scale` — Escalas de comisión. Columnas: `role TEXT PK`, `channel TEXT`, `type TEXT`, `label TEXT`, `tiers JSONB`, `updated_at`, `updated_by`
- `profiles` — Usuarios. Columnas: `id UUID PK (FK auth.users)`, `role TEXT`, `channel_scope TEXT`, `full_name TEXT`, `cargo TEXT`, `is_active BOOLEAN`, `must_change_password BOOLEAN`

RLS pattern del proyecto: lectura para `authenticated`, escritura para `super_user` (verificado via `profiles.role`).

## PROCESO OBLIGATORIO

1. **PRIMERO** lee estos archivos para entender el contexto completo:
   - `/Users/prueba/Downloads/NewFenixBrands/docs/AUDIT_DECISION_TRACEABILITY.md` — el diseño completo (LEER TODO)
   - `/Users/prueba/Downloads/NewFenixBrands/sql/012_config_tables.sql` — para ver el patrón de creación de tablas + RLS que el proyecto ya usa
   - `/Users/prueba/Downloads/NewFenixBrands/sql/004_profiles_y_roles.sql` — para ver cómo se referencian auth.users y profiles
   - Lista el directorio `sql/` para ver la numeración de migraciones existentes

2. **DESPUÉS** de leer, creá el archivo `sql/015_decision_traceability.sql`

## Las 4 tablas a crear

### 1. `config_versions` — Snapshots de configuración
- `id UUID PK DEFAULT gen_random_uuid()`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- `created_by UUID NOT NULL REFERENCES auth.users(id)`
- `app_params_snapshot JSONB NOT NULL` — snapshot completo de app_params al momento
- `store_config_snapshot JSONB NOT NULL` — snapshot de config_store
- `commission_snapshot JSONB NOT NULL` — snapshot de config_commission_scale
- `changes_diff JSONB` — diff vs versión anterior (array de {table, key, field, old, new})
- `reason TEXT` — motivo del cambio
- `is_active BOOLEAN NOT NULL DEFAULT true` — solo 1 activa a la vez
- Índice en `(is_active, created_at DESC)`

### 2. `decision_runs` — Ejecuciones del motor de decisiones
- `id UUID PK DEFAULT gen_random_uuid()`
- `run_type TEXT NOT NULL CHECK (run_type IN ('waterfall', 'purchase_planning', 'commissions'))`
- `triggered_by UUID NOT NULL REFERENCES auth.users(id)`
- `triggered_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- `filters_snapshot JSONB NOT NULL` — filtros usados {brand, channel, year, period, store}
- `config_version_id UUID REFERENCES config_versions(id)` — nullable al inicio
- `total_actions INT NOT NULL DEFAULT 0`
- `total_gap_units INT NOT NULL DEFAULT 0`
- `total_impact_gs NUMERIC NOT NULL DEFAULT 0`
- `pareto_count INT NOT NULL DEFAULT 0`
- `critical_count INT NOT NULL DEFAULT 0`
- `computation_ms INT` — tiempo de cálculo en ms
- `inventory_row_count INT`
- `sales_history_row_count INT`
- `doi_age_row_count INT`
- `metadata JSONB` — extensible
- Índices: `triggered_at DESC`, `triggered_by`, `run_type`

### 3. `decision_actions` — Acciones individuales generadas
- `id UUID PK DEFAULT gen_random_uuid()`
- `run_id UUID NOT NULL REFERENCES decision_runs(id) ON DELETE CASCADE`
- `rank INT NOT NULL` — posición en lista priorizada
- Producto: `sku TEXT NOT NULL`, `sku_comercial TEXT`, `talle TEXT NOT NULL`, `brand TEXT NOT NULL`, `description TEXT`, `linea TEXT`, `categoria TEXT`
- Ubicación: `store TEXT NOT NULL`, `target_store TEXT`, `store_cluster TEXT`
- Métricas: `current_stock INT NOT NULL`, `suggested_units INT NOT NULL`, `ideal_units INT NOT NULL`, `gap_units INT NOT NULL`, `days_of_inventory INT NOT NULL DEFAULT 0`, `historical_avg NUMERIC NOT NULL DEFAULT 0`, `cover_weeks INT NOT NULL`, `current_mos NUMERIC NOT NULL DEFAULT 0`
- Clasificación: `risk TEXT NOT NULL CHECK (risk IN ('critical','low','balanced','overstock'))`, `waterfall_level TEXT NOT NULL CHECK (waterfall_level IN ('store_to_store','depot_to_store','central_to_depot','central_to_b2b'))`, `action_type TEXT NOT NULL`, `impact_score NUMERIC NOT NULL DEFAULT 0`, `pareto_flag BOOLEAN NOT NULL DEFAULT false`, `recommended_action TEXT NOT NULL`
- Workflow: `status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','executed','expired'))`, `reviewed_by UUID REFERENCES auth.users(id)`, `reviewed_at TIMESTAMPTZ`, `review_notes TEXT`, `executed_at TIMESTAMPTZ`, `executed_by UUID REFERENCES auth.users(id)`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- Índices: `run_id`, `status`, `(sku, talle)`, `store`

### 4. `config_audit_log` — Log granular de cambios en config
- `id UUID PK DEFAULT gen_random_uuid()`
- `table_name TEXT NOT NULL`
- `record_key TEXT NOT NULL` — PK del registro cambiado
- `field_name TEXT NOT NULL`
- `old_value JSONB`
- `new_value JSONB`
- `changed_by UUID REFERENCES auth.users(id)`
- `changed_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- Índice: `(table_name, changed_at DESC)`

### Trigger para config_audit_log

Crear una función `fn_config_audit_trigger()` que:
1. Itera sobre las columnas del registro
2. Compara OLD vs NEW para cada columna
3. Si difieren, inserta en `config_audit_log` con el valor correcto de `record_key`:
   - Para `app_params`: usar `NEW.key`
   - Para `config_store`: usar `NEW.store_code`  
   - Para `config_commission_scale`: usar `NEW.role`
4. Excluir columnas `updated_at` y `updated_by` del tracking (son meta, no data)
5. La función debe ser `SECURITY DEFINER` para poder acceder a `auth.uid()`

Crear 3 triggers AFTER UPDATE, uno por cada tabla de config.

### RLS para las 4 tablas

Patrón del proyecto:
```sql
ALTER TABLE X ENABLE ROW LEVEL SECURITY;

-- Lectura: todos los autenticados
CREATE POLICY "Authenticated read X" ON X
  FOR SELECT TO authenticated USING (true);

-- Escritura (INSERT): autenticados (con validación en app)
CREATE POLICY "Authenticated insert X" ON X
  FOR INSERT TO authenticated WITH CHECK (true);

-- UPDATE de decision_actions: solo super_user (para review workflow)
CREATE POLICY "Super user update decision_actions" ON decision_actions
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_user'));
```

Nota: `config_versions` y `config_audit_log` son INSERT-only (no UPDATE/DELETE policies).
`decision_runs` es INSERT-only (immutable).
`decision_actions` necesita UPDATE para el workflow de review.

## Reglas

1. **UN solo archivo SQL:** `sql/015_decision_traceability.sql`
2. **Comentarios claros** al inicio de cada sección (tablas, índices, RLS, triggers)
3. **Orden de creación:** config_versions PRIMERO (porque decision_runs la referencia)
4. **Idempotencia:** Usar `CREATE TABLE IF NOT EXISTS` y `CREATE INDEX IF NOT EXISTS`
5. **NO usar CASCADE en las FK** excepto decision_actions → decision_runs (borrar un run borra sus acciones)
6. **NO modificar tablas existentes** — solo crear nuevas
7. **NO ejecutar nada** — solo crear el archivo
8. **Verificar** que el archivo tiene sintaxis SQL válida revisándolo mentalmente

## Entregable

1. Archivo `sql/015_decision_traceability.sql` creado
2. Verificar que no hay errores de sintaxis
3. Listar las tablas, índices, policies y triggers creados como resumen final

## Verificación post-creación

Después de crear el archivo, leelo completo y verificá:
- [ ] 4 tablas con todos los campos listados arriba
- [ ] Todos los CHECK constraints
- [ ] Todos los índices (al menos 8)
- [ ] Todas las RLS policies (al menos 6)
- [ ] 3 triggers + 1 función trigger
- [ ] FK references correctas (config_versions, decision_runs, auth.users)
- [ ] Orden de creación respeta dependencias (config_versions antes que decision_runs)
