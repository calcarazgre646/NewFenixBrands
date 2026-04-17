/**
 * context/authContext.ts
 *
 * React Context + value type para autenticación.
 * Separado del Provider para que `react-refresh` pueda hacer HMR del Provider.
 */
import { createContext } from "react";
import type { User, Session } from "@supabase/supabase-js";
import type { UserProfile, Permissions } from "@/domain/auth/types";

export interface AuthContextValue {
  user:            User | null;
  session:         Session | null;
  profile:         UserProfile | null;
  permissions:     Permissions;
  isAuthenticated: boolean;
  isLoading:       boolean;
  login:  (email: string, password: string) => Promise<{ error: string | null }>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
