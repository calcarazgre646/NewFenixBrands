/**
 * features/salesPulse/SalesPulseAdminPage.tsx
 *
 * Admin del Sales Pulse Semanal — solo super_user.
 *   - Subscribers: agregar / activar / quitar
 *   - Historial: últimos 12 envíos
 *   - Pruebas: dry-run + envío manual
 */
import { PageHeader } from "@/components/ui/page-header/PageHeader";
import { useSalesPulseAdmin } from "./hooks/useSalesPulseAdmin";
import { SubscribersSection } from "./components/SubscribersSection";
import { RunsSection } from "./components/RunsSection";
import { TestSendSection } from "./components/TestSendSection";

export default function SalesPulseAdminPage() {
  const admin = useSalesPulseAdmin();

  return (
    <div className="space-y-5">
      <PageHeader
        title="Sales Pulse Semanal"
        description="Pulso de ventas que Dash IA envía cada lunes 8:30 AM PYT desde dash@fenixbrands.com.py."
      />

      <SubscribersSection
        subscribers={admin.subscribers}
        isLoading={admin.isLoadingSubscribers}
        error={admin.subscribersError}
        onAdd={admin.addSubscriber.mutateAsync}
        onToggleActive={(id, active) => admin.toggleActive.mutate({ id, active })}
        onRemove={(id) => admin.removeSubscriber.mutate(id)}
      />

      <TestSendSection
        isPending={admin.triggerSalesPulse.isPending}
        onTrigger={admin.triggerSalesPulse.mutateAsync}
      />

      <RunsSection
        runs={admin.runs}
        isLoading={admin.isLoadingRuns}
        error={admin.runsError}
        onDelete={(id) => admin.deleteRun.mutate(id)}
        isDeleting={admin.deleteRun.isPending}
        total={admin.runsTotal}
        page={admin.runsPage}
        pageSize={admin.runsPageSize}
        totalPages={admin.runsTotalPages}
        onPageChange={admin.setRunsPage}
        isFetching={admin.isFetchingRuns}
      />
    </div>
  );
}
