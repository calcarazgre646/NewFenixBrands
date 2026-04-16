import { describe, it, expect } from "vitest";
import { classifyProductType } from "../classify";

describe("classifyProductType", () => {
  // Carry Over
  it('carry_over=true → "carry_over" regardless of estComercial', () => {
    expect(classifyProductType("", true)).toBe("carry_over");
  });
  it('carry_over=true + estComercial="lanzamiento" → "carry_over" (priority)', () => {
    expect(classifyProductType("lanzamiento", true)).toBe("carry_over");
  });
  it('carry_over=true + estComercial="regular" → "carry_over"', () => {
    expect(classifyProductType("regular", true)).toBe("carry_over");
  });

  // Temporada / Moda
  it('estComercial="lanzamiento" + carry_over=false → "temporada"', () => {
    expect(classifyProductType("lanzamiento", false)).toBe("temporada");
  });
  it('estComercial="Lanzamiento" (case insensitive) → "temporada"', () => {
    expect(classifyProductType("Lanzamiento", false)).toBe("temporada");
  });
  it('estComercial="LANZAMIENTO" (uppercase) → "temporada"', () => {
    expect(classifyProductType("LANZAMIENTO", false)).toBe("temporada");
  });

  // Básicos (default)
  it('estComercial="" + carry_over=false → "basicos"', () => {
    expect(classifyProductType("", false)).toBe("basicos");
  });
  it('estComercial="regular" + carry_over=false → "basicos"', () => {
    expect(classifyProductType("regular", false)).toBe("basicos");
  });
  it('estComercial="liquidacion" + carry_over=false → "basicos"', () => {
    expect(classifyProductType("liquidacion", false)).toBe("basicos");
  });
  it('estComercial="activo" + carry_over=false → "basicos"', () => {
    expect(classifyProductType("activo", false)).toBe("basicos");
  });
});
