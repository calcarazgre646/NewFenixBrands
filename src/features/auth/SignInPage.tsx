/**
 * features/auth/SignInPage.tsx
 *
 * Página de login. Redirige según rol si ya está autenticado.
 */
import { useState, type FormEvent } from "react";
import { Navigate } from "react-router";
import { useAuth } from "@/context/AuthContext";
import { getDefaultRoute } from "@/domain/auth/types";
import { EyeCloseIcon, EyeIcon } from "@/icons";
import Label from "@/components/form/Label";
import Input from "@/components/form/input/InputField";
import Button from "@/components/ui/button/Button";

/** Mapea errores de Supabase a mensajes en español */
function translateError(msg: string): string {
  if (msg.includes("Invalid login credentials")) return "Email o contraseña incorrectos";
  if (msg.includes("Email not confirmed")) return "Tu email no fue confirmado. Revisá tu bandeja de entrada.";
  if (msg.includes("Too many requests")) return "Demasiados intentos. Esperá un momento.";
  if (msg.includes("Network")) return "Error de conexión. Verificá tu internet.";
  return msg;
}

export default function SignInPage() {
  const { isAuthenticated, isLoading: authLoading, login, permissions } = useAuth();

  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd]   = useState(false);
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  // Ya autenticado → redirigir a ruta por defecto según rol.
  // isLoading incluye session + profile, así que permissions ya son correctos.
  if (!authLoading && isAuthenticated) {
    return <Navigate to={getDefaultRoute(permissions)} replace />;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password.trim()) {
      setError("Por favor completá todos los campos");
      return;
    }
    setLoading(true);
    const { error: err } = await login(email, password);
    if (err) {
      setError(translateError(err));
      setLoading(false);
    }
    // Si login OK, NO navegar manualmente. El auto-redirect de arriba
    // se encarga cuando profile se carga (onAuthStateChange → loadProfile → re-render).
    // El spinner sigue visible hasta que el redirect ocurra — es correcto.
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <img src="/negro.avif" alt="FenixBrands" className="h-12 w-auto dark:hidden" />
          <img src="/blanco.png" alt="FenixBrands" className="h-12 w-auto hidden dark:block" />
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-theme-md border border-gray-200 dark:border-gray-700 p-8">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">
            Bienvenido
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            Ingresá tus credenciales para acceder al dashboard
          </p>

          {error && (
            <div className="mb-5 p-3 rounded-lg bg-error-50 dark:bg-error-500/10 border border-error-200 dark:border-error-500/20">
              <p className="text-sm text-error-600 dark:text-error-400">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <Label>Email <span className="text-error-500">*</span></Label>
              <Input
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <Label>Contraseña <span className="text-error-500">*</span></Label>
              <div className="relative">
                <Input
                  type={showPwd ? "text" : "password"}
                  placeholder="Tu contraseña"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPwd
                    ? <EyeIcon className="size-5" />
                    : <EyeCloseIcon className="size-5" />
                  }
                </button>
              </div>
            </div>
            <Button className="w-full" size="sm" disabled={loading}>
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Ingresando...
                </span>
              ) : "Iniciar Sesión"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
