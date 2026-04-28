/**
 * features/commissions/hooks/useTransactionsDrawer.ts
 *
 * Lazy fetch de transacciones individuales de un vendedor, para el drill-down
 * que se abre desde la tabla del Equipo. Solo dispara la query cuando el
 * drawer está abierto (`enabled`), así no se tocan los datos hasta que el
 * usuario los pide.
 */
import { useQuery } from "@tanstack/react-query";
import {
  fetchSellerTransactions,
  type SellerTransactionRow,
} from "@/queries/commissions.queries";
import { commissionKeys, STALE_30MIN, GC_60MIN } from "@/queries/keys";

export interface UseTransactionsDrawerArgs {
  /** true cuando el drawer está abierto (controla `enabled` de la query). */
  open: boolean;
  year: number;
  month: number;
  vendedorCodigo: number | null;
}

export interface UseTransactionsDrawerResult {
  transactions: SellerTransactionRow[];
  total:        number;
  units:        number;
  isLoading:    boolean;
  error:        Error | null;
}

export function useTransactionsDrawer({
  open,
  year,
  month,
  vendedorCodigo,
}: UseTransactionsDrawerArgs): UseTransactionsDrawerResult {
  const enabled = open && vendedorCodigo != null;

  const q = useQuery({
    queryKey: vendedorCodigo != null
      ? commissionKeys.transactions(year, month, vendedorCodigo)
      : ["commissions", "transactions", "disabled"],
    queryFn: () => fetchSellerTransactions(year, month, vendedorCodigo as number),
    staleTime: STALE_30MIN,
    gcTime: GC_60MIN,
    enabled,
  });

  const transactions = q.data ?? [];
  let total = 0;
  let units = 0;
  for (const t of transactions) {
    total += t.ventaNeta;
    units += t.unidades;
  }

  return {
    transactions,
    total,
    units,
    isLoading: q.isLoading,
    error: q.error as Error | null,
  };
}
