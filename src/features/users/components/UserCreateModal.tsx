/**
 * features/users/components/UserCreateModal.tsx
 *
 * Modal para crear un nuevo usuario.
 * El usuario se crea con contraseña "fenix123" y must_change_password=true.
 */
import { useState, useEffect } from "react";
import { Modal } from "@/components/ui/modal";
import type { Role, ChannelScope } from "@/domain/auth/types";
import { getRoleLabel } from "@/domain/auth/types";
import { getChannelScopeLabel, validateCreateUser } from "@/domain/users/validation";
import type { CreateUserData, CreateUserResult } from "@/queries/users.queries";

// ─── Types ───────────────────────────────────────────────────────────────────

interface UserCreateModalProps {
  isCreating: boolean;
  createError: string | null;
  onSave: (data: CreateUserData) => Promise<CreateUserResult>;
  onClose: () => void;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const ALL_ROLES: Role[] = ["super_user", "gerencia", "negocio", "vendedor"];
const ALL_SCOPES = ["b2c", "b2b", "b2b_mayoristas", "b2b_utp", "total"] as const;

// ─── Component ───────────────────────────────────────────────────────────────

export function UserCreateModal({
  isCreating,
  createError,
  onSave,
  onClose,
}: UserCreateModalProps) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [cargo, setCargo] = useState("");
  const [role, setRole] = useState<Role>("negocio");
  const [channelScope, setChannelScope] = useState<ChannelScope>(null);
  const [vendedorCodigo, setVendedorCodigo] = useState<string>("");
  const [localError, setLocalError] = useState<string | null>(null);
  // Warning amarillo cuando el user se crea pero el email de invitación falla.
  // El admin tiene que avisar manualmente.
  const [emailWarning, setEmailWarning] = useState<{ email: string; reason: string | null } | null>(null);

  // Auto-limpiar campos según rol: channel_scope solo aplica a 'negocio',
  // vendedor_codigo solo a 'vendedor'.
  useEffect(() => {
    if (role !== "negocio") {
      setChannelScope(null);
    }
    if (role !== "vendedor") {
      setVendedorCodigo("");
    }
  }, [role]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLocalError(null);
    setEmailWarning(null);

    const trimmedCodigo = vendedorCodigo.trim();
    const parsedCodigo = trimmedCodigo === "" ? null : Number(trimmedCodigo);

    if (role === "vendedor" && (parsedCodigo == null || !Number.isFinite(parsedCodigo))) {
      setLocalError("El rol Vendedor requiere un código de vendedor.");
      return;
    }

    const input = {
      email: email.trim(),
      fullName: fullName.trim(),
      role,
      channelScope,
      cargo: cargo.trim() || null,
      vendedorCodigo: parsedCodigo,
    };

    const validation = validateCreateUser(input);
    if (!validation.valid) {
      setLocalError(validation.error ?? "Datos inválidos");
      return;
    }

    try {
      const result = await onSave(input);
      if (result.emailSent === false) {
        // Usuario creado, pero el email no salió. Mostramos warning sin cerrar
        // para que el admin tenga visibles las credenciales y avise manualmente.
        setEmailWarning({ email: input.email, reason: result.emailError });
        return;
      }
      onClose();
    } catch {
      // Error se muestra via createError prop (TanStack Query mutation state)
    }
  }

  const displayError = localError || createError;

  return (
    <Modal isOpen onClose={onClose} className="max-w-lg p-6 sm:p-8">
      <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
        Nuevo Usuario
      </h2>
      <p className="mb-6 text-xs text-gray-400 dark:text-gray-500">
        Se creará con contraseña temporal. Al iniciar sesión deberá cambiarla.
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Email */}
        <div>
          <label htmlFor="create-email" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Email
          </label>
          <input
            id="create-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="off"
            placeholder="usuario@fenixbrands.com"
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          />
        </div>

        {/* Nombre */}
        <div>
          <label htmlFor="create-fullName" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Nombre completo
          </label>
          <input
            id="create-fullName"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          />
        </div>

        {/* Cargo */}
        <div>
          <label htmlFor="create-cargo" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Cargo
          </label>
          <input
            id="create-cargo"
            type="text"
            value={cargo}
            onChange={(e) => setCargo(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          />
        </div>

        {/* Rol */}
        <div>
          <label htmlFor="create-role" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Rol
          </label>
          <select
            id="create-role"
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          >
            {ALL_ROLES.map((r) => (
              <option key={r} value={r}>{getRoleLabel(r)}</option>
            ))}
          </select>
        </div>

        {/* Código de vendedor (solo visible si rol = vendedor) */}
        {role === "vendedor" && (
          <div>
            <label htmlFor="create-vendedorCodigo" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Código de vendedor <span className="text-red-500">*</span>
            </label>
            <input
              id="create-vendedorCodigo"
              type="number"
              inputMode="numeric"
              min={0}
              value={vendedorCodigo}
              onChange={(e) => setVendedorCodigo(e.target.value)}
              placeholder="Requerido — código del ERP"
              required
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            />
            <p className="mt-1 text-[11px] text-gray-400">
              Habilita la vista &laquo;Mi Proyección&raquo;. Debe coincidir con el código del ERP.
            </p>
          </div>
        )}

        {/* Canal (solo visible si rol = negocio) */}
        {role === "negocio" && (
          <div>
            <label htmlFor="create-channelScope" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Canal asignado
            </label>
            <select
              id="create-channelScope"
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

        {/* Error */}
        {displayError && !emailWarning && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">
            {displayError}
          </div>
        )}

        {/* Email warning: usuario creado pero invitación no se envió */}
        {emailWarning && (
          <div className="rounded-lg border border-warning-200 bg-warning-50 px-4 py-3 text-sm dark:border-warning-500/30 dark:bg-warning-500/10">
            <div className="font-semibold text-warning-700 dark:text-warning-400">
              Usuario creado, pero el email no se envió
            </div>
            <div className="mt-1 text-warning-700/90 dark:text-warning-300/90">
              Avisale manualmente al usuario con estas credenciales:
            </div>
            <div className="mt-2 rounded-md bg-white/60 px-3 py-2 font-mono text-xs text-gray-800 dark:bg-gray-900/40 dark:text-gray-200">
              <div>Email: <span className="font-semibold">{emailWarning.email}</span></div>
              <div>Contraseña: <span className="font-semibold">fenix123</span></div>
            </div>
            {emailWarning.reason && (
              <div className="mt-2 text-[11px] text-warning-700/70 dark:text-warning-300/70">
                Motivo: {emailWarning.reason}
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          {emailWarning ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-600"
            >
              Entendido
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                disabled={isCreating}
                className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isCreating}
                className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-600 disabled:opacity-50"
              >
                {isCreating ? "Creando..." : "Crear Usuario"}
              </button>
            </>
          )}
        </div>
      </form>
    </Modal>
  );
}
