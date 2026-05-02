-- ─────────────────────────────────────────────────────────────────────────────
-- 027_user_invitation_template.sql
--
-- Template de email para invitación de usuarios del sistema (no marketing).
-- Usado por la Edge Function manage-user → send-email cuando un super_user
-- crea un usuario desde /usuarios.
--
-- El UUID del template es fijo y referenciado desde supabase/functions/manage-user/index.ts
-- (constante INVITATION_TEMPLATE_ID). Si se cambia acá, hay que cambiarlo allá también.
--
-- ON CONFLICT (id) DO UPDATE: la migración es idempotente y permite iterar el
-- HTML re-aplicando este archivo.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO sam_templates (id, name, channel, subject, body)
VALUES (
  '10000000-0000-4000-a000-000000000001',
  'Invitación de Usuario',
  'email',
  'Acceso a Fenix Brands habilitado',
  $HTML$<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Acceso a Fenix Brands</title>
</head>
<body style="margin:0;padding:0;background-color:#f9fafb;font-family:'Outfit',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#101828;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f9fafb;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:16px;border:1px solid #e5e7eb;overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="background-color:#101828;padding:28px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="color:#ffffff;font-size:18px;font-weight:600;letter-spacing:-0.01em;">
                    Fenix Brands
                  </td>
                  <td align="right" style="color:#9ca3af;font-size:11px;font-weight:500;text-transform:uppercase;letter-spacing:0.1em;">
                    Plataforma Analytics
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 32px 8px;">
              <h1 style="margin:0 0 12px;font-size:26px;font-weight:600;letter-spacing:-0.025em;color:#101828;line-height:1.2;">
                Bienvenido, {{full_name}}
              </h1>
              <p style="margin:0 0 32px;font-size:15px;line-height:1.6;color:#475467;">
                Tu acceso a la plataforma de analytics de Fenix Brands ha sido habilitado con el rol de <strong style="color:#101828;font-weight:600;">{{role_label}}</strong>.
              </p>
            </td>
          </tr>

          <!-- Credentials -->
          <tr>
            <td style="padding:0 32px 32px;">
              <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;color:#475467;margin:0 0 12px;">
                Credenciales de acceso
              </div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f2f7ff;border:1px solid #d6e4ff;border-radius:12px;">
                <tr>
                  <td style="padding:22px 24px;">
                    <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;color:#3641f5;margin:0 0 6px;">Email</div>
                    <div style="font-size:15px;font-weight:500;color:#101828;margin:0 0 18px;word-break:break-all;">{{email}}</div>
                    <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;color:#3641f5;margin:0 0 6px;">Contraseña temporal</div>
                    <div style="font-family:'SF Mono',Menlo,Monaco,Consolas,monospace;font-size:17px;font-weight:600;color:#101828;letter-spacing:0.04em;">{{temporary_password}}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td align="center" style="padding:0 32px 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
                <tr>
                  <td align="center" style="border-radius:12px;background-color:#465fff;box-shadow:0 4px 14px rgba(70,95,255,0.32);">
                    <a href="{{login_url}}" target="_blank" style="display:inline-block;padding:16px 40px;font-family:'Outfit',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:12px;letter-spacing:-0.01em;line-height:1;">
                      Acceder a la plataforma&nbsp;&rarr;
                    </a>
                  </td>
                </tr>
              </table>
              <div style="margin:14px 0 0;font-size:12px;color:#98a2b3;">
                o copiá este enlace: <a href="{{login_url}}" target="_blank" style="color:#465fff;text-decoration:none;">{{login_url}}</a>
              </div>
            </td>
          </tr>

          <!-- Note -->
          <tr>
            <td style="padding:0 32px 32px;">
              <div style="background-color:#fffaeb;border:1px solid #fedf89;border-radius:10px;padding:16px 20px;">
                <div style="font-size:13px;font-weight:600;color:#93370d;margin:0 0 4px;">
                  Primer ingreso
                </div>
                <div style="font-size:13px;line-height:1.55;color:#7a2e0e;">
                  El sistema solicitará reemplazar la contraseña temporal por una definitiva al iniciar sesión.
                </div>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 32px 28px;border-top:1px solid #f2f4f7;background-color:#fafafb;">
              <p style="margin:0;font-size:12px;line-height:1.5;color:#98a2b3;">
                Mensaje automático de la plataforma Fenix Brands. Si no esperabas este acceso, ignorá este correo.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>$HTML$
)
ON CONFLICT (id) DO UPDATE SET
  name       = EXCLUDED.name,
  channel    = EXCLUDED.channel,
  subject    = EXCLUDED.subject,
  body       = EXCLUDED.body,
  updated_at = NOW();
