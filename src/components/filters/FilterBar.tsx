/**
 * components/filters/FilterBar.tsx
 *
 * Barra de filtros global que aparece en el header.
 * Controla: Marca, Canal, Período.
 *
 * La tienda se selecciona dentro de cada página (SalesPage)
 * porque es contextual al canal elegido.
 *
 * REGLA: Este componente NO tiene estado propio.
 * Lee y escribe en FilterContext. Todos los hooks se actualizan automáticamente.
 */
import { useFilters } from "@/context/FilterContext";
import type { BrandFilter, ChannelFilter, PeriodFilter } from "@/domain/filters/types";

const BRANDS: { value: BrandFilter; label: string }[] = [
  { value: "total",    label: "Todas las marcas" },
  { value: "martel",   label: "Martel" },
  { value: "wrangler", label: "Wrangler" },
  { value: "lee",      label: "Lee" },
];

const CHANNELS: { value: ChannelFilter; label: string }[] = [
  { value: "total", label: "Total" },
  { value: "b2c",   label: "B2C" },
  { value: "b2b",   label: "B2B" },
];

const PERIODS: { value: PeriodFilter; label: string }[] = [
  { value: "ytd",            label: "YTD" },
  { value: "lastClosedMonth", label: "Últ. Mes" },
  { value: "currentMonth",   label: "Mes Actual" },
];

interface FilterBarProps {
  filters: ReturnType<typeof useFilters>["filters"];
  compact?: boolean;
}

export default function FilterBar({ compact = false }: FilterBarProps) {
  const { filters, setBrand, setChannel, setPeriod } = useFilters();

  const pillBase =
    "px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer whitespace-nowrap";
  const pillActive =
    "bg-brand-500 text-white border-brand-500";
  const pillInactive =
    "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-brand-400 hover:text-brand-500";

  if (compact) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        {/* Canal */}
        <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          {CHANNELS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setChannel(value)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                filters.channel === value
                  ? "bg-brand-500 text-white"
                  : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Marca */}
        <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          {BRANDS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setBrand(value)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                filters.brand === value
                  ? "bg-brand-500 text-white"
                  : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              }`}
            >
              {value === "total" ? "Todas" : label}
            </button>
          ))}
        </div>

        {/* Período */}
        <div className="flex gap-1">
          {PERIODS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setPeriod(value)}
              className={`${pillBase} ${filters.period === value ? pillActive : pillInactive}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Versión expandida para mobile
  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-xs text-gray-400 mb-1.5">Canal</p>
        <div className="flex gap-1 flex-wrap">
          {CHANNELS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setChannel(value)}
              className={`${pillBase} ${filters.channel === value ? pillActive : pillInactive}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="text-xs text-gray-400 mb-1.5">Marca</p>
        <div className="flex gap-1 flex-wrap">
          {BRANDS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setBrand(value)}
              className={`${pillBase} ${filters.brand === value ? pillActive : pillInactive}`}
            >
              {value === "total" ? "Todas" : label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="text-xs text-gray-400 mb-1.5">Período</p>
        <div className="flex gap-1 flex-wrap">
          {PERIODS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setPeriod(value)}
              className={`${pillBase} ${filters.period === value ? pillActive : pillInactive}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
