/**
 * domain/search/__tests__/engine.test.ts
 *
 * Tests del motor de búsqueda puro.
 * Cubre: multi-word, scoring, grouping, edge cases, seguridad regex.
 */
import { describe, it, expect } from "vitest";
import { search, groupResults, escapeRegex } from "../engine";
import type { SearchableItem } from "../types";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const ITEMS: SearchableItem[] = [
  {
    type: "kpi",
    id: "kpi_revenue",
    title: "Ingresos totales",
    subtitle: "Ventas netas sin IVA",
    searchableText: "revenue facturación",
    path: "/kpis/sales",
  },
  {
    type: "kpi",
    id: "kpi_gross_margin",
    title: "Margen bruto %",
    subtitle: "Porcentaje de margen sobre ventas",
    searchableText: "gross_margin calcGrossMargin Rentabilidad",
    path: "/kpis/profit",
  },
  {
    type: "kpi",
    id: "kpi_gmroi",
    title: "GMROI",
    subtitle: "Retorno del margen sobre el inventario promedio a costo",
    searchableText: "gmroi Rentabilidad",
    path: "/kpis/profit",
  },
  {
    type: "page",
    id: "page_home",
    title: "Inicio",
    subtitle: "Road to Annual Target",
    searchableText: "dashboard ejecutivo home",
    path: "/",
  },
  {
    type: "page",
    id: "page_sales",
    title: "Ventas",
    subtitle: "Análisis de ventas por período",
    searchableText: "ventas revenue ingresos",
    path: "/ventas",
  },
  {
    type: "action",
    id: "action_theme",
    title: "Cambiar tema",
    subtitle: "Alternar entre modo claro y oscuro",
    searchableText: "dark light",
    path: "__action:toggle-theme",
  },
];

// ─── search() ────────────────────────────────────────────────────────────────

describe("search()", () => {
  it("returns empty for empty query", () => {
    expect(search(ITEMS, "")).toEqual([]);
    expect(search(ITEMS, "   ")).toEqual([]);
  });

  it("matches single word in title", () => {
    const results = search(ITEMS, "Margen");
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].id).toBe("kpi_gross_margin"); // title match ranks first
  });

  it("matches single word in subtitle", () => {
    const results = search(ITEMS, "inventario");
    expect(results.length).toBe(1);
    expect(results[0].id).toBe("kpi_gmroi");
  });

  it("matches single word in searchableText", () => {
    const results = search(ITEMS, "facturación");
    expect(results.length).toBe(1);
    expect(results[0].id).toBe("kpi_revenue");
  });

  it("multi-word: ALL words must match", () => {
    const results = search(ITEMS, "margen ventas");
    // "Margen bruto %" has "margen" in title and "ventas" in subtitle
    expect(results.length).toBe(1);
    expect(results[0].id).toBe("kpi_gross_margin");
  });

  it("multi-word: returns empty if one word doesn't match", () => {
    const results = search(ITEMS, "margen blockchain");
    expect(results.length).toBe(0);
  });

  it("is case-insensitive", () => {
    const results = search(ITEMS, "GMROI");
    expect(results.length).toBe(1);
    expect(results[0].id).toBe("kpi_gmroi");
  });

  it("title match scores higher than subtitle match", () => {
    // "Ventas" appears as title in page_sales and in subtitle of kpi_gross_margin
    const results = search(ITEMS, "ventas");
    expect(results[0].id).toBe("page_sales"); // title match → higher score
  });

  it("full query in title scores highest", () => {
    const results = search(ITEMS, "ingresos totales");
    expect(results[0].id).toBe("kpi_revenue"); // exact title match
  });

  it("respects maxResults", () => {
    const results = search(ITEMS, "a", 2); // "a" appears in most items
    expect(results.length).toBeLessThanOrEqual(2);
  });

  it("handles extra whitespace in query", () => {
    const results = search(ITEMS, "  Margen   bruto  ");
    expect(results.length).toBe(1);
    expect(results[0].id).toBe("kpi_gross_margin");
  });

  it("matches across title + subtitle + searchableText combined", () => {
    // "Rentabilidad" in searchableText, "margen" in title — both words must match
    const results = search(ITEMS, "Rentabilidad margen");
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].id).toBe("kpi_gross_margin"); // title has "Margen" → highest score
  });

  it("returns results sorted by score descending", () => {
    const results = search(ITEMS, "ventas");
    // page_sales has "Ventas" in title (score: +10 +3)
    // kpi_revenue has "ventas" in subtitle (score: +5 +1)
    // kpi_gross_margin has "ventas" in subtitle (score: +5 +1)
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
    }
  });

  it("does not crash with regex special characters", () => {
    expect(() => search(ITEMS, "test(")).not.toThrow();
    expect(() => search(ITEMS, "test.*+?")).not.toThrow();
    expect(() => search(ITEMS, "[brackets]")).not.toThrow();
    expect(() => search(ITEMS, "a$b^c")).not.toThrow();
  });

  it("handles items with no searchableText", () => {
    const items: SearchableItem[] = [
      { type: "page", id: "x", title: "Test", subtitle: "Sub", path: "/" },
    ];
    const results = search(items, "test");
    expect(results.length).toBe(1);
  });
});

// ─── groupResults() ──────────────────────────────────────────────────────────

describe("groupResults()", () => {
  it("groups results by type in order: page → kpi → action", () => {
    const all = search(ITEMS, "a"); // broad match
    const groups = groupResults(all);
    const types = groups.map((g) => g.type);

    // Order must be: page before kpi before action
    const pageIdx = types.indexOf("page");
    const kpiIdx = types.indexOf("kpi");
    const actionIdx = types.indexOf("action");

    if (pageIdx >= 0 && kpiIdx >= 0) expect(pageIdx).toBeLessThan(kpiIdx);
    if (kpiIdx >= 0 && actionIdx >= 0) expect(kpiIdx).toBeLessThan(actionIdx);
  });

  it("uses correct labels", () => {
    const groups = groupResults([
      { ...ITEMS[0], score: 5 },  // kpi
      { ...ITEMS[3], score: 5 },  // page
      { ...ITEMS[5], score: 5 },  // action
    ]);
    expect(groups.find((g) => g.type === "kpi")?.label).toBe("Indicadores");
    expect(groups.find((g) => g.type === "page")?.label).toBe("Páginas");
    expect(groups.find((g) => g.type === "action")?.label).toBe("Acciones rápidas");
  });

  it("omits empty groups", () => {
    const groups = groupResults([{ ...ITEMS[0], score: 5 }]); // only kpi
    expect(groups.length).toBe(1);
    expect(groups[0].type).toBe("kpi");
  });

  it("returns empty array for empty input", () => {
    expect(groupResults([])).toEqual([]);
  });
});

// ─── escapeRegex() ───────────────────────────────────────────────────────────

describe("escapeRegex()", () => {
  it("escapes all special regex characters", () => {
    const specials = ".*+?^${}()|[]\\";
    const escaped = escapeRegex(specials);
    expect(() => new RegExp(escaped)).not.toThrow();
    // Should match the literal string
    expect(new RegExp(escaped).test(specials)).toBe(true);
  });

  it("leaves normal text unchanged", () => {
    expect(escapeRegex("hello world")).toBe("hello world");
    expect(escapeRegex("Margen bruto")).toBe("Margen bruto");
  });
});
