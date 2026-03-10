/**
 * features/calendar/CalendarPage.tsx
 *
 * Calendario de Eventos — replica exacta de FenixBrands.
 * Vistas: Mes, Semana, Dia, Ano (custom grid 12 meses).
 * Categorias dinamicas con colores editables.
 * CRUD de eventos con Supabase Realtime.
 *
 * Datos via useCalendar() hook — este componente es solo UI.
 */
import { useState, useRef, useEffect, useCallback } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import type {
  DateSelectArg,
  EventClickArg,
  EventDropArg,
} from "@fullcalendar/core";
import { Modal } from "@/components/ui/modal";
import { useModal } from "@/hooks/useModal";
import { useCalendar, type CalendarEvent, type DbCategory } from "./hooks/useCalendar";
import { useSidebar } from "@/context/SidebarContext";

// ── Year View helpers ────────────────────────────────────────────────────────

const MONTHS_ES = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
];
const DOW_ES = ["L","M","M","J","V","S","D"];

const COLOR_PALETTE = [
  "#465fff", "#12b76a", "#f04438", "#fb6514", "#eab308",
  "#a855f7", "#8b5cf6", "#06b6d4", "#14b8a6", "#ec4899",
  "#f59e0b", "#667085", "#b45309",
];

function eventsForDay(dateStr: string, events: CalendarEvent[]): CalendarEvent[] {
  return events.filter((ev) => {
    const start = ev.start as string;
    const end = ev.end as string | undefined;
    if (!end) return start === dateStr;
    return start <= dateStr && dateStr < end;
  });
}

function pad2(n: number) { return String(n).padStart(2, "0"); }

interface MiniMonthProps {
  year: number;
  month: number;
  events: CalendarEvent[];
  categories: Record<string, DbCategory>;
  today: string;
  onDayClick: (date: string) => void;
}

function MiniMonth({ year, month, events, categories, today, onDayClick }: MiniMonthProps) {
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <p className="mb-3 text-sm font-semibold text-gray-800 dark:text-white/90">
        {MONTHS_ES[month]}
      </p>
      <div className="grid grid-cols-7">
        {DOW_ES.map((d, i) => (
          <div key={i} className="pb-1.5 text-center text-[10px] font-medium uppercase text-gray-400 dark:text-gray-500">
            {d}
          </div>
        ))}
        {cells.map((day, i) => {
          if (!day) return <div key={i} />;
          const dateStr = `${year}-${pad2(month + 1)}-${pad2(day)}`;
          const isToday = dateStr === today;
          const dayEvs = eventsForDay(dateStr, events);
          const hasEvents = dayEvs.length > 0;

          return (
            <div
              key={i}
              role={hasEvents ? "button" : undefined}
              tabIndex={hasEvents ? 0 : undefined}
              onClick={() => hasEvents && onDayClick(dateStr)}
              onKeyDown={(e) => { if (hasEvents && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onDayClick(dateStr); } }}
              className={`flex flex-col items-center py-0.5 ${hasEvents ? "cursor-pointer" : ""}`}
            >
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs transition-colors
                  ${isToday
                    ? "bg-brand-500 font-semibold text-white"
                    : hasEvents
                    ? "font-medium text-gray-800 hover:bg-gray-100 dark:text-white/90 dark:hover:bg-white/5"
                    : "text-gray-500 dark:text-gray-400"
                  }`}
              >
                {day}
              </span>
              {hasEvents && (
                <div className="mt-0.5 flex items-center gap-px">
                  {dayEvs.slice(0, 3).map((ev, j) => {
                    const color = categories[ev.extendedProps?.calendar]?.color ?? "#465fff";
                    return (
                      <span
                        key={ev.id ?? j}
                        className="block h-1 w-1 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                    );
                  })}
                  {dayEvs.length > 3 && (
                    <span className="text-[8px] leading-none text-gray-400">+</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Calendar component ──────────────────────────────────────────────────

export default function CalendarPage() {
  const {
    events, categories, saving, error, clearError,
    addEvent, updateEvent, deleteEvent, moveEvent,
    updateCategoryColor, addCategory,
  } = useCalendar();

  // Year view
  const [yearViewActive, setYearViewActive] = useState(false);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const today = new Date().toISOString().split("T")[0];

  // Event modal
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [eventTitle, setEventTitle] = useState("");
  const [eventStartDate, setEventStartDate] = useState("");
  const [eventEndDate, setEventEndDate] = useState("");
  const [eventCategory, setEventCategory] = useState("");

  // New category form
  const [showNewCat, setShowNewCat] = useState(false);
  const [newCatLabel, setNewCatLabel] = useState("");
  const [newCatColor, setNewCatColor] = useState("#465fff");

  // Day view date picker
  const [currentFCView, setCurrentFCView] = useState("dayGridMonth");
  const [currentFCDate, setCurrentFCDate] = useState(today);

  const calendarRef = useRef<FullCalendar>(null);
  const { isOpen, openModal, closeModal } = useModal();
  const { isExpanded, isHovered } = useSidebar();

  // ── Recalculate FC size after sidebar expand/collapse transition ────────
  useEffect(() => {
    const timer = setTimeout(() => {
      calendarRef.current?.getApi().updateSize();
    }, 320); // sidebar transition is 300ms
    return () => clearTimeout(timer);
  }, [isExpanded, isHovered]);

  // ── Day view date picker ─────────────────────────────────────────────────

  const handleDatesSet = useCallback((info: { view: { type: string }; startStr: string }) => {
    setCurrentFCView(info.view.type);
    setCurrentFCDate(info.startStr.split("T")[0]);
  }, []);

  useEffect(() => {
    if (yearViewActive) return;

    const timer = setTimeout(() => {
      const existing = document.getElementById("fc-day-date-input") as HTMLInputElement | null;

      if (currentFCView !== "timeGridDay") {
        if (existing) existing.remove();
        return;
      }

      if (existing) {
        existing.value = currentFCDate;
        return;
      }

      const rightChunk = document.querySelector(".fc-toolbar-chunk:last-child") as HTMLElement | null;
      if (!rightChunk) return;

      const input = document.createElement("input") as HTMLInputElement;
      input.id = "fc-day-date-input";
      input.type = "date";
      input.value = currentFCDate;

      input.addEventListener("change", () => {
        if (input.value && calendarRef.current) {
          calendarRef.current.getApi().gotoDate(input.value);
        }
      });

      rightChunk.insertBefore(input, rightChunk.firstChild);
    }, 50);

    return () => clearTimeout(timer);
  }, [currentFCView, currentFCDate, yearViewActive]);

  // ── Year view nav ──────────────────────────────────────────────────────────

  const enterYearView = () => {
    const api = calendarRef.current?.getApi();
    if (api) setCurrentYear(api.getDate().getFullYear());
    setYearViewActive(true);
  };

  const switchToFCView = (view: string, date?: string) => {
    setYearViewActive(false);
    requestAnimationFrame(() => {
      const api = calendarRef.current?.getApi();
      if (!api) return;
      if (date) api.gotoDate(date);
      api.changeView(view);
    });
  };

  // ── Event handlers ─────────────────────────────────────────────────────────

  const resetModalFields = () => {
    setEventTitle(""); setEventStartDate(""); setEventEndDate("");
    setEventCategory(""); setSelectedEvent(null);
    setShowNewCat(false); setNewCatLabel(""); setNewCatColor("#465fff");
  };

  const handleDateSelect = (selectInfo: DateSelectArg) => {
    resetModalFields();
    setEventStartDate(selectInfo.startStr);
    setEventEndDate(selectInfo.endStr || selectInfo.startStr);
    openModal();
  };

  const handleEventClick = (clickInfo: EventClickArg) => {
    const ev = clickInfo.event;
    setSelectedEvent(ev as unknown as CalendarEvent);
    setEventTitle(ev.title);
    setEventStartDate(ev.start?.toISOString().split("T")[0] || "");
    setEventEndDate(ev.end?.toISOString().split("T")[0] || "");
    setEventCategory(ev.extendedProps.calendar);
    openModal();
  };

  const handleEventDrop = async (dropInfo: EventDropArg) => {
    const { event } = dropInfo;
    const start = event.start?.toISOString().split("T")[0] ?? "";
    const end = event.end?.toISOString().split("T")[0] ?? null;
    await moveEvent(event.id, start, end);
  };

  const handleEventResize = async (resizeInfo: { event: EventDropArg["event"] }) => {
    const { event } = resizeInfo;
    const start = event.start?.toISOString().split("T")[0] ?? "";
    const end = event.end?.toISOString().split("T")[0] ?? null;
    await moveEvent(event.id, start, end);
  };

  const handleAddOrUpdateEvent = async () => {
    if (!eventTitle.trim() || !eventCategory) return;
    const input = {
      title: eventTitle, startDate: eventStartDate,
      endDate: eventEndDate, category: eventCategory,
    };
    if (selectedEvent) {
      await updateEvent(selectedEvent.id!, input);
    } else {
      await addEvent(input);
    }
    closeModal(); resetModalFields();
  };

  const handleDeleteEvent = async () => {
    if (!selectedEvent) return;
    await deleteEvent(selectedEvent.id!);
    closeModal(); resetModalFields();
  };

  // ── Category handlers ──────────────────────────────────────────────────────

  const handleCategoryColorChange = async (id: string, color: string) => {
    await updateCategoryColor(id, color);
  };

  const handleAddCategory = async () => {
    const label = newCatLabel.trim();
    if (!label) return;
    const id = await addCategory(label, newCatColor);
    setEventCategory(id);
    setShowNewCat(false); setNewCatLabel(""); setNewCatColor("#465fff");
  };

  // ── Event rendering ────────────────────────────────────────────────────────

  const renderEventContent = useCallback((eventInfo: {
    timeText: string;
    event: { title: string; extendedProps: { calendar: string } };
  }) => {
    const color = categories[eventInfo.event.extendedProps.calendar]?.color ?? "#465fff";
    return (
      <div className="event-fc-color flex fc-event-main" style={{ backgroundColor: color + "1F" }}>
        <div className="fc-daygrid-event-dot" style={{ backgroundColor: color, border: "none" }} />
        <div className="fc-event-time">{eventInfo.timeText}</div>
        <div className="fc-event-title">{eventInfo.event.title}</div>
      </div>
    );
  }, [categories]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-w-0 overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">

      {/* Error banner */}
      {error && (
        <div className="flex items-center justify-between border-b border-error-200 bg-error-50 px-6 py-3 dark:border-error-500/20 dark:bg-error-500/10">
          <p className="text-sm text-error-700 dark:text-error-400">{error}</p>
          <button
            onClick={clearError}
            className="text-xs font-medium text-error-600 hover:text-error-800 dark:text-error-400 dark:hover:text-error-300"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* ── Year view ──────────────────────────────────────────────────────── */}
      {yearViewActive && (
        <div>
          {/* Toolbar */}
          <div className="grid grid-cols-3 items-center border-b border-gray-200 px-6 pb-4 pt-6 dark:border-gray-800">
            {/* Left */}
            <div className="flex items-center gap-3">
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentYear((y) => y - 1)}
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 bg-transparent hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-900"
                >
                  <svg width="25" height="24" viewBox="0 0 25 24" fill="none" className="text-gray-600 dark:text-gray-400">
                    <path d="M16.0068 6L9.75684 12.25L16.0068 18.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                <button
                  onClick={() => setCurrentYear((y) => y + 1)}
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 bg-transparent hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-900"
                >
                  <svg width="25" height="24" viewBox="0 0 25 24" fill="none" className="text-gray-600 dark:text-gray-400">
                    <path d="M9.50684 19L15.7568 12.75L9.50684 6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
              <button
                onClick={() => {
                  resetModalFields();
                  setEventStartDate(today); setEventEndDate(today);
                  openModal();
                }}
                className="rounded-lg border-0 bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600"
              >
                Agregar Evento +
              </button>
            </div>

            {/* Center */}
            <div className="flex justify-center">
              <h2 className="text-lg font-medium text-gray-800 dark:text-white/90">{currentYear}</h2>
            </div>

            {/* Right */}
            <div className="flex justify-end">
              <div className="flex rounded-lg bg-gray-100 p-0.5 dark:bg-gray-900">
                <button className="rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-900 shadow-theme-xs dark:bg-gray-800 dark:text-white">
                  Ano
                </button>
                {(["dayGridMonth", "timeGridWeek", "timeGridDay"] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => switchToFCView(v)}
                    className="rounded-md border-0 bg-transparent px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                  >
                    {v === "dayGridMonth" ? "Mes" : v === "timeGridWeek" ? "Semana" : "Dia"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 12-month grid */}
          <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 12 }, (_, m) => (
              <MiniMonth
                key={m}
                year={currentYear}
                month={m}
                events={events}
                categories={categories}
                today={today}
                onDayClick={(date) => switchToFCView("timeGridDay", date)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── FullCalendar (hidden when year view active) ──────────────────── */}
      <div className={yearViewActive ? "hidden" : "custom-calendar"}>
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          locale="es"
          headerToolbar={{
            left: "prev,next addEventButton",
            center: "title",
            right: "yearViewButton,dayGridMonth,timeGridWeek,timeGridDay",
          }}
          buttonText={{ today: "Hoy", month: "Mes", week: "Semana", day: "Dia" }}
          events={events}
          selectable={true}
          editable={true}
          droppable={true}
          eventDurationEditable={true}
          dayMaxEvents={false}
          height="auto"
          contentHeight="auto"
          datesSet={handleDatesSet}
          select={handleDateSelect}
          eventClick={handleEventClick}
          eventDrop={handleEventDrop}
          eventResize={handleEventResize}
          eventContent={renderEventContent}
          customButtons={{
            addEventButton: {
              text: "Agregar Evento +",
              click: () => {
                resetModalFields();
                const t = new Date().toISOString().split("T")[0];
                setEventStartDate(t); setEventEndDate(t);
                openModal();
              },
            },
            yearViewButton: {
              text: "Ano",
              click: enterYearView,
            },
          }}
        />
      </div>

      {/* ── Event Modal ─────────────────────────────────────────────────── */}
      <Modal isOpen={isOpen} onClose={closeModal} className="max-w-[700px] p-6 lg:p-10">
        <div className="flex flex-col overflow-y-auto px-2">
          <div>
            <h5 className="mb-2 text-xl font-semibold text-gray-800 dark:text-white/90 lg:text-2xl">
              {selectedEvent ? "Editar Evento" : "Nuevo Evento"}
            </h5>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Programa hitos del negocio: llegadas de producto, lanzamientos, acciones comerciales y campanas de marketing.
            </p>
          </div>

          <div className="mt-8">
            {/* Title */}
            <div>
              <label htmlFor="cal-event-title" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">
                Titulo del Evento
              </label>
              <input
                id="cal-event-title"
                type="text"
                value={eventTitle}
                onChange={(e) => setEventTitle(e.target.value)}
                placeholder="Ej: Llegada coleccion invierno"
                className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800"
              />
            </div>

            {/* Category */}
            <div className="mt-6">
              <span id="cal-category-label" className="mb-4 block text-sm font-medium text-gray-700 dark:text-gray-400">
                Categoria
              </span>
              <div role="radiogroup" aria-labelledby="cal-category-label" className="flex flex-wrap items-center gap-4 sm:gap-5">
                {Object.values(categories).map((cat) => (
                  <label
                    key={cat.id}
                    className="group relative flex cursor-pointer select-none items-center gap-2 text-sm text-gray-700 dark:text-gray-400"
                  >
                    <span className="relative">
                      <input
                        className="sr-only"
                        type="radio"
                        name="event-category"
                        value={cat.id}
                        checked={eventCategory === cat.id}
                        onChange={() => setEventCategory(cat.id)}
                      />
                      <span
                        className="flex h-5 w-5 items-center justify-center rounded-full border-2 transition-all duration-150"
                        style={{
                          borderColor: eventCategory === cat.id ? cat.color : "#d0d5dd",
                          backgroundColor: eventCategory === cat.id ? cat.color : "transparent",
                        }}
                      >
                        <span className={`h-2 w-2 rounded-full bg-white ${eventCategory === cat.id ? "block" : "hidden"}`} />
                      </span>
                    </span>
                    <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: cat.color }} />
                    {cat.label}
                    {/* Color picker on hover */}
                    <span className="absolute -right-1 -top-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <span className="flex h-4 w-4 items-center justify-center rounded-full border border-white shadow-theme-xs" style={{ backgroundColor: cat.color }}>
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
                        </svg>
                      </span>
                      <input type="color" value={cat.color} onChange={(e) => handleCategoryColorChange(cat.id, e.target.value)} className="sr-only" />
                    </span>
                  </label>
                ))}
              </div>

              {showNewCat ? (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={newCatLabel}
                    onChange={(e) => setNewCatLabel(e.target.value)}
                    placeholder="Nombre de categoria"
                    className="h-9 min-w-[160px] flex-1 rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-800 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                  />
                  <div className="flex flex-wrap items-center gap-1.5">
                    {COLOR_PALETTE.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setNewCatColor(c)}
                        className="h-6 w-6 rounded-full border-2 transition-transform hover:scale-110"
                        style={{ backgroundColor: c, borderColor: newCatColor === c ? "#344054" : "transparent" }}
                      />
                    ))}
                    <label className="cursor-pointer" title="Color personalizado">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-dashed border-gray-300 text-xs text-gray-400 hover:border-gray-500 dark:border-gray-600 dark:text-gray-500 dark:hover:border-gray-400">+</span>
                      <input type="color" value={newCatColor} onChange={(e) => setNewCatColor(e.target.value)} className="sr-only" />
                    </label>
                  </div>
                  <span className="inline-block h-4 w-4 shrink-0 rounded-full border border-gray-200" style={{ backgroundColor: newCatColor }} />
                  <button onClick={handleAddCategory} disabled={!newCatLabel.trim()} type="button" className="h-9 rounded-lg bg-brand-500 px-4 text-sm font-medium text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50">
                    Agregar
                  </button>
                  <button onClick={() => { setShowNewCat(false); setNewCatLabel(""); }} type="button" className="h-9 px-3 text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400">
                    Cancelar
                  </button>
                </div>
              ) : (
                <button onClick={() => setShowNewCat(true)} type="button" className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-brand-500 transition-colors hover:text-brand-600">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
                  Nueva categoria
                </button>
              )}
            </div>

            {/* Start date */}
            <div className="mt-6">
              <label htmlFor="cal-start-date" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">Fecha de Inicio</label>
              <input id="cal-start-date" type="date" value={eventStartDate} onChange={(e) => setEventStartDate(e.target.value)}
                className="h-11 w-full appearance-none rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-800"
              />
            </div>

            {/* End date */}
            <div className="mt-6">
              <label htmlFor="cal-end-date" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">Fecha de Fin</label>
              <input id="cal-end-date" type="date" value={eventEndDate} onChange={(e) => setEventEndDate(e.target.value)}
                className="h-11 w-full appearance-none rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-800"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="mt-6 flex items-center gap-3 sm:justify-end">
            {selectedEvent && (
              <button onClick={handleDeleteEvent} type="button" disabled={saving} className="flex w-full justify-center rounded-lg border border-error-300 bg-white px-4 py-2.5 text-sm font-medium text-error-700 hover:bg-error-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-error-700 dark:bg-gray-800 dark:text-error-400 dark:hover:bg-error-500/10 sm:w-auto">
                {saving ? "Eliminando..." : "Eliminar"}
              </button>
            )}
            <button onClick={closeModal} type="button" className="flex w-full justify-center rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03] sm:w-auto">
              Cancelar
            </button>
            <button onClick={handleAddOrUpdateEvent} type="button" disabled={saving || !eventTitle.trim() || !eventCategory} className="flex w-full justify-center rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto">
              {saving ? "Guardando..." : selectedEvent ? "Guardar Cambios" : "Agregar Evento"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
