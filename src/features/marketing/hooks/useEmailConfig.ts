/**
 * features/marketing/hooks/useEmailConfig.ts
 *
 * Hook para config del remitente de email marketing (Resend) +
 * mutación para actualizar + envío de prueba + historial de tests.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { marketingKeys, STALE_5MIN, STALE_30MIN, GC_60MIN } from "@/queries/keys";
import {
  fetchEmailConfig,
  updateEmailConfig,
  sendTestEmail,
  fetchExecutionsWithEvents,
} from "@/queries/marketing.queries";
import type { SamEmailConfig, SendTestEmailInput } from "@/domain/marketing/types";

export function useEmailConfig() {
  const queryClient = useQueryClient();

  const configQuery = useQuery({
    queryKey: marketingKeys.emailConfig(),
    queryFn: fetchEmailConfig,
    staleTime: STALE_30MIN,
    gcTime: GC_60MIN,
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string;
      patch: Partial<Omit<SamEmailConfig, "id" | "createdAt" | "updatedAt">>;
    }) => updateEmailConfig(id, patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: marketingKeys.emailConfig() }),
  });

  const sendTestMutation = useMutation({
    mutationFn: (input: SendTestEmailInput) => sendTestEmail(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: marketingKeys.executionsWithEvents() });
      queryClient.invalidateQueries({ queryKey: marketingKeys.executions() });
    },
  });

  return {
    config: configQuery.data ?? null,
    isLoading: configQuery.isLoading,
    error: configQuery.error ? (configQuery.error as Error).message : null,

    updateConfig: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,

    sendTest: sendTestMutation.mutateAsync,
    isSending: sendTestMutation.isPending,
    sendError: sendTestMutation.error ? (sendTestMutation.error as Error).message : null,
  };
}

export function useTestExecutions(limit = 20) {
  return useQuery({
    queryKey: marketingKeys.executionsWithEvents({ isTest: true, limit }),
    queryFn: () => fetchExecutionsWithEvents({ isTest: true, limit }),
    staleTime: STALE_5MIN,
    gcTime: GC_60MIN,
  });
}
