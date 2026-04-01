/**
 * LogisticsStatCards.tsx
 *
 * 6 stat cards usando StatCard del design system.
 * Atrasados SIEMPRE visible (accent-positive si 0, accent-negative si >0).
 */
import { StatCard } from "@/components/ui/stat-card/StatCard";
import type { LogisticsSummary } from "@/domain/logistics/types";
import { formatFob } from "./logistics.shared";

interface Props {
  summary: LogisticsSummary;
}

export function LogisticsStatCards({ summary }: Props) {
  return (
    <div className="exec-anim-2 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <StatCard
        label="Ordenes activas"
        value={String(summary.activeOrders)}
      />
      <StatCard
        label="Unidades en transito"
        value={summary.totalUnits.toLocaleString("es-PY")}
      />
      <StatCard
        label="Atrasados"
        value={String(summary.overdueCount)}
        variant={summary.overdueCount > 0 ? "accent-negative" : "accent-positive"}
      />
      <StatCard
        label="Valor FOB"
        value={formatFob(summary.totalFobUSD)}
      />
      <StatCard
        label="Prox. llegada"
        value={summary.nextDate}
        sub={summary.nextDaysUntil < 999 ? `en ${summary.nextDaysUntil}d` : undefined}
      />
      <StatCard
        label="Pipeline"
        value={[
          summary.byErpStatus["PEDIDO"] ? `${summary.byErpStatus["PEDIDO"]} ped` : null,
          summary.byErpStatus["EN TRANSITO"] ? `${summary.byErpStatus["EN TRANSITO"]} trán` : null,
          summary.byErpStatus["EN STOCK"] ? `${summary.byErpStatus["EN STOCK"]} stk` : null,
        ].filter(Boolean).join(" · ") || "—"}
      />
    </div>
  );
}
