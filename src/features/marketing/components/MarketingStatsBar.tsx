/**
 * features/marketing/components/MarketingStatsBar.tsx
 *
 * 6 stat cards para el dashboard de marketing.
 */
import { StatCard } from "@/components/ui/stat-card/StatCard";
import type { MarketingMetrics } from "@/domain/marketing/types";

interface Props {
  metrics: MarketingMetrics;
}

function fmt(n: number): string {
  return n.toLocaleString("es-PY");
}

export function MarketingStatsBar({ metrics }: Props) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
      <StatCard
        label="Total Clientes"
        value={fmt(metrics.totalCustomers)}
        sub="CRM unificado"
      />
      <StatCard
        label="Alcanzables Email"
        value={fmt(metrics.reachableEmail)}
        sub={metrics.totalCustomers > 0
          ? `${((metrics.reachableEmail / metrics.totalCustomers) * 100).toFixed(1)}%`
          : "—"}
        variant="neutral"
      />
      <StatCard
        label="Alcanzables WhatsApp"
        value={fmt(metrics.reachableWhatsapp)}
        sub={metrics.totalCustomers > 0
          ? `${((metrics.reachableWhatsapp / metrics.totalCustomers) * 100).toFixed(1)}%`
          : "—"}
        variant="neutral"
      />
      <StatCard
        label="Triggers Activos"
        value={String(metrics.activeTriggers)}
        variant="neutral"
      />
      <StatCard
        label="Mensajes Enviados"
        value={fmt(metrics.totalExecutions)}
        variant="neutral"
      />
      <StatCard
        label="Tasa Apertura"
        value={`${metrics.openRate.toFixed(1)}%`}
        variant={metrics.openRate >= 20 ? "positive" : "neutral"}
      />
    </div>
  );
}
