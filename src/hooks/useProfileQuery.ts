/**
 * hooks/useProfileQuery.ts
 *
 * Hook de TanStack Query para el perfil del usuario autenticado.
 * Maneja fetch, retry, cache y deduplicación automáticamente.
 */
import { useQuery } from "@tanstack/react-query";
import { profileKeys, STALE_30MIN, GC_60MIN } from "@/queries/keys";
import { fetchProfile } from "@/queries/profile.queries";
import type { UserProfile } from "@/domain/auth/types";

export function useProfileQuery(userId: string | undefined) {
  return useQuery<UserProfile>({
    queryKey: profileKeys.detail(userId!),
    queryFn: () => fetchProfile(userId!),
    enabled: !!userId,
    staleTime: STALE_30MIN,
    gcTime: GC_60MIN,
    retry: 2,
  });
}
