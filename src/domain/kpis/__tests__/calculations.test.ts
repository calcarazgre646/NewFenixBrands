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
} from '../calculations'

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
  // B2C / Total (Fénix): Verde ≥ 55%, Amarillo 50–54.99%, Rojo < 50%
  it('B2C: 55% → healthy', () => expect(classifyMarginHealth(55, 'b2c')).toBe('healthy'))
  it('B2C: 60% → healthy', () => expect(classifyMarginHealth(60, 'b2c')).toBe('healthy'))
  it('B2C: 54.99% → moderate', () => expect(classifyMarginHealth(54.99, 'b2c')).toBe('moderate'))
  it('B2C: 50% → moderate', () => expect(classifyMarginHealth(50, 'b2c')).toBe('moderate'))
  it('B2C: 49.99% → low', () => expect(classifyMarginHealth(49.99, 'b2c')).toBe('low'))
  it('B2C: 30% → low', () => expect(classifyMarginHealth(30, 'b2c')).toBe('low'))
  it('total defaults to B2C thresholds', () => expect(classifyMarginHealth(52, 'total')).toBe('moderate'))
  it('default channel = total', () => expect(classifyMarginHealth(56)).toBe('healthy'))

  // B2B: Verde ≥ 50%, Amarillo 40–49.99%, Rojo < 40%
  it('B2B: 50% → healthy', () => expect(classifyMarginHealth(50, 'b2b')).toBe('healthy'))
  it('B2B: 55% → healthy', () => expect(classifyMarginHealth(55, 'b2b')).toBe('healthy'))
  it('B2B: 49.99% → moderate', () => expect(classifyMarginHealth(49.99, 'b2b')).toBe('moderate'))
  it('B2B: 40% → moderate', () => expect(classifyMarginHealth(40, 'b2b')).toBe('moderate'))
  it('B2B: 39.99% → low', () => expect(classifyMarginHealth(39.99, 'b2b')).toBe('low'))
  it('B2B: 20% → low', () => expect(classifyMarginHealth(20, 'b2b')).toBe('low'))

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

describe('marginHealthThresholds', () => {
  it('B2C: red=50, yellow=55', () => {
    expect(marginHealthThresholds('b2c')).toEqual({ red: 50, yellow: 55 })
  })
  it('total: same as B2C', () => {
    expect(marginHealthThresholds('total')).toEqual({ red: 50, yellow: 55 })
  })
  it('B2B: red=40, yellow=50', () => {
    expect(marginHealthThresholds('b2b')).toEqual({ red: 40, yellow: 50 })
  })
})
