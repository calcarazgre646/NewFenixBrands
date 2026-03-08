/**
 * context/AuthContext.tsx
 *
 * Autenticación via Supabase Auth (instancia auth: uxtzzcjimvapjpkeruwb).
 * Los usuarios del proyecto anterior siguen funcionando — misma instancia.
 */
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { User, Session } from "@supabase/supabase-js";
import { authClient } from "@/api/client";
import { queryClient } from "@/lib/queryClient";

interface AuthContextValue {
  user:            User | null;
  session:         Session | null;
  isAuthenticated: boolean;
  isLoading:       boolean;
  login:  (email: string, password: string) => Promise<{ error: string | null }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]       = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Inicializar sesión existente
    authClient.auth
      .getSession()
      .then(({ data }) => {
        setSession(data.session);
        setUser(data.session?.user ?? null);
      })
      .catch(() => {
        setUser(null);
        setSession(null);
      })
      .finally(() => setIsLoading(false));

    // Escuchar cambios de sesión
    const { data: { subscription } } = authClient.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);
        setIsLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const login = useCallback(
    async (email: string, password: string): Promise<{ error: string | null }> => {
      const timeout = new Promise<{ error: string }>(
        (_, reject) => setTimeout(() => reject({ error: "Tiempo de espera agotado" }), 15_000)
      );
      try {
        const result = await Promise.race([
          authClient.auth.signInWithPassword({ email, password }),
          timeout,
        ]) as Awaited<ReturnType<typeof authClient.auth.signInWithPassword>>;

        if ("error" in result && result.error) {
          return { error: result.error.message };
        }
        return { error: null };
      } catch (e) {
        return { error: e instanceof Error ? e.message : "Error desconocido" };
      }
    },
    []
  );

  const logout = useCallback(async () => {
    await authClient.auth.signOut();
    queryClient.clear();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
