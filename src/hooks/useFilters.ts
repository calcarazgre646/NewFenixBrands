import { useContext } from "react";
import { FilterContext, type FilterContextValue } from "@/context/filter.context";

/** Hook para leer y actualizar filtros desde cualquier componente */
export function useFilters(): FilterContextValue {
  const ctx = useContext(FilterContext);
  if (!ctx) throw new Error("useFilters must be used within FilterProvider");
  return ctx;
}
