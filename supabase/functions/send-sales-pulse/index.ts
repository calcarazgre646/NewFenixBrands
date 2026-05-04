/**
 * Edge Function: send-sales-pulse
 *
 * Despacha el Sales Pulse Semanal:
 *   1. Auth: header x-cron-secret debe matchear CRON_SECRET (si presente)
 *      O bien JWT de un super_user para envíos manuales desde la UI.
 *   2. Calcula la semana cerrada (lunes anterior → domingo anterior, PYT)
 *      a menos que el body indique p_week_start.
 *   3. Llama RPC compute_sales_pulse en proyecto DATA usando service-role.
 *   4. Renderiza HTML usando _shared/salesPulse.
 *   5. Resuelve destinatarios (active=true, o lista override en body para tests).
 *   6. POST a Resend por cada destinatario.
 *   7. INSERT en sales_pulse_runs (auth project) con status final.
 *
 * Body (POST JSON, opcional):
 *   {
 *     "source": "cron" | "manual",       // default: cron si CRON_SECRET match, manual si no
 *     "p_week_start": "YYYY-MM-DD",      // override del lunes; default = lunes anterior
 *     "recipients": ["x@y.com"],         // override; default = activos en sales_pulse_subscribers
 *     "is_test": true,                   // marca el run como prueba (no afecta destinatarios)
 *     "dry_run": true                    // computa pero no envía Resend (devuelve payload + html)
 *   }
 *
 * Secrets requeridos:
 *   SB_SERVICE_ROLE_KEY        (auth project — para sales_pulse_*)
 *   DATA_SUPABASE_URL          (proyecto data, ej https://gwzllatcxxrizxtslkeh.supabase.co)
 *   DATA_SERVICE_ROLE_KEY      (proyecto data — para RPC)
 *   RESEND_API_KEY
 *   CRON_SECRET                (random string, idéntico al guardado en vault del proyecto auth)
 *
 * Deploy:
 *   supabase secrets set DATA_SUPABASE_URL=...
 *   supabase secrets set DATA_SERVICE_ROLE_KEY=...
 *   supabase secrets set CRON_SECRET=...
 *   supabase functions deploy send-sales-pulse --project-ref uxtzzcjimvapjpkeruwb
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { renderSalesPulseHtml, buildSubject } from "../_shared/salesPulse/htmlTemplate.ts";
import { parsePulsePayload } from "../_shared/salesPulse/narrative.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const APP_URL = Deno.env.get("APP_URL") ?? "https://fenix-brands-one.vercel.app";
const FROM_EMAIL = Deno.env.get("SALES_PULSE_FROM_EMAIL") ?? "dash@fenixbrands.com.py";
const FROM_NAME  = Deno.env.get("SALES_PULSE_FROM_NAME")  ?? "Dash IA · FenixBrands";

interface RequestBody {
  source?: "cron" | "manual";
  p_week_start?: string;
  recipients?: string[];
  is_test?: boolean;
  dry_run?: boolean;
}

function jsonOk(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function jsonError(error: string, status = 400, extras?: Record<string, unknown>) {
  return new Response(JSON.stringify({ error, ...extras }), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

/**
 * Calcula el lunes de la semana cerrada en zona horaria PYT (UTC-3).
 * Si "ahora" es lunes 8:30 AM PYT → semana = lunes anterior - 7 días.
 */
function previousMondayPYT(now: Date): string {
  // Convertir UTC → PYT (UTC-3) restando 3h.
  const pyt = new Date(now.getTime() - 3 * 3600 * 1000);
  const dow = pyt.getUTCDay(); // 0=Dom 1=Lun ...
  const daysToLastMonday = dow === 0 ? 13 : (dow === 1 ? 7 : dow + 6);
  const monday = new Date(pyt.getTime() - daysToLastMonday * 86400 * 1000);
  return monday.toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return jsonError("Method not allowed", 405);
  }

  try {
    // ── Env vars ──────────────────────────────────────────────────────────
    const authUrl    = Deno.env.get("SUPABASE_URL");
    const authSrKey  = Deno.env.get("SB_SERVICE_ROLE_KEY");
    const dataUrl    = Deno.env.get("DATA_SUPABASE_URL");
    const dataSrKey  = Deno.env.get("DATA_SERVICE_ROLE_KEY");
    const resendKey  = Deno.env.get("RESEND_API_KEY");
    const cronSecret = Deno.env.get("CRON_SECRET");

    if (!authUrl || !authSrKey)        return jsonError("auth project env missing", 500);
    if (!dataUrl || !dataSrKey)        return jsonError("data project env missing", 500);
    if (!resendKey)                    return jsonError("RESEND_API_KEY missing", 500);
    if (!cronSecret)                   return jsonError("CRON_SECRET missing", 500);

    const authClient = createClient(authUrl, authSrKey);
    const dataClient = createClient(dataUrl, dataSrKey);

    // ── Parse body ────────────────────────────────────────────────────────
    const body = (await req.json().catch(() => ({}))) as RequestBody;

    // ── Auth: cron-secret O JWT super_user ────────────────────────────────
    const incomingCronSecret = req.headers.get("x-cron-secret");
    const isCron = incomingCronSecret === cronSecret;
    let triggeredByUser: string | null = null;

    if (!isCron) {
      // Modo manual: validar JWT
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) return jsonError("auth required", 401);
      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: authErr } = await authClient.auth.getUser(token);
      if (authErr || !user) return jsonError("invalid token", 401);
      const { data: profile } = await authClient
        .from("profiles").select("role").eq("id", user.id).single();
      if (!profile || profile.role !== "super_user") return jsonError("forbidden", 403);
      triggeredByUser = user.id;
    }

    // ── Resolver semana ───────────────────────────────────────────────────
    const weekStart = body.p_week_start ?? previousMondayPYT(new Date());
    const weekEnd   = computeWeekEnd(weekStart);
    const sourceLabel = body.source ?? (isCron ? "cron" : "manual");

    // ── Llamar RPC en proyecto DATA ───────────────────────────────────────
    const { data: rpcRaw, error: rpcErr } = await dataClient.rpc("compute_sales_pulse", {
      p_week_start: weekStart,
    });
    if (rpcErr) {
      await logRun(authClient, {
        triggeredBy: sourceLabel, triggeredByUser, weekStart, weekEnd,
        recipients: [], resendIds: [], status: "failed",
        errorMsg: `RPC: ${rpcErr.message}`, payload: {}, isTest: !!body.is_test,
      });
      return jsonError(`RPC compute_sales_pulse failed: ${rpcErr.message}`, 500);
    }

    const payload = parsePulsePayload(rpcRaw);
    const html    = renderSalesPulseHtml(payload, { appUrl: APP_URL, now: new Date() });
    const subject = buildSubject(payload);

    // ── Resolver destinatarios ────────────────────────────────────────────
    let recipients: string[];
    if (body.recipients && body.recipients.length > 0) {
      recipients = body.recipients;
    } else {
      const { data: subs, error: subsErr } = await authClient
        .from("sales_pulse_subscribers")
        .select("email")
        .eq("active", true);
      if (subsErr) {
        await logRun(authClient, {
          triggeredBy: sourceLabel, triggeredByUser, weekStart, weekEnd,
          recipients: [], resendIds: [], status: "failed",
          errorMsg: `subs fetch: ${subsErr.message}`, payload: rpcRaw ?? {}, isTest: !!body.is_test,
        });
        return jsonError(`No se pudo leer subscribers: ${subsErr.message}`, 500);
      }
      recipients = (subs ?? []).map((r: { email: string }) => r.email);
    }

    // En dry_run no necesitamos destinatarios — solo se previsualiza el HTML.
    // Solo bloqueamos cuando es envío real.
    if (recipients.length === 0 && !body.dry_run) {
      await logRun(authClient, {
        triggeredBy: sourceLabel, triggeredByUser, weekStart, weekEnd,
        recipients: [], resendIds: [], status: "failed",
        errorMsg: "No hay destinatarios activos", payload: rpcRaw ?? {}, isTest: !!body.is_test,
      });
      return jsonError("No hay destinatarios activos", 400);
    }

    // ── Dry run: devolver payload + html sin enviar ──────────────────────
    if (body.dry_run) {
      return jsonOk({
        dry_run: true, week_start: weekStart, week_end: weekEnd,
        subject, recipients, payload, html_length: html.length, html,
      });
    }

    // ── Envío via Resend ─────────────────────────────────────────────────
    const resendIds: string[] = [];
    const errors: string[] = [];

    for (const to of recipients) {
      try {
        const resp = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: `${FROM_NAME} <${FROM_EMAIL}>`,
            to: [to],
            subject,
            html,
          }),
        });
        const data = await resp.json();
        if (!resp.ok) {
          errors.push(`${to}: ${data?.message ?? resp.statusText}`);
        } else if (data?.id) {
          resendIds.push(data.id);
        }
      } catch (e) {
        errors.push(`${to}: ${e instanceof Error ? e.message : "fetch error"}`);
      }
    }

    const status = errors.length === 0 ? "sent"
                  : errors.length === recipients.length ? "failed"
                  : "partial";

    await logRun(authClient, {
      triggeredBy: sourceLabel, triggeredByUser, weekStart, weekEnd,
      recipients, resendIds, status,
      errorMsg: errors.length > 0 ? errors.join(" | ") : null,
      payload: rpcRaw ?? {}, isTest: !!body.is_test,
    });

    return jsonOk({
      status, week_start: weekStart, week_end: weekEnd,
      sent_count: resendIds.length, recipients_count: recipients.length,
      errors,
    });
  } catch (e) {
    console.error("[send-sales-pulse] unhandled:", e);
    return jsonError(e instanceof Error ? e.message : "internal error", 500);
  }
});

// ─── Helpers ────────────────────────────────────────────────────────────────

function computeWeekEnd(weekStart: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(weekStart);
  if (!m) return weekStart;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  d.setUTCDate(d.getUTCDate() + 6);
  return d.toISOString().slice(0, 10);
}

interface LogRunArgs {
  triggeredBy: string;
  triggeredByUser: string | null;
  weekStart: string;
  weekEnd: string;
  recipients: string[];
  resendIds: string[];
  status: string;
  errorMsg: string | null;
  payload: unknown;
  isTest: boolean;
}

async function logRun(client: ReturnType<typeof createClient>, args: LogRunArgs): Promise<void> {
  const { error } = await client.from("sales_pulse_runs").insert({
    triggered_by: args.triggeredBy,
    triggered_by_user: args.triggeredByUser,
    sent_at: args.status === "sent" || args.status === "partial" ? new Date().toISOString() : null,
    week_start: args.weekStart,
    week_end: args.weekEnd,
    recipients: args.recipients,
    resend_ids: args.resendIds,
    status: args.status,
    error_msg: args.errorMsg,
    payload: args.payload,
    is_test: args.isTest,
  });
  if (error) console.error("[send-sales-pulse] log insert error:", error.message);
}
