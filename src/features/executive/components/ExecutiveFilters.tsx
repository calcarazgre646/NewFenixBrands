/**
 * features/executive/components/ExecutiveFilters.tsx
 *
 * Filtros in-page de la vista ejecutiva.
 *
 * Desktop (lg+): Canal como botones agrupados + Período como select.
 *   (Marca viene del FilterBar en el header.)
 *
 * Mobile (<lg): 3 selects — Canal, Marca, Período.
 *   (El header FilterBar está oculto en mobile, así que Marca se muestra aquí.)
 */
import { useFilters } from "@/hooks/useFilters";
import type { BrandFilter, ChannelFilter, PeriodFilter } from "@/domain/filters/types";

const CHANNELS: { value: ChannelFilter; label: string }[] = [
  { value: "total", label: "Total" },
  { value: "b2c",   label: "B2C" },
  { value: "b2b",   label: "B2B" },
];

const BRANDS: { value: BrandFilter; label: string }[] = [
  { value: "total",    label: "Todas" },
  { value: "martel",   label: "Martel" },
  { value: "wrangler", label: "Wrangler" },
  { value: "lee",      label: "Lee" },
];

const PERIODS: { value: PeriodFilter; label: string }[] = [
  { value: "ytd",             label: "YTD" },
  { value: "lastClosedMonth", label: "Últ. Mes" },
  { value: "currentMonth",    label: "Mes Actual" },
];

const selectBase =
  "appearance-none rounded-lg border py-1.5 pl-3 pr-7 text-xs font-medium transition-colors duration-[var(--duration-fast)] focus:outline-none focus:ring-2 focus:ring-brand-500/10";
const selectInactive =
  `${selectBase} border-gray-200 bg-white text-gray-600 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300`;

function Arrow() {
  return (
    <svg
      className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-gray-400 dark:text-gray-500"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2.5}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
    </svg>
  );
}

export function ExecutiveFilters() {
  const { filters, setBrand, setChannel, setPeriod } = useFilters();

  const btnBase = "px-3 py-1.5 text-xs font-medium transition-colors";
  const btnActive = `${btnBase} bg-brand-500 text-white`;
  const btnInactive = `${btnBase} bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700`;

  return (
    <>
      {/* ── Desktop (lg+): botones canal + select período ── */}
      <div className="hidden lg:flex items-center gap-2">
        <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          {CHANNELS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setChannel(value)}
              className={filters.channel === value ? btnActive : btnInactive}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="relative">
          <select
            value={filters.period}
            onChange={(e) => setPeriod(e.target.value as PeriodFilter)}
            className={selectInactive}
          >
            {PERIODS.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <Arrow />
        </div>
      </div>

      {/* ── Mobile (<lg): 3 selects — Marca, Canal, Período ── */}
      <div className="exec-mobile-filters flex items-center gap-2 lg:hidden">
        {/* Marca */}
        <div className="relative">
          <select
            value={filters.brand}
            onChange={(e) => setBrand(e.target.value as BrandFilter)}
            className={selectInactive}
          >
            {BRANDS.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <Arrow />
        </div>

        {/* Canal */}
        <div className="relative">
          <select
            value={filters.channel}
            onChange={(e) => setChannel(e.target.value as ChannelFilter)}
            className={selectInactive}
          >
            {CHANNELS.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <Arrow />
        </div>

        {/* Período */}
        <div className="relative">
          <select
            value={filters.period}
            onChange={(e) => setPeriod(e.target.value as PeriodFilter)}
            className={selectInactive}
          >
            {PERIODS.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <Arrow />
        </div>
      </div>
    </>
  );
}
