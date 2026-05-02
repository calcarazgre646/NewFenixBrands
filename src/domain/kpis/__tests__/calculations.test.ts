import { describe, it, expect } from 'vitest'
import {
  calcGrossMargin,
  calcGMROI,
  calcYoY,
  calcReturnsRate,
  calcInventoryTurnover,
  calcMarkdownDependency,
  calcAOV,
  calcUPT,
  classifyMarginHealth,
  marginHealthThresholds,
  calcCustomerRecurrence,
} from '../calculations'
import { DEFAULT_MARGIN_CONFIG } from '@/domain/config/defaults'

describe('calcGrossMargin', () => {
  it('div por 0: calcGrossMargin(0, 0) → 0', () => expect(calcGrossMargin(0, 0)).toBe(0))
  it('calcGrossMargin(100, 60) → 40', () => expect(calcGrossMargin(100, 60)).toBe(40))
  it('calcGrossMargin(1000, 600) → 40', () => expect(calcGrossMargin(1000, 600)).toBe(40))
  it('100% margen: calcGrossMargin(100, 0) → 100', () => expect(calcGrossMargin(100, 0)).toBe(100))
  it('sin margen: calcGrossMargin(100, 100) → 0', () => expect(calcGrossMargin(100, 100)).toBe(0))
})

describe('calcGMROI', () => {
  it('div por 0 en invValue: calcGMROI(100, 0, 6) → 0', () => expect(calcGMROI(100, 0, 6)).toBe(0))
  it('div por 0 en months: calcGMROI(100, 500, 0) → 0', () => expect(calcGMROI(100, 500, 0)).toBe(0))
  it('calcGMROI(0, 0, 0) → 0', () => expect(calcGMROI(0, 0, 0)).toBe(0))
  it('calcGMROI(600, 1000, 6) → 1.2', () => expect(calcGMROI(600, 1000, 6)).toBeCloseTo(1.2))
})

describe('calcYoY', () => {
  it('calcYoY(120, 100) → 20', () => expect(calcYoY(120, 100)).toBe(20))
  it('div por 0: calcYoY(100, 0) → 0', () => expect(calcYoY(100, 0)).toBe(0))
  it('calcYoY(80, 100) → -20', () => expect(calcYoY(80, 100)).toBe(-20))
  it('calcYoY(0, 0) → 0', () => expect(calcYoY(0, 0)).toBe(0))
})

describe('calcReturnsRate', () => {
  it('calcReturnsRate(abs=500, pos=10000) → 5', () => expect(calcReturnsRate(500, 10000)).toBe(5))
  it('div por 0: calcReturnsRate(500, 0) → 0', () => expect(calcReturnsRate(500, 0)).toBe(0))
  it('calcReturnsRate(0, 1000) → 0', () => expect(calcReturnsRate(0, 1000)).toBe(0))
  it('valor negativo se normaliza con Math.abs', () => expect(calcReturnsRate(-500, 10000)).toBe(5))
})

describe('calcInventoryTurnover', () => {
  it('div por 0 en invValue → 0', () => expect(calcInventoryTurnover(600, 0, 6)).toBe(0))
  it('div por 0 en months → 0', () => expect(calcInventoryTurnover(600, 1000, 0)).toBe(0))
  it('calcInventoryTurnover(600, 1000, 6) → 1.2', () =>
    expect(calcInventoryTurnover(600, 1000, 6)).toBeCloseTo(1.2))
})

describe('calcMarkdownDependency', () => {
  it('div por 0 en bruto → 0', () => expect(calcMarkdownDependency(100, 0)).toBe(0))
  it('calcMarkdownDependency(200, 1000) → 20', () => expect(calcMarkdownDependency(200, 1000)).toBe(20))
})

describe('calcAOV', () => {
  it('div por 0 → 0', () => expect(calcAOV(10000, 0)).toBe(0))
  it('calcAOV(10000, 100) → 100', () => expect(calcAOV(10000, 100)).toBe(100))
})

describe('calcUPT', () => {
  it('div por 0 → 0', () => expect(calcUPT(500, 0)).toBe(0))
  it('calcUPT(500, 100) → 5', () => expect(calcUPT(500, 100)).toBe(5))
})

describe('classifyMarginHealth', () => {
  const { b2cHealthy, b2cModerate, b2bHealthy, b2bModerate } = DEFAULT_MARGIN_CONFIG

  // B2C / Total — derived from config
  it('B2C: at healthy threshold → healthy', () => expect(classifyMarginHealth(b2cHealthy, 'b2c')).toBe('healthy'))
  it('B2C: above healthy → healthy', () => expect(classifyMarginHealth(b2cHealthy + 5, 'b2c')).toBe('healthy'))
  it('B2C: just below healthy → moderate', () => expect(classifyMarginHealth(b2cHealthy - 0.01, 'b2c')).toBe('moderate'))
  it('B2C: at moderate threshold → moderate', () => expect(classifyMarginHealth(b2cModerate, 'b2c')).toBe('moderate'))
  it('B2C: just below moderate → low', () => expect(classifyMarginHealth(b2cModerate - 0.01, 'b2c')).toBe('low'))
  it('B2C: well below → low', () => expect(classifyMarginHealth(30, 'b2c')).toBe('low'))
  it('total defaults to B2C thresholds', () => expect(classifyMarginHealth(b2cModerate + 1, 'total')).toBe('moderate'))
  it('default channel = total', () => expect(classifyMarginHealth(b2cHealthy + 1)).toBe('healthy'))

  // B2B — derived from config
  it('B2B: at healthy threshold → healthy', () => expect(classifyMarginHealth(b2bHealthy, 'b2b')).toBe('healthy'))
  it('B2B: above healthy → healthy', () => expect(classifyMarginHealth(b2bHealthy + 5, 'b2b')).toBe('healthy'))
  it('B2B: just below healthy → moderate', () => expect(classifyMarginHealth(b2bHealthy - 0.01, 'b2b')).toBe('moderate'))
  it('B2B: at moderate threshold → moderate', () => expect(classifyMarginHealth(b2bModerate, 'b2b')).toBe('moderate'))
  it('B2B: just below moderate → low', () => expect(classifyMarginHealth(b2bModerate - 0.01, 'b2b')).toBe('low'))
  it('B2B: well below → low', () => expect(classifyMarginHealth(20, 'b2b')).toBe('low'))

  // Edge cases
  it('0% → low for any channel', () => {
    expect(classifyMarginHealth(0, 'b2c')).toBe('low')
    expect(classifyMarginHealth(0, 'b2b')).toBe('low')
  })
  it('100% → healthy for any channel', () => {
    expect(classifyMarginHealth(100, 'b2c')).toBe('healthy')
    expect(classifyMarginHealth(100, 'b2b')).toBe('healthy')
  })
})

describe('calcCustomerRecurrence', () => {
  it('happy path: 30/100 → 30%', () => expect(calcCustomerRecurrence(30, 100)).toBe(30))
  it('100% recurrencia', () => expect(calcCustomerRecurrence(50, 50)).toBe(100))
  it('sin clientes: 0/0 → 0 (no NaN)', () => expect(calcCustomerRecurrence(0, 0)).toBe(0))
  it('total negativo (defensivo): 5/-1 → 0', () => expect(calcCustomerRecurrence(5, -1)).toBe(0))
})

describe('marginHealthThresholds', () => {
  const { b2cHealthy, b2cModerate, b2bHealthy, b2bModerate } = DEFAULT_MARGIN_CONFIG

  it('B2C thresholds from config', () => {
    expect(marginHealthThresholds('b2c')).toEqual({ red: b2cModerate, yellow: b2cHealthy })
  })
  it('total: same as B2C', () => {
    expect(marginHealthThresholds('total')).toEqual({ red: b2cModerate, yellow: b2cHealthy })
  })
  it('B2B thresholds from config', () => {
    expect(marginHealthThresholds('b2b')).toEqual({ red: b2bModerate, yellow: b2bHealthy })
  })
})
