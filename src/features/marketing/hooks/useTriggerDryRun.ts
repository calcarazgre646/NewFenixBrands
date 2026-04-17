/**
 * features/marketing/hooks/useTriggerDryRun.ts
 *
 * Hook para dry run de triggers: evalúa clientes contra un trigger sin dispararlo.
 */
import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { marketingKeys } from "@/queries/keys";
import { fetchSamCustomers } from "@/queries/marketing.queries";
import { matchCustomersToTrigger } from "@/domain/marketing/triggers";
import type { SamCustomer, SamTrigger } from "@/domain/marketing/types";

export function useTriggerDryRun() {
  const queryClient = useQueryClient();
  const [matchedCustomers, setMatchedCustomers] = useState<SamCustomer[]>([]);
  const [isEvaluating, setIsEvaluating] = useState(false);

  const evaluate = useCallback(
    async (trigger: SamTrigger) => {
      setIsEvaluating(true);
      try {
        // Fetch all customers (up to 1000 for dry run)
        const cached = queryClient.getQueryData<{ data: SamCustomer[] }>(
          marketingKeys.customers({ pageSize: 1000 }),
        );
        const customers = cached?.data ?? (await fetchSamCustomers({ pageSize: 1000 })).data;
        const matched = matchCustomersToTrigger(customers, trigger);
        setMatchedCustomers(matched);
      } finally {
        setIsEvaluating(false);
      }
    },
    [queryClient],
  );

  const clear = useCallback(() => setMatchedCustomers([]), []);

  return {
    matchedCustomers,
    matchCount: matchedCustomers.length,
    isEvaluating,
    evaluate,
    clear,
  };
}
