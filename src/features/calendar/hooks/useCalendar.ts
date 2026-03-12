/**
 * features/calendar/hooks/useCalendar.ts
 *
 * Hook que encapsula toda la capa de datos del calendario:
 * fetch inicial, suscripciones Realtime, y operaciones CRUD.
 *
 * BD: authClient (tablas calendar_events, calendar_categories).
 */
import { useState, useEffect, useCallback } from "react";
import { authClient } from "@/api/client";

// ── Types ────────────────────────────────────────────────────────────────────

export interface DbEvent {
  id: string;
  title: string;
  start_date: string;
  end_date: string | null;
  category: string;
}

export interface DbCategory {
  id: string;
  label: string;
  color: string;
}

export interface CalendarEvent {
  id?: string;
  title: string;
  start: string;
  end?: string;
  allDay?: boolean;
  extendedProps: { calendar: string };
}

function toFC(row: DbEvent): CalendarEvent {
  return {
    id: row.id,
    title: row.title,
    start: row.start_date,
    end: row.end_date ?? undefined,
    extendedProps: { calendar: row.category },
  };
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useCalendar() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [categories, setCategories] = useState<Record<string, DbCategory>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Fetch + Realtime ─────────────────────────────────────────────────────

  useEffect(() => {
    authClient.from("calendar_categories").select("*").then(
      ({ data, error: catErr }) => {
        if (catErr) { setError("Error cargando categorías"); return; }
        if (!data) return;
        const map: Record<string, DbCategory> = {};
        (data as DbCategory[]).forEach((c) => { map[c.id] = c; });
        setCategories(map);
      },
      () => setError("Error de conexión"),
    );

    authClient.from("calendar_events").select("*").then(
      ({ data, error: evErr }) => {
        if (evErr) { setError("Error cargando eventos"); return; }
        setEvents((data as DbEvent[]).map(toFC));
      },
      () => setError("Error de conexión"),
    );

    const evCh = authClient.channel("cal_ev_rt")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "calendar_events" }, (p) => {
        const row = p.new as DbEvent;
        setEvents((prev) => prev.some((e) => e.id === row.id) ? prev : [...prev, toFC(row)]);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "calendar_events" }, (p) => {
        const row = p.new as DbEvent;
        setEvents((prev) => prev.map((e) => e.id === row.id ? toFC(row) : e));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "calendar_events" }, (p) => {
        const row = p.old as { id: string };
        setEvents((prev) => prev.filter((e) => e.id !== row.id));
      })
      .subscribe();

    const catCh = authClient.channel("cal_cat_rt")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "calendar_categories" }, (p) => {
        const row = p.new as DbCategory;
        setCategories((prev) => ({ ...prev, [row.id]: row }));
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "calendar_categories" }, (p) => {
        const row = p.new as DbCategory;
        setCategories((prev) => ({ ...prev, [row.id]: row }));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "calendar_categories" }, (p) => {
        const row = p.old as { id: string };
        setCategories((prev) => { const n = { ...prev }; delete n[row.id]; return n; });
      })
      .subscribe();

    return () => { authClient.removeChannel(evCh); authClient.removeChannel(catCh); };
  }, []);

  // ── CRUD Events ──────────────────────────────────────────────────────────

  const addEvent = useCallback(async (input: {
    title: string; startDate: string; endDate: string; category: string;
  }) => {
    setSaving(true);
    try {
      const newId = crypto.randomUUID();
      const { error: insErr } = await authClient.from("calendar_events").insert({
        id: newId, title: input.title,
        start_date: input.startDate, end_date: input.endDate || null, category: input.category,
      });
      if (insErr) { setError("Error al crear evento"); return; }
      setEvents((prev) => [...prev, {
        id: newId, title: input.title, start: input.startDate,
        end: input.endDate || undefined, allDay: true,
        extendedProps: { calendar: input.category },
      }]);
    } finally { setSaving(false); }
  }, []);

  const updateEvent = useCallback(async (id: string, input: {
    title: string; startDate: string; endDate: string; category: string;
  }) => {
    setSaving(true);
    try {
      const { error: updErr } = await authClient.from("calendar_events").update({
        title: input.title, start_date: input.startDate,
        end_date: input.endDate || null, category: input.category,
      }).eq("id", id);
      if (updErr) { setError("Error al actualizar evento"); return; }
      setEvents((prev) => prev.map((ev) => ev.id === id
        ? { ...ev, title: input.title, start: input.startDate, end: input.endDate || undefined, extendedProps: { calendar: input.category } }
        : ev));
    } finally { setSaving(false); }
  }, []);

  const deleteEvent = useCallback(async (id: string) => {
    setSaving(true);
    try {
      const { error: delErr } = await authClient.from("calendar_events").delete().eq("id", id);
      if (delErr) { setError("Error al eliminar evento"); return; }
      setEvents((prev) => prev.filter((ev) => ev.id !== id));
    } finally { setSaving(false); }
  }, []);

  const moveEvent = useCallback(async (id: string, start: string, end: string | null) => {
    const { error: moveErr } = await authClient.from("calendar_events").update({ start_date: start, end_date: end }).eq("id", id);
    if (moveErr) { setError("Error al mover evento"); return; }
    setEvents((prev) => prev.map((ev) => ev.id === id ? { ...ev, start, end: end ?? undefined } : ev));
  }, []);

  // ── CRUD Categories ──────────────────────────────────────────────────────

  const updateCategoryColor = useCallback(async (id: string, color: string) => {
    const prev = categories;
    setCategories((p) => ({ ...p, [id]: { ...p[id], color } }));
    const { error: colorErr } = await authClient.from("calendar_categories").update({ color }).eq("id", id);
    if (colorErr) { setCategories(prev); setError("Error al actualizar color"); }
  }, [categories]);

  const addCategory = useCallback(async (label: string, color: string): Promise<string> => {
    const id = label.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    const newCat: DbCategory = { id, label, color };
    const { error: addErr } = await authClient.from("calendar_categories").insert(newCat);
    if (addErr) { setError("Error al crear categoría"); return id; }
    setCategories((prev) => ({ ...prev, [id]: newCat }));
    return id;
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return {
    events, categories, saving, error, clearError,
    addEvent, updateEvent, deleteEvent, moveEvent,
    updateCategoryColor, addCategory,
  };
}
