import { describe, it, expect } from "vitest";
import { mapToLifecycleRoles, filterActionsByRole } from "../types";
import type { ActionItemFull } from "@/domain/actionQueue/waterfall";

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeAction(overrides: Partial<ActionItemFull> = {}): ActionItemFull {
  return {
    id: "test-1", rank: 1, sku: "SKU001", skuComercial: "SKU001C", talle: "M",
    description: "Test", brand: "martel", store: "SHOPMCAL", targetStore: undefined,
    currentStock: 10, suggestedUnits: 5, idealUnits: 5, gapUnits: 0,
    daysOfInventory: 30, historicalAvg: 2, coverWeeks: 13,
    currentMOS: 0.5, risk: "low", waterfallLevel: "store_to_store",
    actionType: "transfer", impactScore: 1_000_000, paretoFlag: false,
    storeCluster: "A", timeRestriction: "", counterpartStores: [],
    recommendedAction: "transfer", linea: "Camiseria", categoria: "camisa",
    productType: "basicos", category: "movement", responsibleRoles: [],
    ...overrides,
  };
}

// ─── mapToLifecycleRoles ────────────────────────────────────────────────────

describe("mapToLifecycleRoles", () => {
  it("super_user gets all roles", () => {
    const roles = mapToLifecycleRoles("super_user");
    expect(roles).toContain("marketing_b2c");
    expect(roles).toContain("brand_manager");
    expect(roles).toContain("gerencia_retail");
    expect(roles).toContain("operaciones_retail");
    expect(roles).toContain("logistica");
  });

  it("gerencia gets all roles", () => {
    const roles = mapToLifecycleRoles("gerencia");
    expect(roles.length).toBe(5);
  });

  it("negocio with Brand Manager cargo → brand_manager", () => {
    const roles = mapToLifecycleRoles("negocio", "Brand Manager");
    expect(roles).toEqual(["brand_manager"]);
  });

  it("negocio with marketing cargo → marketing_b2c", () => {
    const roles = mapToLifecycleRoles("negocio", "Marketing Digital");
    expect(roles).toEqual(["marketing_b2c"]);
  });

  it("negocio with operaciones cargo → operaciones + logistica", () => {
    const roles = mapToLifecycleRoles("negocio", "Operaciones Retail");
    expect(roles).toContain("operaciones_retail");
    expect(roles).toContain("logistica");
  });

  it("negocio with logística cargo → operaciones + logistica", () => {
    const roles = mapToLifecycleRoles("negocio", "Logística");
    expect(roles).toContain("logistica");
  });

  it("negocio with gerencia cargo → gerencia_retail", () => {
    const roles = mapToLifecycleRoles("negocio", "Gerente Regional");
    expect(roles).toEqual(["gerencia_retail"]);
  });

  it("negocio without cargo → default (marketing + brand_manager)", () => {
    const roles = mapToLifecycleRoles("negocio");
    expect(roles).toContain("marketing_b2c");
    expect(roles).toContain("brand_manager");
  });

  it("negocio with null cargo → default", () => {
    const roles = mapToLifecycleRoles("negocio", null);
    expect(roles).toContain("marketing_b2c");
  });

  it("is case-insensitive for cargo matching", () => {
    const roles = mapToLifecycleRoles("negocio", "BRAND MANAGER");
    expect(roles).toEqual(["brand_manager"]);
  });
});

// ─── filterActionsByRole ────────────────────────────────────────────────────

describe("filterActionsByRole", () => {
  it("super_user sees everything", () => {
    const actions = [
      makeAction({ category: "movement", responsibleRoles: [] }),
      makeAction({ id: "lc-1", category: "lifecycle", responsibleRoles: ["brand_manager"] }),
    ];
    const result = filterActionsByRole(actions, "super_user");
    expect(result).toHaveLength(2);
  });

  it("gerencia sees everything", () => {
    const actions = [
      makeAction({ category: "lifecycle", responsibleRoles: ["logistica"] }),
    ];
    const result = filterActionsByRole(actions, "gerencia");
    expect(result).toHaveLength(1);
  });

  it("movement without roles is always visible", () => {
    const actions = [
      makeAction({ category: "movement", responsibleRoles: [] }),
    ];
    const result = filterActionsByRole(actions, "negocio", "Brand Manager");
    expect(result).toHaveLength(1);
  });

  it("lifecycle action visible only if role matches", () => {
    const actions = [
      makeAction({ id: "lc-1", category: "lifecycle", responsibleRoles: ["brand_manager"] }),
      makeAction({ id: "lc-2", category: "lifecycle", responsibleRoles: ["logistica"] }),
    ];
    const result = filterActionsByRole(actions, "negocio", "Brand Manager");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("lc-1");
  });

  it("filters out lifecycle actions when user has no matching role", () => {
    const actions = [
      makeAction({ id: "lc-1", category: "lifecycle", responsibleRoles: ["logistica"] }),
    ];
    const result = filterActionsByRole(actions, "negocio", "Brand Manager");
    expect(result).toHaveLength(0);
  });

  it("movement with responsibleRoles filters by role match", () => {
    const actions = [
      makeAction({ category: "movement", responsibleRoles: ["logistica"] }),
    ];
    const result = filterActionsByRole(actions, "negocio", "Brand Manager");
    // Movement with roles set → still filters
    expect(result).toHaveLength(0);
  });
});
