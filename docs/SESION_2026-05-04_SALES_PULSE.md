# Sesión 2026-05-04 — Sales Pulse Semanal (PR feat/sales-pulse-weekly)

## Origen

Ticket de Rod (Fenix): *"Sales Pulse Semanal — Correo automático enviado por Dash IA con el pulso de ventas semanal (todos los lunes al actualizarse la data de ventas). El formato se los entrego yo."*

Rod nunca pasó el formato. Decisión con Carlos (Subestática): cerrar el ticket con un Sales Pulse "básico que tenga sentido para cualquier retail" (con la lógica de Decision Intelligence Platform tipo Palantir que ya estamos construyendo en NewFenixBrands), reescalable cuando él baje su formato. La infra (cron + EF + tablas + UI admin) es la pieza cara y reusable.

## Encuadre

**Qué construye:** un Monday Morning Briefing automático que llega cada lunes 8:30 AM PYT a una lista de destinatarios gestionables, firmado por **Dash IA <dash@fenixbrands.com.py>**.

**Bloques del email (5):**

1. **Headline** — semana ISO + rango de fechas + ventas + WoW% + YoY%
2. **Cumplimiento mensual** — acumulado vs target Budget_2026 + run-rate al cierre + barra de progreso + gap
3. **Top movers** — top 3 marcas / top 3 SKUs / top 3 tiendas (por neto WoW)
4. **Alertas accionables** — novedades sin distribuir (count + 3 ejemplos), sell-through bajo 30-90d (<30%), DSO snapshot vs hace 4 semanas
5. **Freshness + CTA** — última fecha con datos + cuándo se refrescó + link a la app

**Decisiones de producto:**

- **Sin LLM en MVP.** Narrativa por templates puros + thresholds explícitos. Transparente, debuggable, idempotente. Si después quieren generación con GPT, se agrega como capa opcional sin tocar la infra.
- **Lista chica al arranque.** Seed con Rod + Carlos. La UI permite sumar más sin tocar SQL.
- **Trigger manual + cron.** El botón "Enviar prueba" en `/sales-pulse` permite iterar el formato sin esperar al lunes. Dry-run con preview HTML inline (iframe sandboxed) y envío real a un email puntual.
- **Schedule lunes 11:30 UTC = 8:30 AM PYT.** El refresh de las MVs corre `:15 cada hora`, así que a las :30 ya hay data fresca; igual el Sales Pulse pide *semana cerrada* (lunes anterior → domingo anterior) por lo que no depende del refresh del lunes mismo.

## Arquitectura

```
pg_cron 'sales-pulse-monday' (proyecto AUTH) — lunes 11:30 UTC
  ↓ via pg_net + x-cron-secret
send-sales-pulse Edge Function (proyecto AUTH)
  ├─ Auth: x-cron-secret (cron) | JWT super_user (manual desde UI)
  ├─ Resuelve lunes anterior (PYT)
  ├─ RPC compute_sales_pulse(p_week_start) en proyecto DATA
  │     CTEs: ventas WoW + YoY · cumplimiento mensual + run-rate · top movers
  │           · alertas (novelty, STH bajo, DSO) · freshness
  │     Output: jsonb único con 5 bloques
  ├─ parsePulsePayload (defensive parser TS)
  ├─ renderSalesPulseHtml (template inline-styled, mobile-friendly)
  ├─ Resuelve destinatarios (active=true) o usa override del body
  ├─ Resend POST por destinatario
  └─ INSERT sales_pulse_runs (audit log)
```

**Por qué dos proyectos:** la BD del cliente (operacional, ERP, MVs) está en proyecto `gwzllatcxxrizxtslkeh`; los profiles, sam_*, edge functions y Resend integration están en proyecto `uxtzzcjimvapjpkeruwb`. La EF orquesta los dos con dos service-role keys distintas.

## Archivos

### SQL

| Archivo | Proyecto | Contenido |
|---|---|---|
| `sql/029_sales_pulse.sql` | DATA (`gwzllatcxxrizxtslkeh`) | RPC `compute_sales_pulse(date, integer)` SECURITY DEFINER + GRANT EXECUTE solo a service_role |
| `sql/030_sales_pulse_auth.sql` | AUTH (`uxtzzcjimvapjpkeruwb`) | Tablas `sales_pulse_subscribers` y `sales_pulse_runs` con RLS, trigger updated_at, cron job `sales-pulse-monday`, seed Rod + Carlos |

### Edge Function

| Archivo | Notas |
|---|---|
| `supabase/functions/send-sales-pulse/index.ts` | Deno. Auth dual (cron-secret OR JWT). Soporta `dry_run` (preview HTML), `recipients` override, `is_test` flag. Logs todo en `sales_pulse_runs`. |
| `supabase/functions/_shared/salesPulse/{types,narrative,htmlTemplate}.ts` | Mirror del domain. Test `src/domain/salesPulse/__tests__/sync.test.ts` valida byte-equivalencia con `?raw`. |

### App TS

| Archivo | Propósito |
|---|---|
| `src/domain/salesPulse/types.ts` | `SalesPulsePayload` y sub-tipos del jsonb del RPC |
| `src/domain/salesPulse/narrative.ts` | `parsePulsePayload`, `formatPyg`, `formatDelta`, `buildHeadline`, `buildMonthlyLine`, `classifyMomentum`, `freshnessAge` |
| `src/domain/salesPulse/htmlTemplate.ts` | `renderSalesPulseHtml`, `buildSubject` (puros) |
| `src/domain/salesPulse/__tests__/*.test.ts` | 40 tests (37 narrative+html + 3 sync) |
| `src/queries/salesPulse.queries.ts` | CRUD subscribers + history + `triggerSalesPulse` (invoca EF) |
| `src/queries/keys.ts` | `salesPulseKeys` agregado |
| `src/domain/auth/types.ts` | Permiso nuevo `canManageSalesPulse` (super_user) |
| `src/features/salesPulse/SalesPulseAdminPage.tsx` | Página admin con 3 secciones |
| `src/features/salesPulse/components/SubscribersSection.tsx` | Listar / agregar / activar / quitar subscribers |
| `src/features/salesPulse/components/RunsSection.tsx` | Audit log expandible (últimos 12 runs) |
| `src/features/salesPulse/components/TestSendSection.tsx` | Dry-run con iframe + envío real a email puntual |
| `src/features/salesPulse/hooks/useSalesPulseAdmin.ts` | TanStack Query — 4 queries + 4 mutations |
| `src/App.tsx` | Ruta `/sales-pulse` con `PermissionGuard canManageSalesPulse` |
| `src/layout/AppSidebar.tsx` | Item "Sales Pulse" en grupo Control con `EnvelopeIcon` |

## Verificación

| Check | Resultado |
|---|---|
| `npx tsc --noEmit` | 0 errores |
| `npx eslint .` | 0 errores (2 warnings preexistentes en `marketing/useMarketingProducts.ts`) |
| `npx vitest run` | **1896 passed** / 70 suites (+40 nuevos) |
| `npm run build` | OK (3s, sin chunks nuevos significativos — admin page lazy) |

## Pendiente operador (deploy)

Ver `docs/SALES_PULSE_DEPLOY.md` para el checklist runbook.

## Iteraciones post-merge (mismo día — 12 commits adicionales a `main`)

Después de mergear el PR #56, el cliente quiso usar el feature en una demo y aparecieron problemas reales que se fueron resolviendo en vivo. Los detalles de cada commit están en `git log`; este es el resumen ejecutivo:

### Cron schedule
- Cambio de `lunes 11:30 UTC` (= 8:30 AM PYT) a `lunes 17:00 UTC` (= **14:00 PYT**) por preferencia de Rod (recibir el brief al inicio de tarde, no primera hora). Commit: `5882983`.

### Fixes de la EF (deploy bundle)
- **Imports con extensión `.ts`** — el bundler de Supabase Edge Functions (Deno) rechazaba `from "./narrative"` y `from "./types"`; cambio a `.ts` explícito. Commit: `c0b1529`.
- **Auth flow `--no-verify-jwt`** — el cron envía solo `x-cron-secret` sin Authorization, y el gateway lo bloqueaba antes del handler. Re-deploy con flag para que la EF haga su propia auth interna (cron-secret vs JWT super_user).

### Fixes del RPC `compute_sales_pulse` en BD DATA (5 iteraciones)
1. **`search_path = public`** excluía `pg_catalog` → `row_to_jsonb` no resolvía. Fix: `search_path = public, pg_catalog`. Commit: `fa64ebf`.
2. `ALTER FUNCTION` no recompilaba el body cacheado → el path nuevo no aplicaba. Fix: prefijar `pg_catalog.row_to_jsonb` en las 6 invocaciones. Commit: `f175e67`.
3. Esta versión de Postgres rechaza `row_to_jsonb(record)` (signature inexistente con record). Fix: swap por `pg_catalog.to_jsonb(anyelement)`. Commit: `eaf11ba`.
4. **Statement timeout** (8s default de PostgREST) explotaba al consultar `fjdhstvta1` (280K filas). Fix parcial: `set_config('statement_timeout', '60s', true)` adentro del RPC + prefilter por `v_año::int + v_mes::int`. Commit: `493093f`. **No alcanzó** — el cast `::int` rompe el índice.
5. Decisión: stub temporal de los bloques pesados (top SKUs/tiendas + 3 alertas) que devuelven `[]`/`count: 0` para no bloquear la demo. Aplicado in-place en BD DATA, no committed (los archivos del repo conservan la versión completa para Fase 2).

### Bug "Niella / Varias" en top de marcas (commit `6704e7a`)
El RPC hacía `GROUP BY brand` directo sobre `mv_ventas_diarias.brand` que tiene strings ruidosos del ERP ("Niella", "Varias"). Replica server-side la lógica de `normalizeBrand()` del frontend con CASE LIKE case-insensitive sobre las 3 oficiales (Martel/Wrangler/Lee) + LEFT JOIN contra `VALUES` para garantizar que siempre se muestren las 3, ordenadas por neto desc, con WoW% null cuando la base previa fue 0.

### Bug "Meta sin cargar" pese a tener Budget cargado (commit `e18da40`)
El bloque que lee `Budget_${year}.Revenue` tenía `replace(replace(replace(...)))` para parsear formato paraguayo (puntos/comas), pero los strings reales no tenían separadores y algún edge case (NBSP/whitespace) hacía fallar el cast `::numeric`. El `EXCEPTION WHEN OTHERS` silenciaba el error → `monthTarget = 0` → email mostraba "meta sin cargar". Fix: `regexp_replace(coalesce(Revenue::text, ''), '[^0-9.-]', '', 'g')` que extrae solo dígitos/punto/signo (invariante al formato), `trim(Month)`, y `RAISE NOTICE` en el catch para visibilidad futura.

### Rediseño UI del email (commit `dfc8daa`)
Reescritura completa de `htmlTemplate.ts` para alinear con el design system del dashboard (paleta brand `#465fff`, gray-50/200/600/900, success-700 `#027a48`, error-700 `#b42318`, warning-700 `#b54708`). Patterns: `StatCard` (label uppercase tracking-widest 11px gray-400 + valor bold tabular-nums), `DataFreshnessTag` (pill con dot circular), barra de progreso tonal. Hero con número gigante (34px) + delta pills WoW/YoY. Mantiene API pública (`renderSalesPulseHtml`, `buildSubject`). Mirror Deno sincronizado byte-equivalente. Tests actualizados al nuevo wording (40 passing).

### UX admin (`/sales-pulse`)
- **Borrar envíos del historial** (commit `5011c9e`): mutation `deleteRun(id)`, botón papelera por fila con `confirm()`, RLS policy nueva `sales_pulse_runs_delete` para super_user.
- **Paginación del historial** (commit `88a9673`): `fetchRuns(page, pageSize)` con `range()` + `count: "exact"`, `placeholderData: prev` para UX fluido entre páginas, footer con primera/anterior/siguiente/última + indicador `Página X de N` y `Mostrando A–B de N`. Page size 12.
- **Dry-run sin destinatarios** (commit `d9e0d4b`): el preview falla con "No hay destinatarios activos" cuando la lista activa está vacía o el usuario quiere previsualizar sin destinatarios. La validación se mantiene solo en envío real.

## Estado real al cierre de la etapa

### ✅ Vivo y útil para uso real (en producción)
- Cron `lunes 17:00 UTC = lunes 14:00 PYT` activo en BD AUTH (verificable en `cron.job`).
- Email firmado por `Dash IA <dash@fenixbrands.com.py>`.
- Bloque **Headline**: ventas semana + WoW + YoY (correcto, validado).
- Bloque **Cumplimiento mensual**: meta real desde `Budget_2026`, run-rate, gap, barra de progreso.
- Bloque **Top 3 marcas WoW**: normalizadas a Martel/Wrangler/Lee, ordenadas por neto desc.
- Bloque **Freshness**: timestamp de última actualización con flag stale > 24h.
- UI admin completa en `/sales-pulse`: subscribers CRUD + activate/deactivate + remove, historial paginado con borrado, dry-run con iframe sandboxed, envío manual a email puntual.
- Audit log en `sales_pulse_runs` con payload jsonb completo para post-mortem.

### ⚠️ Stub para Fase 2 (devuelven `[]` o `count: 0` en el RPC actual)
Detalle + diseño de la solución en `docs/SALES_PULSE_FASE_2_BACKLOG.md`.

| Bloque | Razón |
|---|---|
| Top 3 SKUs por neto semanal | Timeout pegando contra `fjdhstvta1` (280K filas); el `make_date()` rompe el índice `idx_fjdhstvta1_year_month`. |
| Top 3 tiendas WoW | Mismo problema de índice. |
| Alerta novedades sin distribuir | GROUP BY costoso sobre `mv_stock_tienda` + filtros de exclusión múltiples. |
| Alerta sell-through bajo 30-90d | JOIN `mv_sth_cohort` (285K) × `mv_stock_tienda` se cae por timeout. |
| Alerta DSO snapshot | Mix de snapshot `c_cobrar` + ventana 30d `mv_ventas_diarias`. |

**Solución diseñada para Fase 2:** una MV semanal pre-agregada (`mv_pulso_semanal`) refrescada por el cron `refresh-all-and-log` los lunes :15 UTC. El RPC consulta esa MV en lugar de `fjdhstvta1` directo → queries < 200ms.

## Posible reescalamiento (cuando Rod baje su formato)

- Bloques son funciones puras — sumar/quitar uno es un cambio aislado de `htmlTemplate.ts`.
- Si quiere copy generado por LLM, se puede agregar una llamada a OpenAI dentro de la EF tomando el payload del RPC como contexto y reemplazando solo la sección "narrativa" del HTML, manteniendo los datos como ahora (cache-friendly, idempotente, debuggable).
- Si quiere segmentación por destinatario (ej: el gerente comercial recibe solo movers, el de logística solo alertas), agregar un campo `subscriber_role` a la tabla y un branch en `htmlTemplate.ts`.
- Si quiere cadencia distinta (diaria, mensual), el cron es 1 línea de SQL — el RPC ya acepta `p_week_start` arbitrario.
