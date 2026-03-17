/**
 * queries/users.queries.ts
 *
 * Fetch + update de perfiles de usuario.
 * Create + delete via Edge Function manage-user (requiere service_role).
 * Fuente: tabla public.profiles (authClient).
 */
import { authClient } from "@/api/client";
import type { ChannelScope, Role } from "@/domain/auth/types";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface UserProfileRow {
  id:                 string;
  role:               Role;
  channelScope:       ChannelScope;
  fullName:           string;
  cargo:              string | null;
  isActive:           boolean;
  mustChangePassword: boolean;
  updatedAt:          string;
}

export interface ProfileUpdate {
  fullName?:     string;
  cargo?:        string | null;
  role?:         Role;
  channelScope?: ChannelScope;
  isActive?:     boolean;
}

export interface CreateUserData {
  email:        string;
  fullName:     string;
  role:         Role;
  channelScope: ChannelScope;
  cargo:        string | null;
}

// ─── Fetch ───────────────────────────────────────────────────────────────────

export async function fetchAllProfiles(): Promise<UserProfileRow[]> {
  const { data, error } = await authClient
    .from("profiles")
    .select("id, role, channel_scope, full_name, cargo, is_active, must_change_password, updated_at")
    .order("full_name");

  if (error) throw new Error(`fetchAllProfiles: ${error.message}`);

  return (data ?? []).map((r) => ({
    id:           r.id,
    role:         r.role as Role,
    channelScope: (r.channel_scope as ChannelScope) ?? null,
    fullName:     r.full_name ?? "",
    cargo:        r.cargo ?? null,
    isActive:           r.is_active ?? true,
    mustChangePassword: r.must_change_password ?? false,
    updatedAt:          r.updated_at ?? "",
  }));
}

// ─── Update ──────────────────────────────────────────────────────────────────

export async function updateProfile(
  id: string,
  updates: ProfileUpdate,
): Promise<void> {
  const dbUpdates: Record<string, unknown> = {};
  if (updates.fullName !== undefined)     dbUpdates.full_name     = updates.fullName;
  if (updates.cargo !== undefined)        dbUpdates.cargo         = updates.cargo;
  if (updates.role !== undefined)         dbUpdates.role          = updates.role;
  if (updates.channelScope !== undefined) dbUpdates.channel_scope = updates.channelScope;
  if (updates.isActive !== undefined)     dbUpdates.is_active     = updates.isActive;

  const { error } = await authClient
    .from("profiles")
    .update(dbUpdates)
    .eq("id", id);

  if (error) throw new Error(`updateProfile: ${error.message}`);
}

// ─── Edge Function helpers ───────────────────────────────────────────────────

/**
 * Invoca la Edge Function manage-user con fetch directo.
 * Supabase JS functions.invoke() envuelve errores non-2xx en un mensaje genérico
 * que pierde el detalle real. Con fetch controlamos la respuesta completa.
 */
async function invokeManageUser(
  payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const { data: { session } } = await authClient.auth.getSession();

  if (!session?.access_token) {
    throw new Error("No hay sesión activa. Iniciá sesión de nuevo.");
  }

  const res = await fetch(
    `${supabaseUrl}/functions/v1/manage-user`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
      },
      body: JSON.stringify(payload),
    },
  );

  const body = await res.json().catch(() => null);

  if (!res.ok) {
    const msg = body?.error ?? body?.message ?? `Error ${res.status}`;
    throw new Error(msg);
  }

  if (body?.error) throw new Error(body.error);

  return body;
}

// ─── Create (via Edge Function) ──────────────────────────────────────────────

export async function createUser(
  data: CreateUserData,
): Promise<{ id: string; email: string }> {
  const result = await invokeManageUser({
    action: "create",
    email: data.email,
    fullName: data.fullName,
    role: data.role,
    channelScope: data.channelScope,
    cargo: data.cargo,
  });

  return result as { id: string; email: string };
}

// ─── Delete (via Edge Function) ──────────────────────────────────────────────

export async function deleteUser(userId: string): Promise<void> {
  await invokeManageUser({ action: "delete", userId });
}
