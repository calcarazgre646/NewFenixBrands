/**
 * components/filters/GlobalFilters.tsx
 *
 * Barra unificada de filtros globales (Marca / Canal / Período).
 *
 * Decisiones de diseño:
 *   - SIEMPRE 3 dropdowns en el mismo orden (marca → canal → período).
 *   - Posición fija arriba-izquierda en cada vista que los renderiza.
 *   - Cuando un filtro NO aplica matemáticamente a la vista, se muestra
 *     deshabilitado con tooltip explicativo (no se oculta) — el músculo
 *     visual del usuario se mantiene entre vistas.
 *   - Sub-canal B2B se anida dentro del dropdown de Canal como
 *     "B2B (todos)" / "B2B → Mayorista" / "B2B → UTP" — UNA sola interacción.
 *   - Role-locking: cuando el rol fija canal, el select se muestra con
 *     ícono 🔒 y tooltip "Canal asignado por tu rol" (no editable).
 *   - Native `<select>` para accesibilidad + UX mobile nativa.
 *
 * Lee y escribe en FilterContext via useFilters(). NO tiene estado propio.
 *
 * REGLA: Las vistas sin filtros (/usuarios, /calendario, /ayuda) simplemente
 * NO renderizan este componente.
 */
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
  /** Soporte por filtro de la vista actual. Default: todos habilitados. */
  support?: ViewFilterSupport;
  className?: string;
}

const BRAND_OPTIONS: { value: BrandFilter; label: string }[] = [
  { value: "total",    label: "Todas las marcas" },
  { value: "martel",   label: "Martel" },
  { value: "wrangler", label: "Wrangler" },
  { value: "lee",      label: "Lee" },
];

const PERIOD_OPTIONS: { value: PeriodFilter; label: string }[] = [
  { value: "ytd",             label: "Año a la fecha" },
  { value: "lastClosedMonth", label: "Último mes cerrado" },
  { value: "currentMonth",    label: "Mes actual" },
];

const CHANNEL_OPTIONS: { value: CompositeChannel; label: string }[] = [
  { value: "total",          label: "Todos los canales" },
  { value: "b2c",            label: "B2C" },
  { value: "b2b:all",        label: "B2B (todos)" },
  { value: "b2b:mayorista",  label: "B2B · Mayorista" },
  { value: "b2b:utp",        label: "B2B · UTP" },
];

export default function GlobalFilters({
  support = ALL_FILTERS_ENABLED,
  className,
}: GlobalFiltersProps) {
  const { filters, setBrand, setChannel, setB2bSubchannel, setPeriod, isChannelLocked } = useFilters();

  const brandEnabled   = isEnabled(support.brand);
  const channelEnabled = isEnabled(support.channel) && !isChannelLocked;
  const periodEnabled  = isEnabled(support.period);

  const brandReason   = !brandEnabled   ? disabledReason(support.brand)   : null;
  const channelReason = !isEnabled(support.channel)
    ? disabledReason(support.channel)
    : isChannelLocked
      ? "Canal asignado por tu rol"
      : null;
  const periodReason  = !periodEnabled  ? disabledReason(support.period)  : null;

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
      <FilterDropdown
        label="Marca"
        value={filters.brand}
        onChange={(v) => setBrand(v as BrandFilter)}
        options={BRAND_OPTIONS}
        disabled={!brandEnabled}
        disabledReason={brandReason}
      />
      <FilterDropdown
        label="Canal"
        value={toComposite(filters.channel, filters.b2bSubchannel)}
        onChange={(v) => handleChannelChange(v as CompositeChannel)}
        options={CHANNEL_OPTIONS}
        disabled={!channelEnabled}
        disabledReason={channelReason}
        locked={isChannelLocked && isEnabled(support.channel)}
      />
      <FilterDropdown
        label="Período"
        value={filters.period}
        onChange={(v) => setPeriod(v as PeriodFilter)}
        options={PERIOD_OPTIONS}
        disabled={!periodEnabled}
        disabledReason={periodReason}
      />
    </div>
  );
}

// ─── Dropdown atómico ─────────────────────────────────────────────────────────

interface FilterDropdownProps<T extends string> {
  label: string;
  value: T;
  onChange: (next: T) => void;
  options: readonly { value: T; label: string }[];
  disabled?: boolean;
  disabledReason?: string | null;
  /** Cuando true, muestra ícono de candado (role-locking de canal). */
  locked?: boolean;
}

function FilterDropdown<T extends string>({
  label,
  value,
  onChange,
  options,
  disabled = false,
  disabledReason,
  locked = false,
}: FilterDropdownProps<T>) {
  const baseSelect =
    "appearance-none rounded-lg border py-1.5 pl-3 pr-8 text-xs font-medium transition-colors duration-[var(--duration-fast)] focus:outline-none focus:ring-2 focus:ring-brand-500/10";
  const enabledClasses =
    "border-gray-200 bg-white text-gray-700 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 cursor-pointer";
  const disabledClasses =
    "border-gray-200 bg-gray-50 text-gray-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-500 cursor-not-allowed";

  // Tooltip = razón cuando está deshabilitado, label cuando está habilitado
  const titleAttr = disabled && disabledReason ? disabledReason : `Filtrar por ${label.toLowerCase()}`;

  return (
    <div className="relative" title={titleAttr}>
      {/* Etiqueta visualmente oculta para screen readers */}
      <label className="sr-only" htmlFor={`gf-${label.toLowerCase()}`}>
        {label}
      </label>
      <select
        id={`gf-${label.toLowerCase()}`}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        disabled={disabled}
        aria-label={label}
        aria-disabled={disabled}
        className={`${baseSelect} ${disabled ? disabledClasses : enabledClasses}`}
      >
        {/* Si el value actual no está entre opciones (caso raro de rol locked + valor no listado), incluirlo igual */}
        {!options.some((o) => o.value === value) && (
          <option value={value}>{value}</option>
        )}
        {options.map(({ value: v, label: l }) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
      {/* Ícono: candado si locked, flecha si normal */}
      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500">
        {locked ? (
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
          </svg>
        ) : (
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        )}
      </span>
    </div>
  );
}
