                  
  Auditoría de Seguridad de Tests para Migración de Configuración               
                                                                                
  A. Diagnóstico de la Suite Actual                                             
                                                                                
  Resumen cuantitativo                                                         
                                                                                
  ┌─────────────────────────────────────────────┬──────────────┐
  │                   Métrica                   │    Valor     │               
  ├─────────────────────────────────────────────┼──────────────┤                
  │ Total tests                                 │ 985          │
  ├─────────────────────────────────────────────┼──────────────┤                
  │ Total suites                                │ 25           │
  ├─────────────────────────────────────────────┼──────────────┤               
  │ Tests robustos (invariantes/math/structure) │ ~901 (91.5%) │
  ├─────────────────────────────────────────────┼──────────────┤                
  │ Tests frágiles (value-based de negocio)     │ ~84 (8.5%)   │
  └─────────────────────────────────────────────┴──────────────┘                
                  
  Por dominio y severidad                                                       
                  
  Dominio: Comisiones                                                           
  Archivo test: commissions/calculations.test.ts         
  Tests frágiles: ~25                                                           
  Severidad: ALTA — assertions exactas con % de escalas (0.85, 0.95, 1.05, 1.15,
                                                                               
    1.35, 600K, 700K, 800K)                                                     
  ────────────────────────────────────────
  Dominio: KPI thresholds                                                       
  Archivo test: kpis/calculations.test.ts
  Tests frágiles: ~11                                                           
  Severidad: ALTA — margins health thresholds hardcodeados (50, 55, 40) y
    benchmarks                                                                 
  ────────────────────────────────────────
  Dominio: KPI catálogo                                                         
  Archivo test: kpis/fenix.contract.test.ts
  Tests frágiles: ~12                                                           
  Severidad: MEDIA — counts exactos (50 KPIs, 9/2/8/15/16 por PST), benchmark
    values                                                                     
  ────────────────────────────────────────
  Dominio: Freshness                                                            
  Archivo test: freshness/classify.test.ts
  Tests frágiles: ~8                                                            
  Severidad: ALTA — minutos exactos (90, 120, 180, 360) hardcodeados en
    assertions                                                                 
  ────────────────────────────────────────
  Dominio: Executive                                                            
  Archivo test: executive/calcs.test.ts
  Tests frágiles: ~3                                                            
  Severidad: MEDIA — fallback 70B Gs. y factor 0.90
  ────────────────────────────────────────                                     
  Dominio: Depots                                                               
  Archivo test: depots/calculations.test.ts
  Tests frágiles: ~7                                                            
  Severidad: MEDIA — umbrales WOI (4, 8, 16 semanas), novelty 80%
  ────────────────────────────────────────                                     
  Dominio: Waterfall                                                            
  Archivo test: actionQueue/waterfall.test.ts
  Tests frágiles: ~10                                                           
  Severidad: BAJA — tests son más de comportamiento, pero dependen
  indirectamente                                                               
    de ratios internos
  ────────────────────────────────────────
  Dominio: Grouping                                                             
  Archivo test: actionQueue/grouping.test.ts
  Tests frágiles: ~4                                                            
  Severidad: MEDIA — capacidades de tienda (3000, 5500)
  ────────────────────────────────────────                                     
  Dominio: Normalize                                                            
  Archivo test: api/normalize.test.ts
  Tests frágiles: ~4                                                            
  Severidad: BAJA — clasificación de tiendas, es data reference más que config
                                                                               
  Clasificación de robustez

  - Robustos (91.5%): Tests de math pura (calcGrossMargin, calcYoY, etc.), tests
   de estructura, tests de edge cases, tests de comportamiento del waterfall,
  tests de calendar/users/search/logistics.                                     
  - Frágiles (8.5%): Tests que hardcodean valores numéricos de negocio que la
  fuente de configuración podría cambiar.                                       
   
  ---                                                                           
  B. Lista de Tests a Migrar
                                                                               
  SEVERIDAD ALTA — Ruptura garantizada si cambia la config
                                                                                
  #: 1                                                                          
  Archivo: commissions/calculations.test.ts                                     
  Líneas: 86-111                                                                
  Motivo de fragilidad: findTier assertions hardcodean 0.85, 0.95, 1.15, 1.35 —
    valores de VENDEDOR_TIENDA.tiers[n].value                                  
  Migración sugerida: Contract test: importar la escala y derivar expected del  
    source
  ────────────────────────────────────────                                      
  #: 2                                                                          
  Archivo: commissions/calculations.test.ts                                    
  Líneas: 144-198                                                               
  Motivo de fragilidad: calcCommission para 4 roles (vendedor_tienda,
    supervisor_tienda, vendedor_mayorista, vendedor_utp, gerencia_utp) con % y 
    montos fijos exactos
  Migración sugerida: Contract test: derivar expected de SCALE_BY_ROLE
  ────────────────────────────────────────
  #: 3                                                                          
  Archivo: commissions/calculations.test.ts
  Líneas: 289-290                                                               
  Motivo de fragilidad: calcAllCommissions batch — 1.15 y 0.85 hardcodeados
  Migración sugerida: Contract test: derivar de escala                         
  ────────────────────────────────────────
  #: 4                                                                          
  Archivo: kpis/calculations.test.ts
  Líneas: 67-93                                                                 
  Motivo de fragilidad: classifyMarginHealth con boundaries 55, 50, 49.99, 40, 
    39.99                                                                      
  Migración sugerida: Contract test: importar thresholds y derivar boundaries
  ────────────────────────────────────────
  #: 5                                                                          
  Archivo: kpis/calculations.test.ts
  Líneas: 96-105                                                                
  Motivo de fragilidad: marginHealthThresholds retorna {red:50, yellow:55} /
    {red:40, yellow:50}                                                        
  Migración sugerida: Contract test: importar source
  ────────────────────────────────────────
  #: 6                                                                          
  Archivo: freshness/classify.test.ts
  Líneas: 56-60                                                                 
  Motivo de fragilidad: Default thresholds 120, 360 hardcodeados
  Migración sugerida: Contract test: importar DEFAULT_THRESHOLDS               
  ────────────────────────────────────────
  #: 7                                                                          
  Archivo: freshness/classify.test.ts
  Líneas: 67-76                                                                 
  Motivo de fragilidad: Source thresholds 90, 180, 120, 360 hardcodeados
  Migración sugerida: Contract test: importar SOURCE_THRESHOLDS                

  SEVERIDAD MEDIA — Ruptura probable si cambia catálogo/estructura              
   
  #: 8                                                                          
  Archivo: kpis/fenix.contract.test.ts                                  
  Líneas: 83-112                                                               
  Motivo de fragilidad: Counts exactos: 50, 9, 2, 8, 15, 16 KPIs        
  Migración sugerida: Invariant test: total = sum of PSTs, sin hardcodear cada
    count                                                                       
  ────────────────────────────────────────
  #: 9                                                                          
  Archivo: kpis/fenix.contract.test.ts
  Líneas: 151                                                                   
  Motivo de fragilidad: benchmark.value === 45 para gross_margin
  Migración sugerida: Contract test: derivar de catálogo                       
  ────────────────────────────────────────
  #: 10                                                                         
  Archivo: executive/calcs.test.ts
  Líneas: 20-25                                                                 
  Motivo de fragilidad: Fallback 70_000_000_000 hardcodeado
  Migración sugerida: Contract test: importar constante                        
  ────────────────────────────────────────
  #: 11                                                                         
  Archivo: depots/calculations.test.ts
  Líneas: 87-108                                                                
  Motivo de fragilidad: WOI boundaries 4, 8, 16 hardcodeados
  Migración sugerida: Contract test: importar constantes                       
  ────────────────────────────────────────
  #: 12                                                                         
  Archivo: grouping.test.ts
  Líneas: 118, 337                                                              
  Motivo de fragilidad: Store assortment 3000, 5500
  Migración sugerida: Contract test: importar de STORE_ASSORTMENT              

  ---
  C. Propuesta de Nueva Estrategia de Test
                                                                                
  1. Invariant Tests (ya existen, reforzar)
                                                                                
  Tests que validan propiedades estructurales independientes de valores         
  concretos:                                                                    
                                                                                
  - SCALE_BY_ROLE tiene 8 roles, tiers ordenados ascendentemente, último tier es
   Infinity (ya existe: calculations.test.ts:344-371 — ROBUSTO, no tocar)      
  - Catálogo KPI: IDs únicos, campos obligatorios completos, calcFn para core   
  KPIs (ya existe — ROBUSTO)                                                    
  - Waterfall: input vacío → output vacío, acciones tienen rank > 0, impactScore
   >= 0 (ya existe — ROBUSTO)                                                   
  - Agregar: SOURCE_THRESHOLDS — todas las entradas tienen staleMinutes < 
  riskMinutes y ambos > 0                                                       
  - Agregar: Escalas de comisión — tier 0% siempre tiene value 0, y values son
  monótonamente no-decrecientes                                                 
                  
  2. Contract Tests de Config (NUEVA categoría — migrar los frágiles a esto)    
                  
  Tests que importan la constante como source of truth y verifican que la lógica
   la respeta:    
                                                                                
  // En vez de:   
  expect(findTier(tiers, 70).value).toBe(0.85)                                 
                                                                                
  // Se convierte en:
  const expected = SCALE_BY_ROLE.vendedor_tienda.tiers                          
    .find(t => 70 >= t.minPct && 70 < t.maxPct)!.value                          
  expect(findTier(tiers, 70).value).toBe(expected)                              
                                                                                
  Esto valida que findTier respeta la escala, sin acoplarse al valor concreto.  
                                                                                
  3. Golden Tests / Snapshot (sugerido, no implementar ahora)                   
                                                                               
  Para cuando se migre la config:                                               
  - Snapshot de ALL_SCALES completo
  - Snapshot de SOURCE_THRESHOLDS                                               
  - Snapshot de FENIX_KPI_CATALOG (50 entries con sus benchmark values)
                                                                                
  Estos congelan intencionalmente y se rompen explícitamente cuando alguien     
  cambia config — pero el diff es legible.                                      
                                                                                
  4. Smoke Tests Mínimos (ya cubiertos)                                         
                                                                               
  Los tests existentes de math pura (calcGrossMargin(100,60) → 40) son smoke    
  tests perfectos. No necesitan cambio.
                                                                                
  ---             
  D. Plan de Implementación                                                    
                                                                                
  Voy a implementar las migraciones en los test files, sin tocar lógica
  productiva. Los cambios son:                                                  
                  
  1. commissions/calculations.test.ts — Derivar expected values de SCALE_BY_ROLE
   en lugar de hardcodear
  2. kpis/calculations.test.ts — Importar marginHealthThresholds como source y  
  derivar boundaries
  3. freshness/classify.test.ts — Importar SOURCE_THRESHOLDS y derivar expected
  4. kpis/fenix.contract.test.ts — Convertir counts a invariant (sum = total)   
  5. executive/calcs.test.ts — Importar ANNUAL_TARGET_FALLBACK (requiere        
  exportarlo)                                                                   
  6. depots/calculations.test.ts — Importar constantes de risk   