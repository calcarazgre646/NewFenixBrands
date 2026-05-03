/**
 * components/filters/GlobalFilters.tsx
 *
 * Barra unificada de filtros globales (Marca / Canal / Período).
 *
 * UI del design system del proyecto (mismo lenguaje que NotificationDropdown,
 * Button, Dropdown): triggers con borde gray-200, panels rounded-xl con
 * shadow-theme-lg, paleta brand-* para activo, dark mode integrado.
 *
 * Decisiones:
 *   - SIEMPRE 3 dropdowns en el orden fijo Marca → Canal → Período.
 *   - El trigger muestra el VALOR actual (no solo "Marca"): "Marca: Martel" da
 *     contexto sin abrir el panel.
 *   - Marca tiene un dot de color para identificación visual rápida.
 *   - Sub-canal B2B nesteado: "B2B (todos) / B2B · Mayorista / B2B · UTP".
 *   - Filtros disabled: opacity 60% + tooltip + cursor not-allowed.
 *   - Role-locking: ícono 🔒 en el trigger + tooltip explicativo.
 *
 * Lee/escribe en FilterContext via useFilters(). NO tiene estado propio.
 */
import { useState, useRef, useEffect } from "react";
import { useFilters } from "@/hooks/useFilters";
import {
  ALL_FILTERS_ENABLED,
  disabledReason,
  isEnabled,
  type ViewFilterSupport,
} from "@/domain/filters/viewSupport";
import type {
  BrandFilter,
  PeriodFilter,
} from "@/domain/filters/types";
import {
  toComposite,
  fromComposite,
  type CompositeChannel,
} from "@/components/filters/compositeChannel";

interface GlobalFiltersProps {
  support?: ViewFilterSupport;
  className?: string;
}

// ─── Catálogos de opciones ───────────────────────────────────────────────────

interface BrandOption { value: BrandFilter; label: string; }
const BRAND_OPTIONS: BrandOption[] = [
  { value: "total",    label: "Todas las marcas" },
  { value: "martel",   label: "Martel" },
  { value: "wrangler", label: "Wrangler" },
  { value: "lee",      label: "Lee" },
];

interface PeriodOption { value: PeriodFilter; label: string; }
const PERIOD_OPTIONS: PeriodOption[] = [
  { value: "ytd",             label: "Año a la fecha" },
  { value: "lastClosedMonth", label: "Último mes cerrado" },
  { value: "currentMonth",    label: "Mes actual" },
];

interface ChannelOption { value: CompositeChannel; label: string; indent?: boolean; }
const CHANNEL_OPTIONS: ChannelOption[] = [
  { value: "total",         label: "Todos los canales" },
  { value: "b2c",           label: "B2C" },
  { value: "b2b:all",       label: "B2B" },
  { value: "b2b:mayorista", label: "Mayorista", indent: true },
  { value: "b2b:utp",       label: "UTP",       indent: true },
];

// ─── Componente principal ────────────────────────────────────────────────────

export default function GlobalFilters({
  support = ALL_FILTERS_ENABLED,
  className,
}: GlobalFiltersProps) {
  const { filters, setBrand, setChannel, setB2bSubchannel, setPeriod, isChannelLocked } = useFilters();

  const brandEnabled   = isEnabled(support.brand);
  const channelEnabled = isEnabled(support.channel) && !isChannelLocked;
  const periodEnabled  = isEnabled(support.period);

  const brandReason   = !brandEnabled   ? disabledReason(support.brand) : null;
  const channelReason = !isEnabled(support.channel)
    ? disabledReason(support.channel)
    : isChannelLocked
      ? "Canal asignado por tu rol"
      : null;
  const periodReason  = !periodEnabled  ? disabledReason(support.period) : null;

  const currentBrand   = BRAND_OPTIONS.find((o) => o.value === filters.brand) ?? BRAND_OPTIONS[0];
  const currentChannel = CHANNEL_OPTIONS.find(
    (o) => o.value === toComposite(filters.channel, filters.b2bSubchannel),
  ) ?? CHANNEL_OPTIONS[0];
  const currentPeriod  = PERIOD_OPTIONS.find((o) => o.value === filters.period) ?? PERIOD_OPTIONS[0];

  function handleChannelChange(value: CompositeChannel) {
    const { channel, sub } = fromComposite(value);
    setChannel(channel);
    if (channel === "b2b" && sub !== "all") setB2bSubchannel(sub);
  }

  return (
    <div
      className={`flex flex-wrap items-center gap-2 ${className ?? ""}`}
      data-testid="global-filters"
    >
      {/* ── Marca ── */}
      <FilterDropdown
        ariaLabel="Filtro de marca"
        labelPrefix="Marca"
        valueLabel={currentBrand.label}
        disabled={!brandEnabled}
        disabledReason={brandReason}
      >
        {(close) =>
          BRAND_OPTIONS.map((opt) => (
            <OptionRow
              key={opt.value}
              active={opt.value === filters.brand}
              onClick={() => { setBrand(opt.value); close(); }}
            >
              {opt.label}
            </OptionRow>
          ))
        }
      </FilterDropdown>

      {/* ── Canal ── */}
      <FilterDropdown
        ariaLabel="Filtro de canal"
        labelPrefix="Canal"
        valueLabel={currentChannel.label}
        disabled={!channelEnabled}
        disabledReason={channelReason}
        locked={isChannelLocked && isEnabled(support.channel)}
      >
        {(close) =>
          CHANNEL_OPTIONS.map((opt) => (
            <OptionRow
              key={opt.value}
              active={opt.value === toComposite(filters.channel, filters.b2bSubchannel)}
              onClick={() => { handleChannelChange(opt.value); close(); }}
              indent={opt.indent}
            >
              {opt.label}
            </OptionRow>
          ))
        }
      </FilterDropdown>

      {/* ── Período ── */}
      <FilterDropdown
        ariaLabel="Filtro de período"
        labelPrefix="Período"
        valueLabel={currentPeriod.label}
        disabled={!periodEnabled}
        disabledReason={periodReason}
      >
        {(close) =>
          PERIOD_OPTIONS.map((opt) => (
            <OptionRow
              key={opt.value}
              active={opt.value === filters.period}
              onClick={() => { setPeriod(opt.value); close(); }}
            >
              {opt.label}
            </OptionRow>
          ))
        }
      </FilterDropdown>
    </div>
  );
}

// ─── Trigger + Panel ─────────────────────────────────────────────────────────

interface FilterDropdownProps {
  ariaLabel: string;
  /** "Marca" — solo se usa para tooltip + aria. */
  labelPrefix: string;
  /** "Martel" — el valor activo, único contenido visible del trigger. */
  valueLabel: string;
  disabled?: boolean;
  disabledReason?: string | null;
  /** Role-locking: ícono 🔒 en lugar del caret. */
  locked?: boolean;
  /** Render-prop con la fn `close` para que la opción cierre el panel al elegir. */
  children: (close: () => void) => React.ReactNode;
}

function FilterDropdown({
  ariaLabel,
  labelPrefix,
  valueLabel,
  disabled = false,
  disabledReason,
  locked = false,
  children,
}: FilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Cierre por click-fuera y Escape
  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const triggerBase =
    "group inline-flex items-center gap-1.5 h-9 lg:h-10 rounded-lg border px-2.5 text-xs font-semibold whitespace-nowrap transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500/20";
  const triggerEnabled =
    "border-gray-200 bg-white text-gray-700 hover:border-brand-300 hover:text-brand-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-brand-500/50 dark:hover:text-brand-400";
  const triggerOpen =
    "border-brand-400 bg-brand-50 text-brand-700 dark:border-brand-500/50 dark:bg-brand-500/10 dark:text-brand-400";
  const triggerDisabled =
    "border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed dark:border-gray-700 dark:bg-gray-900 dark:text-gray-500";

  const stateClass = disabled
    ? triggerDisabled
    : open
      ? triggerOpen
      : triggerEnabled;

  const tooltip = disabled && disabledReason
    ? disabledReason
    : `${labelPrefix}: ${valueLabel}`;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        aria-label={`${ariaLabel}. Actual: ${valueLabel}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={tooltip}
        className={`${triggerBase} ${stateClass}`}
      >
        <span>{valueLabel}</span>
        {locked ? (
          <LockIcon className="h-3.5 w-3.5 opacity-70" />
        ) : (
          <CaretIcon className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
        )}
      </button>

      {open && !disabled && (
        <div
          role="listbox"
          aria-label={ariaLabel}
          className="absolute left-0 top-full z-40 mt-2 min-w-[200px] rounded-xl border border-gray-200 bg-white p-1.5 shadow-theme-lg dark:border-gray-800 dark:bg-gray-dark"
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

// ─── Option row ──────────────────────────────────────────────────────────────

interface OptionRowProps {
  active: boolean;
  onClick: () => void;
  /** Indentación visual para sub-opciones (B2B sub-canales). */
  indent?: boolean;
  children: React.ReactNode;
}

function OptionRow({ active, onClick, indent = false, children }: OptionRowProps) {
  const base =
    "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-left transition-colors";
  const stateClass = active
    ? "bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-400"
    : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800";

  // Sub-opciones (Mayorista/UTP bajo B2B): indentación + rayita vertical a la
  // izquierda que las conecta visualmente con su padre (patrón tree-view).
  // El wrapper es block con pl-5 para que el botón w-full respete el margen
  // derecho del panel (el bg de hover queda alineado con las opciones normales).
  if (indent) {
    return (
      <div className="relative pl-5">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-2 bottom-2 w-px bg-gray-200 dark:bg-gray-700"
        />
        <button
          type="button"
          role="option"
          aria-selected={active}
          onClick={onClick}
          className={`${base} ${stateClass}`}
        >
          <span className="flex-1">{children}</span>
          {active && <CheckIcon className="h-3.5 w-3.5" />}
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      role="option"
      aria-selected={active}
      onClick={onClick}
      className={`${base} ${stateClass}`}
    >
      <span className="flex-1">{children}</span>
      {active && <CheckIcon className="h-3.5 w-3.5" />}
    </button>
  );
}

// ─── Iconos ──────────────────────────────────────────────────────────────────

function CaretIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
    </svg>
  );
}

function LockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}
