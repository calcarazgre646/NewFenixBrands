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

export type Currency = "PYG" | "USD";

export interface DbEvent {
  id: string;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string | null;
  category: string;
  budget: number | null;
  currency: Currency;
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
  extendedProps: {
    calendar: string;
    description: string | null;
    budget: number | null;
    currency: Currency;
  };
}

function toFC(row: DbEvent): CalendarEvent {
  return {
    id: row.id,
    title: row.title,
    start: row.start_date,
    end: row.end_date ?? undefined,
    extendedProps: {
      calendar: row.category,
      description: row.description ?? null,
      budget: row.budget ?? null,
      currency: row.currency ?? "PYG",
    },
  };
}

export interface EventInput {
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  category: string;
  budget: number | null;
  currency: Currency;
}

// ── Validation ───────────────────────────────────────────────────────────────

/** Valida que la fecha fin no sea anterior a la fecha inicio */
export function validateDateRange(start: string, end: string | null): string | null {
  if (!start) return "La fecha de inicio es requerida";
  if (end && end < start) return "La fecha de fin no puede ser anterior a la de inicio";
  return null;
}

/** Parsea el string de presupuesto del form a número o null */
export function parseBudgetInput(raw: string): { value: number | null; error: string | null } {
  const trimmed = raw.trim();
  if (!trimmed) return { value: null, error: null };

  // Soportar formato PY (5.000.000) y US (5,000.50)
  const cleaned = trimmed.replace(/\./g, "").replace(",", ".");
  const num = Number(cleaned);

  if (isNaN(num)) return { value: null, error: "El presupuesto debe ser un número válido" };
  if (num < 0) return { value: null, error: "El presupuesto no puede ser negativo" };
  if (num > 100_000_000_000) return { value: null, error: "El presupuesto excede el máximo permitido" };

  return { value: num, error: null };
}

/** Valida todos los campos del form de evento */
export function validateEventForm(fields: {
  title: string;
  category: string;
  startDate: string;
  endDate: string;
  budgetRaw: string;
}): string | null {
  if (!fields.title.trim()) return "El título es requerido";
  if (!fields.category) return "Seleccioná una categoría";

  const dateErr = validateDateRange(fields.startDate, fields.endDate || null);
  if (dateErr) return dateErr;

  const budget = parseBudgetInput(fields.budgetRaw);
  if (budget.error) return budget.error;
  if (budget.value === null) return "El presupuesto es requerido";

  return null;
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

  const addEvent = useCallback(async (input: EventInput) => {
    const dateErr = validateDateRange(input.startDate, input.endDate || null);
    if (dateErr) { setError(dateErr); return; }

    setSaving(true);
    try {
      const newId = crypto.randomUUID();
      const { error: insErr } = await authClient.from("calendar_events").insert({
        id: newId, title: input.title, description: input.description || null,
        start_date: input.startDate, end_date: input.endDate || null,
        category: input.category, budget: input.budget ?? null, currency: input.currency ?? "PYG",
      });
      if (insErr) { setError("Error al crear evento"); return; }
      setEvents((prev) => [...prev, {
        id: newId, title: input.title, start: input.startDate,
        end: input.endDate || undefined, allDay: true,
        extendedProps: {
          calendar: input.category, description: input.description || null,
          budget: input.budget ?? null, currency: input.currency ?? "PYG",
        },
      }]);
    } finally { setSaving(false); }
  }, []);

  const updateEvent = useCallback(async (id: string, input: EventInput) => {
    const dateErr = validateDateRange(input.startDate, input.endDate || null);
    if (dateErr) { setError(dateErr); return; }

    // Verificar que el evento aún existe (otro usuario pudo haberlo eliminado)
    const exists = events.some((ev) => ev.id === id);
    if (!exists) {
      setError("Este evento fue eliminado por otro usuario");
      return;
    }

    setSaving(true);
    const prevEvents = events;
    // Optimistic update
    setEvents((prev) => prev.map((ev) => ev.id === id
      ? { ...ev, title: input.title, start: input.startDate, end: input.endDate || undefined,
          extendedProps: { calendar: input.category, description: input.description || null, budget: input.budget ?? null, currency: input.currency ?? "PYG" } }
      : ev));
    try {
      const { error: updErr } = await authClient.from("calendar_events").update({
        title: input.title, description: input.description || null,
        start_date: input.startDate, end_date: input.endDate || null,
        category: input.category, budget: input.budget ?? null, currency: input.currency ?? "PYG",
      }).eq("id", id);
      if (updErr) {
        setEvents(prevEvents); // Rollback
        setError("Error al actualizar evento");
      }
    } catch {
      setEvents(prevEvents); // Rollback on network error
      setError("Error de conexión al actualizar evento");
    } finally { setSaving(false); }
  }, [events]);

  const deleteEvent = useCallback(async (id: string) => {
    setSaving(true);
    const prevEvents = events;
    // Optimistic delete
    setEvents((prev) => prev.filter((ev) => ev.id !== id));
    try {
      const { error: delErr } = await authClient.from("calendar_events").delete().eq("id", id);
      if (delErr) {
        setEvents(prevEvents); // Rollback
        setError("Error al eliminar evento");
      }
    } catch {
      setEvents(prevEvents); // Rollback on network error
      setError("Error de conexión al eliminar evento");
    } finally { setSaving(false); }
  }, [events]);

  const moveEvent = useCallback(async (id: string, start: string, end: string | null) => {
    const dateErr = validateDateRange(start, end);
    if (dateErr) { setError(dateErr); return; }

    const prevEvents = events;
    // Optimistic move
    setEvents((prev) => prev.map((ev) => ev.id === id ? { ...ev, start, end: end ?? undefined } : ev));
    const { error: moveErr } = await authClient.from("calendar_events").update({ start_date: start, end_date: end }).eq("id", id);
    if (moveErr) {
      setEvents(prevEvents); // Rollback
      setError("Error al mover evento");
    }
  }, [events]);

  // ── CRUD Categories ──────────────────────────────────────────────────────

  const updateCategoryColor = useCallback(async (id: string, color: string) => {
    let prevColor: string | undefined;
    setCategories((p) => {
      prevColor = p[id]?.color;
      return { ...p, [id]: { ...p[id], color } };
    });
    const { error: colorErr } = await authClient.from("calendar_categories").update({ color }).eq("id", id);
    if (colorErr) {
      setCategories((p) => prevColor ? { ...p, [id]: { ...p[id], color: prevColor } } : p);
      setError("Error al actualizar color");
    }
  }, []);

  const addCategory = useCallback(async (label: string, color: string): Promise<string> => {
    const id = label.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");

    if (!id) { setError("El nombre de categoría debe contener al menos una letra o número"); return ""; }

    // Verificar si ya existe (otro usuario pudo haberla creado)
    if (categories[id]) {
      return id; // Ya existe, usarla sin error
    }

    const newCat: DbCategory = { id, label, color };
    const { error: addErr } = await authClient.from("calendar_categories").insert(newCat);
    if (addErr) {
      // Si es un conflict (duplicate key), la categoría ya existe en DB
      if (addErr.code === "23505") {
        setCategories((prev) => ({ ...prev, [id]: newCat }));
        return id;
      }
      setError("Error al crear categoría");
      return id;
    }
    setCategories((prev) => ({ ...prev, [id]: newCat }));
    return id;
  }, [categories]);

  /** Verifica si una categoría tiene eventos antes de permitir eliminarla */
  const categoryHasEvents = useCallback((categoryId: string): boolean => {
    return events.some((ev) => ev.extendedProps?.calendar === categoryId);
  }, [events]);

  const clearError = useCallback(() => setError(null), []);

  return {
    events, categories, saving, error, clearError,
    addEvent, updateEvent, deleteEvent, moveEvent,
    updateCategoryColor, addCategory, categoryHasEvents,
    validateDateRange,
  };
}
