/**
 * features/calendar/EventDashboardPage.tsx
 *
 * Dashboard accionable de un evento del calendario.
 *
 * Ruta: /calendario/evento/:eventId
 */
import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { authClient } from "@/api/client";
import { useAuth } from "@/hooks/useAuth";
import { useStoreConfig } from "@/hooks/useConfig";
import { useEventDashboard } from "./hooks/useEventDashboard";
import { useEventSkus } from "./hooks/useEventSkus";
import { useEventStores } from "./hooks/useEventStores";
import { useAllocationProposals } from "./hooks/useAllocationProposals";
import { useSkuConflicts } from "./hooks/useSkuConflicts";
import { useEventRealtime } from "./hooks/useEventRealtime";
import { EventScorecard } from "./components/EventScorecard";
import { EventSkuPicker } from "./components/EventSkuPicker";
import { EventStorePicker } from "./components/EventStorePicker";
import { StockHealthWidget } from "./components/widgets/StockHealthWidget";
import { ArrivalsWidget } from "./components/widgets/ArrivalsWidget";
import { CurveCompletenessWidget } from "./components/widgets/CurveCompletenessWidget";
import { AllocationProposalCard } from "./components/widgets/AllocationProposalCard";
import { EventHistoryWidget } from "./components/widgets/EventHistoryWidget";
import { PageSkeleton } from "@/components/ui/skeleton/Skeleton";

interface CalendarEventRow {
  id: string;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string | null;
  category: string;
  budget: number | null;
  currency: "PYG" | "USD";
}

function useCalendarEvent(id: string | undefined) {
  return useQuery({
    queryKey: ["calendar", "event", id ?? "none"] as const,
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await authClient
        .from("calendar_events")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data as CalendarEventRow | null;
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
}

export default function EventDashboardPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const eventQ = useCalendarEvent(eventId);
  const event = eventQ.data;
  const storeConfig = useStoreConfig();

  const dashboard = useEventDashboard({
    eventId,
    startDate: event?.start_date ?? null,
  });

  const skusH = useEventSkus(eventId);
  const storesH = useEventStores(eventId);
  const proposalsH = useAllocationProposals(eventId);

  // Realtime: invalida queries cuando cambian las 3 tablas filtradas por event_id
  useEventRealtime(eventId);

  const [showSkuPicker, setShowSkuPicker] = useState(false);
  const [showStorePicker, setShowStorePicker] = useState(false);

  const linkedSkuCodes = useMemo(
    () => skusH.skus.map((s) => s.skuComercial),
    [skusH.skus],
  );
  const conflicts = useSkuConflicts(eventId, linkedSkuCodes);
  const linkedStoreCodes = useMemo(
    () => storesH.stores.map((s) => s.storeCode),
    [storesH.stores],
  );

  const canGenerate = useMemo(() => {
    const activation = storesH.stores.filter((s) => s.role !== "warehouse");
    return skusH.skus.length > 0 && activation.length > 0;
  }, [skusH.skus, storesH.stores]);

  async function handleGenerate() {
    if (!eventId) return;
    await proposalsH.generate({
      eventSkus: skusH.skus,
      eventStores: storesH.stores,
      inventory: dashboard.inventoryFull,
      generatedBy: user?.id ?? null,
      readinessPct: dashboard.readiness?.readinessPct ?? null,
      storeConfig,
    });
  }

  async function handleApprove(id: string) {
    if (!user?.id) return;
    const proposal = proposalsH.proposals.find((p) => p.id === id);
    if (!proposal) return;
    await proposalsH.approve({
      proposal,
      approvedBy: user.id,
      inventorySnapshot: dashboard.inventoryFull,
      readinessPctAtApproval: dashboard.readiness?.readinessPct ?? null,
    });
  }

  if (eventQ.isLoading || dashboard.isLoading) return <PageSkeleton />;

  if (eventQ.error || !event) {
    return (
      <div className="p-6">
        <div className="rounded-2xl border border-error-200 bg-error-50 px-6 py-4 text-sm text-error-700 dark:border-error-500/20 dark:bg-error-500/10 dark:text-error-400">
          Evento no encontrado.
        </div>
        <button
          type="button"
          onClick={() => navigate("/calendario")}
          className="mt-3 text-sm text-brand-600 hover:underline"
        >
          ← Volver al calendario
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5 p-4 sm:p-6">
      {/* ── Breadcrumb ── */}
      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
        <button
          type="button"
          onClick={() => navigate("/calendario")}
          className="hover:text-brand-600 hover:underline"
        >
          Calendario
        </button>
        <span>/</span>
        <span className="text-gray-700 dark:text-gray-300">Evento</span>
      </div>

      {/* ── Scorecard ── */}
      <EventScorecard
        title={event.title}
        startDate={event.start_date}
        readiness={dashboard.readiness}
      />

      {/* ── Linked SKUs + Stores ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <LinkedSkusCard
          skus={skusH.skus}
          conflicts={conflicts.conflicts}
          conflictedSkuSet={conflicts.conflictedSkuSet}
          onAdd={() => setShowSkuPicker(true)}
          onRemove={(id) => skusH.removeSku(id)}
          isMutating={skusH.isMutating}
        />
        <LinkedStoresCard
          stores={storesH.stores}
          onAdd={() => setShowStorePicker(true)}
          onRemove={(id) => storesH.removeStore(id)}
          isMutating={storesH.isMutating}
        />
      </div>

      {/* ── Widgets grid ── */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <StockHealthWidget
          skus={skusH.skus}
          stores={storesH.stores}
          inventory={dashboard.inventory}
        />
        <ArrivalsWidget arrivals={dashboard.arrivalsForBrand} />
        <CurveCompletenessWidget
          coverages={dashboard.coverages}
          coverageBySku={dashboard.coverageBySku}
        />
        <AllocationProposalCard
          proposals={proposalsH.proposals}
          isGenerating={proposalsH.isGenerating}
          isApproving={proposalsH.isApproving}
          canGenerate={canGenerate}
          onGenerate={handleGenerate}
          onApprove={handleApprove}
          onReject={(id) => proposalsH.reject(id)}
        />
      </div>

      {/* ── Decision history (closed-loop log) ── */}
      <EventHistoryWidget eventId={eventId} />

      {/* ── Pickers ── */}
      {showSkuPicker && eventId && (
        <EventSkuPicker
          eventId={eventId}
          alreadyLinked={linkedSkuCodes}
          onClose={() => setShowSkuPicker(false)}
        />
      )}
      {showStorePicker && eventId && (
        <EventStorePicker
          eventId={eventId}
          alreadyLinked={linkedStoreCodes}
          onClose={() => setShowStorePicker(false)}
        />
      )}
    </div>
  );
}

// ─── Linked SKUs Card ────────────────────────────────────────────────────────

function LinkedSkusCard({
  skus,
  conflicts,
  conflictedSkuSet,
  onAdd,
  onRemove,
  isMutating,
}: {
  skus: ReturnType<typeof useEventSkus>["skus"];
  conflicts: ReturnType<typeof useSkuConflicts>["conflicts"];
  conflictedSkuSet: ReturnType<typeof useSkuConflicts>["conflictedSkuSet"];
  onAdd: () => void;
  onRemove: (id: string) => void;
  isMutating: boolean;
}) {
  const conflictBySku = useMemo(
    () => new Map(conflicts.map((c) => [c.skuComercial, c])),
    [conflicts],
  );

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-gray-800">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          SKUs vinculados ({skus.length})
        </h3>
        <button
          type="button"
          onClick={onAdd}
          className="rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-600"
        >
          + Agregar SKUs
        </button>
      </div>
      {conflictedSkuSet.size > 0 && (
        <div className="border-b border-warning-200 bg-warning-50 px-4 py-2 text-xs text-warning-800 dark:border-warning-500/20 dark:bg-warning-500/10 dark:text-warning-300">
          ⚠ {conflictedSkuSet.size} SKU{conflictedSkuSet.size === 1 ? "" : "s"} también vinculado{conflictedSkuSet.size === 1 ? "" : "s"} a otro evento activo. Riesgo de doble allocation.
        </div>
      )}
      {skus.length === 0 ? (
        <div className="px-4 py-6 text-center text-sm text-gray-400">
          Sin SKUs vinculados.
        </div>
      ) : (
        <ul className="max-h-72 divide-y divide-gray-100 overflow-y-auto dark:divide-gray-700">
          {skus.map((s) => {
            const conflict = conflictBySku.get(s.skuComercial);
            return (
              <li key={s.id} className="flex flex-wrap items-center gap-2 px-4 py-2 text-sm">
                <span className="font-mono text-xs text-gray-700 dark:text-gray-300">
                  {s.skuComercial}
                </span>
                <span className="text-xs text-gray-500">{s.brand}</span>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] uppercase text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                  {s.intent}
                </span>
                {conflict && (
                  <span
                    className="rounded-full bg-warning-100 px-2 py-0.5 text-[10px] font-medium text-warning-700 dark:bg-warning-500/20 dark:text-warning-300"
                    title={conflict.conflictingEvents.map((e) => `${e.title} (${e.startDate})`).join("\n")}
                  >
                    En {conflict.conflictingEvents.length} evento{conflict.conflictingEvents.length === 1 ? "" : "s"}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => onRemove(s.id)}
                  disabled={isMutating}
                  className="ml-auto text-xs text-error-600 hover:underline disabled:opacity-50"
                  aria-label={`Quitar ${s.skuComercial}`}
                >
                  Quitar
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ─── Linked Stores Card ──────────────────────────────────────────────────────

function LinkedStoresCard({
  stores,
  onAdd,
  onRemove,
  isMutating,
}: {
  stores: ReturnType<typeof useEventStores>["stores"];
  onAdd: () => void;
  onRemove: (id: string) => void;
  isMutating: boolean;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-gray-800">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          Tiendas ({stores.length})
        </h3>
        <button
          type="button"
          onClick={onAdd}
          className="rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-600"
        >
          + Agregar tiendas
        </button>
      </div>
      {stores.length === 0 ? (
        <div className="px-4 py-6 text-center text-sm text-gray-400">
          Sin tiendas declaradas.
        </div>
      ) : (
        <div className="flex flex-wrap gap-2 p-4">
          {stores.map((s) => (
            <span
              key={s.id}
              className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs dark:border-gray-700 dark:bg-gray-800"
            >
              <span className="font-mono text-gray-700 dark:text-gray-300">{s.storeCode}</span>
              <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] uppercase text-gray-500 dark:bg-gray-900 dark:text-gray-400">
                {s.role}
              </span>
              <button
                type="button"
                onClick={() => onRemove(s.id)}
                disabled={isMutating}
                className="text-error-600 hover:underline disabled:opacity-50"
                aria-label={`Quitar ${s.storeCode}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
