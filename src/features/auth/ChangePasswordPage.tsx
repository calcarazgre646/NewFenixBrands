/**
 * features/auth/ChangePasswordPage.tsx
 *
 * Pantalla de cambio de contraseña obligatorio.
 * Mostrada cuando must_change_password = true en el perfil.
 */
import { useState } from "react";
import { useNavigate } from "react-router";
import { authClient } from "@/api/client";
import { useAuth } from "@/context/AuthContext";
import { getDefaultRoute } from "@/domain/auth/types";
import { validatePassword } from "@/domain/users/validation";
import { queryClient } from "@/lib/queryClient";
import { profileKeys } from "@/queries/keys";

export default function ChangePasswordPage() {
  const { user, permissions } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Validar contraseña
    const validation = validatePassword(password);
    if (!validation.valid) {
      setError(validation.error ?? "Contraseña inválida");
      return;
    }

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }

    setIsSubmitting(true);

    // 1. PRIMERO marcar must_change_password = false via RPC (SECURITY DEFINER)
    //    Debe ejecutarse ANTES de updateUser porque updateUser dispara
    //    onAuthStateChange → AuthContext re-fetch → re-mount de este componente.
    const { error: rpcError } = await authClient.rpc("clear_must_change_password");

    if (rpcError) {
      setError(rpcError.message);
      setIsSubmitting(false);
      return;
    }

    // 2. Cambiar contraseña en Supabase Auth
    const { error: authError } = await authClient.auth.updateUser({
      password,
    });
    if (authError) {
      // Rollback: volver a marcar must_change_password = true
      const { error: rollbackError } = await authClient.rpc("set_must_change_password");
      if (rollbackError) {
        console.error("[ChangePassword] Rollback failed:", rollbackError.message);
      }
      const msg = authError.message.includes("different")
        ? "La nueva contraseña debe ser diferente a la actual"
        : authError.message;
      setError(msg);
      setIsSubmitting(false);
      return;
    }

    // 3. Invalidar cache del perfil para que AuthContext refresque
    await queryClient.invalidateQueries({
      queryKey: profileKeys.detail(user!.id),
    });

    // 4. Navegar a ruta por defecto
    navigate(getDefaultRoute(permissions), { replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg dark:bg-gray-900">
        <div className="mb-6 text-center">
          <img src="/negro.avif" alt="FenixBrands" className="mx-auto mb-4 h-8 w-auto dark:hidden" />
          <img src="/blanco.png" alt="FenixBrands" className="mx-auto mb-4 hidden h-8 w-auto dark:block" />
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            Cambiar Contraseña
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Es tu primer inicio de sesión. Creá una nueva contraseña para continuar.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="new-password" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Nueva contraseña
            </label>
            <input
              id="new-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            />
          </div>

          <div>
            <label htmlFor="confirm-password" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Confirmar contraseña
            </label>
            <input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            />
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-600 disabled:opacity-50"
          >
            {isSubmitting ? "Guardando..." : "Guardar y continuar"}
          </button>
        </form>
      </div>
    </div>
  );
}
