/**
 * features/executive/components/ExecutiveFilters.tsx
 *
 * Filtros in-page con jerarquía visual para el dashboard ejecutivo.
 * Nivel 1: Marca (chips prominentes con color)
 * Nivel 2: Canal (segmented toggle compacto)
 * Nivel 3: Período (dropdown discreto)
 *
 * REGLA: Lee y escribe en FilterContext. Sin estado propio.
 */
import { useFilters } from "@/context/FilterContext";
import type { ChannelFilter, PeriodFilter } from "@/domain/filters/types";

const CHANNELS: { value: ChannelFilter; label: string }[] = [
  { value: "total", label: "Total" },
  { value: "b2c",   label: "B2C" },
  { value: "b2b",   label: "B2B" },
];

const PERIODS: { value: PeriodFilter; label: string }[] = [
  { value: "ytd",             label: "YTD" },
  { value: "lastClosedMonth", label: "Últ. Mes" },
  { value: "currentMonth",    label: "Mes Actual" },
];

export function ExecutiveFilters() {
  const { filters, setChannel, setPeriod } = useFilters();

  return (
    <div className="flex items-center gap-3">
      {/* Channel segmented control */}
      <div className="inline-flex overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
        {CHANNELS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => setChannel(value)}
            className={`px-3 py-1.5 text-xs font-medium transition-colors duration-[var(--duration-fast)] ${
              filters.channel === value
                ? "bg-brand-500 font-semibold text-white"
                : "bg-white text-gray-500 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Period dropdown */}
      <div className="relative">
        <select
          value={filters.period}
          onChange={(e) => setPeriod(e.target.value as PeriodFilter)}
          className="appearance-none rounded-lg border border-gray-200 bg-white py-1.5 pl-3 pr-7 text-xs font-medium text-gray-600 transition-colors duration-[var(--duration-fast)] hover:border-gray-300 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
        >
          {PERIODS.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <svg
          className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-gray-400 dark:text-gray-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </div>
    </div>
  );
}
