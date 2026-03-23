/**
 * features/executive/components/ExecutiveFilters.tsx
 *
 * 4 selects: Total, B2C, B2B (cada uno con marcas adentro) + YTD (períodos).
 * Al elegir una marca desde un canal, se setea canal + marca.
 */
import { useFilters } from "@/context/FilterContext";
import type { BrandFilter, ChannelFilter, PeriodFilter } from "@/domain/filters/types";

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
const selectActive =
  `${selectBase} border-brand-500 bg-brand-50 text-gray-900 dark:border-brand-500 dark:bg-gray-800 dark:text-gray-100`;

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

  function handleChannelBrand(channel: ChannelFilter, brandValue: string) {
    setChannel(channel);
    setBrand(brandValue as BrandFilter);
  }

  // Valor compuesto: si el canal activo coincide, mostrar la marca seleccionada; si no, "header" del canal
  function channelSelectValue(channel: ChannelFilter) {
    if (filters.channel !== channel) return "__header__";
    // Si brand es "total" (Todas), mostrar el header del canal
    if (filters.brand === "total") return "__header__";
    return filters.brand;
  }

  const btnBase = "px-3 py-1.5 text-xs font-medium transition-colors";
  const btnActive = `${btnBase} bg-brand-500 text-white`;
  const btnInactive = `${btnBase} bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700`;

  return (
    <>
      {/* ── Desktop: botones agrupados + select YTD (como estaba) ── */}
      <div className="hidden lg:flex items-center gap-2">
        <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          {(["total", "b2c", "b2b"] as ChannelFilter[]).map((ch) => (
            <button
              key={ch}
              onClick={() => setChannel(ch)}
              className={filters.channel === ch ? btnActive : btnInactive}
            >
              {ch === "total" ? "Total" : ch.toUpperCase()}
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

      {/* ── Mobile: 4 selects (Total, B2C, B2B, YTD) ── */}
      <div className="exec-mobile-filters flex items-center gap-2 lg:hidden">
        {/* Select 1: Total */}
        <div className="relative">
          <select
            value="__header__"
            onChange={(e) => handleChannelBrand("total", e.target.value)}
            className={filters.channel === "total" ? selectActive : selectInactive}
          >
            <option value="__header__" disabled hidden>Total</option>
            <option value="total">Todas</option>
            {BRANDS.filter(b => b.value !== "total").map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <Arrow />
        </div>

        {/* Select 2: B2C */}
        <div className="relative">
          <select
            value="__header__"
            onChange={(e) => handleChannelBrand("b2c", e.target.value)}
            className={filters.channel === "b2c" ? selectActive : selectInactive}
          >
            <option value="__header__" disabled hidden>B2C</option>
            <option value="total">Todas</option>
            {BRANDS.filter(b => b.value !== "total").map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <Arrow />
        </div>

        {/* Select 3: B2B */}
        <div className="relative">
          <select
            value="__header__"
            onChange={(e) => handleChannelBrand("b2b", e.target.value)}
            className={filters.channel === "b2b" ? selectActive : selectInactive}
          >
            <option value="__header__" disabled hidden>B2B</option>
            <option value="total">Todas</option>
            {BRANDS.filter(b => b.value !== "total").map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <Arrow />
        </div>

        {/* Select 4: YTD */}
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
