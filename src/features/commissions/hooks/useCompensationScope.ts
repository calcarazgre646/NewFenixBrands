/**
 * features/commissions/hooks/useCompensationScope.ts
 *
 * Deriva el scope de compensación del usuario autenticado:
 *   - "self": rol vendedor — solo ve su propia data, filtrada por
 *     profile.vendedorCodigo. Si no tiene código asignado, vendedorCodigo=null
 *     y la UI debe mostrar el cartel "vincular código".
 *   - "team": super_user / gerencia — ve a todo el equipo. Si su perfil
 *     también tiene vendedorCodigo (caso raro), la UI puede ofrecer cambiar a
 *     "self".
 */
import { useAuth } from "@/hooks/useAuth";

export type CompensationScope = "self" | "team";

export interface UseCompensationScopeResult {
  scope: CompensationScope;
  /** Código de vendedor del perfil; null si rol vendedor sin mapeo. */
  vendedorCodigo: number | null;
  /** true si el usuario puede ver/operar sobre todo el equipo. */
  canViewTeam: boolean;
  /** true si el rol es vendedor (informativo). */
  isVendedor: boolean;
}

export function useCompensationScope(): UseCompensationScopeResult {
  const { profile } = useAuth();
  const isVendedor = profile?.role === "vendedor";
  const vendedorCodigo = profile?.vendedorCodigo ?? null;

  return {
    scope: isVendedor ? "self" : "team",
    vendedorCodigo,
    canViewTeam: !isVendedor,
    isVendedor,
  };
}
