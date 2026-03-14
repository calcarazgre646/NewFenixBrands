/**
 * features/users/components/UserEditModal.tsx
 *
 * Modal para editar perfil de usuario.
 * Campos: full_name, cargo, role, channel_scope, is_active.
 */
import { useState, useEffect } from "react";
import { Modal } from "@/components/ui/modal";
import type { Role, ChannelScope } from "@/domain/auth/types";
import { getRoleLabel } from "@/domain/auth/types";
import { getChannelScopeLabel } from "@/domain/users/validation";
import type { UserProfileRow, ProfileUpdate } from "@/queries/users.queries";

// ─── Types ───────────────────────────────────────────────────────────────────

interface UserEditModalProps {
  profile: UserProfileRow;
  canChangeRole: boolean;
  canToggleActive: boolean;
  isUpdating: boolean;
  updateError: string | null;
  onSave: (id: string, updates: ProfileUpdate) => Promise<void>;
  onClose: () => void;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const ALL_ROLES: Role[] = ["super_user", "gerencia", "negocio"];
const ALL_SCOPES = ["b2c", "b2b_mayoristas", "b2b_utp", "total"] as const;

// ─── Component ───────────────────────────────────────────────────────────────

export function UserEditModal({
  profile,
  canChangeRole,
  canToggleActive,
  isUpdating,
  updateError,
  onSave,
  onClose,
}: UserEditModalProps) {
  const [fullName, setFullName] = useState(profile.fullName);
  const [cargo, setCargo] = useState(profile.cargo ?? "");
  const [role, setRole] = useState<Role>(profile.role);
  const [channelScope, setChannelScope] = useState<ChannelScope>(profile.channelScope);
  const [isActive, setIsActive] = useState(profile.isActive);

  // Auto-limpiar channel_scope si cambia a rol que no lo usa
  useEffect(() => {
    if (role !== "negocio") {
      setChannelScope(null);
    }
  }, [role]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const updates: ProfileUpdate = {};

    if (fullName !== profile.fullName) updates.fullName = fullName;
    if ((cargo || null) !== profile.cargo) updates.cargo = cargo || null;
    if (role !== profile.role) updates.role = role;
    if (channelScope !== profile.channelScope) updates.channelScope = channelScope;
    if (isActive !== profile.isActive) updates.isActive = isActive;

    // Si no hay cambios, cerrar
    if (Object.keys(updates).length === 0) {
      onClose();
      return;
    }

    await onSave(profile.id, updates);
    onClose();
  }

  const selfEditTooltip = "No podés modificar tu propia cuenta";

  return (
    <Modal isOpen onClose={onClose} className="max-w-lg p-6 sm:p-8">
      <h2 className="mb-6 text-lg font-semibold text-gray-900 dark:text-white">
        Editar Usuario
      </h2>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Nombre */}
        <div>
          <label htmlFor="edit-fullName" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Nombre completo
          </label>
          <input
            id="edit-fullName"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          />
        </div>

        {/* Cargo */}
        <div>
          <label htmlFor="edit-cargo" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Cargo
          </label>
          <input
            id="edit-cargo"
            type="text"
            value={cargo}
            onChange={(e) => setCargo(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          />
        </div>

        {/* Rol */}
        <div>
          <label htmlFor="edit-role" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Rol
          </label>
          <div className="relative" title={!canChangeRole ? selfEditTooltip : undefined}>
            <select
              id="edit-role"
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              disabled={!canChangeRole}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            >
              {ALL_ROLES.map((r) => (
                <option key={r} value={r}>{getRoleLabel(r)}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Canal (solo visible si rol = negocio) */}
        {role === "negocio" && (
          <div>
            <label htmlFor="edit-channelScope" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Canal asignado
            </label>
            <select
              id="edit-channelScope"
              value={(channelScope ?? "") as string}
              onChange={(e) => setChannelScope((e.target.value || null) as ChannelScope)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            >
              <option value="">Sin asignar</option>
              {ALL_SCOPES.map((s) => (
                <option key={s} value={s}>{getChannelScopeLabel(s)}</option>
              ))}
            </select>
          </div>
        )}

        {/* Estado activo */}
        <div>
          <div className="flex items-center justify-between" title={!canToggleActive ? selfEditTooltip : undefined}>
            <label htmlFor="edit-isActive" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Cuenta activa
            </label>
            <button
              id="edit-isActive"
              type="button"
              role="switch"
              aria-checked={isActive}
              disabled={!canToggleActive}
              onClick={() => setIsActive(!isActive)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out disabled:cursor-not-allowed disabled:opacity-50 ${
                isActive ? "bg-brand-500" : "bg-gray-300 dark:bg-gray-600"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ease-in-out ${
                  isActive ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
          {!canToggleActive && (
            <p className="mt-1 text-xs text-gray-400">{selfEditTooltip}</p>
          )}
        </div>

        {/* Error */}
        {updateError && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">
            {updateError}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isUpdating}
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isUpdating}
            className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-600 disabled:opacity-50"
          >
            {isUpdating ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
