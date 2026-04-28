/**
 * features/calendar/hooks/useEventStores.ts
 *
 * CRUD de tiendas que participan de un evento del calendario.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { eventKeys, STALE_5MIN, GC_60MIN } from "@/queries/keys";
import {
  fetchEventStores,
  addEventStores,
  removeEventStore,
  type AddEventStoreInput,
} from "@/queries/events.queries";

export function useEventStores(eventId: string | null | undefined) {
  const qc = useQueryClient();

  const storesQ = useQuery({
    queryKey: eventId ? eventKeys.stores(eventId) : ["events", "stores", "none"],
    queryFn: () => fetchEventStores(eventId!),
    enabled: !!eventId,
    staleTime: STALE_5MIN,
    gcTime: GC_60MIN,
  });

  const addM = useMutation({
    mutationFn: (inputs: AddEventStoreInput[]) => addEventStores(inputs),
    onSuccess: () => {
      if (eventId) qc.invalidateQueries({ queryKey: eventKeys.stores(eventId) });
    },
  });

  const removeM = useMutation({
    mutationFn: (id: string) => removeEventStore(id),
    onSuccess: () => {
      if (eventId) qc.invalidateQueries({ queryKey: eventKeys.stores(eventId) });
    },
  });

  return {
    stores: storesQ.data ?? [],
    isLoading: storesQ.isLoading,
    error: storesQ.error,
    addStores: addM.mutateAsync,
    removeStore: removeM.mutateAsync,
    isMutating: addM.isPending || removeM.isPending,
  };
}
