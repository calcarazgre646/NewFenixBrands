/**
 * lib/queryClient.ts
 *
 * Configuración central de TanStack Query.
 *
 * staleTime: tiempo antes de considerar un dato "stale" (requiere refetch).
 *   - Datos de ventas: 5 min (el ETL no actualiza más seguido)
 *   - Inventario: 10 min (snapshot del día)
 *   - Presupuesto: 60 min (cambia rarísimo)
 *   - Maestros (tiendas): 30 min (casi nunca cambia)
 *
 * gcTime: tiempo que los datos se mantienen en memoria inactivos.
 *
 * BENEFICIOS vs cache artesanal del proyecto anterior:
 *   - Deduplicación automática de queries en vuelo (si dos componentes piden
 *     lo mismo al mismo tiempo, solo se hace UN fetch)
 *   - Background refetch cuando la ventana recupera foco
 *   - Loading/error states consistentes en toda la app
 *   - DevTools en desarrollo para inspeccionar cache
 */
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Default: 5 min — aplica a ventas y KPIs
      staleTime: 5 * 60 * 1_000,
      // Datos en memoria por 30 min aunque el componente se desmonte
      gcTime: 30 * 60 * 1_000,
      // Un solo retry en caso de error de red
      retry: 1,
      retryDelay: (attempt) => Math.min(1_000 * 2 ** attempt, 10_000),
      // Refetch cuando la ventana recupera foco (útil para sesiones largas)
      refetchOnWindowFocus: false,
      // No refetch al reconnect: datos cacheados son válidos.
      // "always" refetcheaba incluso datos fresh, causando re-paginación de
      // fjdhstvta1 sin ORDER BY → totales distintos → YoY inconsistente.
      refetchOnReconnect: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

// ─── staleTime específicos por tipo de dato ───────────────────────────────────
// Usar estos valores en los hooks con: useQuery({ ..., staleTime: STALE_TIMES.inventory })

export const STALE_TIMES = {
  sales:     5  * 60 * 1_000,  // 5 min
  inventory: 10 * 60 * 1_000,  // 10 min
  budget:    60 * 60 * 1_000,  // 1 hora
  stores:    30 * 60 * 1_000,  // 30 min
  tickets:   5  * 60 * 1_000,  // 5 min (mismo que ventas)
  logistics: 15 * 60 * 1_000,  // 15 min
  calendar:  10 * 60 * 1_000,  // 10 min
} as const;
