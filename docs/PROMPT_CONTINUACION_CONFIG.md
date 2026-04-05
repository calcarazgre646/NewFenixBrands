# Prompt de Continuación — Externalización de Config Editable

Copiá este prompt completo al iniciar una nueva sesión de Claude Code en el proyecto NewFenixBrands.

---

## Prompt

```
Estás entrando a un proyecto en producción (NewFenixBrands) donde se viene ejecutando una migración progresiva de constantes de negocio hardcodeadas hacia configuración editable en Supabase. Hay trabajo hecho, documentado y verificado. Tu tarea es continuar exactamente donde se dejó.

## Tu primer paso obligatorio

Antes de proponer o implementar NADA, leé estos documentos en orden:

1. `CLAUDE.md` (raíz del proyecto) — contexto general, reglas de arquitectura, estado actual, log de sesiones
2. `docs/ETAPA_2_3_CONFIG_IMPLEMENTATION.md` — documentación completa de lo implementado (Etapas 2-4), qué está en producción, qué falta, estado de cada tabla
3. `docs/CONFIG ARCHITECTURE.md` — diseño de arquitectura del sistema de config (modelo, loader, validación, fallback, reversibilidad)
4. `docs/scope freeze + inventario final.md` — inventario completo de ~95 constantes de negocio, clasificación por dominio, mapa de impacto, riesgos
5. `docs/safety net de tests.md` — auditoría de fragilidad de tests, qué se migró a contract tests y qué queda

## Lo que ya está hecho (NO rehacer)

- Etapa 0: Auditoría completa de constantes (95 items en 34 archivos)
- Etapa 1: Safety net de tests documentada
- Etapa 2: Infraestructura de config (3 tablas SQL, loader, schemas, hooks, 73 tests)
- Etapa 3: Quick wins (deduplicación de 10 valores dispersos, 5 funciones domain parametrizadas)
- Etapa 4: Migración cuidada (comisiones 8 escalas + márgenes 4 thresholds + 27 tests migrados a contract tests)
- Seed en producción: config_commission_scale (8 filas) + app_params (12 filas) verificados OK

## Lo que falta

Después de leer los docs, vas a encontrar las siguientes tareas pendientes ordenadas por prioridad:

### Conexiones end-to-end faltantes (riesgo bajo, trabajo mecánico)
Las tablas ya están pobladas pero los feature hooks no pasan config a las funciones de domain:
- **Depots:** `buildDepotData()` llama `classifyDepotRisk()` internamente 3 veces con defaults. Necesita aceptar config como parámetro y pasarla.
- **Executive:** `useExecutiveData` hook no pasa config a `calcAnnualTarget()` ni `buildMonthlyRows()`.
- **Freshness:** `useDataFreshness` hook no consume `useFreshnessConfig()`.

### Etapa 5 — Store clusters + waterfall (riesgo alto, requiere diseño)
- `getStoreCluster()` necesita aceptar clusters map como parámetro (4 consumidores: waterfall.ts, grouping.ts, depots/calculations.ts, useActionQueue.ts)
- 9 thresholds del waterfall interconectados (LOW_STOCK_RATIO, HIGH_STOCK_RATIO, etc.)
- `config_store` tabla creada pero vacía
- CLUSTER_PRICE_MIX es dead code (confirmado, 0 consumidores en producción)
- classifyStoreForCommission es código preparatorio (nunca llamado)

### Dead code confirmado para limpiar
- CLUSTER_PRICE_MIX en clusters.ts + DEFAULT_CLUSTER_PRICE_MIX en defaults.ts + useClusterPriceMix hook
- classifyStoreForCommission + storeGoalToSellerGoal en storeMapping.ts

## Reglas de trabajo (NO negociar)

1. No asumir contexto previo — leé los docs primero
2. Auditar antes de cambiar — verificá el estado actual del código antes de implementar
3. No tocar nada fuera del alcance de la etapa que estés ejecutando
4. Si algo parece riesgoso, frenar y documentar antes de actuar
5. Toda propuesta debe incluir: diagnóstico, plan, criterios de éxito, riesgos, rollback, archivos afectados
6. No hacer refactors cosméticos ni introducir abstracciones innecesarias
7. Mantener tipado fuerte, modularidad, limpieza y reversibilidad
8. Todo cambio debe preservar comportamiento salvo donde la etapa explícitamente lo permita
9. No borrar defaults hardcoded hasta que exista fallback estable verificado
10. Pensar como auditor + arquitecto + ingeniero de migración segura

## Arquitectura del sistema de config (resumen)

```
Supabase auth (BD de la app)
  ├── app_params (key TEXT PK, value JSONB, domain TEXT)
  ├── config_store (store_code TEXT PK, cluster, assortment, ...)
  └── config_commission_scale (role TEXT PK, channel, type, label, tiers JSONB)

Frontend:
  queries/config.queries.ts → fetch de 3 tablas via authClient
  domain/config/schemas.ts → validación sin Zod (ValidationResult<T>)
  domain/config/loader.ts → resolveParam (remote → validate → fallback)
  domain/config/defaults.ts → valores hardcoded como fallback
  hooks/useConfig.ts → 8 hooks (staleTime 10min, fallback a defaults)

Patrón de inyección:
  Hook de feature → useXxxConfig() → función domain(input, config = DEFAULT)
  Si BD tiene datos → usa remoto
  Si BD vacía/error → usa default hardcoded
  Rollback → DELETE FROM tabla → vuelve a defaults automáticamente
```

## Estado de tests

- 1058 tests (28 suites) | TSC 0 | Build OK
- 27 tests de comisiones/márgenes/depots migrados de frágiles a contract tests
- Tests derivan expected de la fuente canónica (SCALE_BY_ROLE, DEFAULT_MARGIN_CONFIG, DEFAULT_DEPOT_CONFIG)
- Si una escala cambia en BD, los tests pasan sin edición

## Qué hacer ahora

1. Leé los 5 documentos listados arriba
2. Corré `npm test` y `npx tsc -b --noEmit` para verificar estado actual
3. Identificá cuál es la siguiente tarea con mejor relación valor/riesgo
4. Proponé un plan antes de implementar
5. Ejecutá con el mismo patrón: auditar → diseñar → implementar → testear → documentar

No improvises. Este proyecto está en producción y tiene usuarios reales.
```
