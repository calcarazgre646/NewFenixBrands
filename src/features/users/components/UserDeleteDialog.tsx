/**
 * features/users/components/UserDeleteDialog.tsx
 *
 * Diálogo de confirmación para eliminar un usuario.
 * Hard delete: elimina de auth.users, cascada a profiles.
 */
import { Modal } from "@/components/ui/modal";
import type { UserProfileRow } from "@/queries/users.queries";

interface UserDeleteDialogProps {
  profile: UserProfileRow;
  isDeleting: boolean;
  deleteError: string | null;
  onConfirm: (userId: string) => Promise<unknown>;
  onClose: () => void;
}

export function UserDeleteDialog({
  profile,
  isDeleting,
  deleteError,
  onConfirm,
  onClose,
}: UserDeleteDialogProps) {
  async function handleDelete() {
    await onConfirm(profile.id);
    onClose();
  }

  return (
    <Modal isOpen onClose={onClose} className="max-w-md p-6 sm:p-8">
      <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
        Eliminar Usuario
      </h2>
      <p className="mb-1 text-sm text-gray-600 dark:text-gray-400">
        ¿Estás seguro de que querés eliminar a <strong className="text-gray-900 dark:text-white">{profile.fullName || "este usuario"}</strong>?
      </p>
      <p className="mb-6 text-xs text-gray-400 dark:text-gray-500">
        Esta acción es permanente. Se eliminará la cuenta de autenticación y el perfil. Si necesitás reincorporar a esta persona, deberás crear una cuenta nueva.
      </p>

      {deleteError && (
        <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">
          {deleteError}
        </div>
      )}

      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          disabled={isDeleting}
          className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={isDeleting}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
        >
          {isDeleting ? "Eliminando..." : "Eliminar"}
        </button>
      </div>
    </Modal>
  );
}
