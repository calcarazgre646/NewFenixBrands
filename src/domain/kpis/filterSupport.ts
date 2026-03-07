/**
 * domain/kpis/filterSupport.ts
 *
 * Función pura que determina si un KPI es calculable dados los filtros activos.
 *
 * La lógica consulta el catálogo: cada KPI declara qué dimensiones de filtro soporta
 * según sus fuentes de datos. Si el usuario activa un filtro que el KPI no soporta,
 * el KPI se marca como no disponible con un mensaje descriptivo.
 *
 * Esto es ARQUITECTURAL: aplica a todos los KPIs presentes y futuros sin código ad-hoc.
 */
import { getKpiById } from './fenix.catalog'

export interface KpiAvailability {
  available: boolean
  /** Razón por la que el KPI no está disponible. undefined si available=true. */
  reason?: string
}

/**
 * Verifica si un KPI es calculable con los filtros activos del usuario.
 *
 * @param kpiId   - ID del KPI en el catálogo (e.g. 'aov', 'gmroi')
 * @param filters - Filtros activos: brand, channel, store
 * @returns       - { available: true } o { available: false, reason: "..." }
 */
export function checkKpiAvailability(
  kpiId: string,
  filters: { brand: string; channel: string; store: string | null },
): KpiAvailability {
  const spec = getKpiById(kpiId)
  if (!spec) return { available: false, reason: `KPI "${kpiId}" no existe en el catálogo` }

  const { supportedFilters } = spec
  const unsupported: string[] = []

  if (filters.brand !== 'total' && !supportedFilters.brand) {
    unsupported.push('marca')
  }
  if (filters.channel !== 'total' && !supportedFilters.channel) {
    unsupported.push('canal')
  }
  if (filters.store && !supportedFilters.store) {
    unsupported.push('tienda')
  }

  if (unsupported.length === 0) return { available: true }

  // Si NINGÚN filtro está soportado y todos están activos, es que el KPI no tiene datos
  const allFalse = !supportedFilters.brand && !supportedFilters.channel && !supportedFilters.store
  if (allFalse) {
    return {
      available: false,
      reason: spec.obs ?? 'Dato no disponible — fuente de datos pendiente',
    }
  }

  const filterNames = unsupported.join(', ')
  return {
    available: false,
    reason: `No disponible con filtro de ${filterNames} — la fuente de datos no lo soporta`,
  }
}
