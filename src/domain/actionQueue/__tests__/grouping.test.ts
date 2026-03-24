import { describe, it, expect } from "vitest";
import { groupActions, splitIntoSections } from "../grouping";
import type { ActionItemFull } from "../waterfall";
import type { RiskLevel, WaterfallLevel, ActionType } from "../types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeItem(overrides: Partial<ActionItemFull> = {}): ActionItemFull {
  return {
    id: `aq-${Math.random()}`,
    rank: 1,
    sku: "SKU001",
    skuComercial: "MACA001",
    talle: "M",
    description: "Test Item",
    brand: "Martel",
    store: "TIENDA1",
    targetStore: undefined,
    currentStock: 5,
    suggestedUnits: 10,
    idealUnits: 10,
    gapUnits: 0,
    daysOfInventory: 18.75,
    historicalAvg: 8,
    coverWeeks: 12,
    currentMOS: 0.6,
    risk: "critical" as RiskLevel,
    waterfallLevel: "store_to_store" as WaterfallLevel,
    actionType: "transfer" as ActionType,
    impactScore: 100_000,
    paretoFlag: true,
    storeCluster: "A",
    timeRestriction: "Sin restriccion",
    counterpartStores: [],
    recommendedAction: "Mover stock",
    linea: "Camiseria",
    categoria: "camisa",
    ...overrides,
  };
}

// ─── groupActions tests ───────────────────────────────────────────────────────

describe("groupActions", () => {
  it("returns empty array for empty input", () => {
    expect(groupActions([], "store")).toEqual([]);
    expect(groupActions([], "brand")).toEqual([]);
  });

  it("groups by store correctly", () => {
    const items = [
      makeItem({ store: "CERROALTO", impactScore: 500_000 }),
      makeItem({ store: "CERROALTO", impactScore: 300_000 }),
      makeItem({ store: "WRSSL", impactScore: 200_000 }),
    ];
    const groups = groupActions(items, "store");
    expect(groups).toHaveLength(2);
    expect(groups[0].key).toBe("CERROALTO");
    expect(groups[0].totalActions).toBe(2);
    expect(groups[1].key).toBe("WRSSL");
    expect(groups[1].totalActions).toBe(1);
  });

  it("groups by brand correctly", () => {
    const items = [
      makeItem({ brand: "Wrangler", impactScore: 1_000_000 }),
      makeItem({ brand: "Martel", impactScore: 500_000 }),
      makeItem({ brand: "Martel", impactScore: 400_000 }),
    ];
    const groups = groupActions(items, "brand");
    expect(groups).toHaveLength(2);
    expect(groups[0].key).toBe("Wrangler");
    expect(groups[1].key).toBe("Martel");
    expect(groups[1].totalActions).toBe(2);
  });

  it("sorts groups by total impact descending", () => {
    const items = [
      makeItem({ store: "T1", impactScore: 100_000 }),
      makeItem({ store: "T2", impactScore: 900_000 }),
      makeItem({ store: "T3", impactScore: 500_000 }),
    ];
    const groups = groupActions(items, "store");
    expect(groups[0].key).toBe("T2");
    expect(groups[1].key).toBe("T3");
    expect(groups[2].key).toBe("T1");
  });

  it("computes risk counts correctly", () => {
    const items = [
      makeItem({ store: "T1", risk: "critical" }),
      makeItem({ store: "T1", risk: "critical" }),
      makeItem({ store: "T1", risk: "low" }),
      makeItem({ store: "T1", risk: "overstock" }),
    ];
    const [group] = groupActions(items, "store");
    expect(group.criticalCount).toBe(2);
    expect(group.lowCount).toBe(1);
    expect(group.overstockCount).toBe(1);
  });

  it("computes unique SKUs correctly", () => {
    const items = [
      makeItem({ store: "T1", sku: "A" }),
      makeItem({ store: "T1", sku: "A" }),
      makeItem({ store: "T1", sku: "B" }),
      makeItem({ store: "T1", sku: "C" }),
    ];
    const [group] = groupActions(items, "store");
    expect(group.uniqueSkus).toBe(3);
  });

  it("includes store metadata in store grouping", () => {
    const items = [makeItem({ store: "CERROALTO" })];
    const [group] = groupActions(items, "store");
    expect(group.cluster).toBe("B");
    expect(group.timeRestriction).toBe("Antes de las 10am (optimizar ruta)");
    expect(group.assortmentCapacity).toBe(3000);
  });

  it("does not include store metadata in brand grouping", () => {
    const items = [makeItem({ brand: "Martel" })];
    const [group] = groupActions(items, "brand");
    expect(group.cluster).toBeNull();
    expect(group.timeRestriction).toBeNull();
    expect(group.assortmentCapacity).toBeNull();
  });

  it("groups contain sections", () => {
    const items = [
      makeItem({ store: "T1", actionType: "transfer", risk: "critical" }),
      makeItem({ store: "T1", actionType: "restock_from_depot", risk: "low" }),
    ];
    const [group] = groupActions(items, "store");
    expect(group.sections.length).toBeGreaterThanOrEqual(2);
  });
});

// ─── splitIntoSections tests ──────────────────────────────────────────────────

describe("splitIntoSections", () => {
  it("returns empty for empty input", () => {
    expect(splitIntoSections([])).toEqual([]);
  });

  it("classifies deficit transfers as receive_transfer", () => {
    const items = [makeItem({ actionType: "transfer", risk: "critical" })];
    const sections = splitIntoSections(items);
    expect(sections).toHaveLength(1);
    expect(sections[0].intent).toBe("receive_transfer");
    expect(sections[0].label).toBe("Recibir de otras tiendas");
  });

  it("classifies overstock transfers as redistribute", () => {
    const items = [makeItem({ actionType: "transfer", risk: "overstock" })];
    const sections = splitIntoSections(items);
    expect(sections).toHaveLength(1);
    expect(sections[0].intent).toBe("redistribute");
  });

  it("classifies restock_from_depot as receive_depot", () => {
    const items = [makeItem({ actionType: "restock_from_depot", risk: "critical" })];
    const sections = splitIntoSections(items);
    expect(sections[0].intent).toBe("receive_depot");
  });

  it("classifies resupply_depot as resupply_depot", () => {
    const items = [makeItem({ actionType: "resupply_depot", risk: "critical" })];
    const sections = splitIntoSections(items);
    expect(sections[0].intent).toBe("resupply_depot");
  });

  it("classifies central_to_b2b as ship_b2b", () => {
    const items = [makeItem({ actionType: "central_to_b2b", risk: "low" })];
    const sections = splitIntoSections(items);
    expect(sections[0].intent).toBe("ship_b2b");
  });

  it("sections are ordered: receive_transfer, receive_depot, resupply_depot, redistribute, ship_b2b", () => {
    const items = [
      makeItem({ actionType: "central_to_b2b", risk: "low" }),
      makeItem({ actionType: "transfer", risk: "overstock" }),
      makeItem({ actionType: "transfer", risk: "critical" }),
      makeItem({ actionType: "restock_from_depot", risk: "low" }),
      makeItem({ actionType: "resupply_depot", risk: "critical" }),
    ];
    const sections = splitIntoSections(items);
    const intents = sections.map(s => s.intent);
    expect(intents).toEqual([
      "receive_transfer",
      "receive_depot",
      "resupply_depot",
      "redistribute",
      "ship_b2b",
    ]);
  });

  it("computes totalUnits and criticalCount per section", () => {
    const items = [
      makeItem({ actionType: "transfer", risk: "critical", suggestedUnits: 5 }),
      makeItem({ actionType: "transfer", risk: "critical", suggestedUnits: 15 }),
      makeItem({ actionType: "transfer", risk: "low", suggestedUnits: 3 }),
    ];
    const sections = splitIntoSections(items);
    const section = sections.find(s => s.intent === "receive_transfer")!;
    expect(section.totalUnits).toBe(23);
    expect(section.criticalCount).toBe(2);
    expect(section.items).toHaveLength(3);
  });

  it("skips empty sections", () => {
    const items = [makeItem({ actionType: "transfer", risk: "critical" })];
    const sections = splitIntoSections(items);
    expect(sections).toHaveLength(1);
  });

  // ─── Exhaustive coverage (08/03/2026) ─────────────────────────────────────

  it("multiple items of same intent grouped in one section", () => {
    const items = [
      makeItem({ actionType: "transfer", risk: "critical", suggestedUnits: 10 }),
      makeItem({ actionType: "transfer", risk: "low", suggestedUnits: 5 }),
    ];
    const sections = splitIntoSections(items);
    expect(sections).toHaveLength(1);
    expect(sections[0].intent).toBe("receive_transfer");
    expect(sections[0].items).toHaveLength(2);
  });

  it("classifies non-overstock, non-depot transfer as receive_transfer", () => {
    const items = [makeItem({ actionType: "transfer", risk: "low" })];
    const sections = splitIntoSections(items);
    expect(sections[0].intent).toBe("receive_transfer");
  });

  it("totalUnits sums suggestedUnits not counterpart units", () => {
    const items = [
      makeItem({ suggestedUnits: 7, counterpartStores: [{ store: "T1", units: 4 }, { store: "T2", units: 3 }] }),
    ];
    const sections = splitIntoSections(items);
    expect(sections[0].totalUnits).toBe(7);
  });

  it("criticalCount only counts risk=critical, not low", () => {
    const items = [
      makeItem({ risk: "critical" as RiskLevel }),
      makeItem({ risk: "low" as RiskLevel }),
      makeItem({ risk: "low" as RiskLevel }),
    ];
    const sections = splitIntoSections(items);
    expect(sections[0].criticalCount).toBe(1);
  });

  it("section label and description match intent metadata", () => {
    const items = [makeItem({ actionType: "resupply_depot" })];
    const sections = splitIntoSections(items);
    expect(sections[0].label).toBe("Abastecer RETAILS desde STOCK");
    expect(sections[0].description).toContain("STOCK");
  });

  it("ship_b2b section has correct metadata", () => {
    const items = [makeItem({ actionType: "central_to_b2b" })];
    const sections = splitIntoSections(items);
    expect(sections[0].label).toBe("Envio directo B2B");
    expect(sections[0].description).toContain("STOCK");
  });
});

// ─── Additional groupActions tests (exhaustive coverage) ─────────────────────

describe("groupActions — exhaustive", () => {
  it("totalImpact sums all items' impactScore", () => {
    const items = [
      makeItem({ store: "T1", impactScore: 100 }),
      makeItem({ store: "T1", impactScore: 200 }),
      makeItem({ store: "T1", impactScore: 300 }),
    ];
    const [group] = groupActions(items, "store");
    expect(group.totalImpact).toBe(600);
  });

  it("totalUnits sums all items' suggestedUnits", () => {
    const items = [
      makeItem({ store: "T1", suggestedUnits: 5 }),
      makeItem({ store: "T1", suggestedUnits: 15 }),
    ];
    const [group] = groupActions(items, "store");
    expect(group.totalUnits).toBe(20);
  });

  it("paretoCount counts items with paretoFlag=true", () => {
    const items = [
      makeItem({ store: "T1", paretoFlag: true }),
      makeItem({ store: "T1", paretoFlag: true }),
      makeItem({ store: "T1", paretoFlag: false }),
    ];
    const [group] = groupActions(items, "store");
    expect(group.paretoCount).toBe(2);
  });

  it("label equals key", () => {
    const items = [makeItem({ store: "CERROALTO" })];
    const [group] = groupActions(items, "store");
    expect(group.label).toBe(group.key);
  });

  it("single item group has correct counts", () => {
    const items = [makeItem({ store: "T1", risk: "overstock" as RiskLevel })];
    const [group] = groupActions(items, "store");
    expect(group.totalActions).toBe(1);
    expect(group.overstockCount).toBe(1);
    expect(group.criticalCount).toBe(0);
    expect(group.lowCount).toBe(0);
  });

  it("brand grouping with many brands sorts by impact", () => {
    const items = [
      makeItem({ brand: "Lee", impactScore: 100 }),
      makeItem({ brand: "Wrangler", impactScore: 500 }),
      makeItem({ brand: "Martel", impactScore: 300 }),
    ];
    const groups = groupActions(items, "brand");
    expect(groups[0].key).toBe("Wrangler");
    expect(groups[1].key).toBe("Martel");
    expect(groups[2].key).toBe("Lee");
  });

  it("store group cluster is null for unknown stores", () => {
    const items = [makeItem({ store: "UNKNOWN_STORE_XYZ" })];
    const [group] = groupActions(items, "store");
    expect(group.cluster).toBeNull();
  });

  it("store group assortmentCapacity from STORE_ASSORTMENT", () => {
    const items = [makeItem({ store: "MARTELMCAL" })];
    const [group] = groupActions(items, "store");
    expect(group.assortmentCapacity).toBe(5500);
  });

  it("items array in group contains all original items", () => {
    const items = [
      makeItem({ store: "T1", sku: "A" }),
      makeItem({ store: "T1", sku: "B" }),
    ];
    const [group] = groupActions(items, "store");
    expect(group.items).toHaveLength(2);
    expect(group.items[0]).toBe(items[0]);
    expect(group.items[1]).toBe(items[1]);
  });

  it("sections within group are properly split", () => {
    const items = [
      makeItem({ store: "T1", actionType: "transfer" as ActionType, risk: "critical" as RiskLevel }),
      makeItem({ store: "T1", actionType: "restock_from_depot" as ActionType, risk: "low" as RiskLevel }),
      makeItem({ store: "T1", actionType: "transfer" as ActionType, risk: "overstock" as RiskLevel }),
    ];
    const [group] = groupActions(items, "store");
    // Should have: receive_transfer, receive_depot, redistribute
    expect(group.sections.length).toBe(3);
  });

  it("balanced risk items counted correctly (no dedicated counter)", () => {
    const items = [
      makeItem({ store: "T1", risk: "balanced" as RiskLevel }),
    ];
    const [group] = groupActions(items, "store");
    expect(group.criticalCount).toBe(0);
    expect(group.lowCount).toBe(0);
    expect(group.overstockCount).toBe(0);
    expect(group.totalActions).toBe(1);
  });
});
