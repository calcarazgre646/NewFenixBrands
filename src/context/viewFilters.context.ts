/**
 * context/viewFilters.context.ts
 *
 * Context que permite que cada Page declare qué filtros globales soporta,
 * y que el AppHeader (donde viven los 3 dropdowns junto al buscador) los
 * renderice con el `support` correcto.
 *
 * Pages declaran via <DeclareViewFilters support={...} />.
 * AppHeader consume con useViewFilterSupport().
 *
 * Separado del Provider para que `react-refresh` pueda hacer HMR del Provider.
 */
import { createContext } from "react";
import type { ViewFilterSupport } from "@/domain/filters/viewSupport";

export interface ViewFilterSupportContextValue {
  support: ViewFilterSupport | null;
  setSupport: (support: ViewFilterSupport | null) => void;
}

export const ViewFilterSupportContext = createContext<ViewFilterSupportContextValue | undefined>(
  undefined,
);
