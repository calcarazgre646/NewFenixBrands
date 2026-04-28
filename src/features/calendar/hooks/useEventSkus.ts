/**
 * features/calendar/hooks/useEventSkus.ts
 *
 * CRUD de SKUs (style-color) vinculados a un evento del calendario.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { eventKeys, STALE_5MIN, GC_60MIN } from "@/queries/keys";
import {
  fetchEventSkus,
  addEventSkus,
  removeEventSku,
  type AddEventSkuInput,
} from "@/queries/events.queries";

export function useEventSkus(eventId: string | null | undefined) {
  const qc = useQueryClient();

  const skusQ = useQuery({
    queryKey: eventId ? eventKeys.skus(eventId) : ["events", "skus", "none"],
    queryFn: () => fetchEventSkus(eventId!),
    enabled: !!eventId,
    staleTime: STALE_5MIN,
    gcTime: GC_60MIN,
  });

  const addM = useMutation({
    mutationFn: (inputs: AddEventSkuInput[]) => addEventSkus(inputs),
    onSuccess: () => {
      if (eventId) qc.invalidateQueries({ queryKey: eventKeys.skus(eventId) });
    },
  });

  const removeM = useMutation({
    mutationFn: (id: string) => removeEventSku(id),
    onSuccess: () => {
      if (eventId) qc.invalidateQueries({ queryKey: eventKeys.skus(eventId) });
    },
  });

  return {
    skus: skusQ.data ?? [],
    isLoading: skusQ.isLoading,
    error: skusQ.error,
    addSkus: addM.mutateAsync,
    removeSku: removeM.mutateAsync,
    isMutating: addM.isPending || removeM.isPending,
  };
}
