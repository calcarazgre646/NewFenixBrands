# Etapa 2 — Diseño del Sistema de Configuración

**Proyecto:** NewFenixBrands
**Estado base:** 985 tests (25 suites) · TSC 0 · Build OK
**Fecha:** 2026-04-04
**Objetivo:** Definir la arquitectura de configuración editable: modelo, loader, validación, fallback, integración y reversibilidad. Sin implementar migración de negocio todavía.

---

## A. Diseño Recomendado

### A.1 Modelo: Híbrido (tablas específicas + params genérica)

**Decisión:** Usar **tablas específicas por dominio** para datos estructurados (comisiones, tiendas) y una **tabla genérica `app_params`** para thresholds numéricos simples.

**¿Por qué híbrido?**

| Criterio | Tabla genérica sola | Tablas específicas solas | Híbrido |
|----------|--------------------|-----------------------|---------|
| Type safety | Pobre (JSON sin estructura) | Excelente | Excelente donde importa |
| RLS granular | Difícil | Natural | Natural |
| Queries JOIN | Imposible | Natural | Natural |
| Overhead por constante simple | Bajo | Alto (1 tabla por número) | Bajo |
| Validación | Schema JSON genérico | Constraints SQL + Zod | Lo mejor de ambos |
| Auditabilidad | Genérica | Por dominio | Natural |

### A.2 Tablas propuestas

#### `config_store` — Tiendas y operaciones

```sql
CREATE TABLE config_store (
  store_code   TEXT PRIMARY KEY,
  cluster      TEXT NOT NULL CHECK (cluster IN ('A', 'B', 'OUT')),
  assortment   INTEGER,                       -- capacidad max, null = sin dato
  time_restriction TEXT,                      -- texto libre, null = sin restricción
  is_excluded  BOOLEAN NOT NULL DEFAULT false, -- excluida de red retail
  is_b2b       BOOLEAN NOT NULL DEFAULT false, -- MAYORISTA, UTP, UNIFORMES
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by   UUID REFERENCES auth.users(id)
);

-- RLS: lectura abierta a autenticados, escritura solo super_user
```

**Reemplaza:** `STORE_CLUSTERS`, `STORE_ASSORTMENT`, `STORE_TIME_RESTRICTIONS`, `EXCLUDED_STORES`, `B2B_STORES` (de normalize.ts).

**No reemplaza:** `CLUSTER_PRICE_MIX` (depende de cluster, no de tienda — va a `app_params`).

**Razón de tabla dedicada:** Son ~40 filas con estructura uniforme. Cada tienda tiene cluster, capacidad, horario. Una tabla normalizada permite agregar tiendas sin deploy, hacer queries cruzadas con inventario, y validar con CHECK constraints.

#### `config_commission_scale` — Escalas de comisión

```sql
CREATE TABLE config_commission_scale (
  role         TEXT NOT NULL,
  channel      TEXT NOT NULL,
  type         TEXT NOT NULL CHECK (type IN ('percentage', 'fixed')),
  label        TEXT NOT NULL,
  tiers        JSONB NOT NULL,  -- CommissionTier[] validado con Zod
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by   UUID REFERENCES auth.users(id),
  PRIMARY KEY (role)
);

-- JSONB porque la estructura es homogénea (CommissionTier[]) y validada client-side
-- RLS: lectura abierta a autenticados, escritura solo super_user
```

**Reemplaza:** `scales.ts` completo (8 escalas, 56 tiers).

**Razón de tabla dedicada:** Las escalas son datos tabulares puros con tipo fuerte. JSONB para `tiers` porque la cantidad de tramos varía por rol (6-7) y agregar columnas `tier_1_min`, `tier_1_max`... sería peor. La validación Zod garantiza estructura.

**No usa versionamiento temporal.** Razón: Rodrigo no necesita escalas históricas. Si en el futuro necesita ver "qué escala aplicaba en marzo 2026", se agrega una columna `effective_from`. Pero hoy el costo de complejidad no se justifica.

#### `app_params` — Parámetros simples de negocio

```sql
CREATE TABLE app_params (
  key          TEXT PRIMARY KEY,
  value        JSONB NOT NULL,
  domain       TEXT NOT NULL,          -- 'waterfall', 'depots', 'freshness', etc.
  description  TEXT,                   -- para humanos, no para código
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by   UUID REFERENCES auth.users(id)
);

-- RLS: lectura abierta a autenticados, escritura solo super_user
```

**Contenido inicial previsto:**

| key | value | domain | description |
|-----|-------|--------|-------------|
| `waterfall.low_stock_ratio` | `0.40` | waterfall | Stock < 40% avg = déficit |
| `waterfall.high_stock_ratio` | `2.50` | waterfall | Stock > 250% avg = sobrestock |
| `waterfall.min_stock_abs` | `3` | waterfall | Mínimo absoluto de unidades |
| `waterfall.min_transfer_units` | `2` | waterfall | Mínimo por transferencia |
| `waterfall.pareto_target` | `0.80` | waterfall | Pareto 80% |
| `waterfall.surplus_liquidate_ratio` | `0.60` | waterfall | Liquidar 60% del excedente |
| `waterfall.b2c_cover_weeks` | `13` | waterfall | Semanas de cobertura B2C |
| `waterfall.min_impact_gs` | `500000` | waterfall | Impacto mínimo en Gs. |
| `waterfall.imported_brands` | `["wrangler","lee"]` | waterfall | Marcas importadas (24 sem cobertura) |
| `waterfall.cover_weeks_imported` | `24` | waterfall | Cobertura marcas importadas |
| `waterfall.cover_weeks_national` | `12` | waterfall | Cobertura marcas nacionales |
| `depots.critical_weeks` | `4` | depots | WOI < 4 = crítico |
| `depots.low_weeks` | `8` | depots | WOI < 8 = bajo |
| `depots.high_weeks` | `16` | depots | WOI > 16 = alto |
| `depots.novelty_coverage` | `0.80` | depots | 80% tiendas = cargado |
| `freshness.mv_ventas_mensual` | `{"staleMinutes":90,"riskMinutes":180}` | freshness | Umbrales ventas mensual |
| `freshness.mv_ventas_diarias` | `{"staleMinutes":90,"riskMinutes":180}` | freshness | Umbrales ventas diarias |
| `freshness.mv_stock_tienda` | `{"staleMinutes":90,"riskMinutes":180}` | freshness | Umbrales stock |
| `freshness.mv_doi_edad` | `{"staleMinutes":120,"riskMinutes":360}` | freshness | Umbrales DOI |
| `freshness.default` | `{"staleMinutes":120,"riskMinutes":360}` | freshness | Default freshness |
| `executive.annual_target_fallback` | `70000000000` | executive | Meta anual fallback (Gs.) |
| `executive.ly_budget_factor` | `0.90` | executive | Factor PY cuando falta dato |
| `margin.b2c_healthy` | `55` | kpis | Margen saludable B2C % |
| `margin.b2c_moderate` | `50` | kpis | Margen moderado B2C % |
| `margin.b2b_healthy` | `50` | kpis | Margen saludable B2B % |
| `margin.b2b_moderate` | `40` | kpis | Margen moderado B2B % |
| `cluster.price_mix` | `{"A":{"normal":1,"sale":0,"outlet":0},"B":{"normal":0.57,"sale":0.43,"outlet":0},"OUT":{"normal":0,"sale":0.40,"outlet":0.60}}` | clusters | Mix de precios por cluster |

**Razón de tabla genérica para estos:** Son números o objetos pequeños. Crear una tabla `config_waterfall_thresholds` con 9 columnas para 9 números es más rígido que un key/value tipado. El riesgo de "JSON sin estructura" se mitiga con validación Zod client-side y schema por key.

### A.3 Decisiones de diseño

| Decisión | Elección | Razón |
|----------|----------|-------|
| **Versionamiento** | No | Rodrigo no necesita historial de config. `updated_at` + `updated_by` dan audit trail mínimo. Si crece la necesidad, se agrega `effective_from` a futuro. |
| **Draft/Publish** | No | La config se aplica inmediatamente. No hay workflow de aprobación. El rollback es volver a editar el valor. |
| **Fallback al código** | Sí (obligatorio) | Toda lectura de config tiene un default hardcoded. Si la tabla no existe, está vacía, o la query falla, el sistema funciona exactamente como hoy. |
| **Cache frontend** | TanStack Query con `staleTime: 10min` | La config no cambia en tiempo real. 10 min es conservador — un cambio de Rodrigo se refleja en máximo 10 min sin recargar. |
| **Invalidación** | Manual vía `queryClient.invalidateQueries(configKeys.all)` | Se invalida al guardar desde un futuro admin panel, o al recargar la página. |
| **Carga** | Frontend vía `authClient` (BD de la app, no la operacional) | Las tablas de config viven en la BD de auth/app (mismo Supabase que profiles, calendar). No polucionar la BD operacional del ERP. |
| **Validación** | Zod schemas en frontend + CHECK constraints en SQL | Doble barrera: SQL previene basura a nivel BD, Zod previene basura a nivel app. |
| **RLS** | Lectura: todos los autenticados. Escritura: `role = 'super_user'` | Solo admins editan config. Todos la leen. |
| **Observabilidad** | `console.warn` cuando se usa fallback, `console.info` cuando se carga desde BD | Permite diagnosticar si la config se está leyendo correctamente sin overhead. |

---

## B. Alternativas Descartadas y Por Qué

### B.1 Tabla genérica única para todo

```sql
-- DESCARTADA
CREATE TABLE business_config (key TEXT PK, value_json JSONB, ...);
```

**Por qué no:** Las escalas de comisión (8 roles × 6-7 tiers) y las tiendas (40 filas con 5 campos cada una) pierden toda estructura al aplanarlas en JSON. No se puede hacer `SELECT * FROM business_config WHERE key LIKE 'commission%'` y obtener algo útil. No se puede hacer JOIN con inventario para verificar que todas las tiendas con stock tienen config. Además, RLS por dominio es imposible — ¿cómo diferencias "lectura de comisiones" de "escritura de thresholds" si todo es la misma tabla?

### B.2 Tablas específicas para cada threshold

```sql
-- DESCARTADA
CREATE TABLE config_waterfall (low_stock_ratio NUMERIC, high_stock_ratio NUMERIC, ...);
CREATE TABLE config_depots (critical_weeks INT, low_weeks INT, ...);
CREATE TABLE config_freshness (source TEXT PK, stale_minutes INT, risk_minutes INT);
```

**Por qué no:** Excesivo para números simples. `config_freshness` sería razonable (5 filas), pero `config_waterfall` sería 1 fila con 9 columnas que nunca se joinean con nada. El pattern genérico `app_params` maneja esto mejor con menos overhead de migración SQL.

### B.3 Config en archivo JSON estático

```
-- DESCARTADA
src/config/business.json → import at build time
```

**Por qué no:** Sigue requiriendo deploy para cambiar. No cumple el objetivo de "editable sin código". Además, pierde la ventaja de audit trail (`updated_by`, `updated_at`).

### B.4 Config server-side (Edge Function)

```
-- DESCARTADA
GET /config → JSON → frontend consume
```

**Por qué no:** Supabase ya provee una API REST para tablas. Una Edge Function sería un wrapper innecesario. La lectura directa con `authClient.from('app_params').select()` es más simple, más rápida, y no requiere deploy de función separada.

### B.5 Config con versionamiento temporal completo

```sql
-- DESCARTADA (por ahora)
CREATE TABLE config_commission_scale (
  ..., effective_from DATE, effective_to DATE
);
```

**Por qué no ahora:** Rodrigo nunca pidió ver "qué escalas aplicaban hace 3 meses". El versionamiento agrega complejidad en queries (filtrar por fecha vigente), en el loader (resolver versión actual), y en tests (fijar fecha de test). Si la necesidad surge, se agrega `effective_from` como columna nullable y se filtra `WHERE effective_from <= now()`. Pero hoy el costo > beneficio.

---

## C. Contratos por Dominio

### C.1 `config_store` — Contrato de tiendas

**Qué contiene:**
- Cluster (A/B/OUT) de cada tienda
- Capacidad de assortment (nullable)
- Restricción horaria (nullable, texto libre)
- Flag de exclusión de red retail
- Flag B2B (MAYORISTA, UTP, UNIFORMES)

**Qué NO contiene:**
- Datos operacionales (stock, ventas, inventario) — eso viene del ERP
- Datos de usuario (vendedores asignados) — eso viene de `fjdhstvta1`
- Price mix por cluster — eso va a `app_params` porque depende del cluster, no de la tienda

**Invariantes que debe cumplir:**
- Toda tienda tiene exactamente 1 cluster
- `cluster` es 'A', 'B' o 'OUT' (CHECK constraint)
- `assortment` si existe es > 0
- No hay tiendas duplicadas (PK garantiza)
- Si `is_excluded = true`, la tienda no participa en cálculos de red retail
- Si `is_b2b = true`, la tienda clasifica como canal B2B

**Schema Zod:**
```typescript
const StoreConfigRowSchema = z.object({
  store_code: z.string().min(1),
  cluster: z.enum(["A", "B", "OUT"]),
  assortment: z.number().int().positive().nullable(),
  time_restriction: z.string().nullable(),
  is_excluded: z.boolean(),
  is_b2b: z.boolean(),
});
```

**Migración desde código:**
- `STORE_CLUSTERS` → columna `cluster`
- `STORE_ASSORTMENT` → columna `assortment`
- `STORE_TIME_RESTRICTIONS` → columna `time_restriction`
- `EXCLUDED_STORES` (depots) → columna `is_excluded`
- `B2B_STORES` (normalize) → columna `is_b2b`

### C.2 `config_commission_scale` — Contrato de comisiones

**Qué contiene:**
- Escala de comisión por rol (role PK)
- Canal, tipo (percentage/fixed), label
- Tiers como JSONB: `CommissionTier[]`

**Invariantes que debe cumplir:**
- Exactamente 8 roles definidos
- Cada tier tiene `minPct < maxPct`
- Tiers son ascendentes y contiguos (sin gaps)
- Último tier tiene `maxPct = Infinity` (representado como `null` en JSON, resuelto en Zod)
- `value >= 0` para todos los tiers
- Si type = 'fixed', values son montos en Gs. (enteros)
- Si type = 'percentage', values son % (ej: 0.85 = 0.85%)

**Schema Zod:**
```typescript
const CommissionTierSchema = z.object({
  minPct: z.number().min(0),
  maxPct: z.number().positive().or(z.literal(Infinity)),
  value: z.number().min(0),
});

const CommissionScaleConfigSchema = z.object({
  role: z.string().min(1),
  channel: z.enum(["mayorista", "utp", "retail"]),
  type: z.enum(["percentage", "fixed"]),
  label: z.string().min(1),
  tiers: z.array(CommissionTierSchema).min(2),
});
```

### C.3 `app_params` — Contrato de parámetros genéricos

**Qué contiene:** Thresholds, ratios, factores, listas cortas — todo lo que es un número, un booleano, o un objeto JSON pequeño.

**Invariantes por key:**

| Dominio | Key pattern | Validación |
|---------|-------------|------------|
| waterfall | `waterfall.*` | Ratios: 0-10, abs: integers > 0, Gs: integers > 0 |
| depots | `depots.*` | Weeks: integers > 0, ratios: 0-1 |
| freshness | `freshness.*` | `{staleMinutes: int > 0, riskMinutes: int > staleMinutes}` |
| executive | `executive.*` | Gs: integers > 0, factors: 0-1 |
| kpis/margin | `margin.*` | Percentages: 0-100 |
| clusters | `cluster.*` | Mix totals must sum to 1.0 per cluster |

**Schema Zod por key (resuelto en el loader):**
```typescript
const APP_PARAM_SCHEMAS: Record<string, z.ZodType> = {
  "waterfall.low_stock_ratio": z.number().min(0).max(10),
  "waterfall.min_impact_gs": z.number().int().min(0),
  "freshness.mv_ventas_mensual": z.object({
    staleMinutes: z.number().int().positive(),
    riskMinutes: z.number().int().positive(),
  }).refine(d => d.riskMinutes > d.staleMinutes),
  "margin.b2c_healthy": z.number().min(0).max(100),
  // ... etc.
};
```

---

## D. Loader / Fallback Strategy

### D.1 Arquitectura del loader

```
┌─────────────────────────────────────────────────┐
│                  CONSUMER CODE                   │
│  (domain functions, hooks, components)           │
│                                                  │
│  const threshold = useConfigParam(               │
│    "waterfall.min_impact_gs",                    │
│    500_000  ← hardcoded default                  │
│  );                                              │
└─────────────────────┬───────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────┐
│               CONFIG LOADER LAYER                │
│                                                  │
│  1. Check TanStack Query cache                   │
│  2. If miss → fetch from Supabase                │
│  3. Validate with Zod schema                     │
│  4. If valid → return remote value               │
│  5. If invalid/missing/error → return default    │
│  6. Log warning if using fallback                │
└─────────────────────┬───────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────┐
│           SUPABASE (authClient)                  │
│  app_params / config_store / config_commission   │
└─────────────────────────────────────────────────┘
```

### D.2 Implementación propuesta

**Archivo nuevo:** `src/queries/config.queries.ts`

Responsabilidades:
- `fetchAppParams()` — fetch de `app_params`, retorna `Map<string, unknown>`
- `fetchStoreConfig()` — fetch de `config_store`, retorna `StoreConfigRow[]`
- `fetchCommissionScales()` — fetch de `config_commission_scale`, retorna `CommissionScaleConfig[]`

**Archivo nuevo:** `src/domain/config/loader.ts`

Responsabilidades:
- `resolveParam<T>(params: Map, key: string, schema: ZodType<T>, fallback: T): T`
  - Busca key en params
  - Si existe, valida con schema
  - Si válido, retorna valor remoto
  - Si inválido, `console.warn(...)` y retorna fallback
  - Si no existe, retorna fallback silenciosamente (es el happy path durante migración incremental)
- `resolveStoreConfig(rows: StoreConfigRow[] | null, fallbacks: StoreConfigFallbacks): StoreConfig`
  - Si rows es null/vacío, construye config desde defaults hardcoded actuales
  - Si rows existe, valida cada fila con Zod, descarta inválidas con warning
- `resolveCommissionScales(rows: ScaleRow[] | null, fallbacks: CommissionScale[]): CommissionScale[]`
  - Mismo patrón: remote si existe y válido, fallback si no

**Archivo nuevo:** `src/queries/config.keys.ts`

```typescript
export const configKeys = {
  all: ["config"] as const,
  params: () => ["config", "params"] as const,
  stores: () => ["config", "stores"] as const,
  commissions: () => ["config", "commissions"] as const,
};
```

### D.3 Hooks de consumo

**Archivo nuevo:** `src/hooks/useConfig.ts`

```typescript
// Hook para parámetros simples
function useConfigParam<T>(key: string, fallback: T, schema: ZodType<T>): T

// Hook para store config completa
function useStoreConfig(): StoreConfig

// Hook para commission scales completas
function useCommissionScales(): Record<CommissionRole, CommissionScale>
```

**Características de los hooks:**
- `staleTime: 10 * 60 * 1000` (10 min) — config no cambia en tiempo real
- `gcTime: 60 * 60 * 1000` (1 hora) — mantener en cache post-unmount
- `retry: 1` — 1 retry, luego fallback
- `placeholderData` — los defaults hardcoded como placeholder mientras carga
- **No bloquean render** — la app se renderiza con defaults mientras la config carga. Si la config remota difiere, se actualiza silenciosamente.

### D.4 Comportamiento por estado

| Estado | Comportamiento | Log |
|--------|---------------|-----|
| Config remota cargada y válida | Usa valor remoto | Ninguno |
| Config remota cargada pero inválida (schema fail) | Usa fallback hardcoded | `console.warn("[config] Invalid value for ${key}, using fallback")` |
| Config remota ausente (key no existe en tabla) | Usa fallback hardcoded | Ninguno (happy path durante migración incremental) |
| Query falla (network, RLS, etc.) | Usa fallback hardcoded | `console.warn("[config] Failed to load ${key}, using fallback")` |
| Tabla no existe (pre-migración SQL) | Usa fallback hardcoded | `console.warn("[config] Table not found, using all fallbacks")` |

### D.5 Source switching

```typescript
// En cada archivo de domain que consume config,
// el patrón es:

// ANTES (hardcoded):
const MIN_IMPACT_THRESHOLD = 500_000;

// DESPUÉS (configurable con fallback):
// El valor se inyecta como parámetro de función:
export function runWaterfall(
  input: WaterfallInput,
  config: WaterfallConfig = DEFAULT_WATERFALL_CONFIG,
): ActionItem[] { ... }

// Donde DEFAULT_WATERFALL_CONFIG contiene los valores hardcoded actuales.
// El hook inyecta la config remota si está disponible.
```

**Esto no es feature flag.** Es inyección de dependencias simple. La función pura recibe config como parámetro con default. El hook decide de dónde viene la config. Rollback = dejar de pasar el parámetro.

---

## E. Integración con Código Actual

### E.1 Impacto por capa

#### `src/domain/` — Funciones puras (PRINCIPAL cambio)

**Patrón:** Las funciones que hoy leen constantes del módulo, pasan a recibirlas como parámetro con default.

**Ejemplo — waterfall.ts:**
```typescript
// ANTES:
const LOW_STOCK_RATIO = 0.40;
export function runWaterfall(input: WaterfallInput): ActionItem[] {
  // usa LOW_STOCK_RATIO directamente
}

// DESPUÉS:
export interface WaterfallConfig {
  lowStockRatio: number;
  highStockRatio: number;
  // ... 9 campos
}
export const DEFAULT_WATERFALL_CONFIG: WaterfallConfig = {
  lowStockRatio: 0.40,
  highStockRatio: 2.50,
  // ... valores actuales
};
export function runWaterfall(
  input: WaterfallInput,
  config: WaterfallConfig = DEFAULT_WATERFALL_CONFIG,
): ActionItem[] {
  // usa config.lowStockRatio
}
```

**Archivos afectados en domain:**

| Archivo | Cambio | Complejidad |
|---------|--------|-------------|
| `actionQueue/waterfall.ts` | 9 const → `WaterfallConfig` con default | Media |
| `actionQueue/clusters.ts` | 4 exports → recibir `StoreConfig` como param | Media |
| `commissions/calculations.ts` | `SCALE_BY_ROLE` import → param con default | Baja |
| `commissions/scales.ts` | Se convierte en defaults, no la fuente de verdad | Baja |
| `depots/calculations.ts` | 6 const → `DepotConfig` con default | Baja |
| `freshness/classify.ts` | `SOURCE_THRESHOLDS` → param con default | Baja |
| `executive/calcs.ts` | 3 const → param con default | Baja |
| `kpis/calculations.ts` | Margin thresholds → param con default | Baja |

**Archivo nuevo:**
| Archivo | Contenido |
|---------|-----------|
| `domain/config/types.ts` | `WaterfallConfig`, `DepotConfig`, `FreshnessConfig`, `MarginConfig`, `StoreConfig`, `CommissionConfig` |
| `domain/config/defaults.ts` | `DEFAULT_WATERFALL_CONFIG`, `DEFAULT_DEPOT_CONFIG`, etc. — todos los valores hardcoded actuales como exports nombrados |
| `domain/config/schemas.ts` | Schemas Zod para validación de cada config type |

#### `src/queries/` — Fetch de config (NUEVO)

**Archivos nuevos:**
| Archivo | Contenido |
|---------|-----------|
| `queries/config.queries.ts` | `fetchAppParams()`, `fetchStoreConfig()`, `fetchCommissionScales()` |
| `queries/config.keys.ts` | Query keys para TanStack Query: `configKeys` |

**Archivos existentes sin cambio.** Las queries de ventas, inventario, etc. no cambian. La config se carga en paralelo como query independiente.

#### `src/hooks/` — Wire config a domain (NUEVO)

**Archivo nuevo:** `hooks/useConfig.ts`
- `useConfigParam()` — param individual con Zod + fallback
- `useStoreConfig()` — config de tiendas completa
- `useCommissionScales()` — escalas de comisiones completas
- `useWaterfallConfig()` — config del waterfall completa

#### `src/features/` — Consumo (MÍNIMO cambio)

Los feature hooks (`useActionQueue`, `useCommissions`, `useDepots`, etc.) pasan de importar constantes directamente a recibirlas del hook de config.

**Ejemplo — features/action-queue/hooks/useActionQueue.ts:**
```typescript
// ANTES:
import { runWaterfall } from "@/domain/actionQueue/waterfall";
const result = runWaterfall(input);

// DESPUÉS:
import { runWaterfall, DEFAULT_WATERFALL_CONFIG } from "@/domain/actionQueue/waterfall";
import { useWaterfallConfig } from "@/hooks/useConfig";
const config = useWaterfallConfig(); // remote con fallback a DEFAULT
const result = runWaterfall(input, config);
```

**Archivos de features afectados:**

| Archivo | Cambio |
|---------|--------|
| `features/action-queue/hooks/useActionQueue.ts` | Pasar config a `runWaterfall` |
| `features/commissions/hooks/useCommissions.ts` | Pasar scales desde config hook |
| `features/depots/hooks/useDepots.ts` | Pasar config a `buildDepotData` |
| `features/action-queue/components/ActionGroupCard.tsx` | Importar DOI/WOI de config en vez de hardcodear |
| `features/action-queue/components/PurchasePlanningTab.tsx` | Ídem |

#### `src/tests/` — Impacto

**Tests de domain (existentes):** Los tests que hoy importan constantes del source y las pasan a funciones seguirán funcionando porque las funciones mantienen defaults. Los tests que hardcodean valores necesitan migración (cubierto en Etapa 1 safety net).

**Tests nuevos:**

| Test | Propósito |
|------|-----------|
| `domain/config/__tests__/schemas.test.ts` | Validación de schemas Zod: acepta valores válidos, rechaza inválidos |
| `domain/config/__tests__/loader.test.ts` | `resolveParam`: fallback cuando falta, warn cuando inválido, pass-through cuando válido |
| `domain/config/__tests__/defaults.test.ts` | Golden test: snapshot de todos los defaults para detectar cambios accidentales |

#### SQL (migración)

**Archivo nuevo:** `sql/012_config_tables.sql`

Contenido:
1. `CREATE TABLE app_params (...)`
2. `CREATE TABLE config_store (...)`
3. `CREATE TABLE config_commission_scale (...)`
4. RLS policies para las 3 tablas
5. `INSERT INTO app_params` con valores iniciales (los mismos hardcoded de hoy)
6. `INSERT INTO config_store` con datos de `STORE_CLUSTERS` + `STORE_ASSORTMENT` + `STORE_TIME_RESTRICTIONS`
7. `INSERT INTO config_commission_scale` con datos de `scales.ts`

**Las tablas se crean VACÍAS inicialmente.** El seed es opcional y se aplica después de verificar que los fallbacks funcionan correctamente. Esto permite:
1. Crear las tablas en producción
2. Verificar que la app sigue funcionando con fallbacks
3. Poblar las tablas con los valores actuales
4. Verificar que la app lee de BD y produce los mismos resultados

#### Auth / RLS

```sql
-- Lectura: todos los autenticados
CREATE POLICY "config_read" ON app_params
  FOR SELECT USING (auth.role() = 'authenticated');

-- Escritura: solo super_user
CREATE POLICY "config_write" ON app_params
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'super_user'
    )
  );

-- Mismas policies para config_store y config_commission_scale
```

---

## F. Estrategia Reversible

### F.1 Mecanismo central: fallback al código

La reversibilidad no requiere feature flags. El mecanismo es más simple:

```
Config remota existe y es válida → usar config remota
Config remota no existe / inválida / error → usar DEFAULT_*_CONFIG (hardcoded actual)
```

**Para "rollback":** borrar las filas de la tabla. El sistema vuelve automáticamente a los defaults hardcoded. No requiere deploy, no requiere cambio de código.

### F.2 Comparación pre/post

**Golden test:** Antes de migrar cada dominio, capturar un snapshot del output:

```typescript
// test: given fixed input, waterfall produces this output
const snapshot = runWaterfall(FIXED_INPUT, DEFAULT_WATERFALL_CONFIG);
expect(snapshot).toMatchSnapshot();

// Post-migración: el mismo test con config remota debe producir idéntico output
const remoteConfig = loadedFromSupabase;
const result = runWaterfall(FIXED_INPUT, remoteConfig);
expect(result).toEqual(snapshot);
```

### F.3 Logging de diferencias

```typescript
function resolveParam<T>(
  remote: Map<string, unknown>,
  key: string,
  schema: z.ZodType<T>,
  fallback: T,
): T {
  const raw = remote.get(key);
  if (raw === undefined) return fallback; // sin log — migración incremental

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    console.warn(`[config] Invalid ${key}:`, parsed.error.message, "→ using fallback");
    return fallback;
  }

  // Log diferencia durante período de transición
  if (JSON.stringify(parsed.data) !== JSON.stringify(fallback)) {
    console.info(`[config] ${key}: remote differs from hardcoded default`);
  }

  return parsed.data;
}
```

### F.4 Rollout por dominio

La migración es incremental por diseño:

1. **Crear tablas vacías** → la app sigue usando defaults → 0 riesgo
2. **Poblar `app_params` con thresholds simples** → verificar que lee correctamente → rollback: borrar filas
3. **Poblar `config_store`** → verificar waterfall y depots → rollback: borrar filas
4. **Poblar `config_commission_scale`** → verificar comisiones → rollback: borrar filas

Cada paso es independiente. Si comisiones falla, no afecta waterfall ni depots.

### F.5 Rollback seguro

| Nivel | Acción | Tiempo | Riesgo |
|-------|--------|--------|--------|
| Valor individual | Editar fila en Supabase | 30 seg | Nulo |
| Dominio completo | `DELETE FROM app_params WHERE domain = 'waterfall'` | 30 seg | Nulo — fallback toma control |
| Todo el sistema | `DELETE FROM app_params; DELETE FROM config_store; DELETE FROM config_commission_scale` | 30 seg | Nulo — vuelve a hardcoded |
| Código completo | Revertir commit que agrega hooks de config | 5 min (deploy) | Bajo |

---

## G. Riesgos del Diseño

| # | Riesgo | Severidad | Mitigación |
|---|--------|-----------|------------|
| 1 | **Config remota con valores incorrectos rompe cálculos** | Alta | Validación Zod estricta. Si el schema falla, se usa fallback. Nunca se usa un valor no validado. |
| 2 | **Latencia de carga de config retrasa render** | Media | `placeholderData` con defaults. La app renderiza inmediatamente con valores hardcoded, actualiza silenciosamente cuando llega la config remota. |
| 3 | **Inconsistencia entre config_store y SQL (010_mv_doi_edad)** | Alta | **No se resuelve en esta etapa.** Se documenta como riesgo aceptado. La Etapa 5 (SQL alignment) lo aborda. |
| 4 | **Infinity en JSONB** | Media | JSONB no soporta `Infinity`. Se representa como `null` en BD y el schema Zod transforma `null → Infinity` al parsear tiers de comisión: `.transform(v => v ?? Infinity)` |
| 5 | **app_params crece sin control** | Baja | El dominio field + documentación en description previene acumulación ciega. Code review normal. |
| 6 | **Super user edita config sin entender impacto** | Alta | A futuro: admin UI con previsualización de impacto. Por ahora: solo edición vía Supabase Studio (barrera de complejidad intencional). |
| 7 | **Tests rompen cuando se parametrizan funciones** | Media | Las funciones mantienen default params. Tests existentes que no pasan config siguen usando defaults → no se rompen. |
| 8 | **Doble fuente de verdad durante migración** | Media | La migración es incremental y atómica por dominio. En todo momento, para cada constante, hay exactamente 1 fuente activa (remote si existe y es válida, hardcoded si no). El logging detecta divergencias. |

---

## H. Qué Debe Quedar Listo Antes de la Primera Migración Real

### H.1 Prerequisites de Etapa 1 (ya cubiertos por scope freeze)

- [x] Inventario completo de constantes (doc: scope freeze)
- [x] Clasificación por dominio y fase
- [x] Mapa de impacto por pantalla
- [x] Identificación de tests frágiles (doc: safety net)

### H.2 Prerequisites de Etapa 2 (este documento)

- [ ] **Migración SQL 012** creada (3 tablas + RLS + seeds vacíos)
- [ ] **domain/config/** creado: types.ts, defaults.ts, schemas.ts
- [ ] **queries/config.queries.ts** + config.keys.ts creados
- [ ] **hooks/useConfig.ts** creado con los 4 hooks
- [ ] **Tests de config** pasando: schemas, loader, defaults snapshot
- [ ] **Verificación:** app funciona idéntico con tablas vacías (todo fallback)
- [ ] **Verificación:** app funciona idéntico con tablas pobladas (todo remote = todo default)

### H.3 Antes de migrar el primer dominio real

- [ ] Safety net de tests completada (Etapa 1: tests migrados a invariant-based)
- [ ] Golden test snapshot del dominio a migrar
- [ ] Las funciones puras del dominio aceptan config como parámetro con default
- [ ] El hook del feature inyecta la config desde `useConfig`
- [ ] Deploy a producción con tablas vacías → verificar 0 cambios de comportamiento
- [ ] Poblar tablas → verificar 0 cambios de output

### H.4 Decisiones que NO se toman aquí

| Decisión | Por qué se posterga | Cuándo decidir |
|----------|---------------------|----------------|
| Admin UI para editar config | No es prerequisito. Supabase Studio es suficiente inicialmente. | Cuando Rodrigo pida self-service |
| Versionamiento temporal de escalas | No hay necesidad actual. | Si Rodrigo necesita historial |
| i18n de labels | El sistema es español-only. | Si hay plan de expansión |
| Sincronización con SQL CTE | Alto riesgo, requiere Etapas 0-4 completas. | Etapa 5 |
| Externalización de `derivePermissions` | Es lógica de seguridad, no config. | Probablemente nunca |
| Config por entorno (dev/staging/prod) | Solo existe producción. | Si se crean entornos |

---

## I. Resumen de Archivos Nuevos y Modificados

### Archivos nuevos (Etapa 2 — solo infraestructura)

| Archivo | Propósito | Líneas estimadas |
|---------|-----------|-----------------|
| `sql/012_config_tables.sql` | 3 tablas + RLS + seeds vacíos | ~120 |
| `src/domain/config/types.ts` | Interfaces de config por dominio | ~80 |
| `src/domain/config/defaults.ts` | Valores hardcoded actuales como defaults nombrados | ~100 |
| `src/domain/config/schemas.ts` | Schemas Zod por config type + por app_param key | ~80 |
| `src/domain/config/loader.ts` | `resolveParam`, `resolveStoreConfig`, `resolveCommissionScales` | ~60 |
| `src/domain/config/__tests__/schemas.test.ts` | Validación de schemas | ~60 |
| `src/domain/config/__tests__/loader.test.ts` | Fallback, warn, pass-through | ~80 |
| `src/domain/config/__tests__/defaults.test.ts` | Golden snapshot de todos los defaults | ~30 |
| `src/queries/config.queries.ts` | Fetch de las 3 tablas de config | ~40 |
| `src/queries/config.keys.ts` | Query keys para config | ~10 |
| `src/hooks/useConfig.ts` | Hooks de consumo: param, stores, commissions, waterfall | ~80 |

**Total nuevo:** ~11 archivos, ~740 líneas.

### Archivos modificados (en etapas posteriores, NO en Etapa 2)

| Archivo | Cambio futuro | Etapa |
|---------|---------------|-------|
| `domain/actionQueue/waterfall.ts` | 9 const → parámetro `WaterfallConfig` | 3-4 |
| `domain/actionQueue/clusters.ts` | 4 exports → lookup de `StoreConfig` | 3-4 |
| `domain/commissions/calculations.ts` | `SCALE_BY_ROLE` → parámetro | 3-4 |
| `domain/commissions/scales.ts` | Se renombra a defaults o se re-exporta desde defaults.ts | 3-4 |
| `domain/depots/calculations.ts` | 6 const → parámetro `DepotConfig` | 3-4 |
| `domain/freshness/classify.ts` | `SOURCE_THRESHOLDS` → parámetro | 3-4 |
| `domain/executive/calcs.ts` | 3 const → parámetro | 3-4 |
| `domain/kpis/calculations.ts` | Margin thresholds → parámetro | 3-4 |
| `features/*/hooks/*.ts` | Pasar config hooks a domain functions | 3-4 |

**En Etapa 2 NO se modifican archivos de domain ni features.** Solo se crea la infraestructura (tablas, loader, hooks, schemas, tests).

---

## J. Criterios de Éxito de Etapa 2

| Criterio | Medición |
|----------|----------|
| 3 tablas creadas en Supabase con RLS | SQL ejecutado sin errores |
| Loader funciona con tablas vacías (todo fallback) | Tests de loader pasando |
| Loader funciona con tablas pobladas (todo remote) | Tests de loader pasando |
| Schemas Zod rechazan valores inválidos | Tests de schemas pasando |
| Golden snapshot de defaults existe | Test de defaults pasando |
| App en producción no cambia de comportamiento | 985 tests siguen pasando, build OK, TSC 0 |
| No se tocó ningún archivo de domain ni features | `git diff` confirma |
