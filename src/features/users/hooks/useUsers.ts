/**
 * features/users/hooks/useUsers.ts
 *
 * Hook TanStack Query para listar, crear, editar y eliminar usuarios.
 * Filtros locales (rol, estado) — independientes de FilterContext.
 */
import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { usersKeys, STALE_30MIN, GC_60MIN } from "@/queries/keys";
import {
  fetchAllProfiles,
  updateProfile,
  createUser as createUserQuery,
  deleteUser as deleteUserQuery,
  type UserProfileRow,
  type ProfileUpdate,
  type CreateUserData,
} from "@/queries/users.queries";
import { useAuth } from "@/context/AuthContext";
import { canEditProfile, canDeleteUser } from "@/domain/users/validation";
import type { Role } from "@/domain/auth/types";

// ─── Filter types ────────────────────────────────────────────────────────────

type RoleFilter = Role | "all";
type StatusFilter = "active" | "inactive" | "all";

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useUsers() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const currentUserId = user?.id ?? "";

  // ── Query ──────────────────────────────────────────────────────────────────
  const {
    data: profiles = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: usersKeys.list(),
    queryFn: fetchAllProfiles,
    staleTime: STALE_30MIN,
    gcTime: GC_60MIN,
  });

  // ── Update mutation ────────────────────────────────────────────────────────
  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: ProfileUpdate }) =>
      updateProfile(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: usersKeys.all });
    },
  });

  // ── Create mutation ────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (data: CreateUserData) => createUserQuery(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: usersKeys.all });
    },
  });

  // ── Delete mutation ────────────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: (userId: string) => deleteUserQuery(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: usersKeys.all });
    },
  });

  // ── Filters ────────────────────────────────────────────────────────────────
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const filteredProfiles = useMemo(() => {
    let result = profiles;
    if (roleFilter !== "all") {
      result = result.filter((p) => p.role === roleFilter);
    }
    if (statusFilter !== "all") {
      result = result.filter((p) =>
        statusFilter === "active" ? p.isActive : !p.isActive,
      );
    }
    return result;
  }, [profiles, roleFilter, statusFilter]);

  // ── Edit state ─────────────────────────────────────────────────────────────
  const [editingProfile, setEditingProfile] = useState<UserProfileRow | null>(null);
  const openEdit = useCallback((profile: UserProfileRow) => setEditingProfile(profile), []);
  const closeEdit = useCallback(() => setEditingProfile(null), []);

  // ── Create state ───────────────────────────────────────────────────────────
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const openCreate = useCallback(() => setCreateModalOpen(true), []);
  const closeCreate = useCallback(() => setCreateModalOpen(false), []);

  // ── Delete state ───────────────────────────────────────────────────────────
  const [deletingProfile, setDeletingProfile] = useState<UserProfileRow | null>(null);
  const openDelete = useCallback((profile: UserProfileRow) => setDeletingProfile(profile), []);
  const closeDelete = useCallback(() => setDeletingProfile(null), []);

  // ── Permissions ────────────────────────────────────────────────────────────
  const getEditPermissions = useCallback(
    (target: UserProfileRow) => canEditProfile(currentUserId, target),
    [currentUserId],
  );

  const canDelete = useCallback(
    (targetId: string) => canDeleteUser(currentUserId, targetId),
    [currentUserId],
  );

  return {
    profiles: filteredProfiles,
    totalCount: profiles.length,
    isLoading,
    error: error ? (error as Error).message : null,

    roleFilter,
    setRoleFilter,
    statusFilter,
    setStatusFilter,

    // Edit
    editingProfile,
    openEdit,
    closeEdit,
    getEditPermissions,
    updateUser: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    updateError: updateMutation.error ? (updateMutation.error as Error).message : null,

    // Create
    createModalOpen,
    openCreate,
    closeCreate,
    createUser: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    createError: createMutation.error ? (createMutation.error as Error).message : null,

    // Delete
    deletingProfile,
    openDelete,
    closeDelete,
    canDelete,
    deleteUser: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
    deleteError: deleteMutation.error ? (deleteMutation.error as Error).message : null,
  };
}
