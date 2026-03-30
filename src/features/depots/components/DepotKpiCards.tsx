/**
 * features/depots/components/DepotKpiCards.tsx
 *
 * 5 KPI cards (reducido de 6 — "Demanda mensual" era redundante con semanal).
 * Atrasados/Criticos siempre visibles con accent variant.
 */
import { StatCard } from "@/components/ui/stat-card/StatCard";
import { formatNumber, formatPYGCompact, formatWeeks } from "@/utils/format";
import type { DepotData } from "@/domain/depots/types";

interface Props {
  data: DepotData;
}

export default function DepotKpiCards({ data }: Props) {
  const { totals, retails, stock } = data;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <StatCard
        label="Demanda semanal"
        value={formatNumber(totals.networkWeeklyDemand)}
        sub={`${formatNumber(totals.networkMonthlyDemand)}/mes`}
      />
      <StatCard
        label="Cobertura RETAILS"
        value={formatWeeks(retails.weeksOnHand)}
        sub={`${formatNumber(retails.units)} uds.`}
        variant={retails.risk === "critico" ? "accent-negative" : retails.risk === "saludable" ? "accent-positive" : "neutral"}
      />
      <StatCard
        label="Cobertura STOCK"
        value={formatWeeks(stock.weeksOnHand)}
        sub={`${formatNumber(stock.units)} uds. respaldo`}
        variant={stock.risk === "critico" ? "accent-negative" : stock.risk === "saludable" ? "accent-positive" : "neutral"}
      />
      <StatCard
        label="Tiendas criticas"
        value={String(totals.criticalStoreCount)}
        sub="< 4 semanas cobertura"
        variant={totals.criticalStoreCount > 0 ? "accent-negative" : "accent-positive"}
      />
      <StatCard
        label="Valor red retail"
        value={formatPYGCompact(totals.networkValue)}
        sub={`${totals.dependentStoreCount} tiendas`}
      />
      <StatCard
        label="Novedades"
        value={String(data.novelty.totalSkus)}
        sub={`${data.novelty.byStatus.en_deposito} en depósito`}
        variant={data.novelty.byStatus.en_deposito > 0 ? "accent-negative" : "accent-positive"}
      />
    </div>
  );
}
