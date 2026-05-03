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

## Posible reescalamiento (cuando Rod baje su formato)

- Bloques son funciones puras — sumar/quitar uno es un cambio aislado de `htmlTemplate.ts`.
- Si quiere copy generado por LLM, se puede agregar una llamada a OpenAI dentro de la EF tomando el payload del RPC como contexto y reemplazando solo la sección "narrativa" del HTML, manteniendo los datos como ahora (cache-friendly, idempotente, debuggable).
- Si quiere segmentación por destinatario (ej: el gerente comercial recibe solo movers, el de logística solo alertas), agregar un campo `subscriber_role` a la tabla y un branch en `htmlTemplate.ts`.
- Si quiere cadencia distinta (diaria, mensual), el cron es 1 línea de SQL — el RPC ya acepta `p_week_start` arbitrario.
