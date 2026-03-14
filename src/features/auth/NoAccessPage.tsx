/**
 * features/auth/NoAccessPage.tsx
 *
 * Página que se muestra cuando un usuario intenta acceder a una ruta
 * para la que no tiene permisos.
 */
import { useNavigate } from "react-router";
import { useAuth } from "@/context/AuthContext";
import { getDefaultRoute, getRoleLabel } from "@/domain/auth/types";
import Button from "@/components/ui/button/Button";

export default function NoAccessPage() {
  const { permissions, profile } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="flex items-center justify-center min-h-[60vh] px-4">
      <div className="w-full max-w-md text-center">
        {/* Icon */}
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-warning-100 dark:bg-warning-500/10">
          <svg className="h-7 w-7 text-warning-600 dark:text-warning-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
          </svg>
        </div>

        <h2 className="mb-2 text-lg font-semibold text-gray-800 dark:text-white">
          Acceso restringido
        </h2>
        <p className="mb-1 text-sm text-gray-500 dark:text-gray-400">
          No tenés permisos para acceder a esta sección.
        </p>
        {profile && (
          <p className="mb-6 text-xs text-gray-400 dark:text-gray-500">
            Tu rol actual: <span className="font-medium">{getRoleLabel(profile.role)}</span>
          </p>
        )}

        <Button
          size="sm"
          onClick={() => navigate(getDefaultRoute(permissions), { replace: true })}
        >
          Ir a mi inicio
        </Button>
      </div>
    </div>
  );
}
