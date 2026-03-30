/**
 * features/calendar/CalendarPage.tsx
 *
 * Calendario de Eventos + Llegadas de Logística.
 * Vistas: Mes, Semana, Día, Año (custom grid 12 meses).
 * Categorias dinamicas con colores editables.
 * CRUD de eventos con Supabase Realtime.
 * Llegadas de importación como indicadores read-only (desde logística).
 *
 * Datos via useCalendar() + useCalendarArrivals() hooks.
 */
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import type {
  DateSelectArg,
  EventClickArg,
  EventDropArg,
} from "@fullcalendar/core";
import type { EventResizeDoneArg } from "@fullcalendar/interaction";
import { useModal } from "@/hooks/useModal";
import { useCalendar, type CalendarEvent, type DbCategory } from "./hooks/useCalendar";
import { useCalendarArrivals } from "./hooks/useCalendarArrivals";
import { EventFormModal } from "./components/EventFormModal";
import { ArrivalDetailPopover } from "./components/ArrivalDetailPopover";
import { getBrandColor, getStatusColor } from "@/domain/logistics/calendar";
import type { ArrivalCalendarItem } from "@/domain/logistics/calendar";
import { useSidebar } from "@/context/SidebarContext";

// ── Ship icon (inline SVG, matches src/icons/ship.svg) ──────────────────────

function ShipIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1.875 13.75L3.125 15.625C3.125 15.625 5 16.875 10 16.875C15 16.875 16.875 15.625 16.875 15.625L18.125 13.75" />
      <path d="M3.75 13.75L5 8.125H15L16.25 13.75" />
      <path d="M10 3.125V8.125" />
      <path d="M10 5.625L14.375 8.125" />
      <path d="M10 5.625L5.625 8.125" />
    </svg>
  );
}

// ── Year View helpers ────────────────────────────────────────────────────────

const MONTHS_ES = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
];
const DOW_ES = ["L","M","M","J","V","S","D"];

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
  arrivalDays: Map<string, { totalUnits: number; brands: string[]; hasOverdue: boolean }>;
  today: string;
  onDayClick: (date: string) => void;
}

function MiniMonth({ year, month, events, categories, arrivalDays, today, onDayClick }: MiniMonthProps) {
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const [hoverDate, setHoverDate] = useState<string | null>(null);
  const hoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  function handleMouseEnter(dateStr: string) {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
    setHoverDate(dateStr);
  }
  function handleMouseLeave() {
    hoverTimeout.current = setTimeout(() => setHoverDate(null), 150);
  }

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
          const arrivalDay = arrivalDays.get(dateStr);
          const hasContent = hasEvents || !!arrivalDay;
          const isHovered = hoverDate === dateStr;

          return (
            <div
              key={i}
              className={`relative flex flex-col items-center py-0.5 ${hasContent ? "cursor-pointer" : ""}`}
              role={hasContent ? "button" : undefined}
              tabIndex={hasContent ? 0 : undefined}
              onClick={() => hasContent && onDayClick(dateStr)}
              onKeyDown={(e) => { if (hasContent && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onDayClick(dateStr); } }}
              onMouseEnter={() => hasContent && handleMouseEnter(dateStr)}
              onMouseLeave={handleMouseLeave}
            >
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs transition-colors
                  ${isToday
                    ? "bg-brand-500 font-semibold text-white"
                    : hasContent
                    ? "font-medium text-gray-800 hover:bg-gray-100 dark:text-white/90 dark:hover:bg-white/5"
                    : "text-gray-500 dark:text-gray-400"
                  }`}
              >
                {day}
              </span>
              {/* Indicadores: dots de eventos + barra de llegada */}
              {hasContent && (
                <div className="mt-0.5 flex flex-col items-center gap-px">
                  {hasEvents && (
                    <div className="flex items-center gap-px">
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
                  {arrivalDay && (
                    <div className="flex items-center gap-0.5">
                      {arrivalDay.brands.slice(0, 3).map((b) => (
                        <span
                          key={b}
                          className="block h-1.5 w-1.5 rounded-sm"
                          style={{ backgroundColor: getBrandColor(b), opacity: arrivalDay.hasOverdue ? 1 : 0.7 }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
              {/* Tooltip popover on hover */}
              {isHovered && hasContent && (
                <DayTooltip
                  dateStr={dateStr}
                  dayEvs={dayEvs}
                  categories={categories}
                  arrivalDay={arrivalDay}
                  columnIndex={i % 7}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Tooltip que aparece al hover sobre un día con eventos en la vista año */
function DayTooltip({
  dateStr,
  dayEvs,
  categories,
  arrivalDay,
  columnIndex,
}: {
  dateStr: string;
  dayEvs: CalendarEvent[];
  categories: Record<string, DbCategory>;
  arrivalDay?: { totalUnits: number; brands: string[]; hasOverdue: boolean };
  columnIndex: number;
}) {
  // Posicionar a la izquierda si estamos en las últimas columnas para no salir del viewport
  const alignRight = columnIndex >= 5;
  const d = new Date(dateStr + "T12:00:00");
  const label = d.toLocaleDateString("es-PY", { weekday: "short", day: "numeric", month: "short" });

  return (
    <div
      className={`absolute z-50 mt-1 w-52 rounded-lg border border-gray-200 bg-white p-2.5 shadow-lg dark:border-gray-700 dark:bg-gray-800 ${
        alignRight ? "right-0" : "left-0"
      }`}
      style={{ top: "100%" }}
      onMouseEnter={(e) => e.stopPropagation()}
    >
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
        {label}
      </p>
      {dayEvs.length > 0 && (
        <ul className="space-y-1">
          {dayEvs.slice(0, 5).map((ev, j) => {
            const color = categories[ev.extendedProps?.calendar]?.color ?? "#465fff";
            return (
              <li key={ev.id ?? j} className="flex items-center gap-1.5">
                <span className="block h-2 w-2 shrink-0 rounded-sm" style={{ backgroundColor: color }} />
                <span className="truncate text-[11px] text-gray-700 dark:text-gray-200">
                  {ev.title}
                </span>
              </li>
            );
          })}
          {dayEvs.length > 5 && (
            <li className="text-[10px] text-gray-400 dark:text-gray-500">+{dayEvs.length - 5} más</li>
          )}
        </ul>
      )}
      {arrivalDay && (
        <div className={dayEvs.length > 0 ? "mt-1.5 border-t border-gray-100 pt-1.5 dark:border-gray-700" : ""}>
          <p className="flex items-center gap-1 text-[10px] text-gray-500 dark:text-gray-400">
            <ShipIcon className="h-3 w-3" />
            {arrivalDay.brands.join(", ")} — {arrivalDay.totalUnits.toLocaleString()} uds.
          </p>
        </div>
      )}
      <p className="mt-1.5 text-[9px] text-gray-400 dark:text-gray-500">Click para ver detalle</p>
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

  const {
    arrivalEvents, arrivalItems, arrivalDays,
    showArrivals, toggleArrivals,
  } = useCalendarArrivals();

  const navigate = useNavigate();

  // Year view
  const [yearViewActive, setYearViewActive] = useState(false);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const today = new Date().toISOString().split("T")[0];

  // Event modal
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [modalStartDate, setModalStartDate] = useState("");
  const [modalEndDate, setModalEndDate] = useState("");

  // Arrival detail popover
  const [selectedArrival, setSelectedArrival] = useState<ArrivalCalendarItem | null>(null);

  // Day view date picker
  const [currentFCView, setCurrentFCView] = useState("dayGridMonth");
  const [currentFCDate, setCurrentFCDate] = useState(today);

  const calendarRef = useRef<FullCalendar>(null);
  const { isOpen, openModal, closeModal } = useModal();
  const { isExpanded, isHovered } = useSidebar();

  // Merge events + arrivals for FullCalendar
  const allFCEvents = useMemo(
    () => [...events, ...arrivalEvents],
    [events, arrivalEvents],
  );

  // ── Recalculate FC size after sidebar expand/collapse transition ────────
  useEffect(() => {
    const timer = setTimeout(() => {
      calendarRef.current?.getApi().updateSize();
    }, 320);
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
    setSelectedEvent(null);
    setModalStartDate("");
    setModalEndDate("");
  };

  const handleDateSelect = (selectInfo: DateSelectArg) => {
    resetModalFields();
    setModalStartDate(selectInfo.startStr);
    setModalEndDate(selectInfo.endStr || selectInfo.startStr);
    openModal();
  };

  const handleEventClick = (clickInfo: EventClickArg) => {
    const ev = clickInfo.event;

    // Check if this is an arrival (read-only)
    if (ev.extendedProps?.isArrival) {
      const arrivalData = ev.extendedProps.arrivalData as ArrivalCalendarItem;
      setSelectedArrival(arrivalData);
      return;
    }

    // Normal calendar event
    setSelectedEvent(ev as unknown as CalendarEvent);
    setModalStartDate(ev.start?.toISOString().split("T")[0] || "");
    setModalEndDate(ev.end?.toISOString().split("T")[0] || "");
    openModal();
  };

  const handleEventDrop = async (dropInfo: EventDropArg) => {
    const { event } = dropInfo;
    // Prevent dragging arrivals
    if (event.extendedProps?.isArrival) {
      dropInfo.revert();
      return;
    }
    const start = event.start?.toISOString().split("T")[0] ?? "";
    const end = event.end?.toISOString().split("T")[0] ?? null;
    await moveEvent(event.id, start, end);
  };

  const handleEventResize = async (resizeInfo: EventResizeDoneArg) => {
    const { event } = resizeInfo;
    // Prevent resizing arrivals
    if (event.extendedProps?.isArrival) {
      resizeInfo.revert();
      return;
    }
    const start = event.start?.toISOString().split("T")[0] ?? "";
    const end = event.end?.toISOString().split("T")[0] ?? null;
    await moveEvent(event.id, start, end);
  };

  const handleCloseModal = () => {
    closeModal();
    resetModalFields();
  };

  // ── Event rendering ────────────────────────────────────────────────────────

  const renderEventContent = useCallback((eventInfo: {
    timeText: string;
    event: { title: string; extendedProps: Record<string, unknown> };
  }) => {
    const ep = eventInfo.event.extendedProps;

    // Arrival rendering — distinctive visual
    if (ep.isArrival) {
      const arrivalData = ep.arrivalData as ArrivalCalendarItem;
      const brandColor = getBrandColor(arrivalData.brandNorm);
      const statusColor = getStatusColor(arrivalData.status);
      return (
        <div
          className="flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[11px] font-medium leading-tight cursor-pointer"
          style={{ backgroundColor: brandColor + "15", borderLeft: `3px solid ${statusColor}` }}
        >
          <ShipIcon className="h-3 w-3 shrink-0" />
          <span className="truncate" style={{ color: brandColor }}>
            {arrivalData.brand} · {arrivalData.totalUnits.toLocaleString("es-PY")} uds
          </span>
        </div>
      );
    }

    // Normal event rendering
    const color = categories[(ep as { calendar?: string }).calendar ?? ""]?.color ?? "#465fff";
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

      {/* ── Arrivals toggle + legend ─────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-gray-200 px-6 py-2.5 dark:border-gray-800">
        <div className="flex items-center gap-4">
          <button
            onClick={toggleArrivals}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              showArrivals
                ? "bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400"
                : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
            }`}
          >
            <ShipIcon className="h-3.5 w-3.5" />
            Llegadas
            {arrivalItems.length > 0 && (
              <span className={`ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                showArrivals
                  ? "bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300"
                  : "bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
              }`}>
                {arrivalItems.length}
              </span>
            )}
          </button>
          {showArrivals && arrivalItems.length > 0 && (
            <div className="hidden items-center gap-2 sm:flex">
              {["martel", "wrangler", "lee"].map(b => {
                const count = arrivalItems.filter(i => i.brandNorm === b).length;
                if (count === 0) return null;
                return (
                  <div key={b} className="flex items-center gap-1">
                    <span className="block h-2 w-2 rounded-sm" style={{ backgroundColor: getBrandColor(b) }} />
                    <span className="text-[10px] font-medium capitalize text-gray-500 dark:text-gray-400">
                      {b} ({count})
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

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
                  setModalStartDate(today); setModalEndDate(today);
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
                  Año
                </button>
                {(["dayGridMonth", "timeGridWeek", "timeGridDay"] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => switchToFCView(v)}
                    className="rounded-md border-0 bg-transparent px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                  >
                    {v === "dayGridMonth" ? "Mes" : v === "timeGridWeek" ? "Semana" : "Día"}
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
                arrivalDays={showArrivals ? arrivalDays : new Map()}
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
          buttonText={{ today: "Hoy", month: "Mes", week: "Semana", day: "Día" }}
          events={allFCEvents}
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
                setModalStartDate(t); setModalEndDate(t);
                openModal();
              },
            },
            yearViewButton: {
              text: "Año",
              click: enterYearView,
            },
          }}
        />
      </div>

      {/* ── Event Modal ─────────────────────────────────────────────────── */}
      {isOpen && (
        <EventFormModal
          event={selectedEvent}
          categories={categories}
          saving={saving}
          initialStartDate={modalStartDate}
          initialEndDate={modalEndDate}
          onSave={addEvent}
          onUpdate={updateEvent}
          onDelete={deleteEvent}
          onAddCategory={addCategory}
          onChangeCategoryColor={updateCategoryColor}
          onClose={handleCloseModal}
        />
      )}

      {/* ── Arrival Detail Popover ──────────────────────────────────────── */}
      {selectedArrival && (
        <ArrivalDetailPopover
          item={selectedArrival}
          onClose={() => setSelectedArrival(null)}
          onNavigateToLogistics={() => {
            setSelectedArrival(null);
            navigate("/logistica");
          }}
        />
      )}
    </div>
  );
}
