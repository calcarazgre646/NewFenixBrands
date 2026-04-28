/**
 * components/filters/FilterBar.tsx
 *
 * Barra de filtros global que aparece en el header.
 * Controla: Marca, Canal, Período.
 *
 * En la home ejecutiva (brandOnly=true) solo muestra Marca,
 * porque Canal y Período ya están en ExecutiveFilters in-page.
 *
 * ROLES:
 *   - super_user / gerencia: filtros libres
 *   - negocio con channel_scope: canal visible pero deshabilitado (locked)
 *
 * REGLA: Este componente NO tiene estado propio.
 * Lee y escribe en FilterContext. Todos los hooks se actualizan automáticamente.
 */
import { useFilters } from "@/hooks/useFilters";
import type { B2bSubchannel, BrandFilter, ChannelFilter, PeriodFilter } from "@/domain/filters/types";

const BRANDS: { value: BrandFilter; label: string; initial: string; bg: string }[] = [
  { value: "total",    label: "Todas las marcas", initial: "T", bg: "bg-brand-500" },
  { value: "martel",   label: "Martel",           initial: "M", bg: "bg-success-500" },
  { value: "wrangler", label: "Wrangler",         initial: "W", bg: "bg-warning-500" },
  { value: "lee",      label: "Lee",              initial: "L", bg: "bg-error-500" },
];

const CHANNELS: { value: ChannelFilter; label: string }[] = [
  { value: "total", label: "Total" },
  { value: "b2c",   label: "B2C" },
  { value: "b2b",   label: "B2B" },
];

const B2B_SUBCHANNELS: { value: B2bSubchannel; label: string }[] = [
  { value: "all",       label: "Todos" },
  { value: "mayorista", label: "Mayorista" },
  { value: "utp",       label: "UTP" },
];

const PERIODS: { value: PeriodFilter; label: string }[] = [
  { value: "ytd",            label: "YTD" },
  { value: "lastClosedMonth", label: "Últ. Mes" },
  { value: "currentMonth",   label: "Mes Actual" },
];

interface FilterBarProps {
  filters: ReturnType<typeof useFilters>["filters"];
  compact?: boolean;
  /** Solo mostrar marca (ocultar canal y período). Usado en la home ejecutiva. */
  brandOnly?: boolean;
}

export default function FilterBar({ compact = false, brandOnly = false }: FilterBarProps) {
  const { filters, setBrand, setChannel, setB2bSubchannel, setPeriod, isChannelLocked } = useFilters();
  const showB2bSub = !brandOnly && filters.channel === "b2b";

  const pillBase =
    "px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap";
  const pillActive =
    "bg-brand-500 text-white border-brand-500";
  const pillInactive =
    "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-brand-400 hover:text-brand-500 cursor-pointer";
  const pillLocked =
    "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-700 cursor-not-allowed opacity-60";

  const selectBase =
    "appearance-none rounded-lg border border-gray-200 bg-white py-1.5 pl-3 pr-7 text-xs font-medium text-gray-600 transition-colors hover:border-gray-300 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 cursor-pointer";

  if (compact) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        {/* ── Canal ── */}
        {!brandOnly && (
          <>
            {/* Desktop: botones agrupados originales */}
            <div className="hidden lg:flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              {CHANNELS.map(({ value, label }) => {
                const active = filters.channel === value;
                const locked = isChannelLocked && !active;
                return (
                  <button
                    key={value}
                    onClick={() => setChannel(value)}
                    disabled={isChannelLocked}
                    title={isChannelLocked ? "Canal asignado por tu rol" : undefined}
                    className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                      active
                        ? isChannelLocked
                          ? "bg-brand-400 text-white cursor-not-allowed"
                          : "bg-brand-500 text-white"
                        : locked
                          ? "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed"
                          : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                    }`}
                  >
                    {label}
                    {isChannelLocked && active && (
                      <svg className="inline-block ml-1 h-3 w-3 -mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
            {/* Mobile: botones separados */}
            <div className="lg:hidden flex gap-1">
              {CHANNELS.map(({ value, label }) => {
                const active = filters.channel === value;
                return (
                  <button
                    key={value}
                    onClick={() => setChannel(value)}
                    disabled={isChannelLocked}
                    title={isChannelLocked ? "Canal asignado por tu rol" : undefined}
                    className={`${pillBase} ${
                      active
                        ? pillActive
                        : isChannelLocked
                          ? pillLocked
                          : pillInactive
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Sub-canal B2B (sólo cuando channel='b2b') */}
            {showB2bSub && (
              <>
                <div className="hidden lg:flex rounded-lg border border-indigo-200 dark:border-indigo-500/30 overflow-hidden">
                  {B2B_SUBCHANNELS.map(({ value, label }) => {
                    const active = filters.b2bSubchannel === value;
                    return (
                      <button
                        key={value}
                        onClick={() => setB2bSubchannel(value)}
                        className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                          active
                            ? "bg-indigo-500 text-white"
                            : "bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-500/10"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                <div className="lg:hidden flex gap-1">
                  {B2B_SUBCHANNELS.map(({ value, label }) => {
                    const active = filters.b2bSubchannel === value;
                    return (
                      <button
                        key={value}
                        onClick={() => setB2bSubchannel(value)}
                        className={`${pillBase} ${
                          active
                            ? "bg-indigo-500 text-white border-indigo-500"
                            : "bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-300 border-indigo-200 dark:border-indigo-500/30 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 cursor-pointer"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}

        {/* ── Marca ── */}
        {/* Desktop: botones agrupados originales */}
        <div className="hidden lg:flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          {BRANDS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setBrand(value)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                filters.brand === value
                  ? "bg-brand-500 text-white"
                  : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              }`}
            >
              {value === "total" ? "Todas" : label}
            </button>
          ))}
        </div>
        {/* Mobile: select individual */}
        <select
          value={filters.brand}
          onChange={(e) => setBrand(e.target.value as BrandFilter)}
          className={`lg:hidden ${selectBase}`}
        >
          {BRANDS.map(({ value, label }) => (
            <option key={value} value={value}>
              {value === "total" ? "Todas" : label}
            </option>
          ))}
        </select>

        {/* ── Período ── */}
        {!brandOnly && (
          <>
            {/* Desktop: pills originales */}
            <div className="hidden lg:flex gap-1">
              {PERIODS.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setPeriod(value)}
                  className={`${pillBase} cursor-pointer ${filters.period === value ? pillActive : pillInactive}`}
                >
                  {label}
                </button>
              ))}
            </div>
            {/* Mobile: select individual */}
            <select
              value={filters.period}
              onChange={(e) => setPeriod(e.target.value as PeriodFilter)}
              className={`lg:hidden ${selectBase}`}
            >
              {PERIODS.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </>
        )}
      </div>
    );
  }

  // Versión expandida para mobile
  return (
    <div className="flex flex-col gap-3">
      {!brandOnly && (
        <div>
          <p className="text-xs text-gray-400 mb-1.5">
            Canal
            {isChannelLocked && (
              <span className="ml-1.5 text-[10px] text-gray-400">
                (asignado)
              </span>
            )}
          </p>
          <div className="flex gap-1 flex-wrap">
            {CHANNELS.map(({ value, label }) => {
              const active = filters.channel === value;
              return (
                <button
                  key={value}
                  onClick={() => setChannel(value)}
                  disabled={isChannelLocked}
                  title={isChannelLocked ? "Canal asignado por tu rol" : undefined}
                  className={`${pillBase} ${
                    active
                      ? pillActive
                      : isChannelLocked
                        ? pillLocked
                        : pillInactive
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
          {showB2bSub && (
            <div className="mt-2 flex gap-1 flex-wrap">
              {B2B_SUBCHANNELS.map(({ value, label }) => {
                const active = filters.b2bSubchannel === value;
                return (
                  <button
                    key={value}
                    onClick={() => setB2bSubchannel(value)}
                    className={`${pillBase} ${
                      active
                        ? "bg-indigo-500 text-white border-indigo-500"
                        : "bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-300 border-indigo-200 dark:border-indigo-500/30 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 cursor-pointer"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
      <div>
        <p className="text-xs text-gray-400 mb-1.5">Marca</p>
        <div className="flex gap-1 flex-wrap">
          {BRANDS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setBrand(value)}
              className={`${pillBase} cursor-pointer ${filters.brand === value ? pillActive : pillInactive}`}
            >
              {value === "total" ? "Todas" : label}
            </button>
          ))}
        </div>
      </div>
      {!brandOnly && (
        <div>
          <p className="text-xs text-gray-400 mb-1.5">Período</p>
          <div className="flex gap-1 flex-wrap">
            {PERIODS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setPeriod(value)}
                className={`${pillBase} cursor-pointer ${filters.period === value ? pillActive : pillInactive}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
