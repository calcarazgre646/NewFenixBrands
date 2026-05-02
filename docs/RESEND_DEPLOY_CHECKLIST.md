# Resend — Checklist de deploy a producción

Pasos manuales para activar el envío de email de invitación cuando un super_user crea/invita un usuario desde `/usuarios`.

**Proyecto Supabase:** `uxtzzcjimvapjpkeruwb` (auth/app)
**Dominio Resend:** `fenixbrands.com.py` (debe estar verificado — DNS aplicado por el cliente)
**App URL:** `https://fenixbrands.subestatica.com`

---

## 0. Pre-requisitos

- [ ] Resend dashboard: dominio `fenixbrands.com.py` con los 3 checks verdes (verified)
- [ ] Supabase CLI instalado y autenticado: `supabase login`
- [ ] Cwd: raíz del repo `NewFenixBrands`
- [ ] La API key de Resend a mano (no committearla)

---

## 1. Aplicar migrations en Supabase prod

Ejecutar en Supabase Dashboard → SQL Editor (en orden):

1. **`sql/021_resend_integration.sql`** — crea/extiende `sam_executions`, `sam_email_events`, `sam_email_config` + seed inicial. Si ya estaba aplicada, los `IF NOT EXISTS` la dejan idempotente.
2. **`sql/027_user_invitation_template.sql`** — inserta el template `Invitación de Usuario` en `sam_templates` con UUID fijo `10000000-0000-4000-a000-000000000001`. La migración usa `ON CONFLICT (id) DO UPDATE`, así que se puede re-aplicar para iterar el HTML.

**Verificación post-migration:**

```sql
-- Confirmar config activa
SELECT from_email, from_name, reply_to FROM sam_email_config WHERE is_active = true;
-- Esperado: marketing@fenixbrands.com.py | FenixBrands Marketing | no-reply@fenixbrands.com.py

-- Confirmar template
SELECT id, name, channel FROM sam_templates WHERE id = '10000000-0000-4000-a000-000000000001';
-- Esperado: 1 fila con channel='email'
```

> Si el sender `marketing@fenixbrands.com.py` no es el deseado para invitaciones, podés cambiarlo desde la UI: `/marketing` → tab Configuración → "From Email".

---

## 2. Setear secrets en Supabase

```bash
supabase secrets set \
  RESEND_API_KEY=<la-api-key-de-resend> \
  APP_URL=https://fenixbrands.subestatica.com \
  --project-ref uxtzzcjimvapjpkeruwb
```

`SB_SERVICE_ROLE_KEY` ya debería estar seteado (`manage-user` lo usa hoy). Confirmar con:

```bash
supabase secrets list --project-ref uxtzzcjimvapjpkeruwb
```

Mínimo necesario: `SB_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `APP_URL`. Opcional: `DEFAULT_USER_PASSWORD` (default `fenix123`).

> **Importante:** rotá la `RESEND_API_KEY` en el dashboard de Resend si en algún momento estuvo expuesta (chat, screenshots, etc.).

---

## 3. Deploy de las 3 Edge Functions

```bash
# manage-user (modificada: ahora invoca send-email post-create)
supabase functions deploy manage-user --project-ref uxtzzcjimvapjpkeruwb

# send-email (modificada: acepta param `variables` para emails transaccionales)
supabase functions deploy send-email --project-ref uxtzzcjimvapjpkeruwb

# resend-webhook (sin verify_jwt — Resend no manda Authorization header)
supabase functions deploy resend-webhook --no-verify-jwt --project-ref uxtzzcjimvapjpkeruwb
```

**Verificación:** las 3 funciones deben aparecer en Dashboard → Edge Functions → status `Active`.

---

## 4. Configurar webhook en Resend dashboard

URL del webhook (copiar exacto):

```
https://uxtzzcjimvapjpkeruwb.supabase.co/functions/v1/resend-webhook
```

En Resend dashboard → Webhooks → Add Endpoint:
- URL: la de arriba
- Eventos: `email.sent`, `email.delivered`, `email.opened`, `email.clicked`, `email.bounced`, `email.complained` (todos los de `email.*`)

> El webhook actualiza `sam_executions.status` y registra cada evento crudo en `sam_email_events`.

---

## 5. Smoke test de Resend (sin tocar invitación)

1. Login en `https://fenixbrands.subestatica.com` como super_user
2. Ir a `/marketing` → tab **Configuración**
3. En **Destinatarios de prueba** agregar tu email personal
4. Tab **Plantillas** → editar cualquier template existente o el de Invitación → click **"Enviar prueba"** → seleccionar tu email
5. Verificar:
   - [ ] Email llega a la inbox (no spam)
   - [ ] En Configuración → tab **Historial**, aparece la fila con status `delivered` (puede demorar unos segundos por el webhook)
   - [ ] Click en "Ver eventos" muestra al menos `email.sent` y `email.delivered`

Si llega pero el historial queda en `sent` y nunca pasa a `delivered`: el webhook no está configurado o la URL está mal. Volver al paso 4.

---

## 6. Smoke test del flujo de invitación (end-to-end)

1. En `/usuarios` → click **Crear usuario**
2. Email: usar uno tuyo de prueba (recomendado un Gmail al que tengas acceso)
3. Nombre: `Test Invitación`
4. Rol: `negocio` (o el que sea)
5. Click **Crear Usuario**

**Resultado esperado (caso feliz):**
- [ ] Modal cierra sin warning
- [ ] El nuevo usuario aparece en la tabla
- [ ] Llega email a la bandeja del destinatario con: saludo, credenciales (email + `fenix123`), botón "Iniciar sesión" → `https://fenixbrands.subestatica.com/signin`, aviso de cambio de contraseña

**Resultado esperado (caso falla email):**
- [ ] El usuario igual queda creado en `/usuarios`
- [ ] El modal NO cierra y muestra warning amarillo con las credenciales para avisar manualmente
- [ ] Botón "Entendido" cierra el modal

**Verificar primer login del invitado:**
- [ ] El usuario puede loguearse en `/signin` con su email + `fenix123`
- [ ] Es redirigido a `/cambiar-contrasena`
- [ ] Tras cambiar contraseña, accede normalmente

---

## 7. Troubleshooting

### El email no llega y `sam_executions.status` queda `failed`
- Mirá `error_msg` en la fila correspondiente.
- Causas frecuentes:
  - `RESEND_API_KEY` no seteada o inválida → reseteá el secret y redeploy `send-email`
  - Dominio no verificado en Resend → revisá DNS
  - Sender (`from_email`) usa un dominio distinto al verificado → ajustar en `/marketing` → Configuración

### `manage-user` retorna `emailSent: false`
- Logs: Dashboard → Edge Functions → `manage-user` → Logs. Buscar `[manage-user] Invitation email failed`.
- El error suele propagarse desde `send-email`. Revisá los logs de `send-email`.

### Webhook no actualiza el status
- Resend dashboard → Webhooks → ver intentos. Si aparece 401: la EF se desplegó **sin** `--no-verify-jwt`. Redeploy con la flag.
- Si aparece 4xx con error: ver logs de `resend-webhook` en Supabase.

### El email llega a spam
- Falta SPF/DKIM o están mal en DNS. Resend dashboard → Domains → ver qué record falta.
- Considerar warmup: enviar pocos emails los primeros días para que el dominio gane reputación.

---

## 8. Rollback

Si algo sale mal y querés volver al estado anterior:

```bash
# Revertir manage-user al commit previo (sin send-email integration)
git checkout <commit-anterior> -- supabase/functions/manage-user/index.ts
supabase functions deploy manage-user --project-ref uxtzzcjimvapjpkeruwb
```

El user igual se sigue creando — solo se desactiva el envío automático de email.

---

## Resumen de cambios en este release

| Archivo | Cambio |
|---|---|
| `sql/027_user_invitation_template.sql` | NUEVO — template HTML branded del email |
| `supabase/functions/send-email/index.ts` | Acepta `variables: Record<string,string>` para emails transaccionales (no marketing) |
| `supabase/functions/manage-user/index.ts` | Tras crear+actualizar profile, invoca `send-email` con el template de invitación. Soft-fail. Devuelve `emailSent` y `emailError` |
| `src/queries/users.queries.ts` | Tipo `CreateUserResult` con `emailSent`/`emailError`. Defaults a `emailSent=false` si la EF antigua todavía está deployada |
| `src/features/users/components/UserCreateModal.tsx` | Banner amarillo cuando `emailSent=false` con credenciales para avisar manualmente |
| `src/queries/__tests__/users.queries.test.ts` | +2 tests (success+failure path) |
