import { describe, it, expect } from "vitest";
import { buildEventDecisionPayload } from "../closedLoop";
import type { AllocationLine, AllocationProposal, EventInventoryRow } from "../types";

const inv = (rows: Partial<EventInventoryRow>[]): EventInventoryRow[] =>
  rows.map((r) => ({
    sku: "X", skuComercial: "MARTEL01", talle: "M", brand: "Martel",
    store: "T1", units: 1, price: 100_000, ...r,
  }));

const line = (overrides: Partial<AllocationLine>): AllocationLine => ({
  sku: "X1", skuComercial: "A", talle: "S", brand: "Martel",
  fromStore: "T_OTHER", toStore: "T_EVT", units: 3,
  reason: "missing_size", estimatedRevenue: 300_000,
  ...overrides,
});

const proposal = (lines: AllocationLine[], over: Partial<AllocationProposal> = {}): AllocationProposal => ({
  id: "p-1",
  eventId: "ev-1",
  version: 1,
  status: "draft",
  generatedAt: "2026-04-28T00:00:00Z",
  generatedBy: null,
  configVersionId: null,
  payload: lines,
  totalLines: lines.length,
  totalUnits: lines.reduce((s, l) => s + l.units, 0),
  readinessPct: null,
  notes: null,
  approvedAt: null,
  approvedBy: null,
  ...over,
});

describe("buildEventDecisionPayload — run summary", () => {
  it("builds a run with event_allocation type and totals from lines", () => {
    const result = buildEventDecisionPayload({
      proposal: proposal([line({ units: 3 }), line({ talle: "M", units: 5, estimatedRevenue: 500_000 })]),
      eventId: "ev-1",
      inventory: [],
      approverId: "user-1",
      readinessPctAtApproval: 62.5,
    });
    expect(result.run.runType).toBe("event_allocation");
    expect(result.run.triggeredBy).toBe("user-1");
    expect(result.run.totalActions).toBe(2);
    expect(result.run.totalImpactGs).toBe(800_000);
    expect(result.run.metadata.readinessPctAtApproval).toBe(62.5);
    expect(result.run.filtersSnapshot.eventId).toBe("ev-1");
    expect(result.run.filtersSnapshot.proposalId).toBe("p-1");
    expect(result.run.filtersSnapshot.proposalVersion).toBe(1);
  });

  it("counts critical actions (out_of_stock)", () => {
    const result = buildEventDecisionPayload({
      proposal: proposal([
        line({ reason: "missing_size" }),
        line({ reason: "out_of_stock", units: 0 }),
        line({ reason: "out_of_stock", units: 0 }),
      ]),
      eventId: "ev-1",
      inventory: [],
      approverId: "u",
      readinessPctAtApproval: null,
    });
    expect(result.run.criticalCount).toBe(2);
  });
});

describe("buildEventDecisionPayload — action mapping", () => {
  it("maps reason → waterfall_level + action_type", () => {
    const result = buildEventDecisionPayload({
      proposal: proposal([
        line({ reason: "transfer_from_store" }),
        line({ talle: "M", reason: "missing_size" }),
        line({ talle: "L", reason: "restock_from_depot", fromStore: "STOCK" }),
        line({ talle: "XL", reason: "out_of_stock", fromStore: null, units: 0 }),
      ]),
      eventId: "ev-1",
      inventory: [],
      approverId: "u",
      readinessPctAtApproval: null,
    });
    const [a, b, c, d] = result.actions;
    expect(a.waterfallLevel).toBe("store_to_store");
    expect(a.actionType).toBe("transfer");
    expect(b.waterfallLevel).toBe("store_to_store");
    expect(c.waterfallLevel).toBe("depot_to_store");
    expect(c.actionType).toBe("restock_from_depot");
    expect(d.waterfallLevel).toBe("central_to_depot");
    expect(d.actionType).toBe("resupply_depot");
    expect(d.risk).toBe("critical");
    expect(d.targetStore).toBeNull();
  });

  it("includes snapshot of currentStock at approval time", () => {
    const result = buildEventDecisionPayload({
      proposal: proposal([
        line({ skuComercial: "A", talle: "S", toStore: "T_EVT", units: 5 }),
      ]),
      eventId: "ev-1",
      inventory: inv([
        { skuComercial: "A", talle: "S", store: "T_EVT", units: 2 },
        { skuComercial: "A", talle: "S", store: "OTHER", units: 999 },
      ]),
      approverId: "u",
      readinessPctAtApproval: null,
    });
    expect(result.actions[0].currentStock).toBe(2);
  });

  it("currentStock is 0 when toStore has no rows for that sku/talle", () => {
    const result = buildEventDecisionPayload({
      proposal: proposal([line({ toStore: "EMPTY_STORE" })]),
      eventId: "ev-1",
      inventory: [],
      approverId: "u",
      readinessPctAtApproval: null,
    });
    expect(result.actions[0].currentStock).toBe(0);
  });

  it("rank starts at 1 and is sequential", () => {
    const result = buildEventDecisionPayload({
      proposal: proposal([line({}), line({ talle: "M" }), line({ talle: "L" })]),
      eventId: "ev-1",
      inventory: [],
      approverId: "u",
      readinessPctAtApproval: null,
    });
    expect(result.actions.map((a) => a.rank)).toEqual([1, 2, 3]);
  });

  it("status is always 'approved' (skips pending)", () => {
    const result = buildEventDecisionPayload({
      proposal: proposal([line({})]),
      eventId: "ev-1",
      inventory: [],
      approverId: "u",
      readinessPctAtApproval: null,
    });
    expect(result.actions[0].status).toBe("approved");
  });

  it("FK fields point to event and proposal", () => {
    const result = buildEventDecisionPayload({
      proposal: proposal([line({})], { id: "prop-xyz" }),
      eventId: "ev-abc",
      inventory: [],
      approverId: "u",
      readinessPctAtApproval: null,
    });
    expect(result.actions[0].calendarEventId).toBe("ev-abc");
    expect(result.actions[0].allocationProposalId).toBe("prop-xyz");
  });

  it("recommendedAction has 'sin origen' label when fromStore is null", () => {
    const result = buildEventDecisionPayload({
      proposal: proposal([line({ fromStore: null, reason: "out_of_stock", units: 0 })]),
      eventId: "ev-1",
      inventory: [],
      approverId: "u",
      readinessPctAtApproval: null,
    });
    expect(result.actions[0].recommendedAction).toContain("sin origen");
  });
});
