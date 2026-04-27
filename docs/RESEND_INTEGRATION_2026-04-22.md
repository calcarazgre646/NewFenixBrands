# Integración Resend — Módulo Marketing SAM

**Fecha:** 2026-04-22 12:39 (-03)
**Autor:** Carlos + Claude Code (Opus 4.7)
**Estado:** Fase A código completa, esperando DNS del cliente

---

## Contexto

El módulo Marketing (SAM) de NewFenixBrands tenía toda la UI y schema BD listos (6 tablas `sam_*`, 5 tabs, ETL CLIM100→sam_customers con 82K clientes, CRUD de templates y triggers) pero **cero capa de envío real**: no había Edge Functions de email, no había integración con Resend, `sam_executions` nunca se escribía, y `executeRuleAction()` en `domain/marketing/triggers.ts` era un skeleton comentado.

Esta sesión implementa el envío end-to-end para **email de prueba desde la UI** — template → botón "Enviar prueba" → inbox interno → tracking de delivered/opened/bounced en `sam_executions`. Envíos masivos y triggers automáticos quedan para fase 2.

## Decisiones tomadas

1. **Dominio:** `fenixbrands.com.py` (root/apex). Resend genera DNS que va en subdominio `send.fenixbrands.com.py` para bounces, por lo que **no hay colisión con SPF existente del cliente** en el apex.
2. **From sender:** `marketing@fenixbrands.com.py`.
3. **Cuenta Resend:** la de Subestática, agregando `fenixbrands.com.py` como segundo dominio. API key nueva (scope "Sending access") para poder revocar independientemente de MailCenter.
4. **UI:** nuevo tab "Configuración" dentro de `MarketingPage` (6to tab). No se creó SettingsPage global (queda como deuda técnica).
5. **Proyecto Supabase target:** `uxtzzcjimvapjpkeruwb` (authClient, donde viven las tablas SAM).
6. **Webhook URL:** `https://uxtzzcjimvapjpkeruwb.supabase.co/functions/v1/resend-webhook`

## Archivos creados/modificados

**Nuevos:**
- `sql/021_resend_integration.sql` — ALTER `sam_executions` + tablas `sam_email_events` y `sam_email_config` con RLS + seed inicial
- `supabase/functions/send-email/index.ts` — Auth JWT + fetch template + merge variables + POST Resend + log `sam_executions`
- `supabase/functions/resend-webhook/index.ts` — Mapping eventos Resend → status, upgrade-only, insert `sam_email_events`
- `src/features/marketing/hooks/useEmailConfig.ts` — `useEmailConfig` + `useTestExecutions`
- `src/features/marketing/components/ConfigurationTab.tsx` — 4 secciones (estado Resend, from alias, destinatarios, historial)

**Modificados:**
- `src/domain/marketing/types.ts` — +5 tipos (`SamEmailConfig`, `SamEmailEvent`, `ExecutionWithEvents`, `SendTestEmailInput`, `SendTestEmailResult`)
- `src/domain/auth/types.ts` — +permiso `canConfigureEmailSender` (solo `super_user`)
- `src/queries/marketing.queries.ts` — +4 funciones (`fetchEmailConfig`, `updateEmailConfig`, `sendTestEmail`, `fetchExecutionsWithEvents`)
- `src/queries/keys.ts` — +`marketingKeys.emailConfig()`, `marketingKeys.executionsWithEvents()`
- `src/features/marketing/MarketingPage.tsx` — 6to tab "Configuración"
- `src/features/marketing/components/TemplateFormModal.tsx` — Botón "Enviar prueba" (solo templates email guardados)

## Verificación local al cierre de sesión

| Check | Resultado |
|-------|-----------|
| `npx tsc --noEmit` | 0 errores |
| `npm test -- --run` | **1513 pass** / 44 suites (antes 1493) |
| `npm run build` | OK — chunk MarketingPage 112 KB → 28.7 KB gzip |
| `npm run lint` | 0 errores (2 warnings preexistentes en `useMarketingProducts.ts`, no relacionados) |

**Patrón base copiado:** MailCenter (`/Users/prueba/Downloads/MailCenter/supabase/functions/send-email/index.ts` y `resend-webhook/index.ts`) — ya validado en producción @subestatica.com.

---

## Fase A — Pasos del usuario (todo lo que NO depende de DNS)

Al cierre de sesión (2026-04-22 12:39), ninguno de estos pasos se corrió aún. Todos quedan del lado de Carlos para ejecutar.

### A1. Resend dashboard
- [x] API Key creada `newfenixbrands-prod`, scope "Sending access". *(guardar en 1Password o similar)*
- [x] Domain agregado: `fenixbrands.com.py`, region `us-east-1`. **Estado esperado: Pending hasta que el cliente aplique DNS.**
- [x] DNS records obtenidos del dashboard (ver sección "Records DNS" abajo).

### A2. Entregable al cliente
- [ ] Mandar al cliente la tabla de 4 records DNS (3 obligatorios + 1 opcional). **Plantilla lista en este doc abajo.**
- [ ] Esperar confirmación del cliente de que aplicaron.

### A3. Migration SQL
- [ ] Ejecutar `sql/021_resend_integration.sql` en Supabase SQL Editor del proyecto `uxtzzcjimvapjpkeruwb`.

### A4. Secret + deploy
```bash
cd /Users/prueba/Downloads/NewFenixBrands
supabase secrets set RESEND_API_KEY=re_xxx --project-ref uxtzzcjimvapjpkeruwb
supabase functions deploy send-email --project-ref uxtzzcjimvapjpkeruwb
supabase functions deploy resend-webhook --no-verify-jwt --project-ref uxtzzcjimvapjpkeruwb
```

### A5. Webhook en Resend
- [ ] Resend dashboard → Webhooks → Add → URL `https://uxtzzcjimvapjpkeruwb.supabase.co/functions/v1/resend-webhook` → Events: **All Events**.

### A6. Smoke test (sin DNS verificado)
- [ ] App → Marketing → tab **Configuración** → debería cargar la config seed (`marketing@fenixbrands.com.py`, from_name "FenixBrands Marketing", reply_to `no-reply@fenixbrands.com.py`).
- [ ] Agregar un email propio en "Destinatarios de prueba" → debería guardar OK.
- [ ] Tab Outbound → guardar cualquier template de canal email.
- [ ] Abrir el template → botón "Enviar prueba".
- [ ] **Resultado esperado:** Resend devuelve 403 "domain not verified". En la UI: mensaje de error; en "Historial de tests": fila con `status=failed`, `bounce_reason` o `error_msg` poblado.
- [ ] **Si da otro error** (401, 500, timeout, null en columnas, CORS, etc.): documentar el error exacto y abrir sesión con agente para debug antes de la fase B.

---

## Fase B — Bloqueado por DNS del cliente

### B1. Esperar verificación
- [ ] Cliente confirma que aplicó los 4 records.
- [ ] Resend dashboard → Domains → `fenixbrands.com.py` pasa a **Verified** (3/3 checks verdes). 5-30 min habitual, hasta 72h worst case.

### B2. Retry end-to-end
- [ ] Retry del envío del paso A6. Debería llegar al inbox en 5-30s.
- [ ] `sam_executions.status`: `sent` → `delivered` en <1 min (vía webhook).
- [ ] Abrir el email → `status=opened`, `opened_at` poblado.
- [ ] Historial de tests en UI muestra eventos del webhook (delivered, opened).

### B3. Bounce test
- [ ] Mandar a `bounce@resend.dev` (dirección de test de Resend) → `status=failed`, `bounce_reason` poblado. Valida path de error tracking.

### B4. Criterios de "listo"
- [ ] Dominio verified (3/3)
- [ ] Migration 021 aplicada
- [ ] 2 Edge Functions deployadas
- [ ] Secret seteado
- [ ] Webhook configurado
- [ ] Test E2E exitoso (inbox + BD + webhook)
- [ ] Bounce test exitoso

---

## Records DNS (copy-paste para el cliente)

Obtenidos del dashboard de Resend al agregar `fenixbrands.com.py`:

| # | Tipo | Name (host) | Content | TTL | Priority |
|---|------|-------------|---------|-----|----------|
| 1 | TXT | `resend._domainkey` | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDJAf2fnSuFzjLKZdSK5xk2jRzKAbMpI0quZ0PpYI3zJjBHaotTDKiRsfhpzpCRTizh9NbIMbfqItwPzDoXArsBKDY/L06QUcG/3aUG5Vt5Gvw7lamZNJ1fGPVpWjdh6b+W/6zng5GH3SfTVTnvI9GmiNQTrpSQHsR17NXJStiypwIDAQAB` | Auto (3600) | — |
| 2 | MX | `send` | `feedback-smtp.us-east-1.amazonses.com` | Auto (3600) | **10** |
| 3 | TXT | `send` | `v=spf1 include:amazonses.com ~all` | Auto (3600) | — |
| 4 (opcional) | TXT | `_dmarc` | `v=DMARC1; p=none;` | Auto (3600) | — |

**Notas críticas para el cliente:**
- Los Name son relativos al dominio. Si el panel DNS los pide absolutos: `resend._domainkey.fenixbrands.com.py`, `send.fenixbrands.com.py`, `_dmarc.fenixbrands.com.py`.
- Los registros 2 y 3 viven en el subdominio `send`, **NO afectan el SPF existente del dominio corporativo**.
- El valor del DKIM (registro 1) es muy largo. Copiar tal cual del dashboard de Resend, sin cortar, sin comillas extra, sin espacios.
- Si el panel rechaza el DKIM por formato, puede ser porque faltan los prefijos estándar — probar agregando `v=DKIM1; k=rsa; ` antes del `p=...`.
- Registro 4 (DMARC) es opcional. **Si ya existe un `_dmarc` configurado no tocarlo** — solo agregar si hoy no tienen ninguno.

---

## Cómo retomar (para próximo agente)

**Si el cliente ya aplicó DNS:**
1. Leer este doc y la checklist de Fase B.
2. Verificar en Resend dashboard que el dominio pasó a Verified.
3. Correr smoke test E2E completo (B2 + B3).
4. Si todo OK, marcar como "listo" y actualizar memoria.

**Si el smoke test A6 dio error distinto a 403:**
1. Leer el error reportado por el usuario.
2. Verificar: `supabase functions logs send-email --project-ref uxtzzcjimvapjpkeruwb` (o resend-webhook).
3. Typical issues a revisar:
   - Secret `RESEND_API_KEY` no seteado o incorrecto
   - Migration 021 no aplicada (columnas `to_email`, `is_test` no existen → Postgres error al insert)
   - RLS de `sam_email_config` bloqueando SELECT (rol del usuario no es super_user/gerencia)
   - CORS si se llama desde dominio no esperado

**Si hay que agregar features fase 2:**
- Envío masivo con chunking >100 destinatarios (ver patrón `MailCenter/supabase/functions/send-email/index.ts` líneas 88-105)
- Executor real de triggers → requiere cron (pg_cron) + nueva Edge Function `run-triggers`
- Plantillas HTML con editor visual (actualmente solo textarea + `{{variables}}`)
- Unsubscribe links / CAN-SPAM footer

**Archivos clave para entender el flujo:**
- `supabase/functions/send-email/index.ts` — Payload acepta `{ template_id, to_email, customer_id?, is_test?, override_subject?, override_body? }`.
- `src/queries/marketing.queries.ts` líneas finales — `fetchEmailConfig`, `updateEmailConfig`, `sendTestEmail`, `fetchExecutionsWithEvents`.
- `src/features/marketing/components/ConfigurationTab.tsx` — UI del tab Configuración.
- `src/features/marketing/components/TemplateFormModal.tsx` — Botón "Enviar prueba" (solo visible si `channel === "email"` y `isEdit === true`).

---

## Fuera de alcance (NO implementado en esta sesión)

- Envío masivo batch (chunking >100 destinatarios)
- Ejecutor de triggers automáticos (cron)
- UI de campañas programadas
- Templates HTML con editor visual
- Canales WhatsApp/SMS (flag `channel` existe pero sin handler)
- Segmentación dinámica al ejecutar campañas
- Unsubscribe links / CAN-SPAM compliance footer
- Tests unit nuevos específicos para `useEmailConfig` y `ConfigurationTab` (los 1513 actuales no se rompieron, pero no se agregaron tests para los archivos nuevos)
