import { describe, it, expect } from "vitest";
import {
  buildLineaOptions,
  buildCategoriaOptions,
  filterByDimensions,
} from "../dimensionFilters";
import type { ActionItemFull } from "../waterfall";

const item = (linea: string, categoria: string): { linea: string; categoria: string } => ({
  linea,
  categoria,
});

describe("buildLineaOptions", () => {
  it("descarta líneas que solo contienen una categoría con el mismo string (ruido BD)", () => {
    const items = [
      item("bermuda", "bermuda"),
      item("blazer", "blazer"),
      item("Camisería", "camisa"),
      item("Camisería", "blusa"),
    ];
    const result = buildLineaOptions(items);
    expect(result.map(o => o.value)).toEqual(["Camisería"]);
  });

  it("conserva líneas que agrupan más de una categoría", () => {
    const items = [
      item("Vaquería", "jean"),
      item("Vaquería", "bermuda jean"),
    ];
    const result = buildLineaOptions(items);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ value: "Vaquería", count: 2 });
  });

  it("conserva líneas con una sola categoría si el string difiere de la línea", () => {
    const items = [item("Camisería", "camisa"), item("Camisería", "camisa")];
    const result = buildLineaOptions(items);
    expect(result).toHaveLength(1);
    expect(result[0].count).toBe(2);
  });

  it("ignora items con línea vacía o null", () => {
    const items = [item("", "camisa"), { linea: null, categoria: "remera" }, item("Camisería", "blusa"), item("Camisería", "camisa")];
    const result = buildLineaOptions(items);
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe("Camisería");
  });

  it("ordena alfabéticamente con locale es", () => {
    const items = [
      item("Vaquería", "jean"),
      item("Vaquería", "short"),
      item("Camisería", "camisa"),
      item("Camisería", "blusa"),
    ];
    const result = buildLineaOptions(items);
    expect(result.map(o => o.value)).toEqual(["Camisería", "Vaquería"]);
  });

  it("scope.categoria filtra el conteo a esa categoría", () => {
    const items = [
      item("Camisería", "camisa"),
      item("Camisería", "camisa"),
      item("Camisería", "blusa"),
    ];
    const result = buildLineaOptions(items, { categoria: "camisa" });
    expect(result).toHaveLength(1);
    expect(result[0].count).toBe(2);
  });
});

describe("buildCategoriaOptions", () => {
  it("agrupa por categoría con conteo", () => {
    const items = [
      item("Camisería", "camisa"),
      item("Camisería", "camisa"),
      item("Camisería", "blusa"),
      item("bermuda", "bermuda"),
    ];
    const result = buildCategoriaOptions(items);
    expect(result).toEqual([
      { value: "bermuda", label: "Bermuda", count: 1 },
      { value: "blusa", label: "Blusa", count: 1 },
      { value: "camisa", label: "Camisa", count: 2 },
    ]);
  });

  it("scope.linea filtra a categorías de esa línea", () => {
    const items = [
      item("Camisería", "camisa"),
      item("Camisería", "blusa"),
      item("Vaquería", "jean"),
    ];
    const result = buildCategoriaOptions(items, { linea: "Camisería" });
    expect(result.map(o => o.value)).toEqual(["blusa", "camisa"]);
  });

  it("ignora categorías vacías", () => {
    const items = [item("Camisería", ""), item("Camisería", "camisa")];
    const result = buildCategoriaOptions(items);
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe("camisa");
  });
});

describe("filterByDimensions", () => {
  const items = [
    { linea: "Camisería", categoria: "camisa" },
    { linea: "Camisería", categoria: "blusa" },
    { linea: "Vaquería", categoria: "jean" },
    { linea: "bermuda", categoria: "bermuda" },
  ] as ActionItemFull[];

  it("sin filtros devuelve la lista intacta (mismo identity)", () => {
    expect(filterByDimensions(items, null, null)).toBe(items);
  });

  it("filtra por línea (case-insensitive)", () => {
    const result = filterByDimensions(items, "camisería", null);
    expect(result).toHaveLength(2);
  });

  it("filtra por categoría (case-insensitive)", () => {
    const result = filterByDimensions(items, null, "JEAN");
    expect(result).toHaveLength(1);
    expect(result[0].categoria).toBe("jean");
  });

  it("ambos filtros se componen en AND", () => {
    const result = filterByDimensions(items, "Camisería", "camisa");
    expect(result).toHaveLength(1);
  });

  it("filtros que no matchean devuelven array vacío", () => {
    expect(filterByDimensions(items, "noexiste", null)).toEqual([]);
  });
});
