/**
 * context/AuthContext.tsx
 *
 * Autenticación + perfil + permisos via Supabase Auth.
 *
 * Diseño:
 *   - Sesión = estado síncrono (onAuthStateChange)
 *   - Perfil = data async (TanStack Query via useProfileQuery)
 *   - isLoading = true hasta que AMBOS estén resueltos
 */
import {
  useEffect,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import type { User, Session } from "@supabase/supabase-js";
import { authClient } from "@/api/client";
import { queryClient } from "@/lib/queryClient";
import { useProfileQuery } from "@/hooks/useProfileQuery";
import { derivePermissions, type UserProfile } from "@/domain/auth/types";
import { AuthContext, type AuthContextValue } from "@/context/auth.context";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]                       = useState<User | null>(null);
  const [session, setSession]                 = useState<Session | null>(null);
  const [isSessionLoading, setIsSessionLoading] = useState(true);

  // ─── Sesión: onAuthStateChange (síncrono, sin async) ───────────────────────
  useEffect(() => {
    // Safety timeout: si la sesión no se resuelve en 5s, forzar
    const safetyTimeout = setTimeout(() => {
      setIsSessionLoading((prev) => {
        if (prev) {
          console.warn("[AuthContext] Session restoration timeout (5s). Forcing isSessionLoading=false.");
          return false;
        }
        return prev;
      });
    }, 5_000);

    const { data: { subscription } } = authClient.auth.onAuthStateChange(
      (_event, newSession) => {
        const u = newSession?.user ?? null;
        setSession(newSession);
        setUser(u);
        setIsSessionLoading(false);
        clearTimeout(safetyTimeout);
      }
    );

    return () => {
      clearTimeout(safetyTimeout);
      subscription.unsubscribe();
    };
  }, []);

  // ─── Perfil: TanStack Query (fetch, retry, cache automáticos) ──────────────
  const profileQuery = useProfileQuery(user?.id);
  const profile: UserProfile | null = profileQuery.data ?? null;

  // ─── isLoading: sesión + perfil (si autenticado) ───────────────────────────
  const isAuthenticated = !!user;
  const isLoading = isSessionLoading || (isAuthenticated && profileQuery.isLoading);

  // ─── Login ─────────────────────────────────────────────────────────────────
  const login = useCallback(
    async (email: string, password: string): Promise<{ error: string | null }> => {
      const timeout = new Promise<never>(
        (_, reject) => setTimeout(() => reject(new Error("Tiempo de espera agotado")), 15_000)
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

  // ─── Logout ────────────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    await authClient.auth.signOut();
    queryClient.clear();
  }, []);

  // ─── Permisos derivados (memoizado) ────────────────────────────────────────
  const permissions = useMemo(() => derivePermissions(profile), [profile]);

  const contextValue = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      profile,
      permissions,
      isAuthenticated,
      isLoading,
      login,
      logout,
    }),
    [user, session, profile, permissions, isAuthenticated, isLoading, login, logout]
  );

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}
