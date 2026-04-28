/**
 * features/calendar/hooks/useEventRealtime.ts
 *
 * Suscribe a cambios en las 3 tablas del evento (event_skus, event_stores,
 * allocation_proposals) filtrando por `event_id` y dispara invalidate sobre
 * las queries del dashboard.
 *
 * Resultado: si otro usuario (o vos en otra pestaña) agrega/quita un SKU,
 * agrega una tienda, genera o aprueba una propuesta, el dashboard del evento
 * se actualiza solo sin reload.
 */
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { authClient } from "@/api/client";
import { eventKeys } from "@/queries/keys";

const TABLES = [
  { table: "calendar_event_skus", key: "skus" },
  { table: "calendar_event_stores", key: "stores" },
  { table: "allocation_proposals", key: "proposals" },
] as const;

type EventQueryKey = (typeof TABLES)[number]["key"];

const KEY_FOR: Record<EventQueryKey, (eventId: string) => readonly unknown[]> = {
  skus: eventKeys.skus,
  stores: eventKeys.stores,
  proposals: eventKeys.proposals,
};

export function useEventRealtime(eventId: string | null | undefined): void {
  const qc = useQueryClient();

  useEffect(() => {
    if (!eventId) return;

    const channel = authClient.channel(`event_rt_${eventId}`);

    for (const { table, key } of TABLES) {
      channel.on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        "postgres_changes" as any,
        {
          event: "*",
          schema: "public",
          table,
          filter: `event_id=eq.${eventId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: KEY_FOR[key](eventId) });
        },
      );
    }

    channel.subscribe();

    return () => {
      authClient.removeChannel(channel);
    };
  }, [eventId, qc]);
}
