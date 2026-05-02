/**
 * domain/kpis/fenix.catalog.ts
 *
 * Catálogo formal de los 50 KPIs de FenixBrands.
 * Fuente: "KPI FENIX.xlsx" (30 ene 2026) — contrato exacto con el cliente.
 *
 * Este archivo es la ÚNICA fuente de verdad sobre:
 *   - Qué KPIs existen, su definición y fórmula exacta del cliente
 *   - En qué sprint se implementa cada uno (PST)
 *   - Qué datos de la BD necesita cada KPI
 *   - Si existe una función pura en calculations.ts que lo implementa
 *
 * ─── PST (Prioridad Sprint — columna del Excel) ───────────────────────────────
 *
 *   'core'    → PST vacío + OBS=check  — implementable ahora, datos disponibles
 *   'next'    → PST=1                  — próximo sprint, datos parciales o trabajo extra
 *   'later'   → PST=2                  — requiere datos externos o nuevos procesos
 *   'future'  → PST=3                  — sin datos ni medición actual
 *   'blocked' → PST vacío + OBS≠check  — datos no disponibles todavía
 *
 * ─── Flujo de implementación ─────────────────────────────────────────────────
 *
 *   Sprint 2A (este)  → catálogo + contrato de tests
 *   Sprint 2B         → ajustar/crear funciones en calculations.ts para los tests
 *   Sprint 3          → KpiDashboardPage con KPIs core conectados a UI
 */

import type { KpiCategory } from './types'

// ─── Tipos del catálogo ───────────────────────────────────────────────────────

/** Prioridad de implementación según el Excel del cliente */
export type FenixPst = 'core' | 'next' | 'later' | 'future' | 'blocked'

/** Unidad de medida del KPI para formateo en UI */
export type FenixUnit =
  | 'currency_pyg'   // Guaraníes: ₲ 6.263.380 (sin decimales)
  | 'percent'        // Escala 0-100: "40.2%"
  | 'ratio'          // Múltiplo: "2.4x"
  | 'number'         // Decimal puro (ej: UPT = 4.2)
  | 'days'           // Días enteros
  | 'count'          // Conteo entero

/**
 * Filtros que un KPI puede soportar según sus fuentes de datos.
 *
 * Cada dimensión indica si el KPI puede filtrarse por esa dimensión.
 * Si una dimensión es false, el KPI NO es calculable cuando el usuario
 * activa ese filtro (valor distinto de "total"/null).
 *
 * Esto se determina por las tablas/vistas de las que depende el KPI:
 *   - mv_ventas_mensual / mv_ventas_diarias: soporta brand, channel, store
 *   - fjdhstvta1: soporta brand, channel, store
 *   - vw_ticket_promedio_diario: soporta channel, store — NO brand
 *   - mv_stock_tienda: soporta brand, store, y channel (vía classifyStore(store))
 *   - v_sth_cohort: soporta store; brand vía cruce con mv_stock_tienda; channel
 *     derivado de classifyStore(store)
 *   - c_cobrar: NO tiene brand/channel/store — DSO segmenta solo por el
 *     denominador (ventas) cuando aplica brand/channel
 *   - v_transacciones_dwh: soporta channel/store (vía codigo_sucursal); NO brand
 */
export interface KpiFilterSupport {
  brand:   boolean
  channel: boolean
  store:   boolean
}

/** Definición formal de un KPI según el Excel del cliente */
export interface FenixKpiSpec {
  /** Identificador único snake_case — clave permanente, nunca cambiar */
  id: string
  /** Nombre exacto del Excel */
  name: string
  /** Definición exacta del Excel */
  definition: string
  /** Fórmula textual exacta del Excel */
  formula: string
  /** Prioridad de implementación */
  pst: FenixPst
  /** Categoría de negocio (usa tipos de domain/kpis/types.ts) */
  category: KpiCategory
  /** Unidad de medida para formateo */
  unit: FenixUnit
  /** ¿Subir el valor es bueno (up) o malo (down)? */
  positiveDirection: 'up' | 'down'
  /** Tablas/campos de BD o fuentes externas requeridos */
  inputs: readonly string[]
  /**
   * Filtros soportados según las fuentes de datos.
   * Si un filtro activo no está soportado, el KPI muestra "no disponible".
   * Se determina por la tabla más restrictiva en los inputs del KPI.
   */
  supportedFilters: KpiFilterSupport
  /** Nombre de la función en calculations.ts (si ya existe) */
  calcFn?: string
  /** Observación del cliente (columna OBS del Excel) */
  obs?: string
  /** Benchmark de referencia del negocio */
  benchmark?: { value: number; description: string }
}

// ─── Catálogo completo — 50 KPIs ─────────────────────────────────────────────

export const FENIX_KPI_CATALOG: readonly FenixKpiSpec[] = [

  // ═══════════════════════════════════════════════════════════════════════════
  // CORE — PST vacío + OBS=check
  // Implementables ahora. Datos disponibles en BD operacional.
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: 'revenue',
    name: 'Ingresos totales',
    definition: 'Ventas netas (sin IVA, netas de devoluciones).',
    formula: 'Σ Ventas netas período',
    pst: 'core',
    category: 'sales',
    unit: 'currency_pyg',
    positiveDirection: 'up',
    inputs: ['mv_ventas_mensual.neto'],
    supportedFilters: { brand: true, channel: true, store: true },
    // No hay calcFn — es un SUM directo en el hook via .reduce()
  },
  {
    id: 'gross_margin',
    name: 'Margen bruto %',
    definition: 'Porcentaje de margen sobre ventas.',
    formula: '(Ventas netas - Costo de ventas) / Ventas netas * 100',
    pst: 'core',
    category: 'profit',
    unit: 'percent',
    positiveDirection: 'up',
    inputs: ['mv_ventas_mensual.neto', 'mv_ventas_mensual.costo'],
    supportedFilters: { brand: true, channel: true, store: true },
    calcFn: 'calcGrossMargin',
    benchmark: { value: 45, description: 'Margen bruto B2C saludable > 45%' },
  },
  {
    id: 'gmroi',
    name: 'GMROI',
    definition: 'Retorno del margen sobre el inventario promedio a costo.',
    formula: 'Margen bruto anual / Inventario promedio a costo',
    pst: 'core',
    category: 'profit',
    unit: 'ratio',
    positiveDirection: 'up',
    inputs: [
      'mv_ventas_mensual.neto',
      'mv_ventas_mensual.costo',
      'mv_stock_tienda → SUM(value) como inventario a costo, agrupable por store',
    ],
    // mv_stock_tienda tiene store → canal derivable vía classifyStore(store).
    supportedFilters: { brand: true, channel: true, store: true },
    calcFn: 'calcGMROI',
    benchmark: { value: 2.0, description: 'GMROI saludable > 2.0x' },
  },
  {
    id: 'inventory_turnover',
    name: 'Rotación de inventario',
    definition: 'Veces que se vende el inventario en un período.',
    formula: 'COGS / Inventario promedio a costo',
    pst: 'core',
    category: 'inventory',
    unit: 'ratio',
    positiveDirection: 'up',
    inputs: [
      'mv_ventas_mensual.costo',
      'mv_stock_tienda → SUM(value) como inventario a costo, agrupable por store',
    ],
    // mv_stock_tienda tiene store → canal derivable vía classifyStore(store).
    supportedFilters: { brand: true, channel: true, store: true },
    calcFn: 'calcInventoryTurnover',
    benchmark: { value: 3.0, description: 'Rotación saludable > 3x anualizado' },
  },
  {
    id: 'aov',
    name: 'AOV (Ticket promedio)',
    definition: 'Valor promedio por transacción.',
    formula: 'Ventas netas / #Tickets',
    pst: 'core',
    category: 'store',
    unit: 'currency_pyg',
    positiveDirection: 'up',
    inputs: [
      'vw_ticket_promedio_diario.venta_total_dia',
      'vw_ticket_promedio_diario.cantidad_facturas',
    ],
    // vw_ticket_promedio_diario no tiene marca → brand ✗
    supportedFilters: { brand: false, channel: true, store: true },
    calcFn: 'calcAOV',
  },
  {
    id: 'upt',
    name: 'UPT',
    definition: 'Unidades por transacción.',
    formula: 'Unidades vendidas / #Tickets',
    pst: 'core',
    category: 'store',
    unit: 'number',
    positiveDirection: 'up',
    inputs: [
      'fjdhstvta1.v_cantvend → SUM(unidades)',
      'vw_ticket_promedio_diario.cantidad_facturas',
    ],
    // Dato no disponible: no existe tabla con items por factura.
    // fjdhstvta1 no tiene id de factura, vw_ticket_promedio_diario solo tiene conteo.
    // Deshabilitado hasta que Derlys provea vista con items por factura.
    supportedFilters: { brand: false, channel: false, store: false },
    calcFn: 'calcUPT',
  },
  {
    id: 'returns_rate',
    name: 'Devoluciones/merma %',
    definition: '% de ventas devueltas o pérdidas por merma.',
    formula: 'Devoluciones (Gs) / Ventas (Gs) * 100',
    pst: 'core',
    category: 'product',
    unit: 'percent',
    positiveDirection: 'down',
    inputs: [
      'fjdhstvta1.v_vtasimpu donde v_vtasimpu < 0 (filas de devolución)',
      'fjdhstvta1.v_vtasimpu donde v_vtasimpu > 0 (ventas positivas)',
    ],
    supportedFilters: { brand: true, channel: true, store: true },
    calcFn: 'calcReturnsRate',
    benchmark: { value: 5, description: 'Tasa de devoluciones alarmante > 5%' },
  },
  {
    id: 'markdown_dependency',
    name: 'Markdown dependency',
    definition: '% de ventas realizadas con descuento.',
    formula: 'Ventas con descuento / Ventas totales * 100',
    pst: 'core',
    category: 'product',
    unit: 'percent',
    positiveDirection: 'down',
    inputs: ['mv_ventas_mensual.dcto', 'mv_ventas_mensual.bruto'],
    supportedFilters: { brand: true, channel: true, store: true },
    calcFn: 'calcMarkdownDependency',
    benchmark: { value: 35, description: 'Dependencia de ofertas alarmante > 35%' },
  },
  {
    id: 'sell_through',
    name: 'Sell-through 30/60/90',
    definition: '% vendido del recibido en cohortes de 30/60/90 días.',
    formula: 'Unid vendidas (cohorte ≤Nd) / Unid recibidas (cohorte ≤Nd) * 100',
    pst: 'core',
    category: 'inventory',
    unit: 'percent',
    positiveDirection: 'up',
    inputs: [
      'v_sth_cohort.units_sold y units_received por (sku, talle, store)',
      'v_sth_cohort.cohort_age_days = CURRENT_DATE - first_entry_network',
      'mv_stock_tienda.brand para filtro por marca (cruce por sku)',
    ],
    // v_sth_cohort tiene store → channel derivable. brand vía cruce con mv_stock_tienda.
    supportedFilters: { brand: true, channel: true, store: true },
    calcFn: 'calcSellThrough',
    obs: 'Conectado vía v_sth_cohort (alimenta también lifecycle/waterfall)',
  },
  {
    id: 'dso',
    name: 'DSO',
    definition: 'Días promedio de cobranza.',
    formula: 'Saldo CxC del período / Ventas diarias promedio del período',
    pst: 'core',
    category: 'finance',
    unit: 'days',
    positiveDirection: 'down',
    inputs: [
      'c_cobrar.pendiente_de_pago con f_factura en el período',
      'mv_ventas_diarias.neto / días calendario del período',
    ],
    // c_cobrar no tiene store ni brand; mv_ventas_diarias tiene brand+channel.
    // El saldo CxC no se segmenta por marca/canal — DSO con brand/channel
    // estima días equivalentes contra esa porción de la venta.
    supportedFilters: { brand: true, channel: true, store: false },
    calcFn: 'calcDSO',
    obs: 'Conectado vía c_cobrar (anteriormente reportada como vacía; activa hoy con 834K filas)',
  },
  {
    id: 'customer_recurrence',
    name: 'Recurrencia clientes',
    definition: '% de clientes que compran ≥2 veces en el período.',
    formula: 'Clientes con ≥2 facturas / Clientes totales * 100',
    pst: 'core',
    category: 'customer',
    unit: 'percent',
    positiveDirection: 'up',
    inputs: [
      'v_transacciones_dwh.codigo_cliente + num_transaccion',
      'v_transacciones_dwh.codigo_sucursal para canal/tienda',
    ],
    // v_transacciones_dwh no tiene marca a nivel línea → brand no soportado.
    // codigo_sucursal cruzable con stores → cosujd → classifyStore para canal.
    supportedFilters: { brand: false, channel: true, store: true },
    calcFn: 'calcCustomerRecurrence',
    obs: 'Conectado vía v_transacciones_dwh (datos hasta 31/12/2025; 2026 en espera del ETL de Derlys)',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // BLOCKED — PST vacío pero datos NO disponibles
  // No implementables hasta que se resuelva el bloqueo externo.
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: 'sov_som_delta',
    name: 'SOV vs SOM (delta)',
    definition: 'Diferencia entre Share of Voice y Share of Market.',
    formula: 'SOV - SOM (en pp)',
    pst: 'blocked',
    category: 'commercial',
    unit: 'number',
    positiveDirection: 'up',
    inputs: [
      'externo: inversión publicitaria propia y de la categoría',
      'externo: market share de la empresa en la categoría',
    ],
    supportedFilters: { brand: false, channel: false, store: false },
    obs: 'Falta de datos',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // NEXT — PST=1
  // Próximo sprint. Algunos tienen calcFn parcialmente implementado.
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: 'ebitda_contribution',
    name: 'EBITDA contribución',
    definition: 'Aporte al EBITDA del área/canal.',
    formula: 'Ingresos - COGS - Opex directos',
    pst: 'next',
    category: 'profit',
    unit: 'currency_pyg',
    positiveDirection: 'up',
    inputs: [
      'mv_ventas_mensual.neto',
      'mv_ventas_mensual.costo',
      'externo: comisiones TC, gastos de personal, alquileres, gastos admin indirectos',
    ],
    // mv_ventas_mensual soporta todo, pero externo no → parcial
    supportedFilters: { brand: false, channel: false, store: false },
    calcFn: 'calcEBITDA',
    obs: 'Pendiente de comisiones TC, gastos de personal, otros gastos, gastos administrativos indirectos (listo descuento por pago temprano, alquileres)',
  },
  {
    id: 'otb_compliance',
    name: 'Cumplimiento OTB',
    definition: 'Grado de ejecución del presupuesto de compra.',
    formula: '(OTB ejecutado / OTB aprobado) * 100',
    pst: 'next',
    category: 'inventory',
    unit: 'percent',
    positiveDirection: 'up',
    inputs: ['externo: OTB ejecutado y OTB aprobado por período/marca'],
    supportedFilters: { brand: false, channel: false, store: false },
    calcFn: 'calcOTBCompliance',
    obs: 'Definir fuente de ejecutado y aprobado',
  },
  {
    id: 'oos_rate',
    name: '% OOS (quiebres)',
    definition: 'Porcentaje de tiempo o SKU-tiendas sin stock.',
    formula: 'SKU-store-days OOS / SKU-store-days totales * 100',
    pst: 'next',
    category: 'inventory',
    unit: 'percent',
    positiveDirection: 'down',
    inputs: [
      'fjdexisemp (stock actual snapshot)',
      'externo: histórico de movimientos para reconstruir stock diario',
    ],
    supportedFilters: { brand: false, channel: false, store: false },
    calcFn: 'calcOOSRate',
    obs: 'Se necesita el histórico de movimientos',
  },
  {
    id: 'lfl',
    name: 'LfL (Like-for-Like)',
    definition: 'Crecimiento de ventas en tiendas comparables vs año anterior.',
    formula: '(Ventas comp - Ventas comp AA) / Ventas comp AA * 100',
    pst: 'core',
    category: 'sales',
    unit: 'percent',
    positiveDirection: 'up',
    inputs: [
      'mv_ventas_mensual (filtrado a tiendas comparables — excluir tiendas abiertas en el año actual)',
      'mv_ventas_mensual año anterior (mismos meses, mismas tiendas)',
    ],
    supportedFilters: { brand: true, channel: true, store: true },
    // calcFn existe (calcLfL = calcYoY), pero el HOOK debe garantizar períodos
    // y tiendas simétricas antes de llamar a la función.
    calcFn: 'calcLfL',
    obs: 'Listo en el reporte diario (migrar al general)',
  },
  {
    id: 'conversion_rate',
    name: 'Tasa de conversión',
    definition: '% de visitantes que compran.',
    formula: '#Tickets / Tráfico * 100',
    pst: 'next',
    category: 'store',
    unit: 'percent',
    positiveDirection: 'up',
    inputs: [
      'vw_ticket_promedio_diario.cantidad_facturas',
      'externo: sensores de tráfico por tienda',
    ],
    // vw_ticket_promedio_diario no tiene brand → false
    supportedFilters: { brand: false, channel: true, store: true },
    calcFn: 'calcConversionRate',
    obs: 'Ver depósito de datos',
  },
  {
    id: 'promo_uplift',
    name: 'Uplift vs baseline en promo',
    definition: 'Incremento porcentual de sell-out durante la promo vs línea base.',
    formula: '(Ventas promo - Baseline) / Baseline * 100',
    pst: 'next',
    category: 'commercial',
    unit: 'percent',
    positiveDirection: 'up',
    inputs: [
      'fjdhstvta1 (ventas por día durante el período de la promo)',
      'baseline: promedio de ventas en semanas sin promoción (mismas tiendas)',
    ],
    // fjdhstvta1 soporta todo, baseline externo → parcial
    supportedFilters: { brand: true, channel: true, store: true },
    calcFn: 'calcPromoUplift',
  },
  {
    id: 'promo_roi',
    name: 'ROI de promoción',
    definition: 'Retorno de inversión de una promoción.',
    formula: 'Ingresos incrementales / Costo de la promo',
    pst: 'next',
    category: 'commercial',
    unit: 'ratio',
    positiveDirection: 'up',
    inputs: [
      'fjdhstvta1 (ingresos durante la promo vs baseline)',
      'externo: costo total de la promoción (descuentos + inversión)',
    ],
    supportedFilters: { brand: false, channel: false, store: false },
    calcFn: 'calcPromoROI',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // LATER — PST=2
  // Requiere datos externos, nuevos procesos o integraciones.
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: 'traffic',
    name: 'Tráfico tienda',
    definition: 'Visitas a tienda (personas que ingresan).',
    formula: 'Conteo por sensores/manual',
    pst: 'later',
    category: 'store',
    unit: 'count',
    positiveDirection: 'up',
    inputs: ['externo: sensores de tráfico o conteo manual por tienda'],
    supportedFilters: { brand: false, channel: false, store: false },
    obs: 'Ver depósito de datos',
  },
  {
    id: 'staff_productivity',
    name: 'Productividad vendedor/hora',
    definition: 'Ventas por hora trabajada de vendedor.',
    formula: 'Ventas / Horas trabajadas',
    pst: 'later',
    category: 'store',
    unit: 'currency_pyg',
    positiveDirection: 'up',
    inputs: [
      'mv_ventas_mensual.neto',
      'externo: planilla de horas trabajadas por vendedor/tienda',
    ],
    supportedFilters: { brand: false, channel: false, store: false },
    obs: 'En espera del programa de duplicación',
  },
  {
    id: 'roas',
    name: 'ROAS',
    definition: 'Retorno de la inversión publicitaria.',
    formula: 'Ingresos atribuidos a pauta / Gasto publicitario',
    pst: 'later',
    category: 'commercial',
    unit: 'ratio',
    positiveDirection: 'up',
    inputs: [
      'externo: ingresos atribuidos (plataformas Meta, Google)',
      'externo: gasto publicitario por campaña/período',
    ],
    supportedFilters: { brand: false, channel: false, store: false },
    obs: 'Relevar el proceso y gasto (Va con gastos generales de Finanzas?)',
  },
  {
    id: 'cac',
    name: 'CAC',
    definition: 'Costo de adquisición por nuevo cliente.',
    formula: 'Gasto marketing atribuido / #nuevos clientes',
    pst: 'later',
    category: 'commercial',
    unit: 'currency_pyg',
    positiveDirection: 'down',
    inputs: [
      'externo: gasto de marketing por período',
      'CLIM100 (nuevos clientes — programa de duplicación pendiente)',
    ],
    supportedFilters: { brand: false, channel: false, store: false },
    obs: 'Relevar el proceso y gasto (Va con gastos generales de Finanzas?)',
  },
  {
    id: 'ltv_12m',
    name: 'LTV (12m)',
    definition: 'Valor de vida estimado a 12 meses.',
    formula: 'AOV * Frecuencia * Margen% * Retención',
    pst: 'later',
    category: 'customer',
    unit: 'currency_pyg',
    positiveDirection: 'up',
    inputs: [
      'vw_ticket_promedio_diario (AOV)',
      'CLIM100 (frecuencia y retención)',
      'mv_ventas_mensual.neto + costo (margen)',
    ],
    supportedFilters: { brand: false, channel: false, store: false },
  },
  {
    id: 'ltv_cac',
    name: 'LTV/CAC',
    definition: 'Relación entre valor de vida y costo de adquisición.',
    formula: 'LTV / CAC',
    pst: 'later',
    category: 'customer',
    unit: 'ratio',
    positiveDirection: 'up',
    inputs: ['derivado de ltv_12m y cac (ambos requieren datos externos)'],
    supportedFilters: { brand: false, channel: false, store: false },
  },
  {
    id: 'mkt_attributed_sales',
    name: '% ventas atribuidas a MKT',
    definition: 'Proporción de ventas con touchpoint de marketing.',
    formula: 'Ventas con atribución / Ventas totales * 100',
    pst: 'later',
    category: 'commercial',
    unit: 'percent',
    positiveDirection: 'up',
    inputs: ['externo: plataformas de atribución de marketing'],
    supportedFilters: { brand: false, channel: false, store: false },
  },
  {
    id: 'crm_base',
    name: 'Base CRM (opt-in)',
    definition: 'Contactos con permisos vigentes de comunicación.',
    formula: 'Σ contactos opt-in únicos',
    pst: 'later',
    category: 'customer',
    unit: 'count',
    positiveDirection: 'up',
    inputs: ['CLIM100 (82.905 clientes — programa de duplicación pendiente)'],
    supportedFilters: { brand: false, channel: false, store: false },
  },
  {
    id: 'pipeline_influenced',
    name: 'Pipeline influenciado',
    definition: 'Valor de oportunidades en que MKT intervino.',
    formula: 'Σ valor oportunidades con touchpoint MKT',
    pst: 'later',
    category: 'commercial',
    unit: 'currency_pyg',
    positiveDirection: 'up',
    inputs: ['externo: CRM de ventas B2B con atribución de marketing'],
    supportedFilters: { brand: false, channel: false, store: false },
  },
  {
    id: 'win_rate_assisted',
    name: 'Win rate asistido',
    definition: '% de deals con influencia MKT que se cierran.',
    formula: 'Deals ganados con MKT / Deals con MKT * 100',
    pst: 'later',
    category: 'commercial',
    unit: 'percent',
    positiveDirection: 'up',
    inputs: ['externo: CRM de ventas B2B con atribución'],
    supportedFilters: { brand: false, channel: false, store: false },
  },
  {
    id: 'vm_compliance',
    name: 'Compliance VM',
    definition: 'Cumplimiento de estándares de Visual Merchandising.',
    formula: 'Tiendas con checklist OK / Tiendas auditadas * 100',
    pst: 'later',
    category: 'store',
    unit: 'percent',
    positiveDirection: 'up',
    inputs: ['externo: checklists de VM (calendario de auditorías)'],
    supportedFilters: { brand: false, channel: false, store: false },
    obs: 'Ver calendario',
  },
  {
    id: 'on_time_to_market',
    name: 'On-time-to-market',
    definition: '% de lanzamientos entregados en fecha planificada.',
    formula: 'Lanzamientos on-time / Lanzamientos totales * 100',
    pst: 'later',
    category: 'product',
    unit: 'percent',
    positiveDirection: 'up',
    inputs: ['externo: calendario de lanzamientos de colección'],
    supportedFilters: { brand: false, channel: false, store: false },
    obs: 'Ver calendario',
  },
  {
    id: 'newness_pct',
    name: '% newness',
    definition: 'Proporción de estilos nuevos en el surtido o ventas de nuevos.',
    formula: 'SKUs nuevos / SKUs totales * 100 (o Ventas nuevos / Ventas totales)',
    pst: 'later',
    category: 'product',
    unit: 'percent',
    positiveDirection: 'up',
    inputs: [
      'fjdexisemp (SKUs activos)',
      'fjdhstvta1 (ventas por SKU — fecha de entrada pendiente de relevar)',
    ],
    // fjdexisemp: brand ✓, store ✓; fjdhstvta1: brand ✓, channel ✓, store ✓
    supportedFilters: { brand: true, channel: false, store: true },
    obs: 'Ver calendario',
  },
  {
    id: 'launch_forecast_mape',
    name: 'MAPE (forecast lanzamientos)',
    definition: 'Error porcentual medio absoluto del forecast.',
    formula: 'mean(|Forecast-Real|/Real)*100',
    pst: 'later',
    category: 'product',
    unit: 'percent',
    positiveDirection: 'down',
    inputs: [
      'externo: forecast de unidades por lanzamiento',
      'fjdhstvta1 (ventas reales del período de lanzamiento)',
    ],
    supportedFilters: { brand: false, channel: false, store: false },
  },
  {
    id: 'return_rate_fit',
    name: 'Return rate por fit/calidad',
    definition: '% de unidades devueltas por problemas de calce/calidad.',
    formula: 'Unid devueltas por fit/calidad / Unid vendidas * 100',
    pst: 'later',
    category: 'product',
    unit: 'percent',
    positiveDirection: 'down',
    inputs: [
      'fjdhstvta1 (devoluciones con motivo fit/calidad — campo motivo pendiente de relevar)',
    ],
    supportedFilters: { brand: true, channel: true, store: true },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // FUTURE — PST=3
  // Sin datos disponibles ni medición actual. Roadmap a largo plazo.
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: 'nps',
    name: 'NPS',
    definition: 'Lealtad del cliente: promotores - detractores.',
    formula: '%Promotores(9-10) - %Detractores(0-6)',
    pst: 'future',
    category: 'customer',
    unit: 'number',
    positiveDirection: 'up',
    inputs: ['externo: encuestas NPS (no hay medición activa)'],
    supportedFilters: { brand: false, channel: false, store: false },
    obs: 'No cuenta con medición',
  },
  {
    id: 'fill_rate',
    name: 'Fill rate',
    definition: 'Nivel de cumplimiento de pedidos en tiempo y cantidad.',
    formula: 'Líneas cumplidas / Líneas totales * 100',
    pst: 'future',
    category: 'logistics',
    unit: 'percent',
    positiveDirection: 'up',
    inputs: ['externo: sistema de pedidos de depósito (proceso no relevado)'],
    supportedFilters: { brand: false, channel: false, store: false },
    obs: 'No se tiene relevado el proceso de pedido a depósito',
  },
  {
    id: 'campaign_conversion',
    name: 'Conversión de campañas',
    definition: '% de clics que convierten en compra/lead.',
    formula: 'Conversiones / Clics * 100',
    pst: 'future',
    category: 'commercial',
    unit: 'percent',
    positiveDirection: 'up',
    inputs: ['externo: plataformas de marketing digital (Meta Ads, Google Ads)'],
    supportedFilters: { brand: false, channel: false, store: false },
  },
  {
    id: 'coupon_redemption',
    name: 'Redención de cupones',
    definition: '% de cupones emitidos que se usan.',
    formula: 'Cupones redimidos / Emitidos * 100',
    pst: 'future',
    category: 'commercial',
    unit: 'percent',
    positiveDirection: 'up',
    inputs: ['externo: sistema de cupones (no implementado)'],
    supportedFilters: { brand: false, channel: false, store: false },
  },
  {
    id: 'mql',
    name: 'MQL',
    definition: 'Lead que cumple criterios de marketing (fit/engagement).',
    formula: 'Conteo de leads que superan umbral scoring',
    pst: 'future',
    category: 'commercial',
    unit: 'count',
    positiveDirection: 'up',
    inputs: ['externo: CRM de marketing con scoring'],
    supportedFilters: { brand: false, channel: false, store: false },
  },
  {
    id: 'sql_lead',
    name: 'SQL',
    definition: 'Lead aceptado por ventas tras calificación.',
    formula: 'MQLs aceptados por ventas',
    pst: 'future',
    category: 'commercial',
    unit: 'count',
    positiveDirection: 'up',
    inputs: ['externo: CRM de ventas con proceso de calificación'],
    supportedFilters: { brand: false, channel: false, store: false },
  },
  {
    id: 'b2b_sales_cycle',
    name: 'Ciclo de ventas (B2B)',
    definition: 'Días entre primer contacto y cierre.',
    formula: 'Fecha cierre - Fecha primer contacto',
    pst: 'future',
    category: 'commercial',
    unit: 'days',
    positiveDirection: 'down',
    inputs: ['externo: CRM de ventas B2B con fechas de contacto y cierre'],
    supportedFilters: { brand: false, channel: false, store: false },
  },
  {
    id: 'brand_engagement',
    name: 'Engagement ponderado (marca)',
    definition: 'Interacción ajustada por tipo/alcance.',
    formula: '(Likes*1 + Coment*3 + Shares*5) / Seguidores * 100',
    pst: 'future',
    category: 'commercial',
    unit: 'percent',
    positiveDirection: 'up',
    inputs: ['externo: APIs de redes sociales (Meta/Instagram — Martel, Wrangler, Lee)'],
    supportedFilters: { brand: false, channel: false, store: false },
  },
  {
    id: 'promo_compliance',
    name: 'Promo compliance',
    definition: 'Grado de ejecución de promociones según plan en PDV.',
    formula: 'PDV conformes / PDV auditados * 100',
    pst: 'future',
    category: 'commercial',
    unit: 'percent',
    positiveDirection: 'up',
    inputs: ['externo: auditorías de PDV durante período de promo'],
    supportedFilters: { brand: false, channel: false, store: false },
  },
  {
    id: 'posm_otif',
    name: 'POSM OTIF',
    definition: '% de materiales de punto de venta entregados a tiempo y completos.',
    formula: 'Entregas OTIF / Entregas totales * 100',
    pst: 'future',
    category: 'logistics',
    unit: 'percent',
    positiveDirection: 'up',
    inputs: ['externo: sistema de entregas de materiales POP desde depósito'],
    supportedFilters: { brand: false, channel: false, store: false },
    obs: 'Ver proceso con depósito',
  },
  {
    id: 'planogram_compliance',
    name: 'Planograma cumplimiento',
    definition: '% de PDV que cumplen el planograma definido.',
    formula: 'PDV con planograma OK / PDV auditados * 100',
    pst: 'future',
    category: 'store',
    unit: 'percent',
    positiveDirection: 'up',
    inputs: ['externo: auditorías de planograma por tienda'],
    supportedFilters: { brand: false, channel: false, store: false },
  },
  {
    id: 'special_displays',
    name: 'Exhibiciones adicionales activas',
    definition: 'Cantidad y/o porcentaje de exhibiciones especiales vigentes vs plan.',
    formula: 'Exhibiciones activas / Exhibiciones plan * 100',
    pst: 'future',
    category: 'store',
    unit: 'percent',
    positiveDirection: 'up',
    inputs: ['externo: registro de exhibiciones adicionales por tienda'],
    supportedFilters: { brand: false, channel: false, store: false },
  },
  {
    id: 'share_of_shelf',
    name: 'Share of shelf',
    definition: 'Porcentaje de espacio lineal ocupado en góndola.',
    formula: 'Frentes propios / Frentes totales categoría * 100',
    pst: 'future',
    category: 'commercial',
    unit: 'percent',
    positiveDirection: 'up',
    inputs: ['externo: auditorías de espacio en góndola (relevante en canales multimarca)'],
    supportedFilters: { brand: false, channel: false, store: false },
  },
  {
    id: 'numeric_distribution',
    name: 'Cobertura ND',
    definition: 'Porcentaje de PDV que comercializan la marca (presencia).',
    formula: 'PDV con presencia / PDV totales * 100',
    pst: 'future',
    category: 'commercial',
    unit: 'percent',
    positiveDirection: 'up',
    inputs: ['externo: mapa de PDV y presencia activa de cada marca'],
    supportedFilters: { brand: false, channel: false, store: false },
  },
  {
    id: 'weighted_distribution',
    name: 'Cobertura WD',
    definition: 'Cobertura ponderada por venta de los PDV donde hay presencia.',
    formula: 'Σ ventas cadenas con presencia / Σ ventas totales * 100',
    pst: 'future',
    category: 'commercial',
    unit: 'percent',
    positiveDirection: 'up',
    inputs: ['externo: ventas por cadena/PDV del mercado total'],
    supportedFilters: { brand: false, channel: false, store: false },
  },
  {
    id: 'trade_activation_cost',
    name: 'Costo por activación trade',
    definition: 'Costo promedio por activación en PDV.',
    formula: 'Gasto trade / # activaciones',
    pst: 'future',
    category: 'commercial',
    unit: 'currency_pyg',
    positiveDirection: 'down',
    inputs: [
      'externo: gasto de trade marketing por activación',
      'externo: registro de activaciones en PDV',
    ],
    supportedFilters: { brand: false, channel: false, store: false },
  },

] as const

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Retorna el spec de un KPI por su id. undefined si no existe. */
export function getKpiById(id: string): FenixKpiSpec | undefined {
  return FENIX_KPI_CATALOG.find((k) => k.id === id)
}

/** Retorna todos los KPIs de una prioridad específica. */
export function getKpisByPst(pst: FenixPst): readonly FenixKpiSpec[] {
  return FENIX_KPI_CATALOG.filter((k) => k.pst === pst)
}

/** Retorna todos los KPIs que tienen una función de cálculo implementada. */
export function getImplementedKpis(): readonly FenixKpiSpec[] {
  return FENIX_KPI_CATALOG.filter((k) => k.calcFn !== undefined)
}
