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

// ─── Create (via Edge Function) ──────────────────────────────────────────────

export async function createUser(
  data: CreateUserData,
): Promise<{ id: string; email: string }> {
  const { data: result, error } = await authClient.functions.invoke(
    "manage-user",
    {
      body: {
        action: "create",
        email: data.email,
        fullName: data.fullName,
        role: data.role,
        channelScope: data.channelScope,
        cargo: data.cargo,
      },
    },
  );

  if (error) throw new Error(`createUser: ${error.message}`);

  const body = result as Record<string, unknown> | null;
  if (body?.error) throw new Error(body.error as string);

  return body as { id: string; email: string };
}

// ─── Delete (via Edge Function) ──────────────────────────────────────────────

export async function deleteUser(userId: string): Promise<void> {
  const { data: result, error } = await authClient.functions.invoke(
    "manage-user",
    {
      body: { action: "delete", userId },
    },
  );

  if (error) throw new Error(`deleteUser: ${error.message}`);

  const body = result as Record<string, unknown> | null;
  if (body?.error) throw new Error(body.error as string);
}
