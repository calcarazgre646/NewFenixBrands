import { describe, it, expect } from 'vitest'
import {
  cleanStr,
  toInt,
  parsePYGString,
  parseUSDString,
  normalizeBrand,
  classifyStore,
  parseDDMMYYYY,
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
  it('"ESTRELLA" → "b2c"', () => expect(classifyStore("ESTRELLA")).toBe("b2c"))
  it('"FABRICA" → "excluded"', () => expect(classifyStore("FABRICA")).toBe("excluded"))
  it('"ALM-BATAS" → "excluded"', () => expect(classifyStore("ALM-BATAS")).toBe("excluded"))
  it('"LAVADO" → "excluded"', () => expect(classifyStore("LAVADO")).toBe("excluded"))
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
