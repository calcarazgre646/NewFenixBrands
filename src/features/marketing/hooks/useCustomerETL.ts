/**
 * features/marketing/hooks/useCustomerETL.ts
 *
 * Hook para ejecutar el pipeline ETL de clientes:
 * CLIM100 → transacciones → cobranzas → clean → build → upsert
 */
import { useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { marketingKeys } from "@/queries/keys";
import {
  fetchAllClim100,
  fetchTransactionsForETL,
  fetchCobranzasPending,
  upsertSamCustomers,
} from "@/queries/marketing.queries";
import {
  cleanClim100Row,
  mergeByRuc,
  aggregateTransactions,
  aggregateCobranzas,
  buildCustomerProfile,
} from "@/domain/marketing/etl";

export type EtlPhase =
  | "idle"
  | "fetching-clim100"
  | "fetching-transactions"
  | "fetching-cobranzas"
  | "processing"
  | "upserting"
  | "done"
  | "error";

export interface EtlProgress {
  phase: EtlPhase;
  message: string;
  processed?: number;
  total?: number;
}

export function useCustomerETL() {
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState<EtlProgress>({ phase: "idle", message: "" });

  const mutation = useMutation({
    mutationFn: async () => {
      const year = new Date().getFullYear();

      // 1. Fetch CLIM100
      setProgress({ phase: "fetching-clim100", message: "Descargando clientes del ERP..." });
      const clim100Rows = await fetchAllClim100();
      setProgress({ phase: "fetching-clim100", message: `${clim100Rows.length} filas CLIM100 descargadas` });

      // 2. Fetch transactions
      setProgress({ phase: "fetching-transactions", message: `Descargando transacciones ${year}...` });
      const txnRows = await fetchTransactionsForETL(year);
      setProgress({ phase: "fetching-transactions", message: `${txnRows.length} transacciones ${year} descargadas` });

      // 3. Fetch cobranzas
      setProgress({ phase: "fetching-cobranzas", message: "Descargando cobranzas pendientes..." });
      const cobRows = await fetchCobranzasPending();

      // 4. Process — merge by RUC (one row per real client)
      setProgress({ phase: "processing", message: "Procesando y clasificando clientes por RUC..." });
      const txnMap = aggregateTransactions(txnRows);
      const cobMap = aggregateCobranzas(cobRows);

      // Clean individual rows, then merge by RUC
      const cleanRows = [];
      for (const raw of clim100Rows) {
        const clean = cleanClim100Row(raw);
        if (clean) cleanRows.push(clean);
      }
      const mergedCustomers = mergeByRuc(cleanRows);

      // Count how many customers matched transactions
      let withTxn = 0;
      for (const m of mergedCustomers) {
        if (txnMap.has(m.ruc)) withTxn++;
      }

      setProgress({
        phase: "processing",
        message: `${mergedCustomers.length} clientes únicos (${withTxn} con transacciones)`,
      });

      // Build profiles — txn/cob keyed by RUC (matches v_transacciones_dwh)
      const profiles = [];
      for (const merged of mergedCustomers) {
        const txn = txnMap.get(merged.ruc);
        const cob = cobMap.get(merged.ruc);
        profiles.push(buildCustomerProfile(merged, txn, cob));
      }

      // 5. Upsert
      setProgress({
        phase: "upserting",
        message: `Sincronizando ${profiles.length} clientes...`,
        total: profiles.length,
      });
      await upsertSamCustomers(profiles);

      setProgress({
        phase: "done",
        message: `${profiles.length} clientes sincronizados (${withTxn} con compras)`,
        processed: profiles.length,
        total: profiles.length,
      });

      return { synced: profiles.length, clim100: clim100Rows.length, txns: txnRows.length };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: marketingKeys.all });
    },
    onError: (err) => {
      setProgress({
        phase: "error",
        message: (err as Error).message || "Error en ETL",
      });
    },
  });

  const runETL = useCallback(() => {
    if (mutation.isPending) return;
    mutation.mutate();
  }, [mutation]);

  return {
    runETL,
    isRunning: mutation.isPending,
    progress,
    lastResult: mutation.data ?? null,
    error: mutation.error ? (mutation.error as Error).message : null,
  };
}
