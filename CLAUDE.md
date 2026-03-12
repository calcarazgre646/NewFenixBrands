# NewFenixBrands — Contexto para el Agente

## Mision del proyecto

Reconstruccion completa de FenixBrands (plataforma analytics para empresa de indumentaria paraguaya: marcas Martel, Wrangler, Lee). El proyecto viejo tenia logica de negocio duplicada, queries mezcladas con UI y 0 tests. Este proyecto reconstruye todo con arquitectura limpia.

**Stack:** React 19 + TypeScript + Vite + Tailwind CSS v4 + TanStack Query v5 + Supabase + React Router v7

**Proyecto viejo (SOLO como referencia de UI y logica de negocio):** `/Users/prueba/Downloads/FenixBrands`
→ Ver `docs/OLD_PROJECT_REFERENCE.md` antes de mirar el viejo.

---

## Estado actual (actualizado 12/03/2026)

| Fase | Feature | Estado |
|------|---------|--------|
| Infra | Rutas, layout, auth, contextos, queries, domain logic (82 tests) | ✅ COMPLETO |
| 0 | SignInPage | ✅ COMPLETO |
| 1 | KpiDashboardPage (`/kpis`) — Grid de 9 KPIs con fetch-wide/filter-local | ✅ COMPLETO |
| 1B | ExecutivePage (`/`) — Road to Annual Target, chart acumulado, tabla mensual | ✅ COMPLETO |
| 2 | SalesPage (`/ventas`) — Metricas, 4 tabs analytics (Marcas, Canal/Zonas, Comportamiento, SKUs) | ✅ COMPLETO |
| 3 | ActionQueuePage (`/acciones`) — Waterfall 4 niveles, vista agrupada (Tienda/Marca/Lista), export HTML | ✅ COMPLETO + AUDITADO |
| 4 | LogisticsPage (`/logistica`) — ETAs importacion, tabla agrupada, filtros, summary cards | ✅ COMPLETO + AUDITADO |
| 5 | CalendarPage (`/calendario`) — FullCalendar + CRUD + Realtime + vista Ano | ✅ COMPLETO |
| 6 | SettingsPage (`/configuracion`) — DEUDA: sin spec, sin ruta, requiere definicion del cliente | ⬜ DEUDA |

**La app corre:** `npm run dev` → http://localhost:5173
**Tests:** 480 passing (12 suites) | TSC 0 errores | Build OK | ESLint 0 errors
**Última auditoría profunda:** 12/03/2026 — Score 9.0/10 — 7 ESLint errors→0, split monolito, error boundaries, 47 tests nuevos
**Sesión 12/03/2026 01:25:** Transparent Loading UX para ActionQueuePage (ver abajo)

---

## Proximo trabajo

**Deuda Fase 6:** SettingsPage — no existe spec, ruta ni stub. Posible contenido:
- Perfil de usuario (nombre, foto, cambiar contraseña)
- Preferencias de app (tema claro/oscuro)
- Gestion de usuarios/roles
- Configuracion de alertas/notificaciones
- **Requiere definicion de Rodrigo/Derlys antes de implementar**

---

## Reglas de arquitectura (NO negociar)

1. **Queries** en `src/queries/` → solo fetch + normalizacion, sin logica de negocio
2. **Calculos** en `src/domain/kpis/calculations.ts` → funciones puras, ya existentes
3. **Hooks** en `src/features/[feature]/hooks/` → unen queries + domain logic
4. **Componentes** en `src/features/[feature]/components/` → solo UI, sin logica
5. **Filtros globales** via `useFilters()` → nunca estado local de filtros en paginas
6. **Periodos** via `resolvePeriod()` → nunca calcular meses manualmente
7. **Porcentajes** siempre en escala 0-100 (no 0-1)
8. **Division por 0** → siempre retorna 0 (ya manejado en calculations.ts)

---

## Archivos criticos a conocer

```
src/
  api/normalize.ts              — Frontera ERP→app (parsers, normalizeBrand, classifyStore)
  api/client.ts                 — dataClient (BD operacional) + authClient (auth)
  domain/filters/types.ts       — AppFilters, PeriodFilter, BrandFilter, ChannelFilter
  domain/kpis/calculations.ts   — TODAS las formulas KPI puras (12 funciones)
  domain/period/resolve.ts      — resolvePeriod() — fuente de verdad de periodos
  domain/actionQueue/waterfall.ts — Algoritmo waterfall puro (4 niveles)
  domain/actionQueue/clusters.ts  — Clusters de tiendas (A/B/OUT) + restricciones horarias
  domain/actionQueue/grouping.ts  — Agrupacion pura por tienda/marca
  domain/logistics/types.ts      — Tipos logística (ArrivalStatus, LogisticsGroup, etc.)
  domain/logistics/arrivals.ts   — Funciones puras: toArrivals, groupArrivals, computeSummary
  context/FilterContext.tsx     — useFilters() — estado global de filtros
  queries/sales.queries.ts      — fetchMonthlySales, fetchDailyDetail, fetchBrandBreakdown...
  queries/inventory.queries.ts  — fetchInventory, fetchInventoryValue
  queries/salesHistory.queries.ts — fetchSalesHistory (6m promedio por tienda+SKU)
  queries/tickets.queries.ts    — fetchTickets (AOV diario)
  queries/logistics.queries.ts  — fetchLogisticsImports (tabla Import, ETAs)
  queries/budget.queries.ts     — fetchBudget
  queries/keys.ts               — Query key factories para TanStack Query
```

---

## Docs detallados

- `docs/ARCHITECTURE.md` — Arquitectura completa, convenciones, patrones
- `docs/NEXT_FEATURES.md` — Spec de features (fases 1-4 completadas, ver estado arriba)
- `docs/OLD_PROJECT_REFERENCE.md` — Como y cuando usar el proyecto viejo como referencia
- `docs/AUDIT_WATERFALL_CORE_2026-03-08.md` — Auditoria end-to-end del algoritmo SISO/waterfall (8 bugs corregidos, flujo de datos completo, campos usados/no usados, preguntas pendientes cliente)
- `docs/AUDIT_INTEGRAL_2026-03-11.md` — Auditoria integral completa (428 tests, 16 hallazgos, score 8.5/10)
- `docs/PREGUNTAS_CLIENTE_COLA_ACCIONES.md` — 5+3 preguntas pendientes para Rodrigo/Derlys

---

## Sesión 12/03/2026 01:25 — Transparent Loading UX (ActionQueuePage)

**Objetivo:** Transformar la latencia de carga de la Cola de Acciones en parte de la UX en vez de ocultarla con un skeleton genérico.

**Patrón:** Process Transparency — Live Activity Feed, Ambient Motion, Staggered Reveal, Progress Theater.

### Archivos creados/modificados

| Archivo | Cambio |
|---------|--------|
| `src/features/action-queue/hooks/useActionQueue.ts` | Agregado `LoadingPhase`, `LoadingProgress` types y `loadingProgress` computed property con fases granulares: `fetching-inventory` → `processing-records` → `fetching-history` → `computing-waterfall` → `done` |
| `src/features/action-queue/components/ActionQueueLoader.tsx` | **NUEVO.** Componente de carga transparente: icono spinning + título "Definiendo Acciones", 4 phase step cards con indicadores (done/active/pending), activity log con mensajes contextuales drip-fed, 2 counter pills (Registros, SKUs), 5 floating cards ambient con colores de marca |
| `src/index.css` | 6 keyframes CSS: `aq-float`, `aq-fade-in`, `aq-slide-in`, `aq-ping`, `aq-pulse`, `aq-spin-slow` |
| `src/features/action-queue/ActionQueuePage.tsx` | Reemplazado `<PageSkeleton />` por `<ActionQueueLoader progress={loadingProgress} />` |

### Ajustes de refinamiento
- Icono spinner movido a la izquierda del título (inline flex)
- Activity log limitado a ~3 bullets visibles con `max-h-[92px]` + `overflow-y-auto`
- Phase step cards sin `maxHeight` fijo (no se rompen al pasar a verde/check)
- Floating cards redistribuidas a esquinas del viewport (sin superposición con contenido central)
- Composición centrada verticalmente con `h-[calc(100vh-4rem)]` + `pb-[12vh]` para centro óptico
- Eliminada pill "Acciones" (nunca muestra cifra durante loading)
- Título cambiado a "Definiendo Acciones"

**Verificación:** TSC 0 errores | Build OK | ESLint 0 errors | 480 tests passing
