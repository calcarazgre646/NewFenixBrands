# Prompt de Verificación — Trazabilidad de Decisiones

**Cuándo usar:** Unos días después del 05/04/2026, cuando el Centro de Acciones haya sido usado por usuarios reales. El objetivo es verificar que la persistencia fire-and-forget está funcionando correctamente.

**Cómo usar:** Copiá el bloque de abajo y pegalo como prompt en una nueva sesión de Claude Code.

---

## PROMPT PARA COPIAR

```
Necesito que verifiques que el sistema de trazabilidad de decisiones de NewFenixBrands está funcionando en producción.

**Proyecto:** `/Users/prueba/Downloads/NewFenixBrands`
**BD auth Supabase:** La que usa `authClient` en `src/api/client.ts`

## Contexto

El 05/04/2026 implementamos persistencia silenciosa de decisiones en el Centro de Acciones. Cada vez que un usuario abre la página `/acciones`, el hook `useActionQueue.ts` computa el waterfall y persiste los resultados en 2 tablas:

- `decision_runs` — una fila por ejecución (quién, cuándo, con qué filtros, stats agregados)
- `decision_actions` — N filas por run (cada recomendación generada por el waterfall)

También se crearon:
- `config_versions` — snapshots de configuración
- `config_audit_log` — trigger automático que registra cambios en app_params, config_store, config_commission_scale

La persistencia es fire-and-forget: si falla, la UI sigue funcionando y el error va a console.error("[decision-persist]").

## Lo que necesito que hagas

### 1. Verificar que hay datos en las tablas

Lee `src/api/client.ts` para obtener las credenciales del authClient. Luego ejecutá estas queries contra la BD auth de Supabase (usá el SQL Editor o un script):

```sql
-- ¿Hay runs registrados?
SELECT COUNT(*) as total_runs,
       MIN(triggered_at) as primer_run,
       MAX(triggered_at) as ultimo_run,
       COUNT(DISTINCT triggered_by) as usuarios_distintos
FROM decision_runs;

-- ¿Hay acciones registradas?
SELECT COUNT(*) as total_actions,
       COUNT(DISTINCT run_id) as runs_con_acciones
FROM decision_actions;

-- Stats por run
SELECT dr.id, dr.triggered_at, dr.run_type,
       dr.total_actions, dr.total_gap_units, dr.total_impact_gs,
       dr.computation_ms, dr.filters_snapshot
FROM decision_runs dr
ORDER BY dr.triggered_at DESC
LIMIT 5;

-- ¿Hay cambios de config registrados? (solo si alguien editó config)
SELECT COUNT(*) FROM config_audit_log;
SELECT COUNT(*) FROM config_versions;
```

### 2. Verificar coherencia

Para el último run:
```sql
-- Contar acciones del último run
SELECT dr.id, dr.total_actions as declared,
       (SELECT COUNT(*) FROM decision_actions da WHERE da.run_id = dr.id) as actual
FROM decision_runs dr
ORDER BY dr.triggered_at DESC
LIMIT 1;
```

`declared` (lo que el hook registró) debe coincidir con `actual` (las filas insertadas). Si no coincide, el batch insert falló parcialmente.

### 3. Verificar que el código sigue funcionando

```bash
cd /Users/prueba/Downloads/NewFenixBrands
npx tsc --noEmit
npx vitest run
npx vite build
```

Los 1069 tests (30 suites) deben pasar. TSC 0 errores. Build OK.

### 4. Verificar el hook

Lee `src/features/action-queue/hooks/useActionQueue.ts` y verificá que:
- El `useEffect` de persistencia sigue ahí (buscar "[decision-persist]")
- Tiene el guard `if (!items.length || persistedRunId.current || !user) return`
- Tiene el reset de `persistedRunId.current = null` cuando cambian filtros

### 5. Reportar resultados

Decime:
- ✅ o ❌ Hay datos en decision_runs (cuántos runs, rango de fechas)
- ✅ o ❌ Hay datos en decision_actions (cuántas acciones, coherencia con runs)
- ✅ o ❌ config_audit_log tiene datos (solo si hubo cambios de config)
- ✅ o ❌ TSC, tests, build siguen OK
- ✅ o ❌ El hook de persistencia está intacto

Si algo falló, investigá el console.error("[decision-persist]") en el browser de un usuario para ver si hay errores de RLS, tipos, o conexión.
```

---

## Si no hay datos

Si `decision_runs` está vacía después de varios días, las causas posibles son:

1. **Nadie abrió /acciones** — verificar con el equipo si usaron el Centro de Acciones
2. **El persist falla silenciosamente** — abrir la app en el browser, ir a /acciones, abrir DevTools > Console, y buscar `[decision-persist]` en rojo
3. **RLS bloquea el INSERT** — verificar que la policy "Authenticated insert decision_runs" existe con `SELECT * FROM pg_policies WHERE tablename = 'decision_runs'`
4. **La migración no se aplicó** — verificar que las tablas existen: `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'decision%'`
