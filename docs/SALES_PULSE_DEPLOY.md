# Sales Pulse Semanal — Checklist de Deploy

Pasos del operador para activar el Sales Pulse en producción tras mergear `feat/sales-pulse-weekly`.

---

## Pre-requisitos

- Resend ya verificado para `fenixbrands.com.py` (de la integración de marketing — sesión 22/04/2026 + 02/05/2026 confirmaron envíos reales).
- Acceso a SQL Editor de los dos proyectos Supabase:
  - **DATA / ERP:** `gwzllatcxxrizxtslkeh`
  - **AUTH:** `uxtzzcjimvapjpkeruwb`
- `supabase` CLI logueado con scope sobre `uxtzzcjimvapjpkeruwb`.

---

## D1 — Aplicar migration en proyecto DATA

```sql
-- En SQL Editor del proyecto gwzllatcxxrizxtslkeh
-- Pegar y ejecutar contenido completo de:
sql/029_sales_pulse.sql
```

**Smoke test** después del apply:

```sql
SELECT compute_sales_pulse('2026-04-27'::date);
```

Debe devolver un jsonb con `sales`, `monthly`, `movers`, `alerts`, `freshness`. Si tira error de columna inexistente, abrir issue antes de seguir (el shape de las MVs cambió respecto al snapshot de la sesión).

---

## D2 — Generar CRON_SECRET y guardarlo en vault del proyecto AUTH

Generar string random (32+ chars):

```bash
openssl rand -hex 24
```

Copiar el valor (lo necesitás en D3 y D5 — debe ser idéntico).

En SQL Editor del proyecto `uxtzzcjimvapjpkeruwb`:

```sql
SELECT vault.create_secret('<random-hex-de-arriba>', 'sales_pulse_cron_secret');
```

Verificar:

```sql
SELECT name, created_at FROM vault.secrets WHERE name = 'sales_pulse_cron_secret';
```

---

## D3 — Aplicar migration en proyecto AUTH

```sql
-- En SQL Editor del proyecto uxtzzcjimvapjpkeruwb
-- Pegar y ejecutar contenido completo de:
sql/030_sales_pulse_auth.sql
```

**Verificación:**

```sql
SELECT * FROM sales_pulse_subscribers;            -- debe haber 2 seeds (Rod, Carlos)
SELECT jobid, jobname, schedule FROM cron.job;     -- debe aparecer 'sales-pulse-monday'
```

---

## D4 — Configurar secrets de la Edge Function

Necesitás:
- `SB_SERVICE_ROLE_KEY` (del proyecto AUTH — ya existe de otras EFs, no duplicar si está)
- `DATA_SUPABASE_URL` y `DATA_SERVICE_ROLE_KEY` (del proyecto DATA)
- `RESEND_API_KEY` (del proyecto AUTH — ya existe)
- `CRON_SECRET` (el mismo que D2)

```bash
cd /Users/prueba/Downloads/NewFenixBrands

supabase secrets set DATA_SUPABASE_URL=https://gwzllatcxxrizxtslkeh.supabase.co \
                     --project-ref uxtzzcjimvapjpkeruwb

supabase secrets set DATA_SERVICE_ROLE_KEY=<pegar-service-role-key-del-proyecto-data> \
                     --project-ref uxtzzcjimvapjpkeruwb

supabase secrets set CRON_SECRET=<el-mismo-de-D2> \
                     --project-ref uxtzzcjimvapjpkeruwb
```

Opcionales (defaults razonables ya en el código):
- `APP_URL=https://fenix-brands-one.vercel.app`
- `SALES_PULSE_FROM_EMAIL=dash@fenixbrands.com.py`
- `SALES_PULSE_FROM_NAME="Dash IA · FenixBrands"`

---

## D5 — Deploy Edge Function

```bash
supabase functions deploy send-sales-pulse --project-ref uxtzzcjimvapjpkeruwb
```

Logs en vivo (otra terminal):

```bash
supabase functions logs send-sales-pulse --project-ref uxtzzcjimvapjpkeruwb --follow
```

---

## D6 — Smoke test desde la UI

1. Login como super_user en https://fenix-brands-one.vercel.app
2. Ir a `/sales-pulse` (sidebar → Control → Sales Pulse)
3. Verificar que se vean los 2 subscribers seed (Rod + Carlos)
4. En "Pruebas y envío manual":
   - Click **Vista previa** sin completar nada → debe abrir iframe con el HTML usando datos reales de la última semana cerrada.
   - Verificar que las 5 secciones rendereen y que los números cuadren con `/ventas` en la app.
5. Click **Enviar prueba real** con tu propio email → confirmar que llegue con sender `Dash IA <dash@fenixbrands.com.py>`.
6. Verificar la fila nueva en "Historial de envíos" con `status=sent` y un Resend ID válido.

Si el preview tira error 500 con "RPC compute_sales_pulse failed":
- Revisar logs de la EF (`supabase functions logs ...`).
- Si dice `column ... does not exist`, el SQL del 029 quedó desincronizado con el shape real de las MVs — abrir sesión con el agente.

Si llega 401 al invocar manualmente:
- Confirmar que `SB_SERVICE_ROLE_KEY` apunta al proyecto AUTH y `DATA_SERVICE_ROLE_KEY` al DATA (es fácil cruzarlas).

---

## D7 — Validar el cron del lunes

El próximo lunes 11:30 UTC (8:30 AM PYT):

```sql
-- En proyecto AUTH
SELECT *
FROM cron.job_run_details
WHERE jobname = 'sales-pulse-monday'
ORDER BY start_time DESC
LIMIT 5;

SELECT id, scheduled_at, status, recipients, error_msg
FROM sales_pulse_runs
WHERE triggered_by = 'cron'
ORDER BY scheduled_at DESC
LIMIT 5;
```

Esperado: una fila nueva con `status='sent'` y los 2 destinatarios del seed.

---

## Rollback rápido

Para apagar el cron sin tocar código:

```sql
SELECT cron.unschedule('sales-pulse-monday');
```

Para desactivar todos los destinatarios (no enviar a nadie aunque dispare):

```sql
UPDATE sales_pulse_subscribers SET active = false;
```

Para borrar el módulo entero:

```sql
SELECT cron.unschedule('sales-pulse-monday');
DROP TABLE IF EXISTS sales_pulse_runs;
DROP TABLE IF EXISTS sales_pulse_subscribers;
DROP FUNCTION IF EXISTS sales_pulse_subscribers_touch_updated CASCADE;
-- En proyecto DATA:
DROP FUNCTION IF EXISTS compute_sales_pulse(date, integer);
```

```bash
supabase functions delete send-sales-pulse --project-ref uxtzzcjimvapjpkeruwb
```

---

## Notas operativas

- **Cuándo Rod baje su formato:** ajustar bloques en `src/domain/salesPulse/htmlTemplate.ts` Y `supabase/functions/_shared/salesPulse/htmlTemplate.ts` (mismos archivos byte-a-byte; el test `sync.test.ts` falla en CI si difieren). Después `supabase functions deploy send-sales-pulse`.
- **Sumar destinatarios:** desde la UI `/sales-pulse`. NO editar SQL directo en producción (la UI valida formato + dedup + permisos).
- **Pausar puntualmente:** desde la UI poner el destinatario en `active=false`. Se puede reactivar sin perder historial.
- **El RPC tarda ~5-15s** porque hace queries a `fjdhstvta1` (280K filas) para top SKUs/tiendas. Si en algún momento ese tiempo crece a >25s, considerar materializar una vista semanal pre-agregada.
