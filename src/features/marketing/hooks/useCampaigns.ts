/**
 * features/marketing/hooks/useCampaigns.ts
 *
 * Hook CRUD para campañas SAM.
 */
import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { marketingKeys, STALE_30MIN, GC_60MIN } from "@/queries/keys";
import {
  fetchSamCampaigns,
  createSamCampaign,
  updateSamCampaign,
  fetchSamSegments,
} from "@/queries/marketing.queries";
import type { SamCampaign } from "@/domain/marketing/types";

export function useCampaigns() {
  const queryClient = useQueryClient();

  const { data: campaigns = [], isLoading, error } = useQuery({
    queryKey: marketingKeys.campaigns(),
    queryFn: fetchSamCampaigns,
    staleTime: STALE_30MIN,
    gcTime: GC_60MIN,
  });

  const { data: segments = [] } = useQuery({
    queryKey: marketingKeys.segments(),
    queryFn: fetchSamSegments,
    staleTime: STALE_30MIN,
    gcTime: GC_60MIN,
  });

  const createMutation = useMutation({
    mutationFn: createSamCampaign,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: marketingKeys.all }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<SamCampaign> }) =>
      updateSamCampaign(id, updates),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: marketingKeys.all }),
  });

  // Modal states
  const [editingCampaign, setEditingCampaign] = useState<SamCampaign | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const openEdit = useCallback((c: SamCampaign) => { updateMutation.reset(); setEditingCampaign(c); }, [updateMutation]);
  const closeEdit = useCallback(() => setEditingCampaign(null), []);
  const openCreate = useCallback(() => { createMutation.reset(); setCreateModalOpen(true); }, [createMutation]);
  const closeCreate = useCallback(() => setCreateModalOpen(false), []);

  return {
    campaigns,
    segments,
    isLoading,
    error: error ? (error as Error).message : null,

    editingCampaign,
    openEdit,
    closeEdit,
    createModalOpen,
    openCreate,
    closeCreate,

    createCampaign: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    updateCampaign: async (data: Partial<SamCampaign> & { id?: string }) => {
      const id = data.id ?? editingCampaign?.id;
      if (!id) return;
      await updateMutation.mutateAsync({ id, updates: data });
      closeEdit();
    },
    isUpdating: updateMutation.isPending,
  };
}
