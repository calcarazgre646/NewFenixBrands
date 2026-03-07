/**
 * context/FilterContext.tsx
 *
 * Estado global de filtros de la app.
 *
 * REGLA: Este es el ÚNICO lugar donde se guarda el estado de filtros.
 * Ningún componente ni hook tiene estado de filtros propio excepto
 * filtros estrictamente locales (ej: una tab de una sección específica).
 *
 * Cuando un filtro cambia:
 *   1. FilterContext actualiza el estado
 *   2. Los hooks consumen useFilters() → reciben los nuevos filtros
 *   3. TanStack Query detecta el cambio en la query key → refetch automático
 *   4. Los componentes reciben datos actualizados
 *
 * No hay propagación manual. No hay useEffect de sincronización.
 */
import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import {
  DEFAULT_FILTERS,
  type AppFilters,
  type BrandFilter,
  type ChannelFilter,
  type PeriodFilter,
} from "@/domain/filters/types";

interface FilterContextValue {
  filters: AppFilters;
  setBrand:   (brand: BrandFilter) => void;
  setChannel: (channel: ChannelFilter) => void;
  setStore:   (store: string | null) => void;
  setPeriod:  (period: PeriodFilter) => void;
  setYear:    (year: number) => void;
  resetFilters: () => void;
}

const FilterContext = createContext<FilterContextValue | undefined>(undefined);

export function FilterProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<AppFilters>(DEFAULT_FILTERS);

  const setBrand = useCallback((brand: BrandFilter) => {
    setFilters((prev) => ({ ...prev, brand }));
  }, []);

  const setChannel = useCallback((channel: ChannelFilter) => {
    // Al cambiar canal, resetear tienda seleccionada (puede no pertenecer al nuevo canal)
    setFilters((prev) => ({ ...prev, channel, store: null }));
  }, []);

  const setStore = useCallback((store: string | null) => {
    setFilters((prev) => ({ ...prev, store }));
  }, []);

  const setPeriod = useCallback((period: PeriodFilter) => {
    setFilters((prev) => ({ ...prev, period }));
  }, []);

  const setYear = useCallback((year: number) => {
    setFilters((prev) => ({ ...prev, year }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  return (
    <FilterContext.Provider
      value={{ filters, setBrand, setChannel, setStore, setPeriod, setYear, resetFilters }}
    >
      {children}
    </FilterContext.Provider>
  );
}

/** Hook para leer y actualizar filtros desde cualquier componente */
export function useFilters(): FilterContextValue {
  const ctx = useContext(FilterContext);
  if (!ctx) throw new Error("useFilters must be used within FilterProvider");
  return ctx;
}
