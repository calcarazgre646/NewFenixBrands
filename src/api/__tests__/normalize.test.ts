import { describe, it, expect } from 'vitest'
import {
  cleanStr,
  toInt,
  toNum,
  trimStr,
  parsePYGString,
  parseUSDString,
  parsePct,
  parseDDMMYYYY,
  parseDMonYYYY,
  parseEUCost,
  parsePeriodYYYYMM,
  normalizeBrand,
  brandIdToCanonical,
  classifyStore,
  normalizeChannel,
} from '../normalize'

describe('cleanStr', () => {
  it('null → null', () => expect(cleanStr(null)).toBeNull())
  it('undefined → null', () => expect(cleanStr(undefined)).toBeNull())
  it('"" → null', () => expect(cleanStr("")).toBeNull())
  it('"." → null', () => expect(cleanStr(".")).toBeNull())
  it('"   .  " → null', () => expect(cleanStr("   .  ")).toBeNull())
  it('"ESTRELLA   " → "ESTRELLA"', () => expect(cleanStr("ESTRELLA   ")).toBe("ESTRELLA"))
  it('"  Hola Mundo  " → "Hola Mundo"', () => expect(cleanStr("  Hola Mundo  ")).toBe("Hola Mundo"))
})

describe('toInt', () => {
  it('2026.0 → 2026', () => expect(toInt(2026.0)).toBe(2026))
  it('null → 0', () => expect(toInt(null)).toBe(0))
  it('undefined → 0', () => expect(toInt(undefined)).toBe(0))
  it('"42" → 42', () => expect(toInt("42")).toBe(42))
})

describe('parsePYGString', () => {
  it('"6.263.380" → 6263380', () => expect(parsePYGString("6.263.380")).toBe(6263380))
  it('null → 0', () => expect(parsePYGString(null)).toBe(0))
  it('"" → 0', () => expect(parsePYGString("")).toBe(0))
  it('"1.000" → 1000', () => expect(parsePYGString("1.000")).toBe(1000))
})

describe('parseUSDString', () => {
  it('"$68,450.00" → 68450', () => expect(parseUSDString("$68,450.00")).toBe(68450))
  it('null → 0', () => expect(parseUSDString(null)).toBe(0))
  it('"$0.00" → 0', () => expect(parseUSDString("$0.00")).toBe(0))
  it('"$1,000,000.50" → 1000000.5', () => expect(parseUSDString("$1,000,000.50")).toBe(1000000.5))
})

describe('normalizeBrand', () => {
  it('"Martel Premium" → "Martel"', () => expect(normalizeBrand("Martel Premium")).toBe("Martel"))
  it('"wrangler" → "Wrangler"', () => expect(normalizeBrand("wrangler")).toBe("Wrangler"))
  it('"WRANGLER" → "Wrangler"', () => expect(normalizeBrand("WRANGLER")).toBe("Wrangler"))
  it('"Lee" → "Lee"', () => expect(normalizeBrand("Lee")).toBe("Lee"))
  it('unknown → "Otras"', () => expect(normalizeBrand("MarcaDesconocida")).toBe("Otras"))
  it('null → "Otras"', () => expect(normalizeBrand(null)).toBe("Otras"))
  it('"niella" → "Martel"', () => expect(normalizeBrand("niella")).toBe("Martel"))
})

describe('classifyStore', () => {
  it('"MAYORISTA" → "b2b"', () => expect(classifyStore("MAYORISTA")).toBe("b2b"))
  it('"UTP" → "b2b"', () => expect(classifyStore("UTP")).toBe("b2b"))
  it('"UNIFORMES" → "b2b"', () => expect(classifyStore("UNIFORMES")).toBe("b2b"))
  it('"ESTRELLA" → "b2c"', () => expect(classifyStore("ESTRELLA")).toBe("b2c"))
  it('"FABRICA" → "excluded"', () => expect(classifyStore("FABRICA")).toBe("excluded"))
  it('"ALM-BATAS" → "excluded"', () => expect(classifyStore("ALM-BATAS")).toBe("excluded"))
  it('"LAVADO" → "excluded"', () => expect(classifyStore("LAVADO")).toBe("excluded"))
  it('"E-COMMERCE" → "excluded"', () => expect(classifyStore("E-COMMERCE")).toBe("excluded"))
  it('"PRODUCTO" → "excluded"', () => expect(classifyStore("PRODUCTO")).toBe("excluded"))
  it('"M-SILVIO" → "excluded"', () => expect(classifyStore("M-SILVIO")).toBe("excluded"))
  it('"M-AGUSTIN" → "excluded"', () => expect(classifyStore("M-AGUSTIN")).toBe("excluded"))
  it('padding " MAYORISTA " → "b2b"', () => expect(classifyStore(" MAYORISTA ")).toBe("b2b"))
})

describe('parseDDMMYYYY', () => {
  it('"10/09/2025" → Date(2025, 8, 10)', () => {
    const result = parseDDMMYYYY("10/09/2025")
    expect(result).not.toBeNull()
    expect(result!.getFullYear()).toBe(2025)
    expect(result!.getMonth()).toBe(8)   // 0-indexed: 8 = Septiembre
    expect(result!.getDate()).toBe(10)
  })
  it('null → null', () => expect(parseDDMMYYYY(null)).toBeNull())
  it('"" → null', () => expect(parseDDMMYYYY("")).toBeNull())
  it('malformed → null', () => expect(parseDDMMYYYY("2025-09-10")).toBeNull())
})

// ─── trimStr ──────────────────────────────────────────────────────────────

describe('trimStr', () => {
  it('null → ""', () => expect(trimStr(null)).toBe(""))
  it('undefined → ""', () => expect(trimStr(undefined)).toBe(""))
  it('"  hello  " → "hello"', () => expect(trimStr("  hello  ")).toBe("hello"))
  it('"" → ""', () => expect(trimStr("")).toBe(""))
})

// ─── toNum ────────────────────────────────────────────────────────────────

describe('toNum', () => {
  it('null → 0', () => expect(toNum(null)).toBe(0))
  it('undefined → 0', () => expect(toNum(undefined)).toBe(0))
  it('42.5 → 42.5', () => expect(toNum(42.5)).toBe(42.5))
  it('"3.14" → 3.14', () => expect(toNum("3.14")).toBe(3.14))
  it('"abc" → NaN', () => expect(toNum("abc")).toBeNaN())
})

// ─── parsePct ─────────────────────────────────────────────────────────────

describe('parsePct', () => {
  it('"64%" → 64', () => expect(parsePct("64%")).toBe(64))
  it('"0%" → 0', () => expect(parsePct("0%")).toBe(0))
  it('null → 0', () => expect(parsePct(null)).toBe(0))
  it('"" → 0', () => expect(parsePct("")).toBe(0))
})

// ─── parseDMonYYYY ────────────────────────────────────────────────────────

describe('parseDMonYYYY', () => {
  it('"9-Oct-2025" → Date(2025, 9, 9)', () => {
    const result = parseDMonYYYY("9-Oct-2025")
    expect(result).not.toBeNull()
    expect(result!.getFullYear()).toBe(2025)
    expect(result!.getMonth()).toBe(9)
    expect(result!.getDate()).toBe(9)
  })
  it('"15-Mar-2026" → Date(2026, 2, 15)', () => {
    const result = parseDMonYYYY("15-Mar-2026")
    expect(result).not.toBeNull()
    expect(result!.getFullYear()).toBe(2026)
    expect(result!.getMonth()).toBe(2)
    expect(result!.getDate()).toBe(15)
  })
  it('Spanish month "1-Ene-2026" → Date(2026, 0, 1)', () => {
    const result = parseDMonYYYY("1-Ene-2026")
    expect(result).not.toBeNull()
    expect(result!.getFullYear()).toBe(2026)
    expect(result!.getMonth()).toBe(0)
  })
  it('null → null', () => expect(parseDMonYYYY(null)).toBeNull())
  it('"" → null', () => expect(parseDMonYYYY("")).toBeNull())
  it('invalid month name → null', () => expect(parseDMonYYYY("9-Xyz-2025")).toBeNull())
  it('year < 2000 → null', () => expect(parseDMonYYYY("1-Ene-1999")).toBeNull())
  it('day > 31 → null', () => expect(parseDMonYYYY("32-Ene-2026")).toBeNull())
  it('day < 1 → null', () => expect(parseDMonYYYY("0-Ene-2026")).toBeNull())
})

// ─── parseEUCost ──────────────────────────────────────────────────────────

describe('parseEUCost', () => {
  it('"68.450,00" → 68450', () => expect(parseEUCost("68.450,00")).toBe(68450))
  it('null → 0', () => expect(parseEUCost(null)).toBe(0))
  it('"" → 0', () => expect(parseEUCost("")).toBe(0))
  it('"1.234.567,89" → 1234567.89', () => expect(parseEUCost("1.234.567,89")).toBeCloseTo(1234567.89, 2))
})

// ─── parsePeriodYYYYMM ────────────────────────────────────────────────────

describe('parsePeriodYYYYMM', () => {
  it('"202601" → { year: 2026, month: 1 }', () => {
    expect(parsePeriodYYYYMM("202601")).toEqual({ year: 2026, month: 1 })
  })
  it('"202512" → { year: 2025, month: 12 }', () => {
    expect(parsePeriodYYYYMM("202512")).toEqual({ year: 2025, month: 12 })
  })
  it('"202600" → { year: 2026, month: 0 } (no validation)', () => {
    expect(parsePeriodYYYYMM("202600")).toEqual({ year: 2026, month: 0 })
  })
  it('"202613" → { year: 2026, month: 13 } (no validation)', () => {
    expect(parsePeriodYYYYMM("202613")).toEqual({ year: 2026, month: 13 })
  })
})

// ─── brandIdToCanonical ───────────────────────────────────────────────────

describe('brandIdToCanonical', () => {
  it('"martel" → "Martel"', () => expect(brandIdToCanonical("martel")).toBe("Martel"))
  it('"wrangler" → "Wrangler"', () => expect(brandIdToCanonical("wrangler")).toBe("Wrangler"))
  it('"lee" → "Lee"', () => expect(brandIdToCanonical("lee")).toBe("Lee"))
  it('"total" → null', () => expect(brandIdToCanonical("total")).toBeNull())
})

// ─── normalizeChannel ─────────────────────────────────────────────────────

describe('normalizeChannel', () => {
  it('"B2C" → "B2C"', () => expect(normalizeChannel("B2C")).toBe("B2C"))
  it('"B2B" → "B2B"', () => expect(normalizeChannel("B2B")).toBe("B2B"))
  it('"b2c" (lowercase) → "B2C"', () => expect(normalizeChannel("b2c")).toBe("B2C"))
  it('null → null', () => expect(normalizeChannel(null)).toBeNull())
  it('"Batas" → null', () => expect(normalizeChannel("Batas")).toBeNull())
})
