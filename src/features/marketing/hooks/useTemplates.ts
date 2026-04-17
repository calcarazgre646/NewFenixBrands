/**
 * features/marketing/hooks/useTemplates.ts
 *
 * Hook CRUD para templates SAM.
 */
import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { marketingKeys, STALE_30MIN, GC_60MIN } from "@/queries/keys";
import {
  fetchSamTemplates,
  createSamTemplate,
  updateSamTemplate,
} from "@/queries/marketing.queries";
import type { SamTemplate } from "@/domain/marketing/types";

export function useTemplates() {
  const queryClient = useQueryClient();

  const { data: templates = [], isLoading, error } = useQuery({
    queryKey: marketingKeys.templates(),
    queryFn: () => fetchSamTemplates(),
    staleTime: STALE_30MIN,
    gcTime: GC_60MIN,
  });

  const createMutation = useMutation({
    mutationFn: createSamTemplate,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: marketingKeys.all }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<SamTemplate> }) =>
      updateSamTemplate(id, updates),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: marketingKeys.all }),
  });

  // Modal states
  const [editingTemplate, setEditingTemplate] = useState<SamTemplate | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const openEdit = useCallback((t: SamTemplate) => { updateMutation.reset(); setEditingTemplate(t); }, [updateMutation]);
  const closeEdit = useCallback(() => setEditingTemplate(null), []);
  const openCreate = useCallback(() => { createMutation.reset(); setCreateModalOpen(true); }, [createMutation]);
  const closeCreate = useCallback(() => setCreateModalOpen(false), []);

  return {
    templates,
    isLoading,
    error: error ? (error as Error).message : null,

    editingTemplate,
    openEdit,
    closeEdit,
    createModalOpen,
    openCreate,
    closeCreate,

    createTemplate: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    updateTemplate: async (data: Partial<SamTemplate> & { id?: string }) => {
      const id = data.id ?? editingTemplate?.id;
      if (!id) return;
      await updateMutation.mutateAsync({ id, updates: data });
      closeEdit();
    },
    isUpdating: updateMutation.isPending,
  };
}
