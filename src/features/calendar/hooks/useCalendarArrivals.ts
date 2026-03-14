/**
 * features/calendar/hooks/useCalendarArrivals.ts
 *
 * Hook que proyecta datos de logística (ETAs de importación) al calendario.
 * Los items son read-only — no persisten en calendar_events.
 *
 * Reutiliza el mismo query que useLogistics (TanStack Query deduplica).
 * Patrón: fetch → toArrivals → groupArrivals → groupsToCalendarItems.
 */
import { useMemo, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchLogisticsImports } from "@/queries/logistics.queries";
import { logisticsKeys } from "@/queries/keys";
import { toArrivals, groupArrivals } from "@/domain/logistics/arrivals";
import {
  groupsToCalendarItems,
  arrivalsByDay,
  type ArrivalCalendarItem,
  type ArrivalDaySummary,
} from "@/domain/logistics/calendar";
import type { CalendarEvent } from "./useCalendar";

const STALE_15MIN = 15 * 60 * 1000;
const GC_30MIN    = 30 * 60 * 1000;

// ─── FullCalendar event source adapter ───────────────────────────────────────

/**
 * Convierte ArrivalCalendarItem a CalendarEvent compatible con FullCalendar.
 * Se distingue de eventos normales via extendedProps.isArrival = true.
 */
function toFCEvent(item: ArrivalCalendarItem): CalendarEvent & {
  editable: false;
  display: string;
  extendedProps: CalendarEvent["extendedProps"] & {
    isArrival: true;
    arrivalData: ArrivalCalendarItem;
  };
} {
  return {
    id: item.id,
    title: `${item.brand} · ${item.totalUnits.toLocaleString("es-PY")} uds`,
    start: item.date,
    allDay: true,
    editable: false,
    display: "list-item",
    extendedProps: {
      calendar: "__arrivals__",
      description: null,
      budget: item.costUSD,
      currency: "USD",
      isArrival: true,
      arrivalData: item,
    },
  };
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export interface CalendarArrivalsData {
  /** Items de llegada para FullCalendar */
  arrivalEvents: ReturnType<typeof toFCEvent>[];
  /** Items originales (para popovers, tooltips) */
  arrivalItems: ArrivalCalendarItem[];
  /** Resumen por día para year view (Map<dateISO, summary>) */
  arrivalDays: Map<string, ArrivalDaySummary>;
  /** Toggle de visibilidad */
  showArrivals: boolean;
  toggleArrivals: () => void;
  /** Loading state */
  isLoading: boolean;
}

export function useCalendarArrivals(): CalendarArrivalsData {
  const [showArrivals, setShowArrivals] = useState(true);
  const toggleArrivals = useCallback(() => setShowArrivals(p => !p), []);

  const importsQ = useQuery({
    queryKey: logisticsKeys.imports(),
    queryFn: fetchLogisticsImports,
    staleTime: STALE_15MIN,
    gcTime: GC_30MIN,
    retry: 1,
  });

  const arrivalItems = useMemo(() => {
    if (!importsQ.data) return [];
    const arrivals = toArrivals(importsQ.data);
    const groups = groupArrivals(arrivals);
    return groupsToCalendarItems(groups);
  }, [importsQ.data]);

  const arrivalEvents = useMemo(
    () => (showArrivals ? arrivalItems.map(toFCEvent) : []),
    [arrivalItems, showArrivals],
  );

  const arrivalDays = useMemo(
    () => arrivalsByDay(showArrivals ? arrivalItems : []),
    [arrivalItems, showArrivals],
  );

  return {
    arrivalEvents,
    arrivalItems,
    arrivalDays,
    showArrivals,
    toggleArrivals,
    isLoading: importsQ.isLoading,
  };
}
