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
  buildDepotData,
} from "../calculations";
import type { InventoryItem } from "@/queries/inventory.queries";
import type { SalesHistoryMap } from "@/queries/salesHistory.queries";

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
  it("null → sin_venta", () => {
    expect(classifyDepotRisk(null)).toBe("sin_venta");
  });

  it("0 semanas → critico", () => {
    expect(classifyDepotRisk(0)).toBe("critico");
  });

  it("3 semanas → critico (< 4)", () => {
    expect(classifyDepotRisk(3)).toBe("critico");
  });

  it("4 semanas → bajo (>= 4, < 8)", () => {
    expect(classifyDepotRisk(4)).toBe("bajo");
  });

  it("8 semanas → saludable (>= 8, <= 16)", () => {
    expect(classifyDepotRisk(8)).toBe("saludable");
  });

  it("16 semanas → saludable (= 16)", () => {
    expect(classifyDepotRisk(16)).toBe("saludable");
  });

  it("17 semanas → alto (> 16)", () => {
    expect(classifyDepotRisk(17)).toBe("alto");
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
});
