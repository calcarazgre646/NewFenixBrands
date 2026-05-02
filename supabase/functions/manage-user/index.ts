/**
 * Edge Function: manage-user
 *
 * Gestión de usuarios con service_role key.
 * Acciones: create, delete.
 *
 * Solo super_user puede invocar esta función.
 * El JWT del caller se valida contra la tabla profiles.
 *
 * Deploy:
 *   supabase secrets set SB_SERVICE_ROLE_KEY=<key>
 *   supabase functions deploy manage-user
 */
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_PASSWORD = Deno.env.get("DEFAULT_USER_PASSWORD") ?? "fenix123";
const APP_URL = Deno.env.get("APP_URL") ?? "https://fenixbrands.subestatica.com";

// UUID fijo del template "Invitación de Usuario" en sam_templates
// (ver sql/027_user_invitation_template.sql).
const INVITATION_TEMPLATE_ID = "10000000-0000-4000-a000-000000000001";

const ROLE_LABELS: Record<string, string> = {
  super_user: "Super Usuario",
  gerencia: "Gerencia",
  negocio: "Negocio",
  vendedor: "Vendedor",
};

function jsonOk(data: unknown) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function jsonError(error: string, status = 400) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  // ── CORS preflight ──────────────────────────────────────────────────────
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SB_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Missing env vars", { supabaseUrl: !!supabaseUrl, serviceRoleKey: !!serviceRoleKey });
      return jsonError("Configuración del servidor incompleta", 500);
    }

    // ── Verificar caller ────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonError("No autenticado", 401);
    }

    const token = authHeader.replace("Bearer ", "");
    const serviceClient = createClient(supabaseUrl, serviceRoleKey);

    const {
      data: { user: caller },
      error: authError,
    } = await serviceClient.auth.getUser(token);

    if (authError || !caller) {
      console.error("Auth error:", authError?.message);
      return jsonError("Token inválido", 401);
    }

    // Verificar que el caller es super_user
    const { data: callerProfile, error: profileError } = await serviceClient
      .from("profiles")
      .select("role")
      .eq("id", caller.id)
      .single();

    if (profileError) {
      console.error("Profile lookup error:", profileError.message);
      return jsonError("Error verificando permisos", 500);
    }

    if (callerProfile?.role !== "super_user") {
      return jsonError("Sin permisos", 403);
    }

    // ── Parsear body ──────────────────────────────────────────────────────────
    const body = await req.json();
    const { action } = body;

    if (action === "create") {
      return await handleCreate(serviceClient, body, authHeader, supabaseUrl);
    }

    if (action === "delete") {
      return await handleDelete(serviceClient, body);
    }

    return jsonError("Acción no válida");
  } catch (e) {
    console.error("Unhandled error:", e);
    return jsonError(
      e instanceof Error ? e.message : "Error interno",
      500,
    );
  }
});

// ─── Create ──────────────────────────────────────────────────────────────────

async function handleCreate(
  client: SupabaseClient,
  body: { email: string; fullName: string; role: string; channelScope: string | null; cargo: string | null; vendedorCodigo?: number | null },
  authHeader: string,
  supabaseUrl: string,
) {
  const { email, fullName, role, cargo } = body;
  // Guard: JSON "null" string → real null (prevents storing 'null'/'NULL' as text)
  const channelScope = body.channelScope && body.channelScope !== "null" && body.channelScope !== "NULL"
    ? body.channelScope
    : null;
  const vendedorCodigo = typeof body.vendedorCodigo === "number" && Number.isFinite(body.vendedorCodigo)
    ? body.vendedorCodigo
    : null;

  if (!email || !fullName) {
    return jsonError("Email y nombre son requeridos");
  }

  // 1. Crear usuario en auth.users
  const { data: authData, error: createError } =
    await client.auth.admin.createUser({
      email,
      password: DEFAULT_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

  if (createError) {
    console.error("Create user error:", createError.message);
    const msg = createError.message?.includes("already")
      ? "El email ya está registrado"
      : createError.message;
    return jsonError(msg);
  }

  const userId = authData.user.id;

  // 2. El trigger handle_new_user() ya creó el profile con role='negocio'.
  //    Actualizamos con los valores reales + must_change_password = true.
  const { error: updateError } = await client
    .from("profiles")
    .update({
      role: role || "negocio",
      channel_scope: channelScope,
      cargo: cargo,
      full_name: fullName,
      vendedor_codigo: vendedorCodigo,
      must_change_password: true,
    })
    .eq("id", userId);

  if (updateError) {
    console.error("Profile update error:", updateError.message);
    // Rollback: eliminar el usuario auth si el profile update falla
    await client.auth.admin.deleteUser(userId);
    return jsonError(`Error actualizando perfil: ${updateError.message}`);
  }

  // 3. Enviar email de invitación (soft-fail).
  //    Si falla, el usuario queda creado igual y devolvemos emailSent=false
  //    para que la UI le muestre al admin que tiene que avisar manualmente.
  const { sent: emailSent, error: emailError } = await sendInvitationEmail({
    authHeader,
    supabaseUrl,
    email,
    fullName,
    role: role || "negocio",
  });

  return jsonOk({ id: userId, email, emailSent, emailError });
}

// ─── Send invitation email (soft-fail) ───────────────────────────────────────

async function sendInvitationEmail(args: {
  authHeader: string;
  supabaseUrl: string;
  email: string;
  fullName: string;
  role: string;
}): Promise<{ sent: boolean; error: string | null }> {
  try {
    const res = await fetch(`${args.supabaseUrl}/functions/v1/send-email`, {
      method: "POST",
      headers: {
        Authorization: args.authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        template_id: INVITATION_TEMPLATE_ID,
        to_email: args.email,
        is_test: false,
        variables: {
          full_name: args.fullName,
          email: args.email,
          temporary_password: DEFAULT_PASSWORD,
          login_url: `${APP_URL}/signin`,
          role_label: ROLE_LABELS[args.role] ?? "Usuario",
        },
      }),
    });

    if (res.ok) {
      console.log(`[manage-user] Invitation email sent to ${args.email}`);
      return { sent: true, error: null };
    }

    const errBody = await res.json().catch(() => null);
    const msg = errBody?.error ?? `send-email returned ${res.status}`;
    console.error(`[manage-user] Invitation email failed for ${args.email}: ${msg}`);
    return { sent: false, error: msg };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "send-email fetch error";
    console.error(`[manage-user] Invitation email exception for ${args.email}: ${msg}`);
    return { sent: false, error: msg };
  }
}

// ─── Delete ──────────────────────────────────────────────────────────────────

async function handleDelete(
  client: SupabaseClient,
  body: { userId: string },
) {
  const { userId } = body;

  if (!userId) {
    return jsonError("userId es requerido");
  }

  const { error: deleteError } = await client.auth.admin.deleteUser(userId);

  if (deleteError) {
    console.error("Delete user error:", deleteError.message);
    const msg = deleteError.message?.includes("not found")
      ? "Usuario no encontrado"
      : deleteError.message;
    return jsonError(msg);
  }

  // El ON DELETE CASCADE en profiles se encarga del profile
  return jsonOk({ success: true });
}
