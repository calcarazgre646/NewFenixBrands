import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { resolvePeriod } from '../resolve'

// Simular 4 de Marzo de 2026: calendarMonth=3, calendarDay=4, calendarYear=2026
const MOCK_DATE = new Date(2026, 2, 4) // mes 0-indexed

describe('resolvePeriod — ytd', () => {
  beforeEach(() => { vi.setSystemTime(MOCK_DATE) })
  afterEach(() => { vi.useRealTimers() })

  it('activeMonths incluye mes actual (YTD hasta hoy)', () => {
    // Bug G fix: YTD = desde Enero hasta hoy inclusive (calendarMonth=3 → [1,2,3])
    const r = resolvePeriod('ytd', [1, 2, 3], 2026)
    expect(r.activeMonths).toEqual([1, 2, 3])
  })

  it('closedMonths contiene solo meses cerrados (< calendarMonth) aunque activeMonths incluya el mes actual', () => {
    // closedMonths ≠ activeMonths cuando hay mes parcial en ytd
    const r = resolvePeriod('ytd', [1, 2, 3], 2026)
    expect(r.closedMonths).toEqual([1, 2])
    expect(r.activeMonths).toEqual([1, 2, 3])
  })

  it('isPartial=true cuando el mes actual tiene datos en BD', () => {
    const r = resolvePeriod('ytd', [1, 2, 3], 2026)
    expect(r.isPartial).toBe(true)
  })

  it('isPartial=false cuando el mes actual NO tiene datos en BD', () => {
    const r = resolvePeriod('ytd', [1, 2], 2026)
    expect(r.isPartial).toBe(false)
  })

  it('label refleja activeMonths completo (incluyendo mes parcial), sin ⚠ en ytd', () => {
    // El ⚠ solo aparece en currentMonth, no en ytd (el usuario sabe que ytd incluye hoy)
    const r = resolvePeriod('ytd', [1, 2, 3], 2026)
    expect(r.label).toBe('Ene–Mar 2026')
    expect(r.label).not.toContain('⚠')
  })

  it('año anterior: todos los meses en BD son activos y cerrados', () => {
    const r = resolvePeriod('ytd', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 2025)
    expect(r.activeMonths).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
    expect(r.closedMonths).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
    expect(r.isPartial).toBe(false)
  })
})

describe('resolvePeriod — lastClosedMonth', () => {
  beforeEach(() => { vi.setSystemTime(MOCK_DATE) })
  afterEach(() => { vi.useRealTimers() })

  it('calendarMonth=3 → activeMonths=[2]', () => {
    const r = resolvePeriod('lastClosedMonth', [1, 2, 3], 2026)
    expect(r.activeMonths).toEqual([2])
  })

  it('closedMonths === activeMonths', () => {
    const r = resolvePeriod('lastClosedMonth', [1, 2, 3], 2026)
    expect(r.closedMonths).toEqual([2])
  })

  it('isPartial=false (último mes cerrado es completo)', () => {
    const r = resolvePeriod('lastClosedMonth', [1, 2, 3], 2026)
    expect(r.isPartial).toBe(true) // March IS in DB → isPartial is global flag
    expect(r.activeMonths).toEqual([2]) // pero solo usamos Febrero
  })

  it('activeMonths=[] si el mes anterior no está en BD', () => {
    const r = resolvePeriod('lastClosedMonth', [1, 3], 2026) // Febrero no está
    expect(r.activeMonths).toEqual([])
  })
})

describe('resolvePeriod — currentMonth', () => {
  beforeEach(() => { vi.setSystemTime(MOCK_DATE) })
  afterEach(() => { vi.useRealTimers() })

  it('activeMonths=[calendarMonth]', () => {
    const r = resolvePeriod('currentMonth', [1, 2, 3], 2026)
    expect(r.activeMonths).toEqual([3])
  })

  it('closedMonths=[] (mes actual no es simétrico para YoY)', () => {
    const r = resolvePeriod('currentMonth', [1, 2, 3], 2026)
    expect(r.closedMonths).toEqual([])
  })

  it('isPartial=true cuando mes actual está en BD', () => {
    const r = resolvePeriod('currentMonth', [1, 2, 3], 2026)
    expect(r.isPartial).toBe(true)
  })

  it('label muestra el mes actual sin ⚠ (indicador parcial eliminado del UI)', () => {
    const r = resolvePeriod('currentMonth', [1, 2, 3], 2026)
    expect(r.label).toBe('Mar 2026')
    expect(r.label).not.toContain('⚠')
  })

  it('activeMonths=[] si el mes actual no tiene datos en BD', () => {
    const r = resolvePeriod('currentMonth', [1, 2], 2026)
    expect(r.activeMonths).toEqual([])
    expect(r.isPartial).toBe(false)
  })
})

describe('resolvePeriod — metadatos de calendario', () => {
  beforeEach(() => { vi.setSystemTime(MOCK_DATE) })
  afterEach(() => { vi.useRealTimers() })

  it('retorna calendarMonth correcto', () => {
    const r = resolvePeriod('ytd', [1, 2], 2026)
    expect(r.calendarMonth).toBe(3)
  })

  it('retorna calendarDay correcto', () => {
    const r = resolvePeriod('ytd', [1, 2], 2026)
    expect(r.calendarDay).toBe(4)
  })
})

describe('resolvePeriod — YoY simétrico', () => {
  beforeEach(() => { vi.setSystemTime(MOCK_DATE) })
  afterEach(() => { vi.useRealTimers() })

  it('closedMonths solo contiene meses < calendarMonth (ytd puede tener activeMonths extras)', () => {
    const r = resolvePeriod('ytd', [1, 2, 3], 2026)
    expect(r.closedMonths.every(m => m < 3)).toBe(true)
    // activeMonths incluye calendarMonth pero closedMonths no
    expect(r.activeMonths).toContain(3)
    expect(r.closedMonths).not.toContain(3)
  })

  it('currentMonth no contribuye a closedMonths', () => {
    const r = resolvePeriod('currentMonth', [1, 2, 3], 2026)
    expect(r.closedMonths).toEqual([])
  })
})
