/**
 * features/marketing/hooks/useTriggers.ts
 *
 * Hook CRUD para triggers SAM.
 */
import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { marketingKeys, STALE_30MIN, GC_60MIN } from "@/queries/keys";
import {
  fetchSamTriggers,
  createSamTrigger,
  updateSamTrigger,
  deleteSamTrigger,
} from "@/queries/marketing.queries";
import type { SamTrigger } from "@/domain/marketing/types";

export function useTriggers() {
  const queryClient = useQueryClient();

  const { data: triggers = [], isLoading, error } = useQuery({
    queryKey: marketingKeys.triggers(),
    queryFn: fetchSamTriggers,
    staleTime: STALE_30MIN,
    gcTime: GC_60MIN,
  });

  const createMutation = useMutation({
    mutationFn: createSamTrigger,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: marketingKeys.all }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<SamTrigger> }) =>
      updateSamTrigger(id, updates),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: marketingKeys.all }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSamTrigger,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: marketingKeys.all }),
  });

  // Modal states
  const [editingTrigger, setEditingTrigger] = useState<SamTrigger | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const openEdit = useCallback((t: SamTrigger) => { updateMutation.reset(); setEditingTrigger(t); }, [updateMutation]);
  const closeEdit = useCallback(() => setEditingTrigger(null), []);
  const openCreate = useCallback(() => { createMutation.reset(); setCreateModalOpen(true); }, [createMutation]);
  const closeCreate = useCallback(() => setCreateModalOpen(false), []);

  const toggleTrigger = useCallback(
    async (id: string, isActive: boolean) => {
      await updateMutation.mutateAsync({ id, updates: { isActive } });
    },
    [updateMutation],
  );

  return {
    triggers,
    isLoading,
    error: error ? (error as Error).message : null,

    editingTrigger,
    openEdit,
    closeEdit,
    createModalOpen,
    openCreate,
    closeCreate,

    createTrigger: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    updateTrigger: async (data: Partial<SamTrigger> & { id?: string }) => {
      const id = data.id ?? editingTrigger?.id;
      if (!id) return;
      await updateMutation.mutateAsync({ id, updates: data });
      closeEdit();
    },
    isUpdating: updateMutation.isPending,
    deleteTrigger: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
    toggleTrigger,
  };
}
