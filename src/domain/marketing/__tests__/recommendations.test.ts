/**
 * Tests para domain/marketing/recommendations.ts
 *
 * Verifica que el motor de recomendaciones elige el producto correcto
 * para cada categoría de trigger, y maneja correctamente inputs vacíos.
 */
import { describe, it, expect } from "vitest";
import {
  recommendForTrigger,
  strategyForCategory,
  type RecommendationInput,
} from "../recommendations";
import type { TriggerCategory } from "../types";

// ─── Fixtures ───────────────────────────────────────────────────────────────

const EMPTY: RecommendationInput = {
  lowStockItems: [],
  overstockItems: [],
  topSellers: [],
  slowMovers: [],
};

const SAMPLE: RecommendationInput = {
  lowStockItems: [
    { sku: "LOW1", description: "Jean Martel slim", brand: "Martel", units: 3 },
    { sku: "LOW2", description: "Remera Wrangler", brand: "Wrangler", units: 1 },
    { sku: "LOW3", description: "Jacket Lee", brand: "Lee", units: 5 },
  ],
  overstockItems: [
    { sku: "OS1", description: "Polo Martel azul", brand: "Martel", units: 120 },
    { sku: "SM1", description: "Cinturón Martel", brand: "Martel", units: 200 },
  ],
  topSellers: [
    { sku: "TS1", description: "Jean Wrangler 34", brand: "Wrangler", units: 420, weightPct: 12.5 },
    { sku: "TS2", description: "Jean Lee 32", brand: "Lee", units: 380, weightPct: 10.2 },
  ],
  slowMovers: [
    { sku: "SM1", description: "Cinturón Martel", brand: "Martel", units: 5, weightPct: 0.03 },
    { sku: "SM2", description: "Gorro Lee", brand: "Lee", units: 8, weightPct: 0.08 },
  ],
};

// ─── strategyForCategory ─────────────────────────────────────────────────────

describe("strategyForCategory", () => {
  it("low_stock → urgency", () => {
    expect(strategyForCategory("low_stock")).toBe("urgency");
  });

  it("inactivity/post_purchase/first_purchase/second_purchase → re_engagement", () => {
    expect(strategyForCategory("inactivity")).toBe("re_engagement");
    expect(strategyForCategory("post_purchase")).toBe("re_engagement");
    expect(strategyForCategory("first_purchase")).toBe("re_engagement");
    expect(strategyForCategory("second_purchase")).toBe("re_engagement");
  });

  it("overdue/return/high_ticket/low_ticket → clearance", () => {
    expect(strategyForCategory("overdue")).toBe("clearance");
    expect(strategyForCategory("return")).toBe("clearance");
    expect(strategyForCategory("high_ticket")).toBe("clearance");
    expect(strategyForCategory("low_ticket")).toBe("clearance");
  });

  it("cubre las 9 categorías posibles sin undefined", () => {
    const cats: TriggerCategory[] = [
      "inactivity", "overdue", "return", "post_purchase", "first_purchase",
      "second_purchase", "high_ticket", "low_ticket", "low_stock",
    ];
    for (const c of cats) {
      expect(strategyForCategory(c)).toBeDefined();
    }
  });
});

// ─── Urgency (low_stock) ─────────────────────────────────────────────────────

describe("recommendForTrigger · urgency", () => {
  it("elige el SKU con menor stock de lowStockItems", () => {
    const r = recommendForTrigger("low_stock", SAMPLE);
    expect(r).not.toBeNull();
    expect(r!.sku).toBe("LOW2");
    expect(r!.strategy).toBe("urgency");
    expect(r!.reason).toBe("Stock bajo");
    expect(r!.dataPoint).toBe("1 unidad disponibles");
  });

  it("pluraliza correctamente cuando units > 1", () => {
    const input: RecommendationInput = {
      ...EMPTY,
      lowStockItems: [{ sku: "X", description: "Y", brand: "Z", units: 3 }],
    };
    const r = recommendForTrigger("low_stock", input);
    expect(r!.dataPoint).toBe("3 unidades disponibles");
  });

  it("retorna null si no hay lowStockItems", () => {
    expect(recommendForTrigger("low_stock", EMPTY)).toBeNull();
  });
});

// ─── Re-engagement (inactivity, post_purchase, first/second_purchase) ────────

describe("recommendForTrigger · re_engagement", () => {
  it("inactivity → top seller #1", () => {
    const r = recommendForTrigger("inactivity", SAMPLE);
    expect(r!.sku).toBe("TS1");
    expect(r!.reason).toBe("Top seller");
    expect(r!.dataPoint).toBe("12.5% del total vendido");
    expect(r!.strategy).toBe("re_engagement");
  });

  it("first_purchase usa misma estrategia que inactivity", () => {
    const inactivity = recommendForTrigger("inactivity", SAMPLE);
    const firstPurchase = recommendForTrigger("first_purchase", SAMPLE);
    expect(firstPurchase!.sku).toBe(inactivity!.sku);
  });

  it("second_purchase → top seller", () => {
    const r = recommendForTrigger("second_purchase", SAMPLE);
    expect(r!.sku).toBe("TS1");
  });

  it("post_purchase → top seller", () => {
    const r = recommendForTrigger("post_purchase", SAMPLE);
    expect(r!.sku).toBe("TS1");
  });

  it("retorna null si no hay topSellers", () => {
    expect(recommendForTrigger("inactivity", EMPTY)).toBeNull();
    expect(recommendForTrigger("first_purchase", EMPTY)).toBeNull();
  });
});

// ─── Clearance (overdue, return, high/low_ticket) ────────────────────────────

describe("recommendForTrigger · clearance", () => {
  it("overdue → slow mover que también está en overstock", () => {
    const r = recommendForTrigger("overdue", SAMPLE);
    expect(r).not.toBeNull();
    // SM1 está en slowMovers Y en overstockItems con más stock → intersección
    expect(r!.sku).toBe("SM1");
    expect(r!.reason).toBe("Liquidar sobrestock");
    expect(r!.dataPoint).toBe("200 unidades en stock");
    expect(r!.strategy).toBe("clearance");
  });

  it("return → clearance (misma regla)", () => {
    expect(recommendForTrigger("return", SAMPLE)!.sku).toBe("SM1");
  });

  it("high_ticket → clearance", () => {
    expect(recommendForTrigger("high_ticket", SAMPLE)!.sku).toBe("SM1");
  });

  it("low_ticket → clearance", () => {
    expect(recommendForTrigger("low_ticket", SAMPLE)!.sku).toBe("SM1");
  });

  it("fallback: sin intersección slow/overstock → primer slow mover", () => {
    const input: RecommendationInput = {
      ...EMPTY,
      slowMovers: [
        { sku: "ALONE", description: "Gorro único", brand: "Otras", units: 2, weightPct: 0.01 },
      ],
    };
    const r = recommendForTrigger("overdue", input);
    expect(r).not.toBeNull();
    expect(r!.sku).toBe("ALONE");
    expect(r!.reason).toBe("Bajo rotación");
    expect(r!.dataPoint).toBe("0.01% del total (lento)");
  });

  it("retorna null sin slowMovers ni overstock", () => {
    expect(recommendForTrigger("overdue", EMPTY)).toBeNull();
    expect(recommendForTrigger("return", EMPTY)).toBeNull();
  });
});

// ─── Robustez ────────────────────────────────────────────────────────────────

describe("recommendForTrigger · robustez", () => {
  it("maneja input totalmente vacío sin crashear", () => {
    const cats: TriggerCategory[] = [
      "inactivity", "overdue", "return", "post_purchase", "first_purchase",
      "second_purchase", "high_ticket", "low_ticket", "low_stock",
    ];
    for (const c of cats) {
      expect(() => recommendForTrigger(c, EMPTY)).not.toThrow();
      expect(recommendForTrigger(c, EMPTY)).toBeNull();
    }
  });

  it("no mutaciona el input original", () => {
    const input = JSON.parse(JSON.stringify(SAMPLE)) as RecommendationInput;
    recommendForTrigger("low_stock", input);
    expect(input).toEqual(SAMPLE);
  });
});
