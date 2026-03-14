/**
 * features/users/UsersPage.tsx
 *
 * Página de gestión de usuarios — solo super_user.
 * Lista, crea, edita y elimina usuarios.
 */
import { PageHeader } from "@/components/ui/page-header/PageHeader";
import { PageSkeleton } from "@/components/ui/skeleton/Skeleton";
import { EmptyState } from "@/components/ui/empty-state/EmptyState";
import { GroupIcon, PencilIcon, PlusIcon, TrashBinIcon } from "@/icons";
import { getRoleLabel } from "@/domain/auth/types";
import {
  getRoleBadgeStyle,
  getStatusBadgeStyle,
  getChannelScopeLabel,
} from "@/domain/users/validation";
import { useUsers } from "./hooks/useUsers";
import { UserEditModal } from "./components/UserEditModal";
import { UserCreateModal } from "./components/UserCreateModal";
import { UserDeleteDialog } from "./components/UserDeleteDialog";

// ─── Filter options ──────────────────────────────────────────────────────────

const ROLE_OPTIONS = [
  { value: "all", label: "Todos los roles" },
  { value: "super_user", label: "Super User" },
  { value: "gerencia", label: "Gerencia" },
  { value: "negocio", label: "Negocio" },
] as const;

const STATUS_OPTIONS = [
  { value: "all", label: "Todos los estados" },
  { value: "active", label: "Activos" },
  { value: "inactive", label: "Inactivos" },
] as const;

// ─── Page ────────────────────────────────────────────────────────────────────

export default function UsersPage() {
  const {
    profiles,
    totalCount,
    isLoading,
    error,
    roleFilter,
    setRoleFilter,
    statusFilter,
    setStatusFilter,
    // Edit
    editingProfile,
    openEdit,
    closeEdit,
    getEditPermissions,
    updateUser,
    isUpdating,
    updateError,
    // Create
    createModalOpen,
    openCreate,
    closeCreate,
    createUser,
    isCreating,
    createError,
    // Delete
    deletingProfile,
    openDelete,
    closeDelete,
    canDelete,
    deleteUser,
    isDeleting,
    deleteError,
  } = useUsers();

  if (isLoading) return <PageSkeleton />;

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-600 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400">
        Error al cargar usuarios: {error}
      </div>
    );
  }

  const editPerms = editingProfile ? getEditPermissions(editingProfile) : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Usuarios"
        description="Gestión de roles, permisos y estado de cuentas"
        badge={
          <span className="inline-flex items-center rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-500/20 dark:text-brand-400">
            {totalCount}
          </span>
        }
        actions={
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand-600"
          >
            <PlusIcon className="h-4 w-4" />
            Nuevo Usuario
          </button>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as typeof roleFilter)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
          aria-label="Filtrar por rol"
        >
          {ROLE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
          aria-label="Filtrar por estado"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Table or Empty */}
      {profiles.length === 0 ? (
        <EmptyState
          icon={<GroupIcon className="h-12 w-12" />}
          title="Sin resultados"
          description="No hay usuarios que coincidan con los filtros seleccionados."
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-800">
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Nombre</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Rol</th>
                <th className="hidden px-4 py-3 font-medium text-gray-500 dark:text-gray-400 sm:table-cell">Canal</th>
                <th className="hidden px-4 py-3 font-medium text-gray-500 dark:text-gray-400 md:table-cell">Cargo</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Estado</th>
                <th className="hidden px-4 py-3 font-medium text-gray-500 dark:text-gray-400 lg:table-cell">Actualizado</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {profiles.map((profile) => {
                const status = getStatusBadgeStyle(profile.isActive);
                const deletable = canDelete(profile.id);
                return (
                  <tr key={profile.id} className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                      {profile.fullName || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${getRoleBadgeStyle(profile.role)}`}>
                        {getRoleLabel(profile.role)}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 text-gray-600 dark:text-gray-400 sm:table-cell">
                      {getChannelScopeLabel(profile.channelScope)}
                    </td>
                    <td className="hidden px-4 py-3 text-gray-600 dark:text-gray-400 md:table-cell">
                      {profile.cargo ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${status.className}`}>
                        {status.text}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 text-xs text-gray-400 lg:table-cell">
                      {profile.updatedAt
                        ? new Date(profile.updatedAt).toLocaleDateString("es-PY", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(profile)}
                          className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                          aria-label={`Editar ${profile.fullName}`}
                        >
                          <PencilIcon className="h-4 w-4" />
                        </button>
                        {deletable && (
                          <button
                            type="button"
                            onClick={() => openDelete(profile)}
                            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                            aria-label={`Eliminar ${profile.fullName}`}
                          >
                            <TrashBinIcon className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit Modal */}
      {editingProfile && editPerms && (
        <UserEditModal
          profile={editingProfile}
          canChangeRole={editPerms.canChangeRole}
          canToggleActive={editPerms.canToggleActive}
          isUpdating={isUpdating}
          updateError={updateError}
          onSave={async (id, updates) => {
            await updateUser({ id, updates });
          }}
          onClose={closeEdit}
        />
      )}

      {/* Create Modal */}
      {createModalOpen && (
        <UserCreateModal
          isCreating={isCreating}
          createError={createError}
          onSave={createUser}
          onClose={closeCreate}
        />
      )}

      {/* Delete Dialog */}
      {deletingProfile && (
        <UserDeleteDialog
          profile={deletingProfile}
          isDeleting={isDeleting}
          deleteError={deleteError}
          onConfirm={deleteUser}
          onClose={closeDelete}
        />
      )}
    </div>
  );
}
