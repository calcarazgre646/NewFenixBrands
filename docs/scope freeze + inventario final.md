Auditoría de Preparación para Externalización de Constantes y Reglas de 
  Negocio

  Proyecto: NewFenixBrands
  Estado: Producción · 985 tests (25 suites) · TSC 0 · Build OK
  Fecha: 2026-04-04

  ---
  A. Lectura Ejecutiva

  El proyecto tiene ~95 constantes y reglas de negocio distribuidas en 34
  archivos fuente. La buena noticia: la arquitectura ya centraliza la mayoría en
   src/domain/ (~70%). La mala: hay un 30% disperso en features, hooks, queries
  y SQL que crea acoplamiento invisible.

  Tamaño real del problema: MEDIANO. No es un caos — es un sistema bien
  organizado con focos de deuda técnica localizados y predecibles.

  Distribución:

  ┌────────────────────────┬────────────┬───────────────────────────────────┐
  │       Ubicación        │ Constantes │              Estado               │
  ├────────────────────────┼────────────┼───────────────────────────────────┤
  │ src/domain/ (33        │ ~65        │ Ya centralizadas, pero no         │
  │ archivos)              │            │ externalizables sin romper tests  │
  ├────────────────────────┼────────────┼───────────────────────────────────┤
  │ src/features/ (11      │ ~18        │ Dispersas, duplicadas en 3 casos  │
  │ dirs)                  │            │                                   │
  ├────────────────────────┼────────────┼───────────────────────────────────┤
  │ src/api/normalize.ts   │ ~5         │ Críticas — mapping de marcas y    │
  │                        │            │ tiendas                           │
  ├────────────────────────┼────────────┼───────────────────────────────────┤
  │ sql/ (5+ migrations)   │ ~7         │ Hardcoded en SQL — las más        │
  │                        │            │ difíciles de mover                │
  └────────────────────────┴────────────┴───────────────────────────────────┘

  Riesgo test: 28% del suite (FRAGILE-DIRECT + FRAGILE-INDIRECT) rompe si
  cambian valores de negocio. El 72% es sólido o acoplado-seguro.

  ---
  B. Inventario Consolidado

  B1. Escalas de Comisiones (ALTA probabilidad de cambio)

  Archivo: domain/commissions/scales.ts:13-133
  Símbolo: 8 CommissionScale (56 tiers)
  Dominio: Compensación
  Consumidores: useCommissions hook, CommissionsPage
  Tests: 41 tests directos
  Fase: Migración cuidada
  ────────────────────────────────────────
  Archivo: domain/commissions/scales.ts:152-160
  Símbolo: ROLE_LABELS, CHANNEL_LABELS
  Dominio: Compensación/UI
  Consumidores: CommissionsPage, exports
  Tests: Indirectos
  Fase: Quick win
  ────────────────────────────────────────
  Archivo: domain/commissions/storeMapping.ts:13-21
  Símbolo: classifyStoreForCommission()
  Dominio: Compensación
  Consumidores: useCommissions
  Tests: 5 tests
  Fase: Migración cuidada

  B2. Clusters de Tiendas y Operaciones (ALTA probabilidad de cambio)

  Archivo: domain/actionQueue/clusters.ts:17-43
  Símbolo: STORE_CLUSTERS (A/B/OUT, 20 tiendas)
  Dominio: Distribución
  Consumidores: waterfall, ActionGroupCard, exports
  Tests: Indirectos
  Fase: Migración cuidada
  ────────────────────────────────────────
  Archivo: domain/actionQueue/clusters.ts:50-64
  Símbolo: STORE_ASSORTMENT (capacidad por tienda)
  Dominio: Distribución
  Consumidores: waterfall
  Tests: Indirectos
  Fase: Migración cuidada
  ────────────────────────────────────────
  Archivo: domain/actionQueue/clusters.ts:71-75
  Símbolo: CLUSTER_PRICE_MIX (normal/sale/outlet %)
  Dominio: Pricing
  Consumidores: waterfall
  Tests: Indirectos
  Fase: Alto riesgo
  ────────────────────────────────────────
  Archivo: domain/actionQueue/clusters.ts:81-94
  Símbolo: STORE_TIME_RESTRICTIONS (14 tiendas)
  Dominio: Logística
  Consumidores: ActionGroupCard
  Tests: Ninguno
  Fase: Quick win
  ────────────────────────────────────────
  Archivo: domain/actionQueue/clusters.ts:109
  Símbolo: IMPORTED_BRANDS (wrangler, lee)
  Dominio: Inventario
  Consumidores: waterfall (cover weeks)
  Tests: Indirectos
  Fase: Migración cuidada

  B3. Algoritmo Waterfall — Umbrales (MEDIA probabilidad de cambio)

  ┌───────────────────────┬───────────────┬──────┬────────┬───────┬───────┐
  │        Archivo        │    Símbolo    │ Valo │ Domini │ Tests │ Fase  │
  │                       │               │  r   │   o    │       │       │
  ├───────────────────────┼───────────────┼──────┼────────┼───────┼───────┤
  │                       │               │      │        │       │ Migra │
  │ domain/actionQueue/wa │ LOW_STOCK_RAT │ 0.40 │ Invent │ Direc │ ción  │
  │ terfall.ts:30         │ IO            │      │ ario   │ tos   │ cuida │
  │                       │               │      │        │       │ da    │
  ├───────────────────────┼───────────────┼──────┼────────┼───────┼───────┤
  │                       │               │      │        │       │ Migra │
  │ domain/actionQueue/wa │ HIGH_STOCK_RA │ 2.50 │ Invent │ Direc │ ción  │
  │ terfall.ts:31         │ TIO           │      │ ario   │ tos   │ cuida │
  │                       │               │      │        │       │ da    │
  ├───────────────────────┼───────────────┼──────┼────────┼───────┼───────┤
  │                       │               │      │        │       │ Migra │
  │ domain/actionQueue/wa │ MIN_STOCK_ABS │ 3    │ Invent │ Direc │ ción  │
  │ terfall.ts:32         │               │      │ ario   │ tos   │ cuida │
  │                       │               │      │        │       │ da    │
  ├───────────────────────┼───────────────┼──────┼────────┼───────┼───────┤
  │                       │               │      │        │       │ Migra │
  │ domain/actionQueue/wa │ MIN_AVG_FOR_R │ 5    │ Invent │ Direc │ ción  │
  │ terfall.ts:33         │ ATIO          │      │ ario   │ tos   │ cuida │
  │                       │               │      │        │       │ da    │
  ├───────────────────────┼───────────────┼──────┼────────┼───────┼───────┤
  │                       │               │      │        │       │ Migra │
  │ domain/actionQueue/wa │ MIN_TRANSFER_ │ 2    │ Distri │ Direc │ ción  │
  │ terfall.ts:34         │ UNITS         │      │ bución │ tos   │ cuida │
  │                       │               │      │        │       │ da    │
  ├───────────────────────┼───────────────┼──────┼────────┼───────┼───────┤
  │ domain/actionQueue/wa │ PARETO_TARGET │ 0.80 │ Priori │ Direc │ Quick │
  │ terfall.ts:35         │               │      │ zación │ tos   │  win  │
  ├───────────────────────┼───────────────┼──────┼────────┼───────┼───────┤
  │ domain/actionQueue/wa │ SURPLUS_LIQUI │ 0.60 │ Liquid │ Direc │ Quick │
  │ terfall.ts:36         │ DATE_RATIO    │      │ ación  │ tos   │  win  │
  ├───────────────────────┼───────────────┼──────┼────────┼───────┼───────┤
  │                       │               │      │        │ Direc │ Migra │
  │ domain/actionQueue/wa │ B2C_STORE_COV │ 13   │ Reposi │ tos + │ ción  │
  │ terfall.ts:46         │ ER_WEEKS      │      │ ción   │  UI   │ cuida │
  │                       │               │      │        │       │ da    │
  ├───────────────────────┼───────────────┼──────┼────────┼───────┼───────┤
  │                       │               │ 500, │        │ Direc │       │
  │ domain/actionQueue/wa │ MIN_IMPACT_TH │ 000  │ Filtra │ tos + │ Quick │
  │ terfall.ts:53         │ RESHOLD       │ Gs.  │ do     │  UI   │  win  │
  │                       │               │      │        │ label │       │
  ├───────────────────────┼───────────────┼──────┼────────┼───────┼───────┤
  │ domain/actionQueue/wa │ RETAILS_DEPOT │ stri │ Distri │ Indir │ Quick │
  │ terfall.ts:27-28      │ , STOCK_DEPOT │ ngs  │ bución │ ectos │  win  │
  └───────────────────────┴───────────────┴──────┴────────┴───────┴───────┘

  B4. Catálogo de KPIs (BAJA probabilidad de cambio)

  Archivo: domain/kpis/fenix.catalog.ts                                         
  Símbolo: 50 KpiSpec (9 core, 8 next, rest later/blocked)     
  Dominio: Analytics                                                            
  Consumidores: KPIsPage, ExecutivePage, SearchCatalog         
  Tests: Contract tests                                                        
  Fase: No tocar todavía                                                        
  ────────────────────────────────────────
  Archivo: domain/kpis/categories.ts:20-84                                      
  Símbolo: 9 KpiCategory + orden
  Dominio: Analytics/UI                                                         
  Consumidores: KPIsPage, filters
  Tests: Indirectos                                                            
  Fase: No tocar todavía
  ────────────────────────────────────────
  Archivo: domain/kpis/categories.ts:109-117                                    
  Símbolo: PST badge labels/colors
  Dominio: UI                                                                   
  Consumidores: KPIsPage
  Tests: Ninguno                                                               
  Fase: Quick win (solo UI)
  ────────────────────────────────────────
  Archivo: domain/kpis/calculations.ts:96-117                                   
  Símbolo: Margin health thresholds (B2C 55/50, B2B 50/40)
  Dominio: Finanzas                                                             
  Consumidores: SalesPage, ExecutivePage
  Tests: Directos                                                              
  Fase: Migración cuidada

  B5. Normalización de Marcas y Tiendas (MEDIA probabilidad de cambio)

  Archivo: api/normalize.ts:129-145                                         
  Símbolo: Brand mapping (martel variants→"Martel", etc.)                   
  Dominio: Master Data                                                          
  Consumidores: Todas las queries                                           
  Tests: 7 tests directos                                                       
  Fase: Alto riesgo                                                             
  ────────────────────────────────────────                                     
  Archivo: api/normalize.ts:163                                                 
  Símbolo: B2B_STORES (MAYORISTA, UTP, UNIFORMES)                           
  Dominio: Clasificación                                                       
  Consumidores: classifyStore, filters                                          
  Tests: 12 assertions directas
  Fase: Alto riesgo                                                             
  ────────────────────────────────────────
  Archivo: api/normalize.ts:168-175                                             
  Símbolo: EXCLUDED_STORES (16 tiendas)
  Dominio: Clasificación                                                        
  Consumidores: classifyStore
  Tests: 12 assertions                                                         
  Fase: Alto riesgo

  B6. Freshness / SLA de Datos (BAJA probabilidad de cambio)                    
   
  Archivo: domain/freshness/classify.ts:12-18                                   
  Símbolo: SOURCE_THRESHOLDS (5 MVs: 90/180, 120/360 min)      
  Dominio: Observabilidad                                                       
  Consumidores: FreshnessIndicator en todas las pages          
  Tests: Tests directos (magic numbers)                                         
  Fase: Quick win                                                               
  ────────────────────────────────────────                                     
  Archivo: features/logistics/LogisticsPage.tsx:21                              
  Símbolo: LOGISTICS_THRESHOLDS (1440/10080 min)
  Dominio: Observabilidad                                                       
  Consumidores: LogisticsPage solamente
  Tests: Ninguno                                                               
  Fase: Quick win

  B7. Filtros y Período (MUY BAJA probabilidad de cambio)                       
   
  Archivo: domain/filters/types.ts:40-46                                        
  Símbolo: DEFAULT_FILTERS                                                
  Dominio: UX                                                                   
  Consumidores: useGlobalFilters, todas las pages                         
  Tests: Ninguno directo                                                       
  Fase: No tocar todavía                                                        
  ────────────────────────────────────────                                
  Archivo: domain/filters/types.ts:1-10                                         
  Símbolo: BrandFilter, ChannelFilter, PeriodFilter enums                 
  Dominio: Taxonomía                                                           
  Consumidores: Todo el sistema                                                 
  Tests: Indirectos
  Fase: Alto riesgo (structural)                                                
  ────────────────────────────────────────
  Archivo: domain/period/helpers.ts:16-25                                       
  Símbolo: MONTH_SHORT, MONTH_FULL (español)
  Dominio: i18n                                                                 
  Consumidores: Charts, labels
  Tests: Ninguno                                                               
  Fase: No tocar todavía

  B8. Constantes dispersas en Features (MEDIA probabilidad de cambio)

  Archivo: features/action-queue/ActionGroupCard.tsx:213                        
  Símbolo: WOI target fallback                  
  Valor: b2c:13, b2b:12                                                         
  Dominio: Inventario                           
  Fase: Quick win (ya existe en domain)                                        
  ────────────────────────────────────────                                      
  Archivo: features/action-queue/ActionGroupCard.tsx:150                        
  Símbolo: MOS→WOI factor                                                       
  Valor: 4.33                                                                   
  Dominio: Cálculo                                                             
  Fase: Quick win                                                              
  ────────────────────────────────────────
  Archivo: features/action-queue/ActionGroupCard.tsx:230                        
  Símbolo: DOI thresholds
  Valor: 180/90 días                                                            
  Dominio: Inventario
  Fase: Quick win (duplicado)                                                  
  ────────────────────────────────────────
  Archivo: features/action-queue/PurchasePlanningTab.tsx:105                    
  Símbolo: DOI thresholds
  Valor: 180/90 días                                                            
  Dominio: Inventario
  Fase: Quick win (duplicado)                                                  
  ────────────────────────────────────────
  Archivo: features/*/PAGE_SIZE (3 archivos)                                    
  Símbolo: Paginación
  Valor: 20                                                                     
  Dominio: UX     
  Fase: Quick win                                                              
  ────────────────────────────────────────
  Archivo: features/commissions/useCommissions.ts:109                           
  Símbolo: Vendor code 999 skip
  Valor: 999                                                                    
  Dominio: Compensación
  Fase: Quick win                                                              
  ────────────────────────────────────────
  Archivo: features/sales/salesAnalytics.constants.ts:38-50                     
  Símbolo: Brand→Color mapping
  Valor: hex codes                                                              
  Dominio: UI     
  Fase: No tocar todavía                                                       
  ────────────────────────────────────────
  Archivo: features/calendar/useCalendar.ts:92                                  
  Símbolo: Budget max validation
  Valor: 100B Gs.                                                               
  Dominio: Validación
  Fase: Quick win                                                              

  B9. SQL Hardcoded (ALTA dificultad de migración)

  ┌────────────────────────────────┬───────────────┬─────────────┬─────────┐ 
  │            Archivo             │   Contenido   │   Dominio   │  Fase   │ 
  ├────────────────────────────────┼───────────────┼─────────────┼─────────┤ 
  │                                │ 31 JDE→cosujd │             │         │ 
  │ sql/010_mv_doi_edad.sql:20-52  │  store        │ Master Data │ Alto    │ 
  │                                │ mappings      │             │ riesgo  │    
  │                                │ (CTE)         │             │         │ 
  ├────────────────────────────────┼───────────────┼─────────────┼─────────┤    
  │                                │ Channel       │             │         │    
  │ sql/011_data_freshness.sql:33- │ repair logic  │ Clasificaci │ Alto    │   
  │ 48                             │ (MAYORISTA→B2 │ ón          │ riesgo  │    
  │                                │ B)            │             │         │
  ├────────────────────────────────┼───────────────┼─────────────┼─────────┤    
  │ sql/011_data_freshness.sql:140 │ Cron schedule │             │ Migraci │
  │ -144                           │  15 * * * 1-6 │ Infra       │ ón      │    
  │                                │               │             │ cuidada │
  ├────────────────────────────────┼───────────────┼─────────────┼─────────┤   
  │                                │ Role enums,   │             │ No      │
  │ Migrations (CHECK constraints) │ status enums  │ Taxonomía   │ tocar   │    
  │                                │               │             │ todavía │
  └────────────────────────────────┴───────────────┴─────────────┴─────────┘    
                  
  ---                                                                          
  C. Mapa de Impacto
                    
  ┌─────────────────────────────────────────────────────────────────┐
  │                     PANTALLAS AFECTADAS                         │           
  ├────────────────┬────────────────────────────────────────────────┤
  │ ExecutivePage  │ margin thresholds, KPI catalog, period logic  │            
  │ SalesPage      │ brand colors, margin health, brand mapping    │            
  │ ActionQueuePage│ clusters, waterfall thresholds, DOI, WOI,     │            
  │                │ PARETO, MIN_IMPACT, depot names               │            
  │ CommissionsPage│ 8 scales (56 tiers), role labels, code 999    │            
  │ LogisticsPage  │ freshness thresholds, arrival statuses        │            
  │ DepotsPage     │ coverage threshold (80%), novelty status      │            
  │ KPIsPage       │ 50 KPI specs, 9 categories, PST badges       │             
  │ CalendarPage   │ budget max, brand colors, status colors       │            
  │ UsersPage      │ role enums (from auth/types)                  │            
  ├────────────────┴────────────────────────────────────────────────┤           
  │                     CÁLCULOS AFECTADOS                          │           
  ├─────────────────────────────────────────────────────────────────┤           
  │ Waterfall algorithm    ← 10 constantes, 4 niveles              │           
  │ Commission engine      ← 56 tiers, 8 roles, store→role map    │             
  │ Margin classification  ← 4 thresholds (B2C/B2B × 2 niveles)  │              
  │ Gap analysis           ← cover weeks, imported brands          │            
  │ Data freshness         ← 5 source thresholds                   │            
  │ Brand normalization    ← brand map + store sets (impacta TODO) │            
  └─────────────────────────────────────────────────────────────────┘           
                                                                               
  Constantes con mayor radio de explosión:                                      
  1. Brand mapping (normalize.ts) → afecta TODA query, TODA página, TODOS los
  filtros                                                                       
  2. Store classification (normalize.ts + clusters.ts) → waterfall, comisiones,
  filtros, charts                                                               
  3. Filter enums (types.ts) → structural, cambiar rompe tipos en compilación   
                                                                               
  ---                                                                           
  D. Riesgos Transversales
                                                                                
  D1. Tests frágiles (28% del suite)
                                                                                
  - 87 tests FRAGILE-DIRECT que aseveran valores exactos de negocio             
  - 180 tests FRAGILE-INDIRECT con fixtures que embeben brand/store/role        
  - Cluster crítico: normalize.test.ts (19 assertions directas sobre brands y   
  stores)                                                                       
  - Si se cambia una escala de comisión, 41 tests necesitan actualización manual
                                                                                
  D2. Duplicación de constantes                                                
                                                                                
  - DOI_THRESHOLDS (180/90): definido en 2 componentes de features, no en domain
  - PAGE_SIZE (20): 3 archivos independientes                                  
  - WOI_TARGET (13 semanas): domain + feature fallback                          
  - Store depot names ("RETAILS", "STOCK"): domain + feature comparisons        
                                                                                
  D3. SQL como fuente de verdad paralela                                        
                                                                                
  - 31 store mappings en 010_mv_doi_edad.sql que NO se sincronizan con          
  clusters.ts                                                                  
  - Channel repair en SQL que duplica lógica de normalize.ts                    
  - Cambiar stores en TypeScript sin actualizar SQL = datos inconsistentes      
                                                                                
  D4. Constantes structural vs. de valor                                        
                                                                                
  - BrandFilter, ChannelFilter son tipos de TypeScript — cambiarlos rompe       
  compilación                                                                  
  - Esto es bueno (el compilador avisa), pero hace la migración más invasiva    
  - Externalizar un enum de TypeScript a runtime requiere validación Zod + cast 
                                                                                
  D5. Reglas embebidas en funciones                                             
                                                                                
  - classifyStoreForCommission() no es una constante — es un algoritmo con      
  lógica if/else                                                               
  - waterfall() tiene reglas de prioridad (N1→N4) que no son parametrizables sin
   rediseño                                                                     
  - calcGrossMargin() es una fórmula contable estándar — no conviene           
  externalizar                                                                  
                  
  ---                                                                           
  E. Secuencia Recomendada por Etapas
                                                                                
  Etapa 0: Preparación de tests (prerrequisito)
                                                                                
  Objetivo: Reducir fragilidad de 28% → <15% antes de tocar constantes.         
  - Refactorizar normalize.test.ts: importar constantes, usar it.each           
  - Refactorizar calculations.test.ts (comisiones): extraer tiers de            
  SCALE_BY_ROLE                                                                
  - Refactorizar classify.test.ts (freshness): importar SOURCE_THRESHOLDS       
  - Refactorizar arrivals.test.ts: extraer status labels                 
  - Archivos: 5 test files                                                      
  - Riesgo: Bajo (solo tests, no production code)
  - Criterio de éxito: 985 tests siguen pasando, fragilidad <15%                
                                                                                
  Etapa 1: Quick wins — Deduplicación y centralización                          
                                                                                
  Objetivo: Eliminar duplicaciones y mover constantes sueltas a domain.         
  - Crear domain/actionQueue/constants.ts: DOI_THRESHOLDS, MOS_TO_WEEKS,        
  DEPOT_STORES, PAGE_SIZE                                                       
  - Crear domain/commissions/constants.ts: SYSTEM_VENDOR_CODE (999)            
  - Crear domain/logistics/constants.ts: LOGISTICS_FRESHNESS                    
  - Mover LOGISTICS_THRESHOLDS de LogisticsPage → domain                        
  - Importar desde features en vez de hardcodear                               
  - Archivos afectados: ~8 (3 nuevos, 5 editados)                               
  - Riesgo: Bajo (refactor de imports, sin cambio de valores)                   
  - Criterio de éxito: 0 constantes duplicadas, 985 tests green                 
                                                                                
  Etapa 2: Migración cuidada — Escalas de comisiones                            
                                                                                
  Objetivo: Hacer las 8 escalas (56 tiers) configurables sin romper el engine.  
  - Definir interfaz CommissionConfig que contenga las 8 escalas                
  - Mantener las escalas actuales como DEFAULT_COMMISSION_CONFIG                
  - Agregar punto de inyección (prop/context) para override futuro             
  - Archivos afectados: ~6 (scales.ts, calculations.ts, useCommissions, types)  
  - Riesgo: Medio (las comisiones son cálculo financiero)                       
  - Criterio de éxito: Tests pasan, UI idéntica, escalas inyectables            
                                                                                
  Etapa 3: Migración cuidada — Clusters y operaciones                           
                                                                                
  Objetivo: Hacer clusters, assortment y time restrictions configurables.       
  - Definir StoreConfig con clusters, capacidades, restricciones                
  - Mantener config actual como default                                         
  - Actualizar waterfall para recibir config como parámetro                    
  - Archivos afectados: ~5 (clusters.ts, waterfall.ts, grouping.ts,             
  ActionGroupCard)                                                              
  - Riesgo: Medio-alto (waterfall es el algoritmo central de acciones)          
  - Criterio de éxito: Tests pasan, waterfall produce mismos resultados         
                                                                                
  Etapa 4: Migración cuidada — Normalización de marcas/tiendas                  
                                                                                
  Objetivo: Hacer el brand mapping y store classification configurables.        
  - Definir MasterDataConfig con brand map, B2B stores, excluded stores        
  - Inyectar en normalize functions                                             
  - Archivos afectados: ~4 (normalize.ts, tests)
  - Riesgo: ALTO (afecta toda query de datos)                                   
  - Criterio de éxito: Todas las queries retornan mismos datos
                                                                                
  Etapa 5 (futura): SQL alignment                                               
                                                                                
  Objetivo: Sincronizar store mappings SQL con TypeScript config.               
  - Migrar CTE hardcoded → tabla config_store_mappings                         
  - Channel repair → lookup table en vez de CASE WHEN                           
  - Riesgo: MUY ALTO (toca materialized views en producción)
  - Prerequisito: Etapas 0-4 completadas y estables                             
                                                                                
  NO TOCAR (por ahora):                                                         
                                                                                
  - Catálogo de KPIs (fenix.catalog.ts) — estable, complejo, bajo cambio        
  - Filter enums (BrandFilter, ChannelFilter) — structural, requiere rediseño de
   tipos                                                                        
  - Fórmulas contables (calcGrossMargin, calcGMROI) — estándar, no negociables
  - Month labels — hardcoded pero correcto para español-only                    
  - Help guide — contenido, no configuración                                    
                                                                                
  ---                                                                           
  F. Cosas que Todavía No Sabemos                                               
                                                                                
  1. ¿A dónde van las constantes externalizadas? Opciones: archivo JSON, tabla 
  Supabase, admin UI. Cada una tiene trade-offs de latencia, deploy y           
  complejidad. Sin decidir esto, no se puede diseñar la capa de inyección.
  2. ¿Las escalas de comisiones cambian por período fiscal? Si sí, necesitan    
  versionado temporal (vigente desde/hasta). Si no, un simple config file       
  alcanza.                                                                     
  3. ¿Los clusters de tiendas cambian con apertura/cierre de locales? Si cambian
   seguido, necesitan admin UI. Si es anual, un deploy con archivo nuevo        
  alcanza.                                                                     
  4. ¿Hay stores en el SQL (31 JDE mappings) que ya no existen en clusters.ts?  
  No se ha verificado la sincronización — podría haber drift.                   
  5. ¿El cron 15 * * * 1-6 es política de negocio o infra? Si es negocio       
  (refresh solo lunes-sábado), debería ser configurable. Si es infra, se queda. 
  6. ¿Se anticipa internacionalización? Los month labels, status labels y
  currency están en español. Si hay plan de i18n, la estrategia de              
  externalización cambia completamente.
  7. ¿Los margin thresholds (55%/50% B2C, 50%/40% B2B) vienen de la dirección   
  financiera o son convención interna? Si son del CFO, cambian con política. Si 
  son benchmarks de industria, son estables.                                   
                                                                                
  ---             
  G. Lectura Brutal                                                            
                                                                                
  El proyecto está en buena forma para su tamaño. La arquitectura domain/ ya
  hizo el 70% del trabajo de centralización. Lo que queda no es un desastre — es
   la diferencia entre "centralizado" y "externalizable", que son cosas
  distintas.                                                                    
                  
  Lo que está bien:                                                             
  - 33 archivos domain con separación clara por subdominios
  - 985 tests green con 72% de solidez                                          
  - Cero TypeScript errors, build limpio
  - Las constantes más críticas (waterfall, comisiones, KPIs) ya están en       
  archivos dedicados                                                            
                                                                                
  Lo que duele:                                                                 
  - Las escalas de comisiones (56 tiers) son el candidato #1 a cambio y están en
   código                                                                       
  - Los clusters de tiendas son el candidato #2 y viven en un .ts estático     
  - El brand mapping en normalize.ts es el punto de mayor radio de explosión —  
  un cambio ahí rompe datos en cascada                                          
  - 31 store mappings en SQL que nadie sincroniza con TypeScript                
  - 87 tests que van a romperse la primera vez que alguien cambie un tier de    
  comisión                                                                      
                                                                                
  Lo que NO conviene dramatizar:                                                
  - Los KPIs, fórmulas contables y enums de filtro no son el problema. Son      
  estables, correctos y bien organizados                                        
  - Las duplicaciones (DOI, PAGE_SIZE) son molestas pero no peligrosas — 30     
  minutos de refactor                                                           
  - Los brand colors son UI puro, no negocio                                    
                                                                               
  El orden correcto es: blindar tests → deduplicar → comisiones → clusters →    
  normalización → SQL. Saltarse la etapa de tests es la forma más segura de     
  introducir regresiones silenciosas durante la migración.                      
 