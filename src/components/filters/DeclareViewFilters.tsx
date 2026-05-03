/**
 * components/filters/DeclareViewFilters.tsx
 *
 * Componente declarativo: cada Page lo monta una vez con su `support` para
 * que el AppHeader renderice los 3 filtros globales con el comportamiento
 * correcto (qué se habilita, qué se deshabilita con qué razón).
 *
 * Uso:
 *
 *   <DeclareViewFilters support={ALL_FILTERS_ENABLED} />
 *
 *   <DeclareViewFilters support={{
 *     brand: true,
 *     channel: FILTER_REASONS.noChannelInventory,
 *     period: FILTER_REASONS.noPeriodLogistics,
 *   }} />
 *
 * Pages que NO usan filtros (calendario/usuarios/comisiones/ayuda) simplemente
 * NO montan este componente — el header no muestra la barra de filtros.
 *
 * El cleanup en unmount resetea support → null para que al cambiar de ruta no
 * persista el support de la vista anterior.
 */
import { useContext, useEffect } from "react";
import { ViewFilterSupportContext } from "@/context/viewFilters.context";
import type { ViewFilterSupport } from "@/domain/filters/viewSupport";

interface DeclareViewFiltersProps {
  support: ViewFilterSupport;
}

export default function DeclareViewFilters({ support }: DeclareViewFiltersProps) {
  const ctx = useContext(ViewFilterSupportContext);
  if (!ctx) {
    throw new Error("DeclareViewFilters debe estar dentro de <ViewFilterSupportProvider>");
  }
  const { setSupport } = ctx;

  // Serializamos para depender del VALOR, no de la referencia: si una Page
  // pasa siempre el mismo `support` (objeto literal), el render no debe
  // re-disparar setSupport. JSON.stringify es trivialmente cheap para 3 keys.
  const supportKey = JSON.stringify(support);

  useEffect(() => {
    setSupport(JSON.parse(supportKey) as ViewFilterSupport);
    return () => setSupport(null);
  }, [setSupport, supportKey]);

  return null;
}
