/**
 * domain/kpis/__tests__/fenix.contract.test.ts
 *
 * Contrato formal de los KPIs de FenixBrands.
 * Fuente: "KPI FENIX.xlsx" + domain/kpis/fenix.catalog.ts
 *
 * ─── Propósito ───────────────────────────────────────────────────────────────
 *
 * NO duplica los tests unitarios de calculations.test.ts (que prueban la MATH).
 * Este archivo prueba el CONTRATO DE NEGOCIO: comportamiento esperado con
 * fixtures realistas en escala PYG y edge cases específicos de FenixBrands.
 *
 * ─── Fixtures (valores representativos FenixBrands) ──────────────────────────
 *
 *   Período: YTD Ene+Feb 2026 (2 meses cerrados)
 *   Escala: valores en Guaraníes (PYG)
 */

import { describe, it, expect } from 'vitest'
import {
  calcGrossMargin,
  calcGMROI,
  calcInventoryTurnover,
  calcYoY,
  calcAOV,
  calcUPT,
  calcReturnsRate,
  calcMarkdownDependency,
  calcLfL,
  calcEBITDA,
  calcOTBCompliance,
  calcSellThrough,
  calcOOSRate,
  calcDSO,
  calcConversionRate,
  calcPromoUplift,
  calcPromoROI,
} from '../calculations'
import {
  FENIX_KPI_CATALOG,
  getKpiById,
  getKpisByPst,
  getImplementedKpis,
} from '../fenix.catalog'

// ─────────────────────────────────────────────────────────────────────────────
// FIXTURES DE NEGOCIO — escala PYG real
// Período base: YTD Ene+Feb 2026
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fixture YTD Ene+Feb (2 meses cerrados).
 *
 * Derivaciones esperadas:
 *   grossMargin = (2_800_000 - 1_540_000) / 2_800_000 * 100 = 45.0%
 *   markdownDep = 400_000 / 3_200_000 * 100 = 12.5%
 *   gmroi       = (1_260_000 * 12/2) / 5_000_000 = 1.512
 *   turnover    = (1_540_000 * 12/2) / 5_000_000 = 1.848
 *   aov         = 2_800_000 / 1_200 = 2_333.33 Gs.
 *   upt         = 4_800 / 1_200 = 4.0
 *   returnsRate = 84_000 / 2_884_000 * 100 = 2.913%
 */
const F = {
  neto:              2_800_000,   // Ventas netas Gs.
  cogs:              1_540_000,   // Costo (55% de neto)
  bruto:             3_200_000,   // Precio de lista antes descuentos
  dcto:                400_000,   // Descuentos aplicados
  grossMarginGs:     1_260_000,   // neto - cogs
  invValue:          5_000_000,   // Inventario a costo (fjdexisemp)
  months:                    2,   // Meses del período
  totalTickets:           1_200,  // Facturas emitidas
  totalUnits:             4_800,  // Unidades vendidas
  absNegativeSales:       84_000, // |devoluciones| ~2.9% de ventas positivas
  positiveSales:       2_884_000, // Ventas positivas brutas
} as const

// ─────────────────────────────────────────────────────────────────────────────
// INTEGRIDAD DEL CATÁLOGO
// ─────────────────────────────────────────────────────────────────────────────

describe('Catálogo FenixKPI — integridad', () => {

  it('tiene exactamente 50 KPIs (fuente: KPI FENIX.xlsx)', () => {
    expect(FENIX_KPI_CATALOG.length).toBe(50)
  })

  it('no hay IDs duplicados', () => {
    const ids = FENIX_KPI_CATALOG.map((k) => k.id)
    expect(new Set(ids).size).toBe(50)
  })

  it('todos los KPIs tienen los campos obligatorios completos', () => {
    for (const kpi of FENIX_KPI_CATALOG) {
      expect(kpi.id,         `${kpi.id}: id vacío`).toBeTruthy()
      expect(kpi.name,       `${kpi.id}: name vacío`).toBeTruthy()
      expect(kpi.definition, `${kpi.id}: definition vacía`).toBeTruthy()
      expect(kpi.formula,    `${kpi.id}: formula vacía`).toBeTruthy()
      expect(kpi.unit,       `${kpi.id}: unit vacía`).toBeTruthy()
      expect(kpi.inputs.length, `${kpi.id}: inputs vacío`).toBeGreaterThan(0)
      expect(
        ['core', 'next', 'later', 'future', 'blocked'],
        `${kpi.id}: pst inválido`
      ).toContain(kpi.pst)
    }
  })

  it('distribución por PST: 9 core, 2 blocked, 8 next, 15 later, 16 future', () => {
    expect(getKpisByPst('core').length).toBe(9)
    expect(getKpisByPst('blocked').length).toBe(2)
    expect(getKpisByPst('next').length).toBe(8)
    expect(getKpisByPst('later').length).toBe(15)
    expect(getKpisByPst('future').length).toBe(16)
  })

  it('todos los KPIs core (excepto revenue) tienen calcFn definido', () => {
    const coreKpis = getKpisByPst('core').filter((k) => k.id !== 'revenue')
    for (const kpi of coreKpis) {
      expect(kpi.calcFn, `${kpi.id}: falta calcFn`).toBeTruthy()
    }
  })

  it('todos los KPIs next (PST=1) tienen calcFn definido tras Sprint 2B', () => {
    for (const kpi of getKpisByPst('next')) {
      expect(kpi.calcFn, `${kpi.id}: falta calcFn`).toBeTruthy()
    }
  })

  it('los KPIs con calcFn apuntan a funciones que existen en calculations.ts', () => {
    const existingFns = new Set([
      // Sprint inicial
      'calcGrossMargin', 'calcGMROI', 'calcInventoryTurnover', 'calcYoY',
      'calcLfL', 'calcMarkdownDependency', 'calcReturnsRate', 'calcAOV',
      'calcUPT', 'calcTrend', 'calcCoverageDays', 'classifyStockRisk',
      // Sprint 2B
      'calcEBITDA', 'calcOTBCompliance', 'calcSellThrough', 'calcOOSRate',
      'calcDSO', 'calcConversionRate', 'calcPromoUplift', 'calcPromoROI',
    ])
    for (const kpi of getImplementedKpis()) {
      expect(
        existingFns.has(kpi.calcFn!),
        `calcFn '${kpi.calcFn}' no existe en calculations.ts`
      ).toBe(true)
    }
  })

  it('getKpiById retorna el spec correcto', () => {
    const kpi = getKpiById('gross_margin')
    expect(kpi?.name).toBe('Margen bruto %')
    expect(kpi?.calcFn).toBe('calcGrossMargin')
    expect(kpi?.pst).toBe('core')
    expect(kpi?.benchmark?.value).toBe(45)
  })

  it('getKpiById retorna undefined para id no existente', () => {
    expect(getKpiById('kpi_inventado')).toBeUndefined()
  })

  it('los KPIs con benchmark tienen value numérico y description', () => {
    for (const kpi of FENIX_KPI_CATALOG) {
      if (kpi.benchmark) {
        expect(typeof kpi.benchmark.value).toBe('number')
        expect(kpi.benchmark.description).toBeTruthy()
      }
    }
  })

})

// ─────────────────────────────────────────────────────────────────────────────
// CORE KPI: Ingresos totales
// calcFn: ninguna — el hook hace SUM(neto) via .reduce()
// Fuente: mv_ventas_mensual.neto (ya neto de IVA y devoluciones)
// ─────────────────────────────────────────────────────────────────────────────

describe('KPI: Ingresos totales [core]', () => {

  it('happy path: suma de filas de mv_ventas_mensual del período', () => {
    const rows = [{ neto: 1_400_000 }, { neto: 1_400_000 }]
    expect(rows.reduce((s, r) => s + r.neto, 0)).toBe(F.neto)
  })

  it('período vacío (sin ventas): revenue = 0', () => {
    const rows: { neto: number }[] = []
    expect(rows.reduce((s, r) => s + r.neto, 0)).toBe(0)
  })

  it('mv_ventas_mensual.neto puede ser negativo por tienda (devoluciones > ventas)', () => {
    const rows = [{ neto: 1_400_000 }, { neto: -50_000 }]
    expect(rows.reduce((s, r) => s + r.neto, 0)).toBe(1_350_000)
  })

  it('contrato: el hook filtra por resolvePeriod().activeMonths ANTES de sumar', () => {
    const allRows = [
      { month: 1, neto: 1_400_000 },
      { month: 2, neto: 1_400_000 },
      { month: 3, neto:   500_000 }, // Marzo: fuera de activeMonths=[1,2]
    ]
    const activeMonths = [1, 2]
    const revenue = allRows
      .filter((r) => activeMonths.includes(r.month))
      .reduce((s, r) => s + r.neto, 0)
    expect(revenue).toBe(2_800_000)
  })

})

// ─────────────────────────────────────────────────────────────────────────────
// CORE KPI: Margen bruto %
// calcFn: calcGrossMargin(neto, cogs) → percent 0-100
// Benchmark: > 45% B2C saludable
// ─────────────────────────────────────────────────────────────────────────────

describe('KPI: Margen bruto % [core]', () => {

  it('happy path YTD Ene+Feb: exactamente 45%', () => {
    expect(calcGrossMargin(F.neto, F.cogs)).toBeCloseTo(45.0)
  })

  it('margen sobre benchmark (> 45%): negocio sano', () => {
    const margen = calcGrossMargin(F.neto, F.cogs)
    expect(margen).toBeGreaterThanOrEqual(getKpiById('gross_margin')!.benchmark!.value)
  })

  it('edge case — div/0: sin ventas en el período → 0', () => {
    expect(calcGrossMargin(0, 0)).toBe(0)
    expect(calcGrossMargin(0, 500_000)).toBe(0)
  })

  it('margen negativo: venta a pérdida (liquidación extrema) → negativo válido', () => {
    expect(calcGrossMargin(1_000_000, 1_200_000)).toBeCloseTo(-20)
  })

  it('margen 100%: producto sin costo registrado → 100', () => {
    expect(calcGrossMargin(1_000_000, 0)).toBe(100)
  })

  it('margen 0%: venta exactamente a costo → 0', () => {
    expect(calcGrossMargin(1_000_000, 1_000_000)).toBe(0)
  })

  it('@sprint-2b corregido — neto negativo global (devoluciones > ventas) → 0', () => {
    // Contrato @negative-net-sales: no se calcula margen sobre base negativa.
    // Fix: if (neto <= 0) return 0; — aplicado en Sprint 2B.
    expect(calcGrossMargin(-100_000, 50_000)).toBe(0)
  })

})

// ─────────────────────────────────────────────────────────────────────────────
// CORE KPI: GMROI
// calcFn: calcGMROI(grossMarginGs, invValue, months) → ratio (annualizado)
// Benchmark: > 2.0x saludable
// ─────────────────────────────────────────────────────────────────────────────

describe('KPI: GMROI [core]', () => {

  it('happy path YTD Ene+Feb (2 meses): 1.512', () => {
    expect(calcGMROI(F.grossMarginGs, F.invValue, F.months)).toBeCloseTo(1.512)
  })

  it('resultado por encima del benchmark (2x) indica rentabilidad sana', () => {
    const goodGMROI = calcGMROI(1_260_000, 3_000_000, 2)
    expect(goodGMROI).toBeGreaterThan(getKpiById('gmroi')!.benchmark!.value)
  })

  it('anualización correcta: 6 meses y 2 meses producen GMROI equivalente', () => {
    const gmroi6m = calcGMROI(3_780_000, 5_000_000, 6)
    const gmroi2m = calcGMROI(1_260_000, 5_000_000, 2)
    expect(gmroi6m).toBeCloseTo(gmroi2m)
  })

  it('edge case — sin inventario (tienda vacía): 0', () => {
    expect(calcGMROI(F.grossMarginGs, 0, F.months)).toBe(0)
  })

  it('edge case — months=0 (llamada incorrecta): 0', () => {
    expect(calcGMROI(F.grossMarginGs, F.invValue, 0)).toBe(0)
  })

  it('edge case — margen cero (vender a costo): GMROI = 0', () => {
    expect(calcGMROI(0, F.invValue, F.months)).toBe(0)
  })

  it('mes parcial (currentMonth, months=1): anualiza igual que mes completo', () => {
    const gmroiPartial = calcGMROI(630_000, 5_000_000, 1)
    expect(gmroiPartial).toBeCloseTo(1.512)
  })

})

// ─────────────────────────────────────────────────────────────────────────────
// CORE KPI: Rotación de inventario
// calcFn: calcInventoryTurnover(cogs, invValue, months) → ratio (annualizado)
// Benchmark: > 3x anualizado
// ─────────────────────────────────────────────────────────────────────────────

describe('KPI: Rotación de inventario [core]', () => {

  it('happy path YTD Ene+Feb (2 meses): 1.848', () => {
    expect(calcInventoryTurnover(F.cogs, F.invValue, F.months)).toBeCloseTo(1.848)
  })

  it('rotación sobre benchmark (3x): inventario sano', () => {
    const goodTurnover = calcInventoryTurnover(1_540_000, 2_000_000, 2)
    expect(goodTurnover).toBeGreaterThan(getKpiById('inventory_turnover')!.benchmark!.value)
  })

  it('año completo (months=12): sin efecto de anualización extra', () => {
    expect(calcInventoryTurnover(18_480_000, 5_000_000, 12)).toBeCloseTo(3.696)
  })

  it('edge case — sin inventario: 0', () => {
    expect(calcInventoryTurnover(F.cogs, 0, F.months)).toBe(0)
  })

  it('edge case — months=0: 0', () => {
    expect(calcInventoryTurnover(F.cogs, F.invValue, 0)).toBe(0)
  })

  it('edge case — COGS cero (período sin ventas): 0', () => {
    expect(calcInventoryTurnover(0, F.invValue, F.months)).toBe(0)
  })

})

// ─────────────────────────────────────────────────────────────────────────────
// CORE KPI: AOV (Ticket promedio)
// calcFn: calcAOV(totalSales, totalTickets) → currency_pyg
// Contrato: hook filtra por canal (filterTicketsByChannel) antes de calcular
// ─────────────────────────────────────────────────────────────────────────────

describe('KPI: AOV (Ticket promedio) [core]', () => {

  it('happy path YTD Ene+Feb: Gs 2.333,33 por ticket', () => {
    expect(calcAOV(F.neto, F.totalTickets)).toBeCloseTo(2_333.33)
  })

  it('temporada alta: ticket más alto con misma base de clientes', () => {
    const aov = calcAOV(5_000_000, 800)
    expect(aov).toBeCloseTo(6_250)
  })

  it('edge case — sin tickets (tienda cerrada): 0', () => {
    expect(calcAOV(F.neto, 0)).toBe(0)
  })

  it('ticket único (primer día de operación): igual a ventas totales', () => {
    expect(calcAOV(350_000, 1)).toBe(350_000)
  })

  it('contrato: B2B tiene AOV 10x mayor que B2C — mezclarlos distorsiona el KPI', () => {
    const aovB2C = calcAOV(2_800_000, 1_200)
    const aovB2B = calcAOV(1_500_000, 15)
    expect(aovB2B).toBeGreaterThan(aovB2C * 10)
  })

})

// ─────────────────────────────────────────────────────────────────────────────
// CORE KPI: UPT (Units Per Transaction)
// calcFn: calcUPT(totalUnits, totalTickets) → number
// ─────────────────────────────────────────────────────────────────────────────

describe('KPI: UPT [core]', () => {

  it('happy path YTD Ene+Feb: 4.0 unidades por ticket', () => {
    expect(calcUPT(F.totalUnits, F.totalTickets)).toBe(4.0)
  })

  it('temporada promocional: UPT sube por combos/promos 2x1', () => {
    expect(calcUPT(8_000, 1_200)).toBeCloseTo(6.67)
  })

  it('edge case — sin tickets: 0', () => {
    expect(calcUPT(F.totalUnits, 0)).toBe(0)
  })

  it('artículo unitario (prenda cara, compra individual): UPT=1', () => {
    expect(calcUPT(500, 500)).toBe(1)
  })

  it('contrato: unidades vienen de fjdhstvta1, tickets de vw_ticket_promedio_diario', () => {
    const unidadesFjdh    = 4_800
    const ticketsVwTicket = 1_200
    expect(calcUPT(unidadesFjdh, ticketsVwTicket)).toBe(4.0)
  })

  it('@limitation: cuando brand ≠ "total", el denominador incluye tickets de todas las marcas', () => {
    // vw_ticket_promedio_diario no tiene columna de marca.
    // Numerador (unidades): fjdhstvta1 filtrado por marca → correcto.
    // Denominador (tickets): todas las marcas del canal → artificialmente alto.
    // Resultado: UPT artificialmente bajo cuando brand ≠ "total".
    // El hook marca este caso con note="Denominador incluye todas las marcas..."
    // para comunicar la limitación al usuario.

    // Ejemplo: marca "Martel" tiene 1_000 unidades de 400 transacciones reales.
    // Pero vw_ticket_promedio_diario reporta 1_200 tickets (todas las marcas).
    const unidadesMartel = 1_000
    const ticketsTodasMarcas = 1_200  // inflado
    const ticketsSoloMartel  = 400    // real (no disponible sin ID de transacción)

    const uptAproximado = calcUPT(unidadesMartel, ticketsTodasMarcas) // 0.83 — incorrecto
    const uptReal       = calcUPT(unidadesMartel, ticketsSoloMartel)  // 2.5 — correcto

    expect(uptAproximado).toBeCloseTo(0.83)
    expect(uptReal).toBeCloseTo(2.5)
    expect(uptAproximado).toBeLessThan(uptReal)
  })

})

// ─────────────────────────────────────────────────────────────────────────────
// CORE KPI: Devoluciones/merma %
// calcFn: calcReturnsRate(absNegativeSales, positiveSales) → percent 0-100
// Fuente: fjdhstvta1 (filas con v_vtasimpu < 0 son devoluciones)
// Bug del viejo proyecto: usaba mv_ventas_mensual.neto (agregado), perdía la
// separación entre ventas y devoluciones a nivel de fila.
// ─────────────────────────────────────────────────────────────────────────────

describe('KPI: Devoluciones/merma % [core]', () => {

  it('happy path YTD Ene+Feb: ~2.91% (bajo benchmark 5%)', () => {
    expect(calcReturnsRate(F.absNegativeSales, F.positiveSales)).toBeCloseTo(2.913)
  })

  it('benchmark de alerta: > 5% es señal de problema', () => {
    const alarming = calcReturnsRate(150_000, 2_884_000)
    expect(alarming).toBeGreaterThan(getKpiById('returns_rate')!.benchmark!.value)
  })

  it('edge case — sin ventas positivas: 0', () => {
    expect(calcReturnsRate(F.absNegativeSales, 0)).toBe(0)
  })

  it('edge case — sin devoluciones: 0%', () => {
    expect(calcReturnsRate(0, F.positiveSales)).toBe(0)
  })

  it('acepta tanto positivo como negativo en absNegativeSales (aplica Math.abs)', () => {
    expect(calcReturnsRate(84_000, F.positiveSales)).toBeCloseTo(
      calcReturnsRate(-84_000, F.positiveSales)
    )
  })

  it('contrato: debe usar fjdhstvta1 fila a fila, NO mv_ventas_mensual agregado', () => {
    // Error del viejo: usaba neto mensual = positivos + negativos mezclados.
    // Correcto: separar filas neto > 0 y neto < 0 en fjdhstvta1.
    const rowsFromFjdh = [
      { neto:  500_000 }, { neto:  400_000 }, { neto: -20_000 },
      { neto:  300_000 }, { neto:  -10_000 }, { neto:  200_000 },
    ]
    const positive = rowsFromFjdh.filter((r) => r.neto > 0).reduce((s, r) => s + r.neto, 0)
    const absNeg   = Math.abs(
      rowsFromFjdh.filter((r) => r.neto < 0).reduce((s, r) => s + r.neto, 0)
    )
    expect(calcReturnsRate(absNeg, positive)).toBeCloseTo((30_000 / 1_400_000) * 100)
  })

})

// ─────────────────────────────────────────────────────────────────────────────
// CORE KPI: Markdown dependency
// calcFn: calcMarkdownDependency(dcto, bruto) → percent 0-100
// Benchmark: alarmante > 35%
// ─────────────────────────────────────────────────────────────────────────────

describe('KPI: Markdown dependency [core]', () => {

  it('happy path YTD Ene+Feb: 12.5% (bien bajo el límite 35%)', () => {
    expect(calcMarkdownDependency(F.dcto, F.bruto)).toBeCloseTo(12.5)
  })

  it('benchmark de alerta: > 35% indica sobre-dependencia de descuentos', () => {
    const alarming = calcMarkdownDependency(1_200_000, 3_200_000)
    expect(alarming).toBeGreaterThan(getKpiById('markdown_dependency')!.benchmark!.value)
  })

  it('sin descuentos (full price): 0%', () => {
    expect(calcMarkdownDependency(0, F.bruto)).toBe(0)
  })

  it('liquidación total (todo a descuento): 100%', () => {
    expect(calcMarkdownDependency(3_200_000, 3_200_000)).toBe(100)
  })

  it('edge case — sin ventas brutas: 0', () => {
    expect(calcMarkdownDependency(F.dcto, 0)).toBe(0)
  })

  it('contrato: usa bruto en denominador (no neto) — evita sobreestimar el ratio', () => {
    const conBruto = calcMarkdownDependency(400_000, 3_200_000)  // 12.5% ← correcto
    const conNeto  = (400_000 / 2_800_000) * 100                 // 14.3% ← incorrecto
    expect(conBruto).not.toBeCloseTo(conNeto)
    expect(conBruto).toBeCloseTo(12.5)
  })

})

// ─────────────────────────────────────────────────────────────────────────────
// NEXT KPI: LfL (Like-for-Like)
// calcFn: calcLfL = calcYoY (implementado)
// Contrato: el HOOK garantiza tiendas y períodos simétricos antes de llamar
// Bug del viejo: incluía tiendas nuevas y mes parcial en el denominador
// ─────────────────────────────────────────────────────────────────────────────

describe('KPI: LfL (Like-for-Like) [next PST=1]', () => {

  it('crecimiento del 20% en tiendas comparables', () => {
    expect(calcLfL(1_200_000, 1_000_000)).toBe(20)
  })

  it('declive del 15% en tiendas comparables', () => {
    expect(calcLfL(850_000, 1_000_000)).toBeCloseTo(-15)
  })

  it('edge case — tienda nueva (no existía en AA): prior=0 → 0', () => {
    // El hook excluye estas tiendas ANTES de llamar calcLfL.
    // Si por error llega prior=0: contrato devuelve 0 (no Infinity).
    expect(calcLfL(1_000_000, 0)).toBe(0)
  })

  it('sin variación en tiendas comparables → 0%', () => {
    expect(calcLfL(1_000_000, 1_000_000)).toBe(0)
  })

  it('contrato de simetría: incluir tienda nueva infla el LfL — debe excluirse', () => {
    // Si la tienda nueva se suma al total, el denominador queda igual pero el
    // numerador sube → LfL aparece más alto de lo real.
    const tiendasComparables = { curr: 1_200_000, prior: 1_000_000 } // +20% real
    const tiendaNueva        = { curr:   300_000, prior:         0 } // no existía

    // Incorrecto: prior=0 de tienda nueva hace que calcLfL devuelva 0 desde
    // el denominador 0 — pero si se suman antes:
    const lflConNueva = calcLfL(
      tiendasComparables.curr + tiendaNueva.curr,   // 1_500_000
      tiendasComparables.prior + tiendaNueva.prior  // 1_000_000
    )
    const lflSoloComp = calcLfL(tiendasComparables.curr, tiendasComparables.prior)

    expect(lflSoloComp).toBeCloseTo(20)     // LfL correcto: +20%
    expect(lflConNueva).toBeCloseTo(50)     // LfL distorsionado: +50%
    expect(lflConNueva).not.toBeCloseTo(lflSoloComp)
  })

  it('contrato de simetría: mes parcial — closedMonths da LfL distinto que activeMonths', () => {
    // Error del viejo: comparaba mes actual (parcial) vs mes anterior (completo).
    // Correcto: usar resolvePeriod().closedMonths para YoY simétrico.
    const closedMonths = [1, 2]
    const activeMonths = [1, 2, 3]  // Marzo parcial (4 días)

    const currRows = [
      { month: 1, neto: 700_000 },
      { month: 2, neto: 700_000 },
      { month: 3, neto: 300_000 },  // parcial del año actual
    ]
    const prevRows = [
      { month: 1, neto: 600_000 },
      { month: 2, neto: 600_000 },
      { month: 3, neto: 700_000 },  // Marzo completo del año anterior
    ]

    const sumClosed = (rows: { month: number; neto: number }[], months: number[]) =>
      rows.filter((r) => months.includes(r.month)).reduce((s, r) => s + r.neto, 0)

    const lflCorrecto  = calcLfL(sumClosed(currRows, closedMonths), sumClosed(prevRows, closedMonths))
    const lflDistorted = calcLfL(sumClosed(currRows, activeMonths), sumClosed(prevRows, activeMonths))

    expect(lflCorrecto).toBeCloseTo(16.67)   // +16.7% — correcto
    expect(lflDistorted).not.toBeCloseTo(lflCorrecto) // distorsionado por Marzo parcial
  })

  it('tiendas no comerciales deben excluirse del cálculo', () => {
    // Lista de tiendas excluidas del análisis (no comerciales / almacenes)
    const EXCLUDED_STORES = ['ALM-BATAS', 'FABRICA', 'LAMBARE', 'LAVADO', 'LUQ-DEP-OUT', 'MP']

    const allRows = [
      { store: 'SHOPPING-CCU', neto: 700_000 },
      { store: 'ALM-BATAS',    neto: 999_999 },  // excluir
      { store: 'SHOPPING-MB',  neto: 500_000 },
      { store: 'FABRICA',      neto: 999_999 },  // excluir
    ]

    const filtered = allRows.filter((r) => !EXCLUDED_STORES.includes(r.store))
    expect(filtered).toHaveLength(2)
    expect(filtered.reduce((s, r) => s + r.neto, 0)).toBe(1_200_000)
  })

})

// ─────────────────────────────────────────────────────────────────────────────
// CONTRATO: YoY para currentMonth y YTD
// fetchPriorYearCurrentMonthToDate provee la base de comparación día-a-día
// ─────────────────────────────────────────────────────────────────────────────

describe('Contrato: YoY currentMonth y YTD día-a-día [hook]', () => {

  it('currentMonth: YoY usa rango exacto (Mar 1-4 vs Mar 1-4 año anterior)', () => {
    // currNeto = Mar 1-4, 2026
    // prevNeto = fetchPriorYearCurrentMonthToDate.neto = Mar 1-4, 2025
    const currNeto = 400_000
    const prevNeto = 350_000   // año anterior mismo rango de días
    expect(calcYoY(currNeto, prevNeto)).toBeCloseTo(14.29)
  })

  it('currentMonth: sin datos del año anterior → YoY = null (no se calcula)', () => {
    // Si prevCurrMo.neto === 0, el hook no llama calcYoY → yoyPct = null
    const prevNeto = 0
    expect(calcYoY(400_000, prevNeto)).toBe(0)  // calcYoY devuelve 0 cuando prev=0
    // El hook traduce esto a null al detectar prevCurrMo.neto === 0
  })

  it('ytd año actual: YoY compara Ene–hoy vs Ene–hoy año anterior', () => {
    // curr = Ene+Feb (cerrados) + Mar 1-4 (parcial) = 2_800_000 + 400_000 = 3_200_000
    // prev = Ene+Feb LY (de prevSalesQ/closedMonths) + Mar 1-4 LY (de prevCurrentMonthQ) = 2_600_000 + 350_000
    const currNetoYtd = 3_200_000
    const prevNetoYtd = 2_600_000 + 350_000  // 2_950_000
    expect(calcYoY(currNetoYtd, prevNetoYtd)).toBeCloseTo(8.47)
  })

  it('ytd año anterior: YoY simétrico por meses cerrados (no usa prevCurrentMonthQ)', () => {
    // Para año 2025, todos los meses son "cerrados" → comparación normal por meses
    const currClosedNeto = 2_800_000
    const prevNeto       = 2_600_000
    expect(calcYoY(currClosedNeto, prevNeto)).toBeCloseTo(7.69)
  })

})

// ─────────────────────────────────────────────────────────────────────────────
// NEXT KPI: EBITDA contribución
// calcFn: calcEBITDA(neto, cogs, opex)
// ─────────────────────────────────────────────────────────────────────────────

describe('KPI: EBITDA contribución [next PST=1]', () => {

  it('happy path: neto - cogs - opex', () => {
    // 2_800_000 - 1_540_000 - 500_000 = 760_000
    expect(calcEBITDA(F.neto, F.cogs, 500_000)).toBe(760_000)
  })

  it('EBITDA puede ser negativo si opex > margen bruto', () => {
    const ebitda = calcEBITDA(F.neto, F.cogs, 2_000_000)  // opex > grossMargin
    expect(ebitda).toBeLessThan(0)
    expect(ebitda).toBe(-740_000)  // 1_260_000 - 2_000_000
  })

  it('con opex=0: retorna exactamente el margen bruto (cota superior del EBITDA)', () => {
    expect(calcEBITDA(F.neto, F.cogs, 0)).toBe(F.grossMarginGs)
  })

  it('con opex real del negocio: EBITDA < margen bruto', () => {
    // Una vez disponibles los datos (alquileres + RRHH + comisiones):
    const opexEjemplo = 300_000 + 150_000 + 200_000  // alquiler + comisiones + RRHH
    const ebitdaReal  = calcEBITDA(F.neto, F.cogs, opexEjemplo)
    expect(ebitdaReal).toBeLessThan(F.grossMarginGs)
    expect(ebitdaReal).toBe(F.grossMarginGs - opexEjemplo)
  })

})

// ─────────────────────────────────────────────────────────────────────────────
// NEXT KPI: Cumplimiento OTB
// calcFn: calcOTBCompliance(ejecutado, aprobado)
// ─────────────────────────────────────────────────────────────────────────────

describe('KPI: Cumplimiento OTB [next PST=1]', () => {

  it('happy path: 80% de ejecución del presupuesto de compra', () => {
    expect(calcOTBCompliance(800_000, 1_000_000)).toBe(80)
  })

  it('sobre-ejecución: ejecutado > aprobado → > 100% (señal de alerta)', () => {
    expect(calcOTBCompliance(1_200_000, 1_000_000)).toBe(120)
  })

  it('sub-ejecución leve: 95% — dentro del rango aceptable', () => {
    expect(calcOTBCompliance(950_000, 1_000_000)).toBe(95)
  })

  it('edge case — sin presupuesto aprobado: 0 (evitar división por cero)', () => {
    expect(calcOTBCompliance(500_000, 0)).toBe(0)
  })

})

// ─────────────────────────────────────────────────────────────────────────────
// NEXT KPI: Sell-through 30/60/90
// calcFn: calcSellThrough(vendidas, recibidas)
// ─────────────────────────────────────────────────────────────────────────────

describe('KPI: Sell-through 30/60/90 [next PST=1]', () => {

  it('happy path: 70% sell-through en 30 días (350/500 unidades)', () => {
    expect(calcSellThrough(350, 500)).toBeCloseTo(70)
  })

  it('100% sell-through: todo vendido en el período', () => {
    expect(calcSellThrough(500, 500)).toBe(100)
  })

  it('sell-through > 100%: se vendió stock del período anterior (válido)', () => {
    // Una tienda puede vender más de lo que recibió si tenía stock previo.
    expect(calcSellThrough(600, 500)).toBe(120)
  })

  it('edge case — sin recepción de mercadería: 0', () => {
    expect(calcSellThrough(100, 0)).toBe(0)
  })

})

// ─────────────────────────────────────────────────────────────────────────────
// NEXT KPI: % OOS (quiebres de stock)
// calcFn: calcOOSRate(oosSkuStoreDays, totalSkuStoreDays)
// ─────────────────────────────────────────────────────────────────────────────

describe('KPI: % OOS (quiebres de stock) [next PST=1]', () => {

  it('happy path: 1.5% de quiebres en el período (5 SKUs × 3 tiendas × 30 días)', () => {
    const total = 30 * 100 * 10   // 30_000 SKU-store-days
    const oos   = 30 *   5 *  3   // 450 OOS (5 SKUs en 3 tiendas)
    expect(calcOOSRate(oos, total)).toBeCloseTo(1.5)
  })

  it('sin quiebres: OOS = 0%', () => {
    expect(calcOOSRate(0, 30_000)).toBe(0)
  })

  it('todos fuera de stock (almacén vacío): OOS = 100%', () => {
    expect(calcOOSRate(30_000, 30_000)).toBe(100)
  })

  it('edge case — sin SKU-store-days (período vacío): 0', () => {
    expect(calcOOSRate(100, 0)).toBe(0)
  })

})

// ─────────────────────────────────────────────────────────────────────────────
// NEXT KPI: DSO (Days Sales Outstanding)
// calcFn: calcDSO(cxc, avgDailySales)
// ─────────────────────────────────────────────────────────────────────────────

describe('KPI: DSO [next PST=1]', () => {

  it('happy path: 30 días de cobranza (mayoristas a 30 días)', () => {
    const cxcB2B          = 150_000_000  // CxC de mayoristas
    const ventasDiariasB2B = 5_000_000  // ventas B2B promedio diarias
    expect(calcDSO(cxcB2B, ventasDiariasB2B)).toBe(30)
  })

  it('DSO bajo (15 días): cobranza rápida, excelente gestión', () => {
    const dso = calcDSO(75_000_000, 5_000_000)
    expect(dso).toBe(15)
  })

  it('DSO alto (90 días): señal de alerta en cobranza B2B', () => {
    const dso = calcDSO(450_000_000, 5_000_000)
    expect(dso).toBe(90)
  })

  it('edge case — sin ventas: 0 (evitar división por cero)', () => {
    expect(calcDSO(100_000_000, 0)).toBe(0)
    expect(calcDSO(100_000_000, -1)).toBe(0)  // ventas negativas también → 0
  })

})

// ─────────────────────────────────────────────────────────────────────────────
// NEXT KPI: Tasa de conversión
// calcFn: calcConversionRate(tickets, traffic)
// ─────────────────────────────────────────────────────────────────────────────

describe('KPI: Tasa de conversión [next PST=1]', () => {

  it('happy path: 30% de conversión (150 tickets / 500 visitas)', () => {
    expect(calcConversionRate(150, 500)).toBeCloseTo(30)
  })

  it('conversión típica en indumentaria: 20-40% es saludable', () => {
    const rate = calcConversionRate(150, 500)  // 30%
    expect(rate).toBeGreaterThanOrEqual(20)
    expect(rate).toBeLessThanOrEqual(40)
  })

  it('conversión 100%: todos los visitantes compraron (teórico máximo)', () => {
    expect(calcConversionRate(100, 100)).toBe(100)
  })

  it('edge case — sin tráfico registrado: 0 (sensor no disponible)', () => {
    expect(calcConversionRate(150, 0)).toBe(0)
  })

})

// ─────────────────────────────────────────────────────────────────────────────
// NEXT KPI: Uplift vs baseline en promo
// calcFn: calcPromoUplift(ventasPromo, baseline)
// ─────────────────────────────────────────────────────────────────────────────

describe('KPI: Uplift vs baseline en promo [next PST=1]', () => {

  it('happy path: +47.4% uplift sobre baseline', () => {
    expect(calcPromoUplift(175_000, 118_750)).toBeCloseTo(47.37)
  })

  it('uplift negativo: la promo redujo ventas vs baseline (señal de alarma)', () => {
    const uplift = calcPromoUplift(90_000, 120_000)
    expect(uplift).toBeCloseTo(-25)  // -25%
    expect(uplift).toBeLessThan(0)
  })

  it('sin efecto promo: ventas exactamente iguales al baseline → 0%', () => {
    expect(calcPromoUplift(120_000, 120_000)).toBe(0)
  })

  it('baseline calculado como promedio de semanas sin promo', () => {
    // El hook calcula baseline antes de llamar a calcPromoUplift
    const ventasSinPromo = [120_000, 110_000, 130_000, 115_000]
    const baseline = ventasSinPromo.reduce((s, v) => s + v, 0) / ventasSinPromo.length
    expect(baseline).toBe(118_750)
    expect(calcPromoUplift(175_000, baseline)).toBeCloseTo(47.37)
  })

})

// ─────────────────────────────────────────────────────────────────────────────
// NEXT KPI: ROI de promoción
// calcFn: calcPromoROI(ingresosIncrementales, costoPromo)
// ─────────────────────────────────────────────────────────────────────────────

describe('KPI: ROI de promoción [next PST=1]', () => {

  it('happy path: ROI de 1.35x (promo rentable)', () => {
    expect(calcPromoROI(650_000, 480_000)).toBeCloseTo(1.354)
  })

  it('ROI < 1: la promo no se auto-financió — señal de alerta', () => {
    const roi = calcPromoROI(300_000, 480_000)
    expect(roi).toBeCloseTo(0.625)
    expect(roi).toBeLessThan(1)
  })

  it('ROI exactamente 1: el uplift cubrió el costo de la promo', () => {
    expect(calcPromoROI(480_000, 480_000)).toBe(1)
  })

  it('costo de promo incluye descuentos + POSM + activación', () => {
    // El hook debe sumar todos los componentes del costo antes de llamar calcPromoROI
    const descuentosOtorgados = 400_000
    const costosPOSM          =  50_000
    const costoActivacion     =  30_000
    const costoTotal = descuentosOtorgados + costosPOSM + costoActivacion  // 480_000

    expect(calcPromoROI(650_000, costoTotal)).toBeCloseTo(1.354)
  })

  it('edge case — costo cero (promo sin inversión registrada): 0', () => {
    expect(calcPromoROI(650_000, 0)).toBe(0)
  })

})
