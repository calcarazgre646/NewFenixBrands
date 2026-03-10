/**
 * domain/search/__tests__/catalog.test.ts
 *
 * Tests del catálogo de búsqueda.
 * Verifica que el catálogo se construye correctamente y que
 * la búsqueda end-to-end funciona sobre datos reales.
 */
import { describe, it, expect } from "vitest";
import { buildSearchCatalog } from "../catalog";
import { search } from "../engine";

const catalog = buildSearchCatalog();

describe("buildSearchCatalog()", () => {
  it("returns a non-empty array", () => {
    expect(catalog.length).toBeGreaterThan(0);
  });

  it("contains system pages (no KPIs page)", () => {
    const pages = catalog.filter((i) => i.type === "page");
    expect(pages.length).toBe(5); // Inicio, Ventas, Acciones, Logística, Calendario
    expect(pages.find((p) => p.id === "page_kpis")).toBeUndefined();
  });

  it("contains only core KPIs (9 implemented)", () => {
    const kpis = catalog.filter((i) => i.type === "kpi");
    expect(kpis.length).toBe(9);
  });

  it("KPI items have no path (informational only)", () => {
    const kpis = catalog.filter((i) => i.type === "kpi");
    for (const kpi of kpis) {
      expect(kpi.path).toBeUndefined();
    }
  });

  it("contains quick actions", () => {
    const actions = catalog.filter((i) => i.type === "action");
    expect(actions.length).toBeGreaterThan(0);
  });

  it("all items have required fields (path optional for KPIs)", () => {
    for (const item of catalog) {
      expect(item.id).toBeTruthy();
      expect(item.title).toBeTruthy();
      expect(item.subtitle).toBeTruthy();
      expect(["kpi", "page", "action"]).toContain(item.type);
      // Pages and actions must have path; KPIs must not
      if (item.type !== "kpi") {
        expect(item.path).toBeTruthy();
      }
    }
  });

  it("KPI items have meta with category and kpiId", () => {
    const kpis = catalog.filter((i) => i.type === "kpi");
    for (const kpi of kpis) {
      expect(kpi.meta?.category).toBeTruthy();
      expect(kpi.meta?.kpiId).toBeTruthy();
    }
  });

  it("all IDs are unique", () => {
    const ids = catalog.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ─── End-to-end search on real catalog ───────────────────────────────────────

describe("search on real catalog", () => {
  it("finds 'Inicio' page by name", () => {
    const results = search(catalog, "inicio");
    expect(results[0].id).toBe("page_home");
  });

  it("finds KPI by exact name", () => {
    const results = search(catalog, "Ingresos totales");
    expect(results[0].id).toBe("kpi_revenue");
  });

  it("finds KPI by id keyword", () => {
    const results = search(catalog, "gross_margin");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].id).toBe("kpi_gross_margin");
  });

  it("finds KPI by category name", () => {
    const results = search(catalog, "Rentabilidad");
    expect(results.length).toBeGreaterThan(0);
  });

  it("finds page by hidden keyword", () => {
    const results = search(catalog, "waterfall");
    expect(results[0].id).toBe("page_actions");
  });

  it("finds quick action", () => {
    const results = search(catalog, "tema oscuro");
    expect(results[0].id).toBe("action_theme");
  });

  it("multi-word across title+subtitle", () => {
    const results = search(catalog, "margen bruto");
    expect(results[0].title).toContain("Margen bruto");
  });

  it("returns empty for nonsense query", () => {
    expect(search(catalog, "xyznonexistent")).toEqual([]);
  });
});
