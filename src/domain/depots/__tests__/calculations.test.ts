/**
 * domain/depots/__tests__/calculations.test.ts
 *
 * Tests para la lógica de Depósitos & Cobertura.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  computeWOI,
  monthlyToWeekly,
  classifyDepotRisk,
  classifyNoveltyDistribution,
  buildNoveltyData,
  buildDepotData,
  aggregateCategoriesByBrand,
} from "../calculations";
import type { InventoryItem } from "@/queries/inventory.queries";
import type { SalesHistoryMap } from "@/queries/salesHistory.queries";
import { DEFAULT_DEPOT_CONFIG } from "@/domain/config/defaults";

// ─── Helpers ────────────────────────────────────────────────────────────────

function inv(overrides: Partial<InventoryItem> = {}): InventoryItem {
  return {
    store: "TOLAMB",
    storeType: "b2c",
    sku: "SKU001",
    skuComercial: "MACA001",
    talle: "M",
    description: "Camisa test",
    brand: "Martel",
    linea: "Camiseria",
    categoria: "camisa",
    units: 100,
    price: 150000,
    priceMay: 100000,
    cost: 80000,
    value: 8000000,
    estComercial: "temporada",
    carryOver: false,
    ...overrides,
  };
}

// ─── computeWOI ─────────────────────────────────────────────────────────────

describe("computeWOI", () => {
  it("sin ventas (0) → null", () => {
    expect(computeWOI(100, 0)).toBeNull();
  });

  it("ventas negativas → null", () => {
    expect(computeWOI(100, -5)).toBeNull();
  });

  it("100 unidades, 43.3 ventas/mes → ~10 semanas", () => {
    const result = computeWOI(100, 43.3);
    expect(result).toBeCloseTo(10, 0);
  });

  it("0 unidades, ventas positivas → 0", () => {
    expect(computeWOI(0, 50)).toBe(0);
  });

  it("1000 unidades, 100/mes → ~43.3 semanas", () => {
    const result = computeWOI(1000, 100);
    expect(result).toBeCloseTo(43.3, 0);
  });
});

// ─── monthlyToWeekly ────────────────────────────────────────────────────────

describe("monthlyToWeekly", () => {
  it("433 mensual → ~100 semanal", () => {
    expect(monthlyToWeekly(433)).toBeCloseTo(100, 0);
  });

  it("0 → 0", () => {
    expect(monthlyToWeekly(0)).toBe(0);
  });
});

// ─── classifyDepotRisk ──────────────────────────────────────────────────────

describe("classifyDepotRisk", () => {
  // Derive boundaries from config defaults — tests survive threshold changes
  const { criticalWeeks, lowWeeks, highWeeks } = DEFAULT_DEPOT_CONFIG;

  it("null → sin_venta", () => {
    expect(classifyDepotRisk(null)).toBe("sin_venta");
  });

  it("0 semanas → critico", () => {
    expect(classifyDepotRisk(0)).toBe("critico");
  });

  it("below critical → critico", () => {
    expect(classifyDepotRisk(criticalWeeks - 1)).toBe("critico");
  });

  it("at critical → bajo", () => {
    expect(classifyDepotRisk(criticalWeeks)).toBe("bajo");
  });

  it("at low → saludable", () => {
    expect(classifyDepotRisk(lowWeeks)).toBe("saludable");
  });

  it("at high → saludable", () => {
    expect(classifyDepotRisk(highWeeks)).toBe("saludable");
  });

  it("above high → alto", () => {
    expect(classifyDepotRisk(highWeeks + 1)).toBe("alto");
  });
});

// ─── buildDepotData ─────────────────────────────────────────────────────────

describe("buildDepotData", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 13)); // 13 Mar 2026
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("inventario vacío → datos con 0s", () => {
    const result = buildDepotData([], new Map());

    expect(result.stock.units).toBe(0);
    expect(result.retails.units).toBe(0);
    expect(result.stores).toHaveLength(0);
    expect(result.totals.dependentStoreCount).toBe(0);
    expect(result.totals.networkUnits).toBe(0);
  });

  it("separa STOCK y RETAILS del inventario", () => {
    const items = [
      inv({ store: "STOCK", units: 500, value: 5000000 }),
      inv({ store: "RETAILS", units: 200, value: 2000000 }),
      inv({ store: "TOLAMB", units: 100, value: 1000000 }),
    ];

    const result = buildDepotData(items, new Map());

    expect(result.stock.units).toBe(500);
    expect(result.retails.units).toBe(200);
    expect(result.stores).toHaveLength(1);
    expect(result.stores[0].units).toBe(100);
  });

  it("excluye tiendas B2B y depósitos internos", () => {
    const items = [
      inv({ store: "MAYORISTA", units: 300 }),
      inv({ store: "FABRICA", units: 200 }),
      inv({ store: "TOLAMB", units: 100 }),
    ];

    const result = buildDepotData(items, new Map());

    // Solo TOLAMB debe aparecer como tienda dependiente
    expect(result.stores).toHaveLength(1);
    expect(result.stores[0].key).toBe("TOLAMB");
  });

  it("calcula WOI de depósitos contra demanda de red", () => {
    const items = [
      inv({ store: "STOCK", sku: "SKU001", units: 433 }),
      inv({ store: "TOLAMB", sku: "SKU001", units: 50 }),
    ];

    // TOLAMB vendió 433 u/mes promedio → ~100 u/semana
    const history: SalesHistoryMap = new Map([
      ["TOLAMB|SKU001", 433],
    ]);

    const result = buildDepotData(items, history);

    // STOCK tiene 433 u / ~100 u/semana ≈ 4.33 semanas
    expect(result.stock.weeksOnHand).toBeCloseTo(4.3, 0);
  });

  it("clasifica tiendas críticas (< 4 semanas)", () => {
    const items = [
      inv({ store: "TOLAMB", sku: "SKU001", units: 10 }),
      inv({ store: "CERROALTO", sku: "SKU001", units: 1000 }),
    ];

    const history: SalesHistoryMap = new Map([
      ["TOLAMB|SKU001", 100],      // 10u / ~23u/sem = ~0.4 sem → crítico
      ["CERROALTO|SKU001", 100],   // 1000u / ~23u/sem = ~43 sem → alto
    ]);

    const result = buildDepotData(items, history);
    expect(result.totals.criticalStoreCount).toBe(1);
  });

  it("genera salesWindow con 6 meses", () => {
    const result = buildDepotData([], new Map());

    expect(result.salesWindow.periodLabels).toHaveLength(6);
    expect(result.salesWindow.periodLabels[5]).toBe("2026-03");
    expect(result.salesWindow.periodLabels[0]).toBe("2025-10");
  });

  it("ordena tiendas: críticas primero, luego por WOI asc", () => {
    const items = [
      inv({ store: "TOLAMB", sku: "SKU001", units: 10 }),
      inv({ store: "CERROALTO", sku: "SKU001", units: 500 }),
      inv({ store: "ESTRELLA", sku: "SKU001", units: 50 }),
    ];

    const history: SalesHistoryMap = new Map([
      ["TOLAMB|SKU001", 100],
      ["CERROALTO|SKU001", 100],
      ["ESTRELLA|SKU001", 100],
    ]);

    const result = buildDepotData(items, history);

    // TOLAMB (10u, crítico) debe ser primero
    expect(result.stores[0].key).toBe("TOLAMB");
  });

  it("agrega topBrands y topCategories por nodo", () => {
    const items = [
      inv({ store: "STOCK", brand: "Martel", categoria: "camisa", value: 5000000 }),
      inv({ store: "STOCK", brand: "Wrangler", categoria: "vaquero", value: 3000000 }),
      inv({ store: "STOCK", brand: "Martel", categoria: "pantalón", value: 2000000 }),
    ];

    const result = buildDepotData(items, new Map());

    expect(result.stock.topBrands).toHaveLength(2);
    expect(result.stock.topBrands[0].label).toBe("Martel"); // 7M > 3M
    expect(result.stock.topCategories).toHaveLength(3);
    expect(result.stock.topCategories[0].label).toBe("camisa"); // 5M
  });

  it("expone categoriesByBrand en stock y retails", () => {
    const items = [
      // STOCK — Martel: camisa 5M + pantalón 2M; Wrangler: vaquero 3M
      inv({ store: "STOCK", brand: "Martel",   categoria: "camisa",   value: 5000000, units: 50 }),
      inv({ store: "STOCK", brand: "Wrangler", categoria: "vaquero",  value: 3000000, units: 30 }),
      inv({ store: "STOCK", brand: "Martel",   categoria: "pantalón", value: 2000000, units: 20 }),
      // RETAILS — solo Lee: bermuda 4M
      inv({ store: "RETAILS", brand: "Lee", categoria: "bermuda", value: 4000000, units: 40 }),
    ];

    const result = buildDepotData(items, new Map());

    // Stock: dos marcas con sus categorías propias, ordenadas por valor desc
    expect(Object.keys(result.stock.categoriesByBrand).sort()).toEqual(["Martel", "Wrangler"]);
    expect(result.stock.categoriesByBrand.Martel.map(r => r.label)).toEqual(["camisa", "pantalón"]);
    expect(result.stock.categoriesByBrand.Wrangler).toHaveLength(1);
    expect(result.stock.categoriesByBrand.Wrangler[0].label).toBe("vaquero");

    // Retails: solo Lee
    expect(result.retails.categoriesByBrand.Lee).toHaveLength(1);
    expect(result.retails.categoriesByBrand.Lee[0].units).toBe(40);
  });

  it("incluye tiendas con 0 inventario pero con ventas históricas", () => {
    const items = [
      inv({ store: "STOCK", sku: "SKU001", units: 100 }),
    ];

    // FERIA no tiene inventario pero sí ventas históricas
    const history: SalesHistoryMap = new Map([
      ["FERIA|SKU001", 50],
    ]);

    const result = buildDepotData(items, history);

    const feria = result.stores.find(s => s.key === "FERIA");
    expect(feria).toBeDefined();
    expect(feria!.units).toBe(0);
    expect(feria!.risk).toBe("critico");
  });

  it("incluye datos de novelty en resultado", () => {
    const items = [
      inv({ store: "STOCK", sku: "SKU001", units: 200, estComercial: "lanzamiento" }),
      inv({ store: "TOLAMB", sku: "SKU001", units: 50, estComercial: "lanzamiento" }),
      inv({ store: "TOLAMB", sku: "SKU002", units: 100, estComercial: "linea" }),
    ];

    const result = buildDepotData(items, new Map());

    expect(result.novelty).toBeDefined();
    expect(result.novelty.totalSkus).toBe(1); // solo SKU001 es lanzamiento
    expect(result.novelty.totalUnits).toBe(250);
  });

  it("marca isNovelty en DepotSkuRow", () => {
    const items = [
      inv({ store: "TOLAMB", sku: "SKU001", estComercial: "lanzamiento" }),
      inv({ store: "TOLAMB", sku: "SKU002", estComercial: "linea" }),
    ];

    const result = buildDepotData(items, new Map());
    const rows = result.stores[0].skuRows;

    const noveltyRow = rows.find(r => r.sku === "SKU001");
    const normalRow = rows.find(r => r.sku === "SKU002");
    expect(noveltyRow?.isNovelty).toBe(true);
    expect(normalRow?.isNovelty).toBe(false);
  });
});

// ─── aggregateCategoriesByBrand (helper puro) ───────────────────────────────

describe("aggregateCategoriesByBrand", () => {
  it("agrupa por (marca, categoría) y ordena categorías por valor desc", () => {
    const items = [
      inv({ brand: "Martel", categoria: "camisa",   value: 1_000_000, units: 10 }),
      inv({ brand: "Martel", categoria: "pantalón", value: 3_000_000, units: 30 }),
      inv({ brand: "Martel", categoria: "camisa",   value:   500_000, units:  5 }), // mismo bucket
    ];
    const out = aggregateCategoriesByBrand(items, [], new Map());
    expect(Object.keys(out)).toEqual(["Martel"]);
    expect(out.Martel.map(r => r.label)).toEqual(["pantalón", "camisa"]);
    const camisa = out.Martel.find(r => r.label === "camisa")!;
    expect(camisa.units).toBe(15); // 10 + 5
    expect(camisa.value).toBe(1_500_000);
  });

  it("nodo vacío → record vacío", () => {
    expect(aggregateCategoriesByBrand([], [], new Map())).toEqual({});
  });

  it("WOI por (marca, categoría) usa demanda de la red dependiente", () => {
    const stockItems = [inv({ store: "STOCK", brand: "Martel", categoria: "camisa", units: 100 })];
    const dependentItems = [inv({ store: "TOLAMB", sku: "SKU001", brand: "Martel", categoria: "camisa" })];
    const history: SalesHistoryMap = new Map([["TOLAMB|SKU001", 43.3]]);

    const out = aggregateCategoriesByBrand(stockItems, dependentItems, history);
    expect(out.Martel[0].woi).toBeCloseTo(10, 0); // 100 / (43.3/4.33) ≈ 10
  });

  it("categoría sin demanda → woi null", () => {
    const out = aggregateCategoriesByBrand(
      [inv({ store: "STOCK", brand: "Lee", categoria: "bermuda", units: 50 })],
      [],
      new Map(),
    );
    expect(out.Lee[0].woi).toBeNull();
  });

  it("marcas en nodeItems sin demanda en la red → siguen apareciendo con woi null", () => {
    const out = aggregateCategoriesByBrand(
      [inv({ store: "STOCK", brand: "Niella", categoria: "remera", units: 20 })],
      [inv({ store: "TOLAMB", brand: "Otra", categoria: "polera" })],
      new Map([["TOLAMB|SKU001", 10]]),
    );
    expect(out.Niella).toBeDefined();
    expect(out.Niella[0].woi).toBeNull();
  });
});

// ─── classifyNoveltyDistribution ───────────────────────────────────────────

describe("classifyNoveltyDistribution", () => {
  it("0 tiendas → en_deposito", () => {
    expect(classifyNoveltyDistribution(0, 10)).toBe("en_deposito");
  });

  it("1 de 10 tiendas → en_distribucion", () => {
    expect(classifyNoveltyDistribution(1, 10)).toBe("en_distribucion");
  });

  it("7 de 10 tiendas → en_distribucion (70%)", () => {
    expect(classifyNoveltyDistribution(7, 10)).toBe("en_distribucion");
  });

  it("8 de 10 tiendas → cargado (80% exacto)", () => {
    expect(classifyNoveltyDistribution(8, 10)).toBe("cargado");
  });

  it("10 de 10 tiendas → cargado (100%)", () => {
    expect(classifyNoveltyDistribution(10, 10)).toBe("cargado");
  });

  it("0 tiendas totales → en_deposito", () => {
    expect(classifyNoveltyDistribution(0, 0)).toBe("en_deposito");
  });
});

// ─── buildNoveltyData ──────────────────────────────────────────────────────

describe("buildNoveltyData", () => {
  it("inventario vacío → totalSkus 0", () => {
    const result = buildNoveltyData([], 10);
    expect(result.totalSkus).toBe(0);
    expect(result.skus).toHaveLength(0);
    expect(result.byStatus).toEqual({ en_deposito: 0, en_distribucion: 0, cargado: 0 });
  });

  it("filtra solo items con estComercial lanzamiento", () => {
    const items = [
      inv({ sku: "SKU001", estComercial: "lanzamiento", store: "STOCK" }),
      inv({ sku: "SKU002", estComercial: "linea", store: "STOCK" }),
      inv({ sku: "SKU003", estComercial: "outlet", store: "STOCK" }),
    ];
    const result = buildNoveltyData(items, 10);
    expect(result.totalSkus).toBe(1);
    expect(result.skus[0].sku).toBe("SKU001");
  });

  it("SKU solo en STOCK → en_deposito", () => {
    const items = [
      inv({ sku: "SKU001", estComercial: "lanzamiento", store: "STOCK", units: 100, value: 1000000 }),
    ];
    const result = buildNoveltyData(items, 10);
    expect(result.skus[0].distributionStatus).toBe("en_deposito");
    expect(result.skus[0].stockUnits).toBe(100);
    expect(result.skus[0].storeCount).toBe(0);
    expect(result.skus[0].coveragePct).toBe(0);
    expect(result.byStatus.en_deposito).toBe(1);
  });

  it("SKU en STOCK + 3 de 10 tiendas → en_distribucion", () => {
    const items = [
      inv({ sku: "SKU001", estComercial: "lanzamiento", store: "STOCK", units: 200 }),
      inv({ sku: "SKU001", estComercial: "lanzamiento", store: "TOLAMB", units: 10 }),
      inv({ sku: "SKU001", estComercial: "lanzamiento", store: "CERROALTO", units: 5 }),
      inv({ sku: "SKU001", estComercial: "lanzamiento", store: "ESTRELLA", units: 8 }),
    ];
    const result = buildNoveltyData(items, 10);
    expect(result.skus[0].distributionStatus).toBe("en_distribucion");
    expect(result.skus[0].storeCount).toBe(3);
    expect(result.skus[0].coveragePct).toBe(30);
  });

  it("SKU en 9 de 10 tiendas → cargado", () => {
    const stores = ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9"];
    const items = stores.map(s =>
      inv({ sku: "SKU001", estComercial: "lanzamiento", store: s, units: 5 })
    );
    const result = buildNoveltyData(items, 10);
    expect(result.skus[0].distributionStatus).toBe("cargado");
    expect(result.skus[0].coveragePct).toBe(90);
    expect(result.byStatus.cargado).toBe(1);
  });

  it("agrupa por SKU (sin talle)", () => {
    const items = [
      inv({ sku: "SKU001", talle: "M", estComercial: "lanzamiento", store: "STOCK", units: 50 }),
      inv({ sku: "SKU001", talle: "L", estComercial: "lanzamiento", store: "STOCK", units: 30 }),
    ];
    const result = buildNoveltyData(items, 10);
    expect(result.totalSkus).toBe(1);
    expect(result.skus[0].totalUnits).toBe(80);
    expect(result.skus[0].stockUnits).toBe(80);
  });

  it("cuenta RETAILS y STOCK por separado", () => {
    const items = [
      inv({ sku: "SKU001", estComercial: "lanzamiento", store: "STOCK", units: 100 }),
      inv({ sku: "SKU001", estComercial: "lanzamiento", store: "RETAILS", units: 50 }),
    ];
    const result = buildNoveltyData(items, 10);
    expect(result.skus[0].stockUnits).toBe(100);
    expect(result.skus[0].retailsUnits).toBe(50);
    expect(result.skus[0].totalUnits).toBe(150);
  });

  it("excluye tiendas excluidas del conteo de distribución", () => {
    const items = [
      inv({ sku: "SKU001", estComercial: "lanzamiento", store: "STOCK", units: 100 }),
      inv({ sku: "SKU001", estComercial: "lanzamiento", store: "FABRICA", units: 1 }),
      inv({ sku: "SKU001", estComercial: "lanzamiento", store: "LAVADO", units: 1 }),
    ];
    const result = buildNoveltyData(items, 10);
    // FABRICA y LAVADO son excluded → storeCount debe ser 0
    expect(result.skus[0].storeCount).toBe(0);
    expect(result.skus[0].distributionStatus).toBe("en_deposito");
  });

  it("ordena por status (deposito primero) y luego units desc", () => {
    const items = [
      inv({ sku: "SKU-A", estComercial: "lanzamiento", store: "TOLAMB", units: 10 }),
      inv({ sku: "SKU-B", estComercial: "lanzamiento", store: "STOCK", units: 200 }),
      inv({ sku: "SKU-C", estComercial: "lanzamiento", store: "STOCK", units: 50 }),
    ];
    const result = buildNoveltyData(items, 10);
    // SKU-B y SKU-C son en_deposito, SKU-A es en_distribucion
    expect(result.skus[0].sku).toBe("SKU-B"); // en_deposito, 200 units
    expect(result.skus[1].sku).toBe("SKU-C"); // en_deposito, 50 units
    expect(result.skus[2].sku).toBe("SKU-A"); // en_distribucion
  });

  it("byStatus cuenta correctamente múltiples SKUs", () => {
    const items = [
      inv({ sku: "SKU-A", estComercial: "lanzamiento", store: "STOCK", units: 100 }),
      inv({ sku: "SKU-B", estComercial: "lanzamiento", store: "STOCK", units: 50 }),
      inv({ sku: "SKU-B", estComercial: "lanzamiento", store: "TOLAMB", units: 5 }),
    ];
    const result = buildNoveltyData(items, 1); // 1 tienda, threshold 80%
    // SKU-A: 0 tiendas → en_deposito
    // SKU-B: 1 de 1 → cargado (100%)
    expect(result.byStatus.en_deposito).toBe(1);
    expect(result.byStatus.cargado).toBe(1);
    expect(result.byStatus.en_distribucion).toBe(0);
  });
});
