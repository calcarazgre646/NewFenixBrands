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
      return await handleCreate(serviceClient, body);
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

  return jsonOk({ id: userId, email });
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
