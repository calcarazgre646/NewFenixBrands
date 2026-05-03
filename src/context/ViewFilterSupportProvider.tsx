/**
 * context/ViewFilterSupportProvider.tsx
 *
 * Provider para el "support" de filtros globales declarado por la Page activa.
 * Vive dentro de AppLayout, una sola instancia.
 */
import { useMemo, useState, type ReactNode } from "react";
import {
  ViewFilterSupportContext,
  type ViewFilterSupportContextValue,
} from "@/context/viewFilters.context";
import type { ViewFilterSupport } from "@/domain/filters/viewSupport";

export function ViewFilterSupportProvider({ children }: { children: ReactNode }) {
  const [support, setSupport] = useState<ViewFilterSupport | null>(null);
  const value = useMemo<ViewFilterSupportContextValue>(() => ({ support, setSupport }), [support]);
  return (
    <ViewFilterSupportContext.Provider value={value}>
      {children}
    </ViewFilterSupportContext.Provider>
  );
}
