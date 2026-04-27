/**
 * Edge Function: send-email
 *
 * Envía un email usando Resend API. Fetch del template + config de sender,
 * merge de variables con datos del cliente (opcional), POST a Resend,
 * y registra el intento en sam_executions (is_test=true si es prueba).
 *
 * El webhook de Resend (resend-webhook) actualiza status/timestamps.
 *
 * Auth: solo super_user o gerencia pueden invocar.
 *
 * Deploy:
 *   supabase secrets set RESEND_API_KEY=<key>
 *   supabase functions deploy send-email
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Rate limit in-memory (simple, por-instancia). Evita floods mientras se prueba.
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 20;
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT_MAX;
}

function jsonOk(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function jsonError(error: string, status = 400) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

interface SendEmailBody {
  template_id: string;
  to_email: string;
  customer_id?: string | null;
  is_test?: boolean;
  override_subject?: string | null;
  override_body?: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SB_SERVICE_ROLE_KEY");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Missing Supabase env vars");
      return jsonError("Configuración del servidor incompleta", 500);
    }
    if (!resendApiKey) {
      return jsonError("RESEND_API_KEY no configurada", 500);
    }

    // ── Verificar caller ────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonError("No autenticado", 401);

    const token = authHeader.replace("Bearer ", "");
    const serviceClient = createClient(supabaseUrl, serviceRoleKey);

    const {
      data: { user: caller },
      error: authError,
    } = await serviceClient.auth.getUser(token);

    if (authError || !caller) return jsonError("Token inválido", 401);

    const { data: callerProfile } = await serviceClient
      .from("profiles")
      .select("role")
      .eq("id", caller.id)
      .single();

    if (!callerProfile || !["super_user", "gerencia"].includes(callerProfile.role)) {
      return jsonError("Sin permisos", 403);
    }

    if (isRateLimited(caller.id)) {
      return jsonError("Demasiadas solicitudes. Esperá un minuto.", 429);
    }

    // ── Parsear body ────────────────────────────────────────────────────────
    const body = (await req.json()) as SendEmailBody;
    const { template_id, to_email, customer_id, is_test, override_subject, override_body } = body;

    if (!template_id) return jsonError("template_id requerido");
    if (!to_email || !to_email.includes("@")) return jsonError("to_email inválido");

    // ── Fetch template ──────────────────────────────────────────────────────
    const { data: template, error: templateError } = await serviceClient
      .from("sam_templates")
      .select("id, channel, subject, body")
      .eq("id", template_id)
      .single();

    if (templateError || !template) {
      return jsonError("Template no encontrado", 404);
    }
    if (template.channel !== "email") {
      return jsonError("Solo se soportan templates de canal email", 400);
    }

    // ── Fetch config activa ─────────────────────────────────────────────────
    const { data: config, error: configError } = await serviceClient
      .from("sam_email_config")
      .select("from_email, from_name, reply_to")
      .eq("is_active", true)
      .single();

    if (configError || !config) {
      return jsonError("No hay configuración de email activa", 500);
    }

    // ── Fetch customer (opcional, para merge de variables) ──────────────────
    const variables: Record<string, string> = {
      razon_social: "Cliente",
      ruc: "",
      last_purchase: "",
      total_spent: "",
      tier: "",
      erp_code: "",
    };

    if (customer_id) {
      const { data: customer } = await serviceClient
        .from("sam_customers")
        .select("erp_code, ruc, razon_social, last_purchase, total_spent, tier")
        .eq("id", customer_id)
        .single();

      if (customer) {
        variables.razon_social = customer.razon_social ?? "Cliente";
        variables.ruc = customer.ruc ?? "";
        variables.last_purchase = customer.last_purchase
          ? new Date(customer.last_purchase).toLocaleDateString("es-PY")
          : "";
        variables.total_spent = customer.total_spent
          ? `₲ ${Number(customer.total_spent).toLocaleString("es-PY")}`
          : "";
        variables.tier = customer.tier ?? "";
        variables.erp_code = customer.erp_code ?? "";
      }
    }

    // ── Merge variables ─────────────────────────────────────────────────────
    const subjectRaw = override_subject ?? template.subject ?? "";
    const bodyRaw = override_body ?? template.body ?? "";

    const subject = replaceVars(subjectRaw, variables);
    const html = replaceVars(bodyRaw, variables);

    const fromLine = config.from_name
      ? `${config.from_name} <${config.from_email}>`
      : config.from_email;

    // ── POST a Resend ───────────────────────────────────────────────────────
    const resendPayload: Record<string, unknown> = {
      from: fromLine,
      to: [to_email],
      subject,
      html,
    };
    if (config.reply_to) resendPayload.reply_to = config.reply_to;

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(resendPayload),
    });

    const resendData = await resendRes.json();

    // ── Registrar en sam_executions ─────────────────────────────────────────
    const executionInsert: Record<string, unknown> = {
      trigger_id: null,
      customer_id: customer_id ?? null,
      campaign_id: null,
      channel: "email",
      status: resendRes.ok ? "sent" : "failed",
      sent_at: resendRes.ok ? new Date().toISOString() : null,
      error_msg: resendRes.ok ? null : (resendData?.message ?? "Resend error"),
      to_email,
      from_email: config.from_email,
      subject_snapshot: subject,
      html_snapshot: html,
      variables_used: variables,
      is_test: is_test ?? true,
      resend_email_id: resendRes.ok ? resendData.id : null,
    };

    const { data: execution, error: execError } = await serviceClient
      .from("sam_executions")
      .insert(executionInsert)
      .select("id")
      .single();

    if (execError) {
      console.error("Insert execution error:", execError.message);
    }

    if (!resendRes.ok) {
      console.error(`[send-email] Resend error:`, resendData);
      return jsonError(resendData?.message ?? "Error en Resend API", resendRes.status);
    }

    console.log(
      `[send-email] Sent to ${to_email} by ${caller.email} (template ${template_id}, test=${is_test ?? true})`,
    );

    return jsonOk({
      execution_id: execution?.id ?? null,
      resend_email_id: resendData.id,
      status: "sent",
    });
  } catch (e) {
    console.error("Unhandled error:", e);
    return jsonError(
      e instanceof Error ? e.message : "Error interno",
      500,
    );
  }
});

// ─── Helpers ────────────────────────────────────────────────────────────────

function replaceVars(raw: string, vars: Record<string, string>): string {
  let out = raw;
  for (const [key, value] of Object.entries(vars)) {
    out = out.replaceAll(`{{${key}}}`, value);
  }
  return out;
}
