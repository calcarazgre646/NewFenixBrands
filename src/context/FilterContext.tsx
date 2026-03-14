/**
 * context/FilterContext.tsx
 *
 * Estado global de filtros de la app.
 *
 * REGLA: Este es el ÚNICO lugar donde se guarda el estado de filtros.
 * Ningún componente ni hook tiene estado de filtros propio excepto
 * filtros estrictamente locales (ej: una tab de una sección específica).
 *
 * ROLES:
 *   - super_user / gerencia: filtros libres
 *   - negocio con channel_scope: canal bloqueado (no puede cambiarlo)
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
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import {
  DEFAULT_FILTERS,
  type AppFilters,
  type BrandFilter,
  type ChannelFilter,
  type PeriodFilter,
} from "@/domain/filters/types";
import { useAuth } from "@/context/AuthContext";

interface FilterContextValue {
  filters: AppFilters;
  setBrand:   (brand: BrandFilter) => void;
  setChannel: (channel: ChannelFilter) => void;
  setStore:   (store: string | null) => void;
  setPeriod:  (period: PeriodFilter) => void;
  setYear:    (year: number) => void;
  resetFilters: () => void;
  /** true si el filtro de canal está bloqueado por el rol del usuario */
  isChannelLocked: boolean;
}

const FilterContext = createContext<FilterContextValue | undefined>(undefined);

/**
 * Mapea channel_scope del perfil al ChannelFilter de la app.
 * Los sub-canales B2B se mapean a "b2b" por ahora (la data no distingue sub-canales aún).
 */
function scopeToChannel(scope: string | null): ChannelFilter {
  if (!scope || scope === "total") return "total";
  if (scope === "b2c") return "b2c";
  // b2b_mayoristas y b2b_utp → ambos son "b2b" en la data actual
  if (scope.startsWith("b2b")) return "b2b";
  return "total";
}

export function FilterProvider({ children }: { children: ReactNode }) {
  const { permissions } = useAuth();
  const isChannelLocked = permissions.isChannelLocked;
  const lockedChannel = permissions.lockedChannel;

  const [filters, setFilters] = useState<AppFilters>(() => {
    if (isChannelLocked && lockedChannel) {
      return { ...DEFAULT_FILTERS, channel: scopeToChannel(lockedChannel) };
    }
    return DEFAULT_FILTERS;
  });

  // Si el perfil se carga después del mount (async), sincronizar canal
  useEffect(() => {
    if (isChannelLocked && lockedChannel) {
      setFilters((prev) => ({
        ...prev,
        channel: scopeToChannel(lockedChannel),
        store: null,
      }));
    }
  }, [isChannelLocked, lockedChannel]);

  const setBrand = useCallback((brand: BrandFilter) => {
    setFilters((prev) => ({ ...prev, brand }));
  }, []);

  const setChannel = useCallback((channel: ChannelFilter) => {
    // Si el canal está bloqueado, ignorar el cambio
    if (isChannelLocked) return;
    // Al cambiar canal, resetear tienda seleccionada (puede no pertenecer al nuevo canal)
    setFilters((prev) => ({ ...prev, channel, store: null }));
  }, [isChannelLocked]);

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
    if (isChannelLocked && lockedChannel) {
      setFilters({ ...DEFAULT_FILTERS, channel: scopeToChannel(lockedChannel) });
    } else {
      setFilters(DEFAULT_FILTERS);
    }
  }, [isChannelLocked, lockedChannel]);

  // Memoizar el valor del contexto para evitar re-renders innecesarios
  const contextValue = useMemo<FilterContextValue>(
    () => ({ filters, setBrand, setChannel, setStore, setPeriod, setYear, resetFilters, isChannelLocked }),
    [filters, setBrand, setChannel, setStore, setPeriod, setYear, resetFilters, isChannelLocked]
  );

  return (
    <FilterContext.Provider value={contextValue}>
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
