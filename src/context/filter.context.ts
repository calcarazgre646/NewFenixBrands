/**
 * context/filterContext.ts
 *
 * React Context + value type para filtros globales.
 * Separado del Provider para que `react-refresh` pueda hacer HMR del Provider.
 */
import { createContext } from "react";
import type {
  AppFilters,
  BrandFilter,
  ChannelFilter,
  PeriodFilter,
} from "@/domain/filters/types";

export interface FilterContextValue {
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

export const FilterContext = createContext<FilterContextValue | undefined>(undefined);
