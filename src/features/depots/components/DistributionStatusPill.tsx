/**
 * features/depots/components/DistributionStatusPill.tsx
 *
 * Pill de estado de distribución para productos de lanzamiento.
 */
import type { NoveltyDistributionStatus } from "@/domain/depots/types";

const STATUS_CONFIG: Record<NoveltyDistributionStatus, { label: string; cls: string }> = {
  en_deposito: {
    label: "En depósito",
    cls: "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600",
  },
  en_distribucion: {
    label: "En distribución",
    cls: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/20",
  },
  cargado: {
    label: "Cargado",
    cls: "bg-success-100 text-success-700 border-success-200 dark:bg-success-500/15 dark:text-success-400 dark:border-success-500/20",
  },
};

interface Props {
  status: NoveltyDistributionStatus;
}

export default function DistributionStatusPill({ status }: Props) {
  const { label, cls } = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${cls}`}>
      {label}
    </span>
  );
}
