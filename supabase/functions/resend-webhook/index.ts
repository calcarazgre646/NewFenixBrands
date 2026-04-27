/**
 * Edge Function: resend-webhook
 *
 * Recibe eventos del webhook de Resend y actualiza sam_executions +
 * registra cada evento en sam_email_events.
 *
 * Regla: solo hacer "upgrade" de status (sent → delivered → opened).
 * bounced/complained → status='failed' (terminal).
 *
 * Deploy (sin verificación de JWT — Resend llama sin auth token):
 *   supabase functions deploy resend-webhook --no-verify-jwt
 *
 * Configurar en Resend dashboard → Webhooks → Add:
 *   URL: https://<PROJECT>.supabase.co/functions/v1/resend-webhook
 *   Events: All Events
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SB_SERVICE_ROLE_KEY = Deno.env.get("SB_SERVICE_ROLE_KEY") ?? "";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Resend event type → sam_executions.status
const STATUS_MAP: Record<string, string> = {
  "email.sent":             "sent",
  "email.delivered":        "delivered",
  "email.delivery_delayed": "sent",
  "email.opened":           "opened",
  "email.clicked":          "opened",
  "email.bounced":          "failed",
  "email.complained":       "failed",
};

// Orden de upgrade (no bajar de opened → delivered)
const STATUS_ORDER = ["pending", "sent", "delivered", "opened", "clicked", "failed"];

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const body = await req.json();
    const eventType = body.type as string | undefined;
    const eventData = (body.data ?? {}) as Record<string, unknown>;

    console.log(`[resend-webhook] Event: ${eventType}`, eventData.email_id);

    if (!eventType) return json({ ok: true, skipped: "no event type" });

    const newStatus = STATUS_MAP[eventType];
    if (!newStatus) {
      return json({ ok: true, skipped: `unhandled event ${eventType}` });
    }

    const emailId = eventData.email_id as string | undefined;
    if (!emailId) {
      return json({ ok: true, skipped: "no email_id" });
    }

    const client = createClient(SUPABASE_URL, SB_SERVICE_ROLE_KEY);

    // Buscar la execution
    const { data: execution } = await client
      .from("sam_executions")
      .select("id, status")
      .eq("resend_email_id", emailId)
      .single();

    if (!execution) {
      console.log(`[resend-webhook] No execution for resend_email_id=${emailId}`);
      return json({ ok: true, skipped: "execution not found" });
    }

    // Decidir si hacer upgrade
    const currentIdx = STATUS_ORDER.indexOf(execution.status);
    const newIdx = STATUS_ORDER.indexOf(newStatus);
    const isTerminal = newStatus === "failed";
    const shouldUpdate = isTerminal || newIdx > currentIdx;

    if (shouldUpdate) {
      const update: Record<string, unknown> = { status: newStatus };
      const nowIso = new Date().toISOString();

      if (eventType === "email.delivered") update.delivered_at = nowIso;
      if (eventType === "email.opened") update.opened_at = nowIso;
      if (eventType === "email.clicked") update.clicked_at = nowIso;
      if (eventType === "email.bounced") {
        const bounce = eventData.bounce as { type?: string; message?: string } | undefined;
        update.bounce_reason = bounce?.type ?? bounce?.message ?? "bounced";
        update.error_msg = bounce?.message ?? "Email bounced";
      }
      if (eventType === "email.complained") {
        update.bounce_reason = "complained";
        update.error_msg = "Destinatario marcó como spam";
      }

      await client.from("sam_executions").update(update).eq("id", execution.id);
    }

    // Registrar evento crudo
    await client.from("sam_email_events").insert({
      execution_id: execution.id,
      event_type: eventType,
      payload: eventData,
    });

    return json({ ok: true });
  } catch (e) {
    console.error("[resend-webhook] Error:", e);
    return json({ error: e instanceof Error ? e.message : "Internal error" }, 500);
  }
});
