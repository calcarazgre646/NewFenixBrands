# PLAN DE AUDITORIA INTEGRAL — NewFenixBrands v2

**Fecha:** 2026-03-07
**Objetivo:** Evaluar si el proyecto pasa el estandar de un ingeniero senior de empresa de software de primer nivel. Auditar de punta a punta cada feature, dimension tecnica y aspecto de calidad.
**Criterio:** Cada dimension se califica 1-10 con hallazgos especificos y veredicto PASS/WARN/FAIL.

---

## FASE 1: ARQUITECTURA Y ESTRUCTURA (Macro)

### 1.1 Separacion de capas
- [ ] Verificar que `domain/` no importa React ni Supabase (0 side effects)
- [ ] Verificar que `queries/` no importa domain logic (solo fetch + normalize)
- [ ] Verificar que `features/*/hooks/` son el unico puente entre queries y domain
- [ ] Verificar que `features/*/components/` son props-driven (no fetch directo)
- [ ] Buscar violaciones: grep imports cruzados entre capas

### 1.2 Consistencia de patrones
- [ ] Cada feature sigue el patron: Page.tsx + hooks/ + components/
- [ ] Cada hook usa useQuery de TanStack con keys de `queries/keys.ts`
- [ ] Cada query usa `dataClient` o `authClient` correctamente
- [ ] No hay logica de negocio duplicada entre features

### 1.3 Dependencias y acoplamiento
- [ ] Revisar package.json: deps innecesarias, versiones conflictivas, deps sin usar
- [ ] Verificar que no hay circular dependencies
- [ ] Verificar tree-shaking: imports selectivos vs barrel imports pesados

### 1.4 Configuracion del proyecto
- [ ] tsconfig.json: strict mode, paths, target adecuado
- [ ] vite.config.ts: plugins, optimizaciones
- [ ] vitest.config.ts: coverage scope correcto
- [ ] Verificar que NO existe eslint config (hallazgo inicial) — evaluar impacto

---

## FASE 2: SEGURIDAD

### 2.1 Credenciales y secretos
- [ ] .env.local: verificar que NO esta en git (check .gitignore)
- [ ] Buscar hardcoded secrets en src/ (grep URLs supabase, keys, tokens)
- [ ] Verificar que .env.example existe con placeholders (no valores reales)
- [ ] Verificar que Supabase anon keys no estan en codigo fuente

### 2.2 Autenticacion
- [ ] AuthContext: manejo de sesion, refresh token, timeout
- [ ] AuthGuard: protege TODAS las rutas privadas (no solo algunas)
- [ ] SignInPage: sanitizacion de inputs, rate limiting client-side
- [ ] Verificar que no hay rutas publicas accidentales
- [ ] Logout: limpia estado global (filters, cache, session)

### 2.3 Autorizacion y RLS
- [ ] Evaluar si Supabase tiene RLS habilitado (documentar estado)
- [ ] Evaluar si hay roles de usuario o es single-tenant
- [ ] Verificar que las queries no exponen datos de otros tenants

### 2.4 Seguridad frontend
- [ ] XSS: inputs sanitizados, dangerouslySetInnerHTML ausente o controlado
- [ ] CSRF: evaluar si aplica (SPA + Supabase JWT)
- [ ] Content Security Policy: verificar headers (via vercel.json o meta tags)
- [ ] Dependencias con vulnerabilidades conocidas: `npm audit`

---

## FASE 3: PERFORMANCE Y BUNDLE

### 3.1 Bundle analysis
- [ ] Identificar chunks >200KB y su causa raiz
- [ ] `budget.queries` = 580KB — POR QUE? Investigar
- [ ] `index` = 486KB — evaluar si se puede splitear
- [ ] `CalendarPage` = 279KB — FullCalendar es pesado, evaluar lazy load
- [ ] Verificar code-splitting: React.lazy + Suspense en rutas
- [ ] Verificar tree-shaking de ApexCharts, FullCalendar, Supabase

### 3.2 Queries y red
- [ ] Revisar staleTime y cacheTime de TanStack Query (QueryClient config)
- [ ] Evaluar si hay over-fetching (traer mas datos de los necesarios)
- [ ] Verificar paginacion: fetchAllRows() — cuantas filas trae por feature
- [ ] Evaluar queries paralelas vs secuenciales (Promise.all donde corresponde)
- [ ] Verificar que no hay N+1 queries (fetch en loop)
- [ ] Medir tamaño de payload de cada query principal (sales, inventory, etc.)

### 3.3 Renderizado
- [ ] Buscar re-renders innecesarios (contextos amplios que causan cascada)
- [ ] Verificar memo/useMemo/useCallback donde hay calculo costoso
- [ ] Verificar que tablas grandes usan virtualizacion o paginacion
- [ ] Evaluar si FilterContext causa re-render global en cada cambio

### 3.4 Assets y carga
- [ ] Verificar que imagenes/iconos estan optimizados
- [ ] Verificar que CSS no tiene imports innecesarios de Tailwind
- [ ] Verificar que fonts se cargan eficientemente

---

## FASE 4: CALIDAD DE CODIGO

### 4.1 TypeScript strictness
- [ ] Confirmar `strict: true` en tsconfig
- [ ] Buscar `any` types en el codigo (grep "any" en .ts/.tsx)
- [ ] Buscar `@ts-ignore` o `@ts-expect-error`
- [ ] Buscar type assertions inseguras (`as any`, `as unknown as X`)
- [ ] Verificar que interfaces/types estan bien definidos (no Record<string, any>)

### 4.2 Error handling
- [ ] Cada query tiene manejo de error (TanStack Query `error` state)
- [ ] Cada pagina muestra estado de error al usuario
- [ ] Hay Error Boundary global? (React error boundary)
- [ ] Supabase errors: se manejan o se propagan silenciosamente?
- [ ] Network failures: que pasa si Supabase esta caido?

### 4.3 Consistencia y DRY
- [ ] No hay logica de calculo duplicada entre hooks
- [ ] No hay fetch functions duplicadas entre queries
- [ ] Formateo de moneda/porcentaje centralizado en utils/format.ts
- [ ] Normalizacion centralizada en api/normalize.ts (no inline en queries)

### 4.4 Codigo muerto y deuda
- [ ] Buscar archivos no importados (dead code)
- [ ] Buscar funciones exportadas pero no usadas
- [ ] Buscar componentes del template TailAdmin no usados
- [ ] Evaluar cantidad de codigo template vs codigo propio

### 4.5 Naming conventions
- [ ] Archivos: kebab-case o PascalCase consistente
- [ ] Funciones/hooks: camelCase
- [ ] Types/Interfaces: PascalCase
- [ ] Constantes: UPPER_SNAKE_CASE
- [ ] Query keys: patron consistente

---

## FASE 5: TESTING

### 5.1 Cobertura actual
- [ ] 198 tests en 5 archivos — que cubren exactamente?
- [ ] Ejecutar coverage report: que porcentaje del domain/ esta cubierto?
- [ ] Que porcentaje de queries/ esta cubierto? (probablemente 0%)
- [ ] Que porcentaje de hooks esta cubierto? (probablemente 0%)

### 5.2 Calidad de tests
- [ ] Tests cubren edge cases (division por 0, null, arrays vacios)?
- [ ] Tests de contrato (fenix.contract.test.ts) — que validan exactamente?
- [ ] Tests son deterministas (no dependen de fecha actual, random, etc.)?
- [ ] Tests son rapidos (<1s total)?

### 5.3 Gaps criticos
- [ ] Waterfall algorithm (actionQueue/waterfall.ts) tiene tests?
- [ ] Logistics domain (arrivals.ts) tiene tests?
- [ ] Executive calcs (calcs.ts) tiene tests?
- [ ] Normalization tiene tests? (si — normalize.test.ts)
- [ ] Period resolution tiene tests? (si — resolve.test.ts)

### 5.4 Estrategia de testing
- [ ] Evaluar necesidad de integration tests (hooks + queries mock)
- [ ] Evaluar necesidad de E2E tests (Playwright/Cypress)
- [ ] Evaluar necesidad de visual regression tests

---

## FASE 6: FEATURE-BY-FEATURE AUDIT

Para CADA feature, verificar:
- Flujo de datos completo (query → hook → component)
- Manejo de loading/error/empty states
- Filtros funcionan correctamente
- Responsive design
- Accesibilidad basica (aria labels, keyboard nav, contraste)

### 6.1 SignInPage (`/signin`)
- [ ] Login flow completo (email + password → Supabase → redirect)
- [ ] Error handling (credenciales invalidas, red caida)
- [ ] No se puede acceder a rutas protegidas sin auth
- [ ] Despues de login, redirige a `/`

### 6.2 ExecutivePage (`/`)
- [ ] Road to Annual Target: datos correctos, grafico acumulado
- [ ] Tabla mensual: meses cerrados vs parcial, badges
- [ ] Filtros: marca, canal afectan los datos
- [ ] Period resolution: YTD, mes actual, ultimo cerrado

### 6.3 KpiDashboardPage (`/kpis`)
- [ ] 9 KPIs renderizan con datos
- [ ] Cada KPI card muestra: valor, YoY, trend, sparkline
- [ ] Filtros globales afectan todos los KPIs
- [ ] Loading skeletons mientras carga

### 6.4 SalesPage (`/ventas`)
- [ ] 4 tabs: Marcas, Canal/Zonas, Comportamiento, SKUs
- [ ] Cada tab muestra datos correctos por periodo seleccionado
- [ ] Filtros: marca, canal, periodo, tienda
- [ ] Charts: ApexCharts renderizan sin errores

### 6.5 ActionQueuePage (`/acciones`)
- [ ] Waterfall algorithm produce resultados coherentes
- [ ] 13+ columnas en tabla: SKU, talle, tienda, stock, riesgo, etc.
- [ ] Filtros: marca, linea, categoria, riesgo, nivel waterfall
- [ ] Export HTML: genera archivo descargable
- [ ] Pareto 20/80: flag correcto en items

### 6.6 LogisticsPage (`/logistica`)
- [ ] Summary cards: ordenes, unidades, proxima llegada
- [ ] Tabla agrupada expandible
- [ ] Badges de estado (Pasado, Este Mes, Prox. Mes)
- [ ] Filtros: marca, categoria, toggle pasados

### 6.7 CalendarPage (`/calendario`)
- [ ] FullCalendar renderiza (Mes, Semana, Dia, Ano)
- [ ] CRUD: crear, editar, eliminar eventos
- [ ] Drag & drop + resize
- [ ] Supabase Realtime: cambios se reflejan live
- [ ] Categorias con colores editables

---

## FASE 7: MANTENIBILIDAD Y ESCALABILIDAD

### 7.1 Documentacion
- [ ] CLAUDE.md: actualizado, util para onboarding
- [ ] ARCHITECTURE.md: refleja la realidad del codigo
- [ ] NEXT_FEATURES.md: coherente con el estado actual
- [ ] Comentarios en codigo: solo donde la logica no es obvia

### 7.2 Escalabilidad horizontal
- [ ] Agregar un KPI nuevo: cuantos archivos hay que tocar?
- [ ] Agregar una pagina nueva: cuantos archivos?
- [ ] Agregar un filtro nuevo: cuantos archivos?
- [ ] El patron es claro para un dev nuevo?

### 7.3 Deuda tecnica
- [ ] Inventario completo de TODOs/FIXMEs en codigo
- [ ] Codigo template TailAdmin sin usar (peso muerto)
- [ ] Budget_2026 hardcodeado — plan para 2027?
- [ ] SettingsPage sin implementar — impacto?

### 7.4 Operaciones y observabilidad
- [ ] Hay logging estructurado? (console.log vs servicio)
- [ ] Hay error tracking? (Sentry o similar)
- [ ] Hay analytics de uso? (Posthog, Mixpanel, etc.)
- [ ] Hay health check o status page?

---

## FASE 8: BASE DE DATOS Y QUERIES SQL

### 8.1 Schema
- [ ] Indices creados (001_indices_y_vistas.sql) — verificar existencia en BD
- [ ] Vistas materializadas: mv_stock_tienda, mv_ventas_12m — refresh schedule?
- [ ] Bug v_inventario cartesiano: esta fixeado en produccion?
- [ ] FK constraints: existen o son solo convenciones?

### 8.2 Queries desde el app
- [ ] Cada query en queries/ — es eficiente? Usa indices?
- [ ] Hay queries que traen SELECT * cuando solo necesitan 3 columnas?
- [ ] fetchAllRows() — cuantas paginas trae? Hay tablas que no lo necesitan?
- [ ] Hay queries sin filtro de ano/mes que scanean toda la tabla?

### 8.3 Seguridad BD
- [ ] RLS policies: estado actual
- [ ] Service role key vs anon key: cual se usa?
- [ ] Hay datos sensibles expuestos (PII de clientes)?
- [ ] CLIM100 (82K clientes con RUC): esta protegida?

---

## RESUMEN DE EJECUCION

| Fase | Dimension | Prioridad | Esfuerzo estimado |
|------|-----------|-----------|-------------------|
| 1 | Arquitectura | Alta | Revision de codigo |
| 2 | Seguridad | Critica | Grep + revision manual |
| 3 | Performance | Alta | Bundle analysis + profiling |
| 4 | Calidad codigo | Alta | Grep + revision manual |
| 5 | Testing | Media | Coverage + gap analysis |
| 6 | Feature audit | Alta | Revision de cada feature |
| 7 | Mantenibilidad | Media | Evaluacion cualitativa |
| 8 | Base de datos | Alta | Revision SQL + queries |

**Entregable final:** Reporte con score por dimension, hallazgos criticos, y plan de remediacion priorizado.
