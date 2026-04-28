/**
 * Tests para classifySellerRole — fuente única de verdad de la clasificación
 * vendedor → rol/canal.
 */
import { describe, it, expect } from "vitest";
import { classifySellerRole } from "../classify";

describe("classifySellerRole", () => {
  it("B2B + uniforme → vendedor_utp / utp", () => {
    expect(classifySellerRole("B2B", "uniforme")).toEqual({
      role: "vendedor_utp",
      channel: "utp",
    });
  });

  it("B2B + cualquier otro tipo → vendedor_mayorista / mayorista", () => {
    expect(classifySellerRole("B2B", "vtaxmayor")).toEqual({
      role: "vendedor_mayorista",
      channel: "mayorista",
    });
    expect(classifySellerRole("B2B", "")).toEqual({
      role: "vendedor_mayorista",
      channel: "mayorista",
    });
  });

  it("B2C → vendedor_tienda / retail", () => {
    expect(classifySellerRole("B2C", "any")).toEqual({
      role: "vendedor_tienda",
      channel: "retail",
    });
  });

  it("canal vacío → vendedor_tienda / retail (fallback retail)", () => {
    expect(classifySellerRole("", "")).toEqual({
      role: "vendedor_tienda",
      channel: "retail",
    });
  });

  it("canal con casing distinto a 'B2B' no entra a la rama mayorista", () => {
    // El ERP normaliza a "B2B" exacto. Casing distinto = retail por diseño.
    expect(classifySellerRole("b2b", "uniforme")).toEqual({
      role: "vendedor_tienda",
      channel: "retail",
    });
  });

  it("tipoVenta con casing distinto a 'uniforme' no entra a UTP", () => {
    expect(classifySellerRole("B2B", "Uniforme")).toEqual({
      role: "vendedor_mayorista",
      channel: "mayorista",
    });
  });
});
