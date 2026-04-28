/**
 * features/calendar/hooks/useSkuConflicts.ts
 *
 * Detecta SKUs vinculados al evento que también están vinculados a otros
 * eventos activos del calendario (riesgo de doble allocation).
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { eventKeys, STALE_5MIN, GC_60MIN } from "@/queries/keys";
import { fetchSkuConflicts, type SkuConflict } from "@/queries/events.queries";

export interface SkuConflictsData {
  conflicts: SkuConflict[];
  conflictedSkuSet: Set<string>;     // O(1) lookup desde el UI
  isLoading: boolean;
}

export function useSkuConflicts(
  eventId: string | null | undefined,
  skuComerciales: string[],
): SkuConflictsData {
  // Cheap stable key para el query (sorted join)
  const skuKey = useMemo(() => [...skuComerciales].sort().join(","), [skuComerciales]);

  const q = useQuery({
    queryKey: eventId ? eventKeys.skuConflicts(eventId, skuKey) : ["events", "skuConflicts", "none"],
    queryFn: () => fetchSkuConflicts(eventId!, skuComerciales),
    enabled: !!eventId && skuComerciales.length > 0,
    staleTime: STALE_5MIN,
    gcTime: GC_60MIN,
  });

  const conflictedSkuSet = useMemo(
    () => new Set((q.data ?? []).map((c) => c.skuComercial)),
    [q.data],
  );

  return {
    conflicts: q.data ?? [],
    conflictedSkuSet,
    isLoading: q.isLoading,
  };
}
